// Frontend application
/* ── CloudVault Frontend App ─────────────────────────────────── */
const API = '/api';
let currentUser = null;
let currentView = 'all';
let currentFolder = null;
let isListView = false;
let uploadFiles = [];
let currentSort = 'createdAt-desc';
let selectedColor = '#6366f1';
let deleteTarget = null;
let playerInstance = null;
let searchDebounce = null;

// ── Helpers ──────────────────────────────────────────────────
async function api(method, path, data, isFormData = false) {
  const opts = {
    method,
    credentials: 'include',
    headers: {}
  };
  if (data && !isFormData) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(data);
  } else if (data) {
    opts.body = data;
  }
  const res = await fetch(API + path, opts);
  const json = await res.json().catch(() => ({}));
  const message = typeof json.error === 'string' ? json.error : json.error?.message;
  if (!res.ok) throw new Error(message || 'Request failed');
  return json;
}

function isAuthError(message = '') {
  return /(authentication required|invalid token|token expired|inactive)/i.test(message);
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getFileIcon(mimeType, name) {
  const ext = name?.split('.').pop()?.toLowerCase();
  if (!mimeType && !ext) return '📄';
  if (mimeType?.startsWith('image/')) return '🖼️';
  if (mimeType?.startsWith('video/')) return '🎬';
  if (mimeType?.startsWith('audio/')) return '🎵';
  if (mimeType === 'application/pdf' || ext === 'pdf') return '📕';
  if (mimeType?.includes('word') || ['doc','docx'].includes(ext)) return '📝';
  if (mimeType?.includes('spreadsheet') || ['xls','xlsx','csv'].includes(ext)) return '📊';
  if (mimeType?.includes('presentation') || ['ppt','pptx'].includes(ext)) return '📑';
  if (mimeType?.startsWith('text/') || ['txt','md','json','xml','yml','yaml'].includes(ext)) return '📄';
  if (['zip','rar','7z','tar','gz'].includes(ext)) return '🗜️';
  if (['js','ts','py','java','cpp','c','go','rs'].includes(ext)) return '💻';
  return '📁';
}

function getFileType(mimeType) {
  if (!mimeType) return 'other';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
  if (mimeType.startsWith('text/')) return 'text';
  return 'other';
}

function getTypeClass(mimeType) {
  const t = getFileType(mimeType);
  return `type-${t}`;
}

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.classList.add('exit');
    el.addEventListener('animationend', () => el.remove());
  }, 3200);
}

function setLoading(id, loading) {
  const btn = document.getElementById(id);
  if (!btn) return;
  const span = btn.querySelector('span');
  const loader = btn.querySelector('.btn-loader');
  if (loading) { span?.classList.add('hidden'); loader?.classList.remove('hidden'); btn.disabled = true; }
  else { span?.classList.remove('hidden'); loader?.classList.add('hidden'); btn.disabled = false; }
}

// ── Auth ─────────────────────────────────────────────────────
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`${tab.dataset.tab}-form`).classList.add('active');
  });
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  setLoading('login-btn', true);
  const errorEl = document.getElementById('login-error');
  errorEl.classList.add('hidden');
  try {
    const data = await api('POST', '/auth/login', {
      email: document.getElementById('login-email').value,
      password: document.getElementById('login-password').value
    });
    currentUser = data.user;
    await showDashboard();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally { setLoading('login-btn', false); }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  setLoading('reg-btn', true);
  const errorEl = document.getElementById('reg-error');
  errorEl.classList.add('hidden');
  try {
    const data = await api('POST', '/auth/register', {
      name: document.getElementById('reg-name').value,
      email: document.getElementById('reg-email').value,
      password: document.getElementById('reg-password').value
    });
    currentUser = data.user;
    await showDashboard();
    toast('Welcome to CloudVault! 🎉', 'success');
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally { setLoading('reg-btn', false); }
});

function togglePassword(id) {
  const input = document.getElementById(id);
  input.type = input.type === 'password' ? 'text' : 'password';
}

function resetSessionState() {
  currentUser = null;
  document.getElementById('dashboard-page').classList.remove('active');
  document.getElementById('auth-page').classList.add('active');
  document.getElementById('user-dropdown').classList.remove('open');
}

async function logout() {
  try {
    await api('POST', '/auth/logout');
  } catch {}
  resetSessionState();
}

// ── Dashboard Init ───────────────────────────────────────────
async function showDashboard() {
  document.getElementById('auth-page').classList.remove('active');
  document.getElementById('dashboard-page').classList.add('active');
  if (!currentUser) {
    try {
      const d = await api('GET', '/auth/me');
      currentUser = d.user;
    } catch {
      resetSessionState();
      return;
    }
  }
  updateUserUI();
  await Promise.all([loadFolders(), loadFiles()]);
  loadStats();
}

function updateUserUI() {
  if (!currentUser) return;
  const initial = currentUser.name?.[0]?.toUpperCase() || '?';
  document.getElementById('user-avatar').textContent = initial;
  document.getElementById('user-name-display').textContent = currentUser.name || 'User';
  document.getElementById('dropdown-name').textContent = currentUser.name || '—';
  document.getElementById('dropdown-email').textContent = currentUser.email || '—';
}

// ── Stats ────────────────────────────────────────────────────
async function loadStats() {
  try {
    const data = await api('GET', '/files/stats/overview');
    const used = data.storageUsed || 0;
    const limit = data.storageLimit || 1073741824;
    const pct = Math.min(100, Math.round((used / limit) * 100));
    document.getElementById('storage-fill').style.width = pct + '%';
    document.getElementById('storage-text').textContent = `${formatSize(used)} / ${formatSize(limit)}`;
  } catch {}
}

// ── Folders ──────────────────────────────────────────────────
async function loadFolders() {
  try {
    const data = await api('GET', '/folders');
    const list = document.getElementById('folder-list');
    if (!data.folders?.length) {
      list.innerHTML = '<div class="empty-folders">No folders yet</div>';
      return;
    }
    list.innerHTML = data.folders.map(f => `
      <div class="folder-item ${currentFolder === f._id ? 'active' : ''}" 
           onclick="openFolder('${f._id}','${f.name}')">
        <span class="folder-dot" style="background:${f.color}"></span>
        <span>${f.name}</span>
      </div>
    `).join('');

    // Update folder select in upload modal
    const sel = document.getElementById('upload-folder-select');
    const existing = Array.from(sel.options).map(o => o.value);
    data.folders.forEach(f => {
      if (!existing.includes(f._id)) {
        const opt = new Option(f.name, f._id);
        sel.add(opt);
      }
    });
  } catch (err) {
    console.error('Load folders error:', err);
  }
}

function openFolder(id, name) {
  currentFolder = id;
  currentView = 'folder';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.folder-item').forEach(fi => {
    fi.classList.toggle('active', fi.getAttribute('onclick')?.includes(id));
  });
  updateBreadcrumb(name);
  loadFiles();
  closeSidebar();
}

function openNewFolderModal() {
  document.getElementById('new-folder-name').value = '';
  document.getElementById('folder-error').classList.add('hidden');
  openModal('folder-modal');
  setTimeout(() => document.getElementById('new-folder-name').focus(), 100);
}

async function createFolder() {
  const name = document.getElementById('new-folder-name').value.trim();
  const errEl = document.getElementById('folder-error');
  errEl.classList.add('hidden');
  if (!name) { errEl.textContent = 'Please enter a folder name'; errEl.classList.remove('hidden'); return; }
  try {
    await api('POST', '/folders', { name, color: selectedColor });
    closeModal('folder-modal');
    await loadFolders();
    toast('Folder created', 'success');
  } catch (err) {
    errEl.textContent = err.message; errEl.classList.remove('hidden');
  }
}

// Color picker
document.querySelectorAll('.color-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.color-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedColor = btn.dataset.color;
  });
});

document.getElementById('new-folder-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') createFolder();
});

// ── Files ────────────────────────────────────────────────────
async function loadFiles(searchQuery = '') {
  const grid = document.getElementById('files-grid');
  const empty = document.getElementById('empty-state');
  const loading = document.getElementById('loading-state');
  
  grid.innerHTML = '';
  empty.classList.add('hidden');
  loading.classList.remove('hidden');

  try {
    let data;
    if (searchQuery) {
      data = await api('GET', `/search?q=${encodeURIComponent(searchQuery)}`);
      data.files = data.results;
    } else {
      const [sortField, sortOrder] = currentSort.split('-');
      let typeFilter = '';
      if (currentView === 'images') typeFilter = '&type=image';
      else if (currentView === 'videos') typeFilter = '&type=video';
      else if (currentView === 'audio') typeFilter = '&type=audio';
      else if (currentView === 'documents') typeFilter = '&type=document';
      
      const folderParam = currentFolder ? `&folder=${currentFolder}` : (currentView === 'folder' ? '' : '');
      data = await api('GET', `/files?sort=${sortField}&order=${sortOrder}${typeFilter}${folderParam}`);
    }

    loading.classList.add('hidden');

    let files = data.files || [];
    
    if (currentView === 'favorites') {
      files = files.filter(f => f.isFavorite);
    }

    document.getElementById('file-count').textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;

    if (!files.length) {
      empty.classList.remove('hidden');
      return;
    }

    grid.innerHTML = files.map(f => renderFileCard(f)).join('');
  } catch (err) {
    loading.classList.add('hidden');
    console.error('Load files error:', err);
    if (isAuthError(err.message)) await logout();
  }
}

function renderFileCard(file) {
  const icon = getFileIcon(file.mimeType, file.name);
  const type = getFileType(file.mimeType);
  const typeClass = getTypeClass(file.mimeType);
  const isImage = type === 'image';
  const isFav = file.isFavorite;

  if (isListView) {
    return `
      <div class="file-card" onclick="previewFile('${file._id}')">
        <div class="card-body">
          <span class="list-icon">${icon}</span>
          <div class="list-info">
            <div class="card-name">${escapeHtml(file.name)}</div>
            <div class="card-meta">${formatDate(file.createdAt)} · <span class="type-chip ${typeClass}">${type}</span></div>
          </div>
          <span class="list-size">${formatSize(file.size)}</span>
          <div class="card-actions">
            <button class="card-action-btn fav ${isFav ? 'active' : ''}" 
              onclick="event.stopPropagation();toggleFavorite('${file._id}',this)" title="${isFav ? 'Unfavorite' : 'Favorite'}">
              ${isFav ? '★' : '☆'}
            </button>
            <button class="card-action-btn" onclick="event.stopPropagation();confirmDelete('${file._id}','${escapeHtml(file.name)}')" title="Delete">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            </button>
          </div>
        </div>
      </div>`;
  }

  return `
    <div class="file-card" onclick="previewFile('${file._id}')">
      <div class="card-thumb">
        ${isImage && file.downloadUrl
          ? `<img src="${file.downloadUrl}" alt="${escapeHtml(file.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''}
        <div class="file-icon-large" style="${isImage && file.downloadUrl ? 'display:none' : ''}">${icon}</div>
      </div>
      <div class="card-body">
        <div class="card-name">${escapeHtml(file.name)}</div>
        <div class="card-meta">${formatSize(file.size)} · <span class="type-chip ${typeClass}">${type}</span></div>
      </div>
      <div class="card-actions">
        <button class="card-action-btn fav ${isFav ? 'active' : ''}" 
          onclick="event.stopPropagation();toggleFavorite('${file._id}',this)" title="${isFav ? 'Unfavorite' : 'Favorite'}">
          ${isFav ? '★' : '☆'}
        </button>
        <button class="card-action-btn" onclick="event.stopPropagation();confirmDelete('${file._id}','${escapeHtml(file.name)}')" title="Delete">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
      </div>
    </div>`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── File Preview ─────────────────────────────────────────────
async function previewFile(id) {
  try {
    const data = await api('GET', `/files/${id}`);
    const file = data.file;
    const type = getFileType(file.mimeType);
    const url = file.downloadUrl;

    document.getElementById('preview-filename').textContent = file.name;
    document.getElementById('preview-download').href = url;

    const body = document.getElementById('preview-body');
    const footer = document.getElementById('preview-meta');

    // Cleanup previous video player
    if (playerInstance) { try { playerInstance.dispose(); } catch {} playerInstance = null; }

    let previewHtml = '';

    if (type === 'image') {
      previewHtml = `<img class="preview-image" src="${url}" alt="${escapeHtml(file.name)}">`;
    } else if (type === 'video') {
      const videoId = 'preview-vid-' + Date.now();
      previewHtml = `
        <video id="${videoId}" class="video-js vjs-default-skin preview-video" controls preload="auto" data-setup='{}'>
          <source src="${url}" type="${file.mimeType}">
          <p>Your browser does not support video playback.</p>
        </video>`;
      setTimeout(() => {
        const el = document.getElementById(videoId);
        if (el && typeof videojs !== 'undefined') {
          playerInstance = videojs(el, { fluid: true, responsive: true });
        }
      }, 50);
    } else if (type === 'audio') {
      previewHtml = `
        <div class="preview-audio-wrap">
          <div class="preview-file-icon" style="font-size:4rem;margin-bottom:16px">🎵</div>
          <p style="margin-bottom:20px;color:var(--text-2)">${escapeHtml(file.name)}</p>
          <audio class="preview-audio" controls>
            <source src="${url}" type="${file.mimeType}">
          </audio>
        </div>`;
    } else if (type === 'pdf') {
      previewHtml = `<iframe class="preview-pdf" src="${url}" title="${escapeHtml(file.name)}"></iframe>`;
    } else if (type === 'text') {
      try {
        const res = await fetch(url);
        const text = await res.text();
        previewHtml = `<pre class="preview-text">${escapeHtml(text.slice(0, 10000))}${text.length > 10000 ? '\n\n... (truncated)' : ''}</pre>`;
      } catch {
        previewHtml = genericPreview(file);
      }
    } else {
      previewHtml = genericPreview(file);
    }

    body.innerHTML = previewHtml;
    footer.innerHTML = `
      <div class="meta-item">📁 ${formatSize(file.size)}</div>
      <div class="meta-item">📅 ${formatDate(file.createdAt)}</div>
      <div class="meta-item"><span class="type-chip ${getTypeClass(file.mimeType)}">${type}</span></div>
      ${file.folder ? `<div class="meta-item">📂 ${file.folder?.name || 'Folder'}</div>` : ''}
    `;

    openModal('preview-modal');
  } catch (err) {
    toast('Could not load preview: ' + err.message, 'error');
  }
}

function genericPreview(file) {
  return `
    <div class="preview-generic">
      <div class="preview-file-icon">${getFileIcon(file.mimeType, file.name)}</div>
      <h3>${escapeHtml(file.name)}</h3>
      <p>${formatSize(file.size)} · Preview not available for this file type</p>
      <br>
      <a href="${file.downloadUrl}" target="_blank" rel="noopener" class="btn-primary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download File
      </a>
    </div>`;
}

function closePreview() {
  if (playerInstance) { try { playerInstance.dispose(); } catch {} playerInstance = null; }
  closeModal('preview-modal');
}

// ── Favorites ────────────────────────────────────────────────
async function toggleFavorite(id, btn) {
  const isActive = btn.classList.contains('active');
  try {
    await api('PATCH', `/files/${id}`, { isFavorite: !isActive });
    btn.classList.toggle('active');
    btn.textContent = !isActive ? '★' : '☆';
    btn.title = !isActive ? 'Unfavorite' : 'Favorite';
    toast(!isActive ? 'Added to favorites' : 'Removed from favorites', 'success');
    if (currentView === 'favorites') loadFiles();
  } catch (err) { toast(err.message, 'error'); }
}

// ── Delete ───────────────────────────────────────────────────
function confirmDelete(id, name) {
  deleteTarget = id;
  document.getElementById('delete-file-name').textContent = name;
  openModal('delete-modal');
  document.getElementById('delete-confirm-btn').onclick = doDelete;
}

async function doDelete() {
  if (!deleteTarget) return;
  try {
    await api('DELETE', `/files/${deleteTarget}`);
    closeModal('delete-modal');
    toast('File deleted', 'success');
    loadFiles();
    loadStats();
    deleteTarget = null;
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Upload ───────────────────────────────────────────────────
function openUploadModal() {
  uploadFiles = [];
  renderUploadQueue();
  document.getElementById('file-input').value = '';
  openModal('upload-modal');
}

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  addFilesToQueue([...e.dataTransfer.files]);
});
fileInput.addEventListener('change', () => addFilesToQueue([...fileInput.files]));

function addFilesToQueue(files) {
  const maxSize = 100 * 1024 * 1024;
  files.forEach(f => {
    if (f.size > maxSize) { toast(`${f.name} is too large (max 100MB)`, 'error'); return; }
    if (!uploadFiles.find(uf => uf.name === f.name && uf.size === f.size)) {
      uploadFiles.push(f);
    }
  });
  renderUploadQueue();
}

function removeFromQueue(idx) {
  uploadFiles.splice(idx, 1);
  renderUploadQueue();
}

function renderUploadQueue() {
  const queueEl = document.getElementById('upload-queue');
  if (!uploadFiles.length) { queueEl.classList.add('hidden'); return; }
  queueEl.classList.remove('hidden');
  queueEl.innerHTML = uploadFiles.map((f, i) => `
    <div class="queue-item">
      <span class="queue-icon">${getFileIcon(f.type, f.name)}</span>
      <div class="queue-info">
        <div class="queue-name">${escapeHtml(f.name)}</div>
        <div class="queue-size">${formatSize(f.size)}</div>
      </div>
      <button class="queue-remove" onclick="removeFromQueue(${i})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
  `).join('');
}

async function confirmUpload() {
  if (!uploadFiles.length) { toast('Please select files to upload', 'error'); return; }
  
  const folderId = document.getElementById('upload-folder-select').value;
  const fd = new FormData();
  uploadFiles.forEach(f => fd.append('files', f));
  if (folderId) fd.append('folderId', folderId);

  const btn = document.getElementById('upload-confirm-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="btn-loader"></div> Uploading…';

  try {
    const data = await api('POST', '/files/upload', fd, true);
    closeModal('upload-modal');
    toast(`${data.files?.length || 0} file(s) uploaded successfully! 🚀`, 'success');
    if (data.errors?.length) data.errors.forEach(e => toast(`Failed: ${e.file}`, 'error'));
    await loadFiles();
    loadStats();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Upload`;
  }
}

// ── Search ───────────────────────────────────────────────────
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  searchClear.classList.toggle('hidden', !q);
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    if (q) loadFiles(q);
    else { loadFiles(); updateBreadcrumb(currentView === 'all' ? 'All Files' : currentView); }
  }, 350);
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.classList.add('hidden');
  loadFiles();
});

// ── Navigation ───────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const view = item.dataset.view;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.folder-item').forEach(f => f.classList.remove('active'));
    item.classList.add('active');
    currentView = view;
    currentFolder = null;
    const labels = { all: 'All Files', images: 'Images', videos: 'Videos', audio: 'Audio', documents: 'Documents', favorites: 'Favorites' };
    updateBreadcrumb(labels[view] || view);
    loadFiles();
    closeSidebar();
  });
});

function updateBreadcrumb(label) {
  document.getElementById('breadcrumb').innerHTML = `<span class="crumb active">${escapeHtml(label)}</span>`;
}

// Sort
document.getElementById('sort-select').addEventListener('change', e => {
  currentSort = e.target.value;
  loadFiles();
});

// View toggle (grid/list)
document.getElementById('view-toggle').addEventListener('click', () => {
  isListView = !isListView;
  const grid = document.getElementById('files-grid');
  grid.classList.toggle('list-view', isListView);
  document.getElementById('view-icon-grid').style.display = isListView ? 'block' : 'none';
  document.getElementById('view-icon-list').style.display = isListView ? 'none' : 'block';
  loadFiles();
});

// ── Sidebar (Mobile) ─────────────────────────────────────────
const sidebar = document.getElementById('sidebar');
const overlay = document.createElement('div');
overlay.className = 'sidebar-overlay';
document.body.appendChild(overlay);

document.getElementById('hamburger').addEventListener('click', () => {
  sidebar.classList.add('open');
  overlay.classList.add('active');
});

function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
}

document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);

// ── User Menu ────────────────────────────────────────────────
document.getElementById('user-menu-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('user-dropdown').classList.toggle('open');
});

document.addEventListener('click', () => {
  document.getElementById('user-dropdown').classList.remove('open');
});

// ── Modals ───────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
  const el = document.getElementById(id);
  el.classList.remove('open');
  el.style.display = 'none';
  if (id === 'preview-modal') closePreview();
}

// Close modal on backdrop click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      const id = overlay.id;
      if (id === 'preview-modal') closePreview();
      else closeModal(id);
    }
  });
});

// ESC to close
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
      if (m.id === 'preview-modal') closePreview();
      else closeModal(m.id);
    });
  }
});

// ── Auto-init ────────────────────────────────────────────────
(async () => {
  try {
    const d = await api('GET', '/auth/me');
    currentUser = d.user;
    await showDashboard();
  } catch {}
})();
