const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { clearAuthCookie, setAuthCookie } = require('../utils/authCookie');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { error: 'Too many attempts, please try again later' }
});

const generateToken = (user) => {
  return jwt.sign(
    { userId: user._id, email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const sendAuthResponse = (res, statusCode, message, user, token, extra = {}) => {
  setAuthCookie(res, token);
  return res.status(statusCode).json({
    message,
    user,
    ...extra
  });
};

// POST /api/auth/register
router.post('/register', authLimiter, [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 50 }),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { name, email, password } = req.body;

    // Check if DB is connected
    if (!User.db || User.db.readyState !== 1) {
      // Demo mode: create fake token
      const fakeUser = { _id: 'demo_' + Date.now(), name, email, role: 'user' };
      const token = generateToken(fakeUser);
      return sendAuthResponse(
        res,
        201,
        'Demo mode: User registered (no DB)',
        { name, email, role: 'user', storageUsed: 0, storageLimit: 1073741824 },
        token
      );
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = await User.create({ name, email, password });
    const token = generateToken(user);

    return sendAuthResponse(
      res,
      201,
      'Registration successful',
      {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        storageUsed: user.storageUsed,
        storageLimit: user.storageLimit
      },
      token
    );
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const { email, password } = req.body;

    // Demo mode
    if (!User.db || User.db.readyState !== 1) {
      const fakeUser = { _id: 'demo_user', name: 'Demo User', email, role: 'user' };
      const token = generateToken(fakeUser);
      return sendAuthResponse(
        res,
        200,
        'Demo login successful',
        { id: 'demo_user', name: 'Demo User', email, role: 'user', storageUsed: 0, storageLimit: 1073741824 },
        token
      );
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user);

    return sendAuthResponse(
      res,
      200,
      'Login successful',
      {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        storageUsed: user.storageUsed,
        storageLimit: user.storageLimit,
        lastLogin: user.lastLogin
      },
      token
    );
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ message: 'Logout successful' });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    // Demo mode
    if (!User.db || User.db.readyState !== 1) {
      return res.json({ user: req.user });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        storageUsed: user.storageUsed,
        storageLimit: user.storageLimit,
        storagePercent: user.storagePercent,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/auth/profile
router.put('/profile', authenticate, [
  body('name').optional().trim().notEmpty().isLength({ max: 50 })
], async (req, res, next) => {
  try {
    if (!User.db || User.db.readyState !== 1) {
      return res.json({ message: 'Demo mode: Profile update simulated', user: req.user });
    }

    const { name } = req.body;
    const updates = {};
    if (name) updates.name = name;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json({ message: 'Profile updated', user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
