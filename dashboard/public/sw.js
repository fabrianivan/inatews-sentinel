/*
 * INATEWS SENTINEL — service worker, for browser notifications only.
 *
 * It shows two kinds of notification: those the open dashboard page asks for, and push
 * messages the dashboard's server sends when no tab is open (Web Push). A click on one brings
 * the dashboard to the front at the event, or opens the official source. It caches nothing and
 * handles no requests, so it can never serve stale data.
 */

/** The only pages a notification's "source" action may open. */
const OFFICIAL_SOURCES = ['https://www.bmkg.go.id', 'https://magma.esdm.go.id'];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function isOfficialSource(url) {
  return (
    typeof url === 'string' &&
    OFFICIAL_SOURCES.some((origin) => url === origin || url.startsWith(`${origin}/`))
  );
}

/** A dashboard address on this site: only a path that starts with a single slash. */
function dashboardUrl(path) {
  const safe = typeof path === 'string' && /^\/(?!\/)/.test(path) ? path : '/';
  return new URL(safe, self.location.origin).href;
}

/** The notification options a push message may set; anything else in it is ignored. */
function pushOptions(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : undefined);
  const options = {
    body: text(source.body, 600) || 'Ada pembaruan dari dasbor — buka untuk melihatnya.',
    tag: text(source.tag, 200),
    lang: 'id',
    icon: '/notification-icon.png',
    requireInteraction: source.requireInteraction === true,
    data: source.data && typeof source.data === 'object' ? source.data : {},
  };
  if (typeof source.timestamp === 'number' && Number.isFinite(source.timestamp)) options.timestamp = source.timestamp;
  if (Array.isArray(source.actions)) {
    options.actions = source.actions
      .filter((action) => action && (action.action === 'peta' || action.action === 'sumber') && typeof action.title === 'string')
      .slice(0, 2)
      .map((action) => ({ action: action.action, title: action.title.slice(0, 40) }));
  }
  return options;
}

// A push from the dashboard's server: always shown (browsers require it), and open dashboard
// tabs are told, so their list of recent notifications includes it.
self.addEventListener('push', (event) => {
  let message = null;
  try {
    message = event.data ? event.data.json() : null;
  } catch {
    message = null;
  }
  const title = message && typeof message.title === 'string' ? message.title.slice(0, 200) : 'INATEWS SENTINEL';
  const options = pushOptions(message && message.options);
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        client.postMessage({ type: 'inatews:pushed', alert: message && message.alert ? message.alert : null });
      }
    })()
  );
});

// The browser renewed the subscription: subscribe again and hand the server the new address,
// which takes over the settings kept for the old one.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const previous = event.oldSubscription;
      const options = previous && previous.options;
      if (!previous || !options) return;
      const renewed = event.newSubscription || (await self.registration.pushManager.subscribe(options));
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: renewed.toJSON(), replaces: previous.endpoint }),
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const data = notification.data || {};
  notification.close();

  if (event.action === 'sumber' && isOfficialSource(data.sourceUrl)) {
    event.waitUntil(self.clients.openWindow(data.sourceUrl));
    return;
  }

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const own = windows.filter((client) => new URL(client.url).origin === self.location.origin);
      const dashboard = own.find((client) => client.focused) || own[0];
      if (dashboard) {
        try {
          await dashboard.focus();
        } catch {
          // focusing can be refused; the message below still shows the event
        }
        dashboard.postMessage({ type: 'inatews:notification-click', target: data.target || null });
        return;
      }
      await self.clients.openWindow(dashboardUrl(data.url));
    })()
  );
});
