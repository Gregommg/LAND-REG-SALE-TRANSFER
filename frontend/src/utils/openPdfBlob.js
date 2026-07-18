/**
 * Opens a PDF blob (fetched from a protected, auth-header-only endpoint) in
 * a new browser tab. Revokes the temporary object URL shortly after so it
 * doesn't leak memory.
 */
export function openPdfBlob(blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
