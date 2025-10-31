const express = require('express');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Profile fetch error:', error);
      return res.status(500).json({ 
        message: 'Failed to fetch profile',
        code: 'FETCH_ERROR'
      });
    }

    const userProfile = {
      id: req.user.id,
      email: req.user.email,
      name: profile?.name || req.user.user_metadata?.name || '',
      avatar_url: profile?.avatar_url || req.user.user_metadata?.avatar_url || '',
      theme: profile?.theme || 'light',
      created_at: profile?.created_at || req.user.created_at
    };

    res.json(userProfile);

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', [
  auth,
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('theme').optional().isIn(['light', 'dark']).withMessage('Theme must be light or dark')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, avatar_url, theme } = req.body;

    // Prepare update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
    if (theme !== undefined) updateData.theme = theme;
    updateData.updated_at = new Date().toISOString();

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', req.userId)
      .single();

    let profile;

    if (existingProfile) {
      // Update existing profile
      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', req.userId)
        .select()
        .single();

      if (error) {
        console.error('Profile update error:', error);
        return res.status(500).json({ 
          message: 'Failed to update profile',
          code: 'UPDATE_ERROR'
        });
      }

      profile = updatedProfile;
    } else {
      // Create new profile
      const profileData = {
        id: req.userId,
        email: req.user.email,
        ...updateData,
        created_at: new Date().toISOString()
      };

      const { data: newProfile, error } = await supabase
        .from('profiles')
        .insert([profileData])
        .select()
        .single();

      if (error) {
        console.error('Profile creation error:', error);
        return res.status(500).json({ 
          message: 'Failed to create profile',
          code: 'CREATE_ERROR'
        });
      }

      profile = newProfile;
    }

    res.json(profile);

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// @route   GET /api/users/dashboard
// @desc    Get user dashboard data
// @access  Private
router.get('/dashboard', auth, async (req, res) => {
  try {
    // Get total habits count
    const { data: habits, error: habitsError } = await supabase
      .from('habits')
      .select('id, is_active, current_streak, total_completions')
      .eq('user_id', req.userId);

    if (habitsError) {
      console.error('Habits fetch error:', habitsError);
      return res.status(500).json({ 
        message: 'Failed to fetch habits',
        code: 'FETCH_ERROR'
      });
    }

    // Get today's progress
    const today = new Date().toISOString().split('T')[0];
    const { data: todayProgress, error: progressError } = await supabase
      .from('progress')
      .select('completed')
      .eq('user_id', req.userId)
      .eq('date', today);

    if (progressError) {
      console.error('Progress fetch error:', progressError);
      return res.status(500).json({ 
        message: 'Failed to fetch progress',
        code: 'FETCH_ERROR'
      });
    }

    // Calculate statistics
    const totalHabits = habits.length;
    const activeHabits = habits.filter(h => h.is_active).length;
    const completedToday = todayProgress.filter(p => p.completed).length;
    const totalCompletions = habits.reduce((sum, h) => sum + (h.total_completions || 0), 0);
    const longestStreak = Math.max(...habits.map(h => h.current_streak || 0), 0);

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = sevenDaysAgo.toISOString().split('T')[0];

    const { data: recentActivity, error: activityError } = await supabase
      .from('progress')
      .select('date, completed')
      .eq('user_id', req.userId)
      .gte('date', startDate)
      .order('date', { ascending: true });

    if (activityError) {
      console.error('Activity fetch error:', activityError);
    }

    const dashboardData = {
      totalHabits,
      activeHabits,
      completedToday,
      totalCompletions,
      longestStreak,
      recentActivity: recentActivity || []
    };

    res.json(dashboardData);

  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// @route   DELETE /api/users/account
// @desc    Delete user account
// @access  Private
router.delete('/account', auth, async (req, res) => {
  try {
    // Delete user's progress
    await supabase
      .from('progress')
      .delete()
      .eq('user_id', req.userId);

    // Delete user's habits
    await supabase
      .from('habits')
      .delete()
      .eq('user_id', req.userId);

    // Delete user's profile
    await supabase
      .from('profiles')
      .delete()
      .eq('id', req.userId);

    // Delete user from auth
    const { error } = await supabase.auth.admin.deleteUser(req.userId);

    if (error) {
      console.error('User deletion error:', error);
      return res.status(500).json({ 
        message: 'Failed to delete account',
        code: 'DELETE_ERROR'
      });
    }

    res.json({ message: 'Account deleted successfully' });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

module.exports = router;