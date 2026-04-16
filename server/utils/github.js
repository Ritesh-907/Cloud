// GitHub API service
const axios = require('axios');

const GITHUB_API = 'https://api.github.com';

const githubClient = axios.create({
  baseURL: GITHUB_API,
  headers: {
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28'
  }
});

const owner = () => process.env.GITHUB_OWNER;
const repo = () => process.env.GITHUB_REPO;
const branch = () => process.env.GITHUB_BRANCH || 'main';

/**
 * Upload a file to GitHub repository
 */
async function uploadFile(filePath, fileBuffer, commitMessage = 'Upload file') {
  const base64Content = fileBuffer.toString('base64');
  
  // Check if file exists (to get SHA for update)
  let sha = null;
  try {
    const existing = await githubClient.get(
      `/repos/${owner()}/${repo()}/contents/${filePath}`,
      { params: { ref: branch() } }
    );
    sha = existing.data.sha;
  } catch (err) {
    // File doesn't exist yet — that's fine
  }

  const payload = {
    message: commitMessage,
    content: base64Content,
    branch: branch(),
    ...(sha && { sha })
  };

  const response = await githubClient.put(
    `/repos/${owner()}/${repo()}/contents/${filePath}`,
    payload
  );

  return {
    sha: response.data.content.sha,
    downloadUrl: response.data.content.download_url,
    htmlUrl: response.data.content.html_url,
    path: response.data.content.path,
    size: response.data.content.size
  };
}

/**
 * Delete a file from GitHub repository
 */
async function deleteFile(filePath, sha, commitMessage = 'Delete file') {
  await githubClient.delete(
    `/repos/${owner()}/${repo()}/contents/${filePath}`,
    {
      data: {
        message: commitMessage,
        sha,
        branch: branch()
      }
    }
  );
  return true;
}

/**
 * Get file content from GitHub
 */
async function getFile(filePath) {
  const response = await githubClient.get(
    `/repos/${owner()}/${repo()}/contents/${filePath}`,
    { params: { ref: branch() } }
  );
  return response.data;
}

/**
 * List files in a directory on GitHub
 */
async function listFiles(dirPath = '') {
  try {
    const response = await githubClient.get(
      `/repos/${owner()}/${repo()}/contents/${dirPath}`,
      { params: { ref: branch() } }
    );
    return Array.isArray(response.data) ? response.data : [response.data];
  } catch (err) {
    if (err.response?.status === 404) return [];
    throw err;
  }
}

/**
 * Check if GitHub credentials are configured
 */
function isConfigured() {
  return !!(process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO);
}

/**
 * Get raw download URL for a file
 */
function getRawUrl(filePath) {
  return `https://raw.githubusercontent.com/${owner()}/${repo()}/${branch()}/${filePath}`;
}

module.exports = {
  uploadFile,
  deleteFile,
  getFile,
  listFiles,
  isConfigured,
  getRawUrl
};