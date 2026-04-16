# ☁️ CloudVault — Full-Stack Cloud Storage App

A Google Drive–inspired cloud storage application with GitHub as the file storage backend. Built with Node.js, Express, MongoDB, and a modern dark-themed SPA frontend.

---

## ✨ Features

- **🔐 JWT Authentication** — Secure register/login with bcrypt password hashing & rate limiting
- **📁 File Management** — Upload, preview, stream, download, and delete files
- **📂 Folder Organization** — Create color-coded folders, move files between folders
- **🔍 Full-Text Search** — Search files by name, description, and tags
- **🎬 Video Streaming** — Video.js player with HTML5 streaming
- **🖼️ Media Preview** — In-app preview for images, videos, audio, PDFs, and text files
- **⭐ Favorites** — Star important files for quick access
- **📊 Storage Dashboard** — Real-time storage usage stats by file type
- **📱 Responsive UI** — Works on desktop and mobile
- **🗄️ GitHub Storage** — All files stored in a GitHub repository via API
- **🏗️ Scalable Architecture** — Clean separation of concerns, RESTful API design

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- GitHub account

### 1. Install dependencies
```bash
cd cloudvault
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/cloudvault
JWT_SECRET=your_super_secret_key_here
GITHUB_TOKEN=ghp_yourPersonalAccessToken
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_storage_repository
GITHUB_BRANCH=main
```

### 3. Set up GitHub Storage Repository

1. Create a **new GitHub repository** (can be private)
2. Generate a **Personal Access Token**:
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Required scopes: `repo` (full control)
3. Add the token, username, and repo name to `.env`

### 4. Start the server
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Visit `http://localhost:3000`

---

## 📁 Project Structure

```
cloudvault/
├── server/
│   ├── index.js              # Express app entry point
│   ├── models/
│   │   ├── User.js           # User schema (auth, storage quota)
│   │   ├── File.js           # File metadata schema
│   │   └── Folder.js         # Folder schema
│   ├── routes/
│   │   ├── auth.js           # POST /login, /register, GET /me
│   │   ├── files.js          # CRUD + upload + stream
│   │   ├── folders.js        # Folder CRUD
│   │   └── search.js         # Full-text search
│   ├── middleware/
│   │   ├── auth.js           # JWT verify middleware
│   │   └── upload.js         # Multer config (memory storage)
│   └── utils/
│       ├── db.js             # MongoDB connection
│       └── github.js         # GitHub API service (upload/delete/get)
└── public/
    ├── index.html            # SPA shell
    ├── css/style.css         # Full design system
    └── js/app.js             # Frontend application
```

---

## 🔌 API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in, returns JWT |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/profile` | Update profile |

### Files
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files` | List files (supports `?type=&sort=&folder=`) |
| POST | `/api/files/upload` | Upload (multipart, up to 10 files) |
| GET | `/api/files/:id` | Get file metadata |
| PATCH | `/api/files/:id` | Update metadata |
| DELETE | `/api/files/:id` | Delete from GitHub + DB |
| GET | `/api/files/:id/stream` | Stream/redirect to raw URL |
| GET | `/api/files/stats/overview` | Dashboard statistics |

### Folders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/folders` | List folders |
| POST | `/api/folders` | Create folder |
| GET | `/api/folders/:id` | Get folder + contents |
| PATCH | `/api/folders/:id` | Update folder |
| DELETE | `/api/folders/:id` | Delete folder |

### Search
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search?q=` | Search files by name/description/tags |

---

## 🏗️ Architecture Notes

### GitHub Storage Strategy
Files are uploaded to GitHub using the Contents API:
- Path format: `uploads/{userId}/{uuid}.ext`
- SHA stored in DB to enable updates/deletes
- Raw URLs used for serving (works for public repos)
- For private repos: redirect to GitHub raw + token auth

### Demo Mode
If MongoDB is unavailable, the app runs in **demo mode**:
- In-memory arrays replace database queries
- Uploads still work (if GitHub is configured)
- JWT tokens still issued (with fake user data)

### Security
- Helmet.js for HTTP security headers
- Rate limiting on auth endpoints (20 req/15min)
- JWT expiry (7 days default)
- File type blocking (.exe, .bat, .sh, etc.)
- Max file size enforcement (100MB default)
- Input validation with express-validator

---

## 🔧 Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `MONGODB_URI` | `mongodb://localhost:27017/cloudvault` | MongoDB connection string |
| `JWT_SECRET` | *(required)* | JWT signing secret |
| `JWT_EXPIRES_IN` | `7d` | Token expiry |
| `GITHUB_TOKEN` | *(required)* | GitHub PAT |
| `GITHUB_OWNER` | *(required)* | GitHub username |
| `GITHUB_REPO` | *(required)* | Repository name |
| `GITHUB_BRANCH` | `main` | Branch to store files |
| `MAX_FILE_SIZE` | `104857600` | Max file size in bytes (100MB) |

---

## 📈 Scaling Considerations

- **Storage limits**: GitHub has a 1GB soft limit per repo — use multiple repos or switch to S3/GCS for production
- **Private repos**: Set up a proxy endpoint to stream files through the server with auth headers
- **CDN**: Cache `downloadUrl` responses at the edge for frequently accessed files
- **Queue**: For large uploads, consider a job queue (Bull/BullMQ) with progress events via SSE
- **Search**: Replace regex search with MongoDB Atlas Search or Elasticsearch for full-text search at scale

---

## 🤝 Contributing

PRs welcome! Please open an issue first for major changes.