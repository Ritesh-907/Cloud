// Express app entry point
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./utils/db');

const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const folderRoutes = require('./routes/folders');
const searchRoutes = require('./routes/search');

const app = express();

// Connect to MongoDB
connectDB();

// Security middleware
// app.use(helmet({
//   contentSecurityPolicy: {
//     directives: {
//       defaultSrc: ["'self'"],
//       scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "vjs.zencdn.net"],
//       styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "fonts.googleapis.com", "vjs.zencdn.net"],
//       fontSrc: ["'self'", "fonts.gstatic.com", "cdn.jsdelivr.net"],
//       imgSrc: ["'self'", "data:", "blob:", "raw.githubusercontent.com", "*.githubusercontent.com"],
//       mediaSrc: ["'self'", "blob:", "raw.githubusercontent.com", "*.githubusercontent.com"],
//       connectSrc: ["'self'", "raw.githubusercontent.com", "*.githubusercontent.com"],
//       frameSrc: ["'none'"],
//     },
//   },
// }));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],

      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "cdn.jsdelivr.net",
        "vjs.zencdn.net"
      ],

      scriptSrcAttr: ["'unsafe-inline'"], // ✅ FIX

      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "cdn.jsdelivr.net",
        "fonts.googleapis.com",
        "vjs.zencdn.net"
      ],

      fontSrc: [
        "'self'",
        "data:", // ✅ FIX
        "fonts.gstatic.com",
        "cdn.jsdelivr.net"
      ],

      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "raw.githubusercontent.com",
        "*.githubusercontent.com"
      ],

      mediaSrc: [
        "'self'",
        "blob:",
        "raw.githubusercontent.com",
        "*.githubusercontent.com"
      ],

      connectSrc: [
        "'self'",
        "raw.githubusercontent.com",
        "*.githubusercontent.com"
      ],

      frameSrc: ["'none'"],
    },
  },
}));

app.use(cors({
  origin(origin, callback) {
    const frontendUrl = process.env.FRONTEND_URL;

    if (!origin) return callback(null, true);
    if (!frontendUrl) return callback(null, true);
    if (origin === frontendUrl) return callback(null, true);

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/search', searchRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 CloudVault server running on http://localhost:${PORT}`);
  console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
