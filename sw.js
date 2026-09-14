// Retire previously installed Last Drop workers. Do not remove this URL yet:
// browsers with an old registration need it to recover even if the app cannot load.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  await self.clients.claim();
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('last-drop-')).map(key=>caches.delete(key)));
  await self.registration.unregister();
 })());
});
// No fetch handler: all requests, including redirects, go directly to the network.
