const express = require('express');
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/share/stats
// @desc    Get shareable stats for user
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', req.userId)
      .single();

    // Get habits with streaks
    const { data: habits, error: habitsError } = await supabase
      .from('habits')
      .select('name, emoji, current_streak, longest_streak, total_completions')
      .eq('user_id', req.userId)
      .eq('is_active', true)
      .order('current_streak', { ascending: false });

    if (habitsError) {
      console.error('Habits fetch error:', habitsError);
      return res.status(500).json({ 
        message: 'Failed to fetch habits',
        code: 'FETCH_ERROR'
      });
    }

    // Calculate overall stats
    const totalHabits = habits.length;
    const totalCompletions = habits.reduce((sum, h) => sum + (h.total_completions || 0), 0);
    const longestStreak = Math.max(...habits.map(h => h.longest_streak || 0), 0);
    const currentStreaks = habits.map(h => h.current_streak || 0);
    const averageStreak = currentStreaks.length > 0 
      ? Math.round(currentStreaks.reduce((sum, s) => sum + s, 0) / currentStreaks.length)
      : 0;

    // Get recent activity for the chart (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];

    const { data: recentActivity, error: activityError } = await supabase
      .from('progress')
      .select('date, completed')
      .eq('user_id', req.userId)
      .gte('date', startDate)
      .order('date', { ascending: true });

    if (activityError) {
      console.error('Activity fetch error:', activityError);
    }

    // Group activity by date
    const activityByDate = {};
    if (recentActivity) {
      recentActivity.forEach(activity => {
        if (!activityByDate[activity.date]) {
          activityByDate[activity.date] = { completed: 0, total: 0 };
        }
        activityByDate[activity.date].total++;
        if (activity.completed) {
          activityByDate[activity.date].completed++;
        }
      });
    }

    const shareableStats = {
      user: {
        name: profile?.name || 'Anonymous',
        avatar_url: profile?.avatar_url || ''
      },
      stats: {
        totalHabits,
        totalCompletions,
        longestStreak,
        averageStreak
      },
      topHabits: habits.slice(0, 5).map(h => ({
        name: h.name,
        emoji: h.emoji,
        currentStreak: h.current_streak,
        longestStreak: h.longest_streak
      })),
      activityChart: activityByDate,
      generatedAt: new Date().toISOString()
    };

    res.json(shareableStats);

  } catch (error) {
    console.error('Get shareable stats error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// @route   POST /api/share/create
// @desc    Create a shareable link
// @access  Private
router.post('/create', auth, async (req, res) => {
  try {
    const { title, description, includeStats, includeHabits } = req.body;

    // Generate a unique share ID
    const shareId = `${req.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get data to share based on preferences
    let shareData = {
      user_id: req.userId,
      share_id: shareId,
      title: title || 'My Habit Progress',
      description: description || '',
      include_stats: includeStats !== false,
      include_habits: includeHabits !== false,
      created_at: new Date().toISOString(),
      expires_at: null // No expiration by default
    };

    if (includeStats) {
      // Get basic stats
      const { data: habits } = await supabase
        .from('habits')
        .select('current_streak, longest_streak, total_completions')
        .eq('user_id', req.userId)
        .eq('is_active', true);

      if (habits) {
        shareData.stats = {
          totalHabits: habits.length,
          totalCompletions: habits.reduce((sum, h) => sum + (h.total_completions || 0), 0),
          longestStreak: Math.max(...habits.map(h => h.longest_streak || 0), 0)
        };
      }
    }

    if (includeHabits) {
      // Get top habits
      const { data: topHabits } = await supabase
        .from('habits')
        .select('name, emoji, current_streak')
        .eq('user_id', req.userId)
        .eq('is_active', true)
        .order('current_streak', { ascending: false })
        .limit(5);

      if (topHabits) {
        shareData.habits = topHabits;
      }
    }

    // Store shareable data
    const { data: shareRecord, error } = await supabase
      .from('shared_progress')
      .insert([shareData])
      .select()
      .single();

    if (error) {
      console.error('Share creation error:', error);
      return res.status(500).json({ 
        message: 'Failed to create shareable link',
        code: 'CREATE_ERROR'
      });
    }

    const shareUrl = `${process.env.CLIENT_URL}/share/${shareId}`;

    res.status(201).json({
      shareId,
      shareUrl,
      shareRecord
    });

  } catch (error) {
    console.error('Create share error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// @route   GET /api/share/:shareId
// @desc    Get shared progress data
// @access  Public
router.get('/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;

    const { data: shareRecord, error } = await supabase
      .from('shared_progress')
      .select('*')
      .eq('share_id', shareId)
      .single();

    if (error || !shareRecord) {
      return res.status(404).json({ 
        message: 'Shared progress not found',
        code: 'NOT_FOUND'
      });
    }

    // Check if expired
    if (shareRecord.expires_at && new Date(shareRecord.expires_at) < new Date()) {
      return res.status(410).json({ 
        message: 'Shared progress has expired',
        code: 'EXPIRED'
      });
    }

    // Get user profile for display
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', shareRecord.user_id)
      .single();

    const responseData = {
      title: shareRecord.title,
      description: shareRecord.description,
      user: {
        name: profile?.name || 'Anonymous User',
        avatar_url: profile?.avatar_url || ''
      },
      createdAt: shareRecord.created_at
    };

    if (shareRecord.include_stats && shareRecord.stats) {
      responseData.stats = shareRecord.stats;
    }

    if (shareRecord.include_habits && shareRecord.habits) {
      responseData.habits = shareRecord.habits;
    }

    res.json(responseData);

  } catch (error) {
    console.error('Get shared progress error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// @route   GET /api/share/user/links
// @desc    Get user's shared links
// @access  Private
router.get('/user/links', auth, async (req, res) => {
  try {
    const { data: sharedLinks, error } = await supabase
      .from('shared_progress')
      .select('share_id, title, description, created_at, expires_at')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Shared links fetch error:', error);
      return res.status(500).json({ 
        message: 'Failed to fetch shared links',
        code: 'FETCH_ERROR'
      });
    }

    const linksWithUrls = sharedLinks.map(link => ({
      ...link,
      shareUrl: `${process.env.CLIENT_URL}/share/${link.share_id}`
    }));

    res.json(linksWithUrls);

  } catch (error) {
    console.error('Get user shared links error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// @route   DELETE /api/share/:shareId
// @desc    Delete a shared link
// @access  Private
router.delete('/:shareId', auth, async (req, res) => {
  try {
    const { shareId } = req.params;

    const { error } = await supabase
      .from('shared_progress')
      .delete()
      .eq('share_id', shareId)
      .eq('user_id', req.userId);

    if (error) {
      console.error('Share deletion error:', error);
      return res.status(500).json({ 
        message: 'Failed to delete shared link',
        code: 'DELETE_ERROR'
      });
    }

    res.json({ message: 'Shared link deleted successfully' });

  } catch (error) {
    console.error('Delete share error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

module.exports = router;