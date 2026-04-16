// Multer config (memory storage)
const multer = require('multer');
const path = require('path');

const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024; // 100MB default

// Use memory storage since we're uploading to GitHub
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Blocked file types (executables)
  const blockedExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi', '.dll'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (blockedExtensions.includes(ext)) {
    return cb(new Error(`File type ${ext} is not allowed`), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_SIZE,
    files: 10 // max 10 files at once
  },
  fileFilter
});

// Error handler for multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `File too large. Max size is ${MAX_SIZE / 1024 / 1024}MB` });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Max 10 files per upload' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

module.exports = { upload, handleUploadError };