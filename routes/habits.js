const express = require('express');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/habits
// @desc    Get all habits for authenticated user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { active, category, sort } = req.query;
    
    let query = supabase
      .from('habits')
      .select('*')
      .eq('user_id', req.userId);

    // Filter by active status
    if (active !== undefined) {
      query = query.eq('is_active', active === 'true');
    }

    // Filter by category
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    // Apply sorting
    if (sort === 'name') {
      query = query.order('name', { ascending: true });
    } else if (sort === 'streak') {
      query = query.order('current_streak', { ascending: false });
    } else if (sort === 'created') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data: habits, error } = await query;

    if (error) {
      console.error('Habits fetch error:', error);
      return res.status(500).json({ 
        message: 'Failed to fetch habits',
        code: 'FETCH_ERROR'
      });
    }

    res.json(habits || []);

  } catch (error) {
    console.error('Get habits error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// @route   POST /api/habits
// @desc    Create a new habit
// @access  Private
router.post('/', [
  auth,
  body('name').trim().isLength({ min: 1 }).withMessage('Habit name is required'),
  body('category').optional().trim(),
  body('emoji').optional().trim(),
  body('color').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, description, emoji, category, color } = req.body;

    const habitData = {
      user_id: req.userId,
      name: name.trim(),
      description: description?.trim() || '',
      emoji: emoji || '✅',
      category: category?.trim() || 'General',
      color: color || '#3B82F6',
      is_active: true,
      current_streak: 0,
      longest_streak: 0,
      total_completions: 0,
      created_at: new Date().toISOString()
    };

    const { data: habit, error } = await supabase
      .from('habits')
      .insert([habitData])
      .select()
      .single();

    if (error) {
      console.error('Habit creation error:', error);
      return res.status(500).json({ 
        message: 'Failed to create habit',
        code: 'CREATE_ERROR'
      });
    }

    res.status(201).json(habit);

  } catch (error) {
    console.error('Create habit error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// @route   PUT /api/habits/:id
// @desc    Update a habit
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, emoji, category, color, is_active } = req.body;
    const habitId = req.params.id;

    // Check if habit belongs to user
    const { data: existingHabit, error: fetchError } = await supabase
      .from('habits')
      .select('*')
      .eq('id', habitId)
      .eq('user_id', req.userId)
      .single();

    if (fetchError || !existingHabit) {
      return res.status(404).json({ 
        message: 'Habit not found',
        code: 'NOT_FOUND'
      });
    }

    // Prepare update data
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (emoji !== undefined) updateData.emoji = emoji;
    if (category !== undefined) updateData.category = category.trim();
    if (color !== undefined) updateData.color = color;
    if (is_active !== undefined) updateData.is_active = is_active;
    updateData.updated_at = new Date().toISOString();

    const { data: habit, error } = await supabase
      .from('habits')
      .update(updateData)
      .eq('id', habitId)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) {
      console.error('Habit update error:', error);
      return res.status(500).json({ 
        message: 'Failed to update habit',
        code: 'UPDATE_ERROR'
      });
    }

    res.json(habit);

  } catch (error) {
    console.error('Update habit error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// @route   DELETE /api/habits/:id
// @desc    Delete a habit
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const habitId = req.params.id;

    // Check if habit belongs to user
    const { data: existingHabit, error: fetchError } = await supabase
      .from('habits')
      .select('id')
      .eq('id', habitId)
      .eq('user_id', req.userId)
      .single();

    if (fetchError || !existingHabit) {
      return res.status(404).json({ 
        message: 'Habit not found',
        code: 'NOT_FOUND'
      });
    }

    // Delete all progress entries for this habit
    await supabase
      .from('progress')
      .delete()
      .eq('habit_id', habitId)
      .eq('user_id', req.userId);

    // Delete the habit
    const { error } = await supabase
      .from('habits')
      .delete()
      .eq('id', habitId)
      .eq('user_id', req.userId);

    if (error) {
      console.error('Habit deletion error:', error);
      return res.status(500).json({ 
        message: 'Failed to delete habit',
        code: 'DELETE_ERROR'
      });
    }

    res.json({ message: 'Habit deleted successfully' });

  } catch (error) {
    console.error('Delete habit error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// @route   GET /api/habits/categories
// @desc    Get all categories for user
// @access  Private
router.get('/categories', auth, async (req, res) => {
  try {
    const { data: habits, error } = await supabase
      .from('habits')
      .select('category')
      .eq('user_id', req.userId);

    if (error) {
      console.error('Categories fetch error:', error);
      return res.status(500).json({ 
        message: 'Failed to fetch categories',
        code: 'FETCH_ERROR'
      });
    }

    // Extract unique categories
    const categories = [...new Set(habits.map(h => h.category))].filter(Boolean);

    res.json(categories);

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

module.exports = router;