const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'accessToken';
const DEFAULT_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function getCookieSameSite() {
  const sameSite = (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase();
  return ['lax', 'strict', 'none'].includes(sameSite) ? sameSite : 'lax';
}

function useSecureCookies() {
  return process.env.COOKIE_SECURE === 'true'
    || process.env.NODE_ENV === 'production'
    || getCookieSameSite() === 'none';
}

function getCookieMaxAge() {
  const parsed = parseInt(process.env.COOKIE_MAX_AGE_MS, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_COOKIE_MAX_AGE;
}

function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: useSecureCookies(),
    sameSite: getCookieSameSite(),
    maxAge: getCookieMaxAge(),
    path: '/'
  };
}

function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
}

function clearAuthCookie(res) {
  const { maxAge, ...clearOptions } = getAuthCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, clearOptions);
}

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) return cookies;

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function getAuthToken(req) {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[AUTH_COOKIE_NAME]) return cookies[AUTH_COOKIE_NAME];

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  return null;
}

module.exports = {
  AUTH_COOKIE_NAME,
  clearAuthCookie,
  getAuthCookieOptions,
  getAuthToken,
  setAuthCookie
};
