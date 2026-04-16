// Folder CRUD
const express = require('express');
const { authenticate } = require('../middleware/auth');
const Folder = require('../models/Folder');
const File = require('../models/File');
const User = require('../models/User');

const router = express.Router();
const dbReady = () => User.db && User.db.readyState === 1;
const demoFolders = [];

// GET /api/folders - List folders
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { parent = null } = req.query;
    if (!dbReady()) {
      return res.json({ folders: demoFolders.filter(f => f.owner === (req.user._id || 'demo_user')) });
    }

    const query = { owner: req.user._id };
    if (parent !== 'null') query.parent = parent || null;

    const folders = await Folder.find(query).sort({ name: 1 });
    res.json({ folders });
  } catch (error) {
    next(error);
  }
});

// POST /api/folders - Create folder
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { name, parentId = null, color = '#6366f1', description = '' } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Folder name required' });

    if (!dbReady()) {
      const folder = {
        _id: 'folder_' + Date.now(),
        name,
        owner: req.user._id || 'demo_user',
        parent: parentId,
        color,
        description,
        createdAt: new Date()
      };
      demoFolders.push(folder);
      return res.status(201).json({ folder });
    }

    const folder = await Folder.create({
      name: name.trim(),
      owner: req.user._id,
      parent: parentId || null,
      color,
      description
    });

    res.status(201).json({ folder });
  } catch (error) {
    next(error);
  }
});

// GET /api/folders/:id - Get folder with contents
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    if (!dbReady()) {
      const folder = demoFolders.find(f => f._id === req.params.id);
      if (!folder) return res.status(404).json({ error: 'Folder not found' });
      return res.json({ folder, files: [], subfolders: [] });
    }

    const [folder, files, subfolders] = await Promise.all([
      Folder.findOne({ _id: req.params.id, owner: req.user._id }),
      File.find({ owner: req.user._id, folder: req.params.id }).sort({ createdAt: -1 }),
      Folder.find({ owner: req.user._id, parent: req.params.id }).sort({ name: 1 })
    ]);

    if (!folder) return res.status(404).json({ error: 'Folder not found' });
    res.json({ folder, files, subfolders });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/folders/:id - Update folder
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const { name, color, description } = req.body;
    const updates = {};
    if (name) updates.name = name.trim();
    if (color) updates.color = color;
    if (description !== undefined) updates.description = description;

    if (!dbReady()) {
      const folder = demoFolders.find(f => f._id === req.params.id);
      if (!folder) return res.status(404).json({ error: 'Folder not found' });
      Object.assign(folder, updates);
      return res.json({ folder });
    }

    const folder = await Folder.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      updates,
      { new: true }
    );

    if (!folder) return res.status(404).json({ error: 'Folder not found' });
    res.json({ folder });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/folders/:id - Delete folder
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    if (!dbReady()) {
      const idx = demoFolders.findIndex(f => f._id === req.params.id);
      if (idx !== -1) demoFolders.splice(idx, 1);
      return res.json({ message: 'Folder deleted' });
    }

    const folder = await Folder.findOne({ _id: req.params.id, owner: req.user._id });
    if (!folder) return res.status(404).json({ error: 'Folder not found' });

    // Move files in folder to root
    await File.updateMany({ folder: req.params.id, owner: req.user._id }, { folder: null });
    await Folder.findByIdAndDelete(req.params.id);

    res.json({ message: 'Folder deleted, files moved to root' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;