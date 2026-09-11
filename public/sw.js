/* Minimal service worker: makes the site installable and gives a lean
 * offline fallback. Only same-origin GET asset/navigation requests are
 * cached — API/auth requests always go to the network. */

const CACHE_NAME = "kendrick-david-v2";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API/auth calls — they need to always reach the network.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Navigations: try network, fall back to the cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
        return response;
      }).catch(() => caches.match("/"))
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

const PUSH_TAG = "kendrick-unread";
const HARD_ALERT_TAG = "kendrick-alert";

/**
 * Is the user actively looking at the surface this push is about? If so,
 * suppress the banner so chatting isn't spammed by your own view.
 * Hard alerts never suppress — they take over the screen on purpose.
 */
function isViewingRelevantPage(url, payloadUrl) {
  if (!payloadUrl) return false;
  if (payloadUrl === "/fan-club") {
    return url.pathname.startsWith("/fan-club");
  }
  if (payloadUrl === "/messages") {
    return url.pathname.startsWith("/messages");
  }
  return false;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* fall through to the default payload */
  }

  const title = data.title || "Kendrick David";
  const body = data.body || "You have new messages";
  const url = (data.data && data.data.url) || "/";
  const badgeCount = (data.data && parseInt(data.data.badgeCount || "0", 10)) || 0;
  const isAlert = data.tag === HARD_ALERT_TAG;
  const tag = data.tag || PUSH_TAG;

  const notificationOptions = {
    body,
    tag,
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    data: { url },
  };

  if (isAlert) {
    // Full-content hard alert: stay on screen until dismissed (don't auto
    // collapse), buzz on phones, and always show even if the app is open.
    notificationOptions.requireInteraction = true;
    notificationOptions.vibrate = [200, 100, 200];
  }

  const show = () => self.registration.showNotification(title, notificationOptions);

  // A focused client already on the relevant page? Skip the banner — unless
  // this is a hard alert, which is shown unconditionally.
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const viewing =
          !isAlert &&
          clients.some(
            (client) =>
              client.focused &&
              (client.visibilityState === "visible" || client.visibilityState === "prerender") &&
              isViewingRelevantPage(new URL(client.url), url)
          );
        if (viewing) return;
        return show();
      })
      .catch(() => show())
      .then(() => {
        // Hard alerts don't touch the unread badge.
        if (isAlert) return;
        // Red count bubble on the home-screen icon (Android/desktop only).
        if ("setAppBadge" in self.navigator) {
          if (badgeCount > 0) self.navigator.setAppBadge(badgeCount);
          else self.navigator.clearAppBadge();
        }
      })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).pathname === url && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// The app posts this when the user is all caught up — dismiss any active
// unread notifications so Android's automatic icon dot disappears too.
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "clear-unread") {
    event.waitUntil(
      self.registration
        .getNotifications({ tag: PUSH_TAG })
        .then((notifications) => notifications.forEach((n) => n.close()))
    );
  }
});