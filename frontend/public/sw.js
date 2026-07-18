// Minimal service worker so the app is installable. It doesn't attempt
// offline caching of API data (land records need to be live/current), it
// just needs to exist and handle fetch for the browser to consider the
// site installable as an app.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Intentionally pass-through (no caching) - always hit the network so
  // land records, prices, and statuses are never served stale.
});
