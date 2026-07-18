// In development, the Vite dev server proxies /uploads to the backend (see
// vite.config.js), so a relative path works. In production, frontend and
// backend are typically on different domains/services, so this needs an
// absolute URL - set VITE_UPLOADS_BASE_URL to your deployed backend's
// /uploads path (e.g. https://your-backend.onrender.com/uploads).
const UPLOADS_BASE_URL = import.meta.env.VITE_UPLOADS_BASE_URL || "/uploads";

/**
 * Builds a full URL to an uploaded file (e.g. a profile photo path like
 * "photos/169999-123.jpg" stored on the user record).
 * @param {string|null|undefined} relativePath
 * @returns {string|null}
 */
export function uploadsUrl(relativePath) {
  if (!relativePath) return null;
  return `${UPLOADS_BASE_URL}/${relativePath}`;
}
