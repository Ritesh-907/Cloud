// CRUD + upload + stream
const express = require('express');
const path = require('path');
const mime = require('mime-types');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');
const github = require('../utils/github');
const File = require('../models/File');
const User = require('../models/User');
const Folder = require('../models/Folder');

const router = express.Router();

const dbReady = () => User.db && User.db.readyState === 1;

// In-memory store for demo mode
const demoFiles = [];

// GET /api/files - List files
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { folder = null, type, sort = 'createdAt', order = 'desc', page = 1, limit = 50 } = req.query;

    if (!dbReady()) {
      // Demo mode: return in-memory files
      return res.json({ files: demoFiles.filter(f => f.owner === req.user._id || f.owner === 'demo_user'), total: demoFiles.length, page: 1, pages: 1 });
    }

    const query = { owner: req.user._id };
    if (folder !== 'null') query.folder = folder || null;
    if (type) {
      const typeMap = {
        image: /^image\//,
        video: /^video\//,
        audio: /^audio\//,
        document: /application\/(pdf|msword|vnd\.openxmlformats)/,
        other: null
      };
      if (typeMap[type]) query.mimeType = { $regex: typeMap[type] };
    }

    const sortObj = { [sort]: order === 'desc' ? -1 : 1 };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [files, total] = await Promise.all([
      File.find(query).sort(sortObj).skip(skip).limit(parseInt(limit)).populate('folder', 'name'),
      File.countDocuments(query)
    ]);

    res.json({ files, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
});

// POST /api/files/upload - Upload files
router.post('/upload', authenticate, upload.array('files', 10), handleUploadError, async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    if (!github.isConfigured()) {
      return res.status(503).json({
        error: 'GitHub storage not configured',
        hint: 'Set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO in .env'
      });
    }

    const { folderId = null, tags = '' } = req.body;
    const userId = req.user._id || 'demo_user';
    const results = [];
    const errors = [];

    for (const file of req.files) {
      try {
        const ext = path.extname(file.originalname);
        const uniqueName = `${uuidv4()}${ext}`;
        const githubPath = `uploads/${userId}/${uniqueName}`;

        // Upload to GitHub
        const ghResult = await github.uploadFile(
          githubPath,
          file.buffer,
          `Upload: ${file.originalname}`
        );

        const fileData = {
          name: file.originalname,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          extension: ext.replace('.', '').toLowerCase(),
          githubPath: ghResult.path,
          githubSha: ghResult.sha,
          downloadUrl: ghResult.downloadUrl || github.getRawUrl(githubPath),
          owner: userId,
          folder: folderId || null,
          tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []
        };

        if (dbReady()) {
          const savedFile = await File.create(fileData);

          // Update user storage
          await User.findByIdAndUpdate(userId, {
            $inc: { storageUsed: file.size }
          });

          results.push(savedFile);
        } else {
          // Demo mode
          fileData._id = uuidv4();
          fileData.createdAt = new Date();
          demoFiles.push(fileData);
          results.push(fileData);
        }
      } catch (fileError) {
        console.error(`Error uploading ${file.originalname}:`, fileError.message);
        errors.push({ file: file.originalname, error: fileError.message });
      }
    }

    res.status(201).json({
      message: `${results.length} file(s) uploaded successfully`,
      files: results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/files/:id - Get single file
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    if (!dbReady()) {
      const file = demoFiles.find(f => f._id === req.params.id);
      if (!file) return res.status(404).json({ error: 'File not found' });
      return res.json({ file });
    }

    const file = await File.findOne({ _id: req.params.id, owner: req.user._id });
    if (!file) return res.status(404).json({ error: 'File not found' });

    await File.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });
    res.json({ file });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/files/:id - Delete file
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    let file;
    if (dbReady()) {
      file = await File.findOne({ _id: req.params.id, owner: req.user._id });
    } else {
      const idx = demoFiles.findIndex(f => f._id === req.params.id);
      if (idx !== -1) file = demoFiles[idx];
    }

    if (!file) return res.status(404).json({ error: 'File not found' });

    // Delete from GitHub
    if (github.isConfigured()) {
      try {
        await github.deleteFile(file.githubPath, file.githubSha, `Delete: ${file.name}`);
      } catch (ghError) {
        console.error('GitHub delete error:', ghError.message);
        // Continue to delete from DB even if GitHub fails
      }
    }

    if (dbReady()) {
      await File.findByIdAndDelete(req.params.id);
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { storageUsed: -file.size }
      });
    } else {
      const idx = demoFiles.findIndex(f => f._id === req.params.id);
      if (idx !== -1) demoFiles.splice(idx, 1);
    }

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/files/:id - Update file metadata
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const { name, description, tags, isFavorite, folderId } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (tags !== undefined) updates.tags = tags;
    if (isFavorite !== undefined) updates.isFavorite = isFavorite;
    if (folderId !== undefined) updates.folder = folderId || null;

    if (!dbReady()) {
      const file = demoFiles.find(f => f._id === req.params.id);
      if (!file) return res.status(404).json({ error: 'File not found' });
      Object.assign(file, updates);
      return res.json({ file });
    }

    const file = await File.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      updates,
      { new: true }
    );

    if (!file) return res.status(404).json({ error: 'File not found' });
    res.json({ file });
  } catch (error) {
    next(error);
  }
});

// GET /api/files/:id/stream - Stream/proxy media file
router.get('/:id/stream', authenticate, async (req, res, next) => {
  try {
    let file;
    if (dbReady()) {
      file = await File.findOne({ _id: req.params.id, owner: req.user._id });
    } else {
      file = demoFiles.find(f => f._id === req.params.id);
    }

    if (!file) return res.status(404).json({ error: 'File not found' });

    // Redirect to GitHub raw URL (or proxy for private repos)
    const rawUrl = file.downloadUrl || github.getRawUrl(file.githubPath);
    res.redirect(rawUrl);
  } catch (error) {
    next(error);
  }
});

// GET /api/files/stats/overview - Dashboard stats
router.get('/stats/overview', authenticate, async (req, res, next) => {
  try {
    if (!dbReady()) {
      return res.json({
        total: demoFiles.length,
        totalSize: demoFiles.reduce((s, f) => s + (f.size || 0), 0),
        byType: {},
        recent: demoFiles.slice(-5).reverse()
      });
    }

    const userId = req.user._id;
    const [total, byType, recent, user] = await Promise.all([
      File.countDocuments({ owner: userId }),
      File.aggregate([
        { $match: { owner: userId } },
        { $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $regexMatch: { input: '$mimeType', regex: /^image\// } }, then: 'image' },
                { case: { $regexMatch: { input: '$mimeType', regex: /^video\// } }, then: 'video' },
                { case: { $regexMatch: { input: '$mimeType', regex: /^audio\// } }, then: 'audio' },
                { case: { $eq: ['$mimeType', 'application/pdf'] }, then: 'pdf' },
              ],
              default: 'other'
            }
          },
          count: { $sum: 1 },
          totalSize: { $sum: '$size' }
        }}
      ]),
      File.find({ owner: userId }).sort({ createdAt: -1 }).limit(5),
      User.findById(userId)
    ]);

    const totalSize = byType.reduce((s, t) => s + t.totalSize, 0);

    res.json({
      total,
      totalSize,
      storageUsed: user?.storageUsed || 0,
      storageLimit: user?.storageLimit || 1073741824,
      byType: byType.reduce((acc, t) => { acc[t._id] = { count: t.count, size: t.totalSize }; return acc; }, {}),
      recent
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;