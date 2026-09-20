const CACHE='pocket-arcade-064993b47522';
const ASSETS=["./","./index.html","./public/fonts/dm-sans-600.ttf","./public/fonts/dm-sans-700.ttf","./public/fonts/dmsans-OFL.txt","./public/fonts/lilita-OFL.txt","./public/fonts/lilita-one.ttf","./public/icon.svg","./public/manifest.webmanifest","./src/app.js","./src/audio-bank.js","./src/audio.js","./src/catalog.js","./src/core.js","./src/draw.js","./src/games/cleanup.js","./src/games/diner.js","./src/games/drill.js","./src/games/factory.js","./src/games/harbor.js","./src/games/mech.js","./src/games/ricochet.js","./src/games/robot.js","./src/games/train.js","./src/games/worlds.js","./src/icons.js","./src/mastery.js","./src/navigation.js","./src/preview.js","./src/run-state.js","./src/store.js","./src/style.css","./src/version.js"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(url=>new Request(new URL(url,self.location.href),{cache:'reload'}))))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('pocket-arcade-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE_UPDATE')self.skipWaiting()});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
