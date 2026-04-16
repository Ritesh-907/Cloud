// Full-text search
const express = require('express');
const { authenticate } = require('../middleware/auth');
const File = require('../models/File');
const User = require('../models/User');

const router = express.Router();
const dbReady = () => User.db && User.db.readyState === 1;

// GET /api/search?q=query
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { q, type, minSize, maxSize, from, to } = req.query;
    if (!q?.trim()) return res.status(400).json({ error: 'Search query required' });

    if (!dbReady()) {
      return res.json({ results: [], total: 0 });
    }

    const query = {
      owner: req.user._id,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } }
      ]
    };

    if (type) query.mimeType = { $regex: new RegExp(`^${type}/`, 'i') };
    if (minSize) query.size = { ...query.size, $gte: parseInt(minSize) };
    if (maxSize) query.size = { ...query.size, $lte: parseInt(maxSize) };
    if (from) query.createdAt = { ...query.createdAt, $gte: new Date(from) };
    if (to) query.createdAt = { ...query.createdAt, $lte: new Date(to) };

    const results = await File.find(query).sort({ createdAt: -1 }).limit(50).populate('folder', 'name');
    res.json({ results, total: results.length, query: q });
  } catch (error) {
    next(error);
  }
});

module.exports = router;