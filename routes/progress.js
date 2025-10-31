const express = require('express');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');

const router = express.Router();

// Helper function to calculate streaks
const calculateStreaks = async (habitId, userId) => {
  try {
    const { data: progress, error } = await supabase
      .from('progress')
      .select('date, completed')
      .eq('habit_id', habitId)
      .eq('user_id', userId)
      .eq('completed', true)
      .order('date', { ascending: false });

    if (error || !progress || progress.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Calculate current streak
    for (let i = 0; i < progress.length; i++) {
      const progressDate = new Date(progress[i].date);
      progressDate.setHours(0, 0, 0, 0);
      
      const daysDiff = Math.floor((today - progressDate) / (1000 * 60 * 60 * 24));
      
      if (i === 0 && (daysDiff === 0 || daysDiff === 1)) {
        currentStreak = 1;
      } else if (i > 0) {
        const prevDate = new Date(progress[i - 1].date);
        prevDate.setHours(0, 0, 0, 0);
        const prevDaysDiff = Math.floor((prevDate - progressDate) / (1000 * 60 * 60 * 24));
        
        if (prevDaysDiff === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Calculate longest streak
    tempStreak = 1;
    longestStreak = 1;
    
    for (let i = 1; i < progress.length; i++) {
      const currentDate = new Date(progress[i].date);
      const prevDate = new Date(progress[i - 1].date);
      const daysDiff = Math.floor((prevDate - currentDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 1;
      }
    }

    return { currentStreak, longestStreak };
  } catch (error) {
    console.error('Calculate streaks error:', error);
    return { currentStreak: 0, longestStreak: 0 };
  }
};

// @route   GET /api/progress
// @desc    Get progress for date range
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { startDate, endDate, habitId } = req.query;
    
    let query = supabase
      .from('progress')
      .select(`
        *,
        habits (
          id,
          name,
          emoji,
          color,
          category
        )
      `)
      .eq('user_id', req.userId);
    
    if (habitId) {
      query = query.eq('habit_id', habitId);
    }
    
    if (startDate && endDate) {
      query = query
        .gte('date', startDate)
        .lte('date', endDate);
    }

    query = query.order('date', { ascending: false });

    const { data: progress, error } = await query;

    if (error) {
      console.error('Progress fetch error:', error);
      return res.status(500).json({ 
        message: 'Failed to fetch progress',
        code: 'FETCH_ERROR'
      });
    }

    res.json(progress || []);

  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// @route   POST /api/progress/toggle
// @desc    Toggle habit completion for a date
// @access  Private
router.post('/toggle', [
  auth,
  body('habitId').isUUID().withMessage('Valid habit ID is required'),
  body('date').isISO8601().withMessage('Valid date is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { habitId, date, notes } = req.body;
    
    // Verify habit belongs to user
    const { data: habit, error: habitError } = await supabase
      .from('habits')
      .select('id')
      .eq('id', habitId)
      .eq('user_id', req.userId)
      .single();

    if (habitError || !habit) {
      return res.status(404).json({ 
        message: 'Habit not found',
        code: 'NOT_FOUND'
      });
    }

    const progressDate = new Date(date);
    progressDate.setHours(0, 0, 0, 0);
    const dateString = progressDate.toISOString().split('T')[0];

    // Find existing progress entry
    const { data: existingProgress, error: fetchError } = await supabase
      .from('progress')
      .select('*')
      .eq('user_id', req.userId)
      .eq('habit_id', habitId)
      .eq('date', dateString)
      .single();

    let progress;

    if (existingProgress && !fetchError) {
      // Toggle existing progress
      const { data: updatedProgress, error: updateError } = await supabase
        .from('progress')
        .update({
          completed: !existingProgress.completed,
          notes: notes !== undefined ? notes : existingProgress.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingProgress.id)
        .select()
        .single();

      if (updateError) {
        console.error('Progress update error:', updateError);
        return res.status(500).json({ 
          message: 'Failed to update progress',
          code: 'UPDATE_ERROR'
        });
      }

      progress = updatedProgress;
    } else {
      // Create new progress entry
      const { data: newProgress, error: createError } = await supabase
        .from('progress')
        .insert([{
          user_id: req.userId,
          habit_id: habitId,
          date: dateString,
          completed: true,
          notes: notes || '',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (createError) {
        console.error('Progress creation error:', createError);
        return res.status(500).json({ 
          message: 'Failed to create progress',
          code: 'CREATE_ERROR'
        });
      }

      progress = newProgress;
    }

    // Update habit streaks and total completions
    const { currentStreak, longestStreak } = await calculateStreaks(habitId, req.userId);
    
    const { data: completionCount } = await supabase
      .from('progress')
      .select('id', { count: 'exact' })
      .eq('habit_id', habitId)
      .eq('user_id', req.userId)
      .eq('completed', true);

    const totalCompletions = completionCount?.length || 0;

    await supabase
      .from('habits')
      .update({
        current_streak: currentStreak,
        longest_streak: longestStreak,
        total_completions: totalCompletions,
        updated_at: new Date().toISOString()
      })
      .eq('id', habitId)
      .eq('user_id', req.userId);

    res.json(progress);

  } catch (error) {
    console.error('Toggle progress error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// @route   GET /api/progress/today
// @desc    Get today's progress for all habits
// @access  Private
router.get('/today', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayString = today.toISOString().split('T')[0];

    // Get all active habits
    const { data: habits, error: habitsError } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', req.userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (habitsError) {
      console.error('Habits fetch error:', habitsError);
      return res.status(500).json({ 
        message: 'Failed to fetch habits',
        code: 'FETCH_ERROR'
      });
    }

    // Get today's progress
    const { data: progress, error: progressError } = await supabase
      .from('progress')
      .select('*')
      .eq('user_id', req.userId)
      .eq('date', todayString);

    if (progressError) {
      console.error('Progress fetch error:', progressError);
      return res.status(500).json({ 
        message: 'Failed to fetch progress',
        code: 'FETCH_ERROR'
      });
    }

    // Combine habits with their progress
    const todayProgress = habits.map(habit => {
      const habitProgress = progress.find(p => p.habit_id === habit.id);
      return {
        habit,
        completed: habitProgress ? habitProgress.completed : false,
        notes: habitProgress ? habitProgress.notes : '',
        progressId: habitProgress ? habitProgress.id : null
      };
    });

    res.json(todayProgress);

  } catch (error) {
    console.error('Get today progress error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// @route   GET /api/progress/stats
// @desc    Get progress statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const { habitId, days = 30 } = req.query;
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const endDateString = endDate.toISOString().split('T')[0];
    const startDateString = startDate.toISOString().split('T')[0];

    let query = supabase
      .from('progress')
      .select('*')
      .eq('user_id', req.userId)
      .gte('date', startDateString)
      .lte('date', endDateString);

    if (habitId) {
      query = query.eq('habit_id', habitId);
    }

    const { data: progress, error } = await query;

    if (error) {
      console.error('Stats fetch error:', error);
      return res.status(500).json({ 
        message: 'Failed to fetch statistics',
        code: 'FETCH_ERROR'
      });
    }

    const completedDays = progress.filter(p => p.completed).length;
    const totalDays = parseInt(days);
    const completionRate = totalDays > 0 ? (completedDays / totalDays) * 100 : 0;

    res.json({
      completedDays,
      totalDays,
      completionRate: Math.round(completionRate * 100) / 100,
      missedDays: totalDays - completedDays
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// @route   GET /api/progress/calendar/:year/:month
// @desc    Get calendar view for specific month
// @access  Private
router.get('/calendar/:year/:month', auth, async (req, res) => {
  try {
    const { year, month } = req.params;
    const { habitId } = req.query;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const startDateString = startDate.toISOString().split('T')[0];
    const endDateString = endDate.toISOString().split('T')[0];

    let query = supabase
      .from('progress')
      .select(`
        *,
        habits (
          id,
          name,
          emoji,
          color
        )
      `)
      .eq('user_id', req.userId)
      .gte('date', startDateString)
      .lte('date', endDateString);

    if (habitId) {
      query = query.eq('habit_id', habitId);
    }

    const { data: progress, error } = await query;

    if (error) {
      console.error('Calendar fetch error:', error);
      return res.status(500).json({ 
        message: 'Failed to fetch calendar data',
        code: 'FETCH_ERROR'
      });
    }

    res.json(progress || []);

  } catch (error) {
    console.error('Get calendar error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

module.exports = router;