// File metadata schema
const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'File name is required'],
    trim: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  extension: {
    type: String,
    lowercase: true
  },
  // GitHub storage info
  githubPath: {
    type: String,
    required: true,
    unique: true
  },
  githubSha: {
    type: String,
    required: true
  },
  downloadUrl: {
    type: String,
    required: true
  },
  // Organization
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  folder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null
  },
  // Metadata
  description: {
    type: String,
    default: ''
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  isFavorite: {
    type: Boolean,
    default: false
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  viewCount: {
    type: Number,
    default: 0
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  // Media info
  duration: Number,  // for video/audio in seconds
  dimensions: {     // for images/video
    width: Number,
    height: Number
  },
  thumbnail: String // base64 thumbnail for images
}, {
  timestamps: true
});

// Indexes for performance
fileSchema.index({ owner: 1, createdAt: -1 });
fileSchema.index({ owner: 1, folder: 1 });
fileSchema.index({ owner: 1, mimeType: 1 });
fileSchema.index({ name: 'text', description: 'text', tags: 'text' });

// File type helpers
fileSchema.virtual('fileType').get(function() {
  const mime = this.mimeType;
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.includes('document') || mime.includes('word')) return 'document';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'spreadsheet';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'presentation';
  if (mime.startsWith('text/')) return 'text';
  return 'other';
});

fileSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('File', fileSchema);