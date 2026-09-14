const CACHE='last-drop-08e6c90a7bfe';
const PRECACHE=["/assets/index-Bi1P_GVz.css","/assets/index-fAp6bEef.js","/favicon.svg","/file.svg","/globe.svg","/icons/icon-192.png","/icons/icon-512.png","/index.html","/manifest.webmanifest","/recognition-core.mjs","/recognize.js","/window.svg"];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('last-drop-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);if(request.method!=='GET')return;
 if(url.origin===self.location.origin){
  if(url.pathname.startsWith('/api/'))return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
   if(request.mode==='navigate')return (await cache.match('/index.html'))||fetch(request);
   const saved=await cache.match(request);if(saved)return saved;
   const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response;
  }));
 }else if(request.destination==='image'){
  event.respondWith(caches.open(CACHE).then(async cache=>{const saved=await cache.match(request);if(saved)return saved;const response=await fetch(request);if(response.ok||response.type==='opaque'){try{await cache.put(request,response.clone());}catch{}}return response;}));
 }
});
