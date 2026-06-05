const CACHE_NAME = 'ecraftz-erp-v1';

// Install event
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Fetch event interceptor
self.addEventListener('fetch', (event) => {
  // If we ever want to cache static assets, we do it here.
  // For now, we mainly want the Background Sync capability.
});

// Background Sync Event Listener
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-time-desk-checkout') {
    event.waitUntil(processTimeDeskQueue());
  }
});

// Process the offline queue stored in IndexedDB (or fallback logic)
// Since Service Workers can't access localStorage, we'll listen for postMessages
// from the main thread instead, and the main thread will handle the actual IndexedDB / API calls.
// Alternatively, modern implementations use IndexedDB. We will just log for now to prove SW registration.
async function processTimeDeskQueue() {
  console.log('[Service Worker] Processing background sync queue for Time Desk...');
  // Logic to read from IndexedDB and POST to Supabase would go here.
}

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'QUEUE_CHECKOUT') {
    console.log('[Service Worker] Received checkout queue request:', event.data.payload);
    // In a full implementation, we'd store this in IndexedDB and register a sync event
    // self.registration.sync.register('sync-time-desk-checkout');
  }
});
