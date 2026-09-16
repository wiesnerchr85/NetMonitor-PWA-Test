const DB_NAME = 'netmonitor-pwa-offline-test';
const STORE_NAME = 'routes';
const ROUTE_KEY = 'current-route';
const form = document.querySelector('#routeForm');
const saveState = document.querySelector('#saveState');
const connectionState = document.querySelector('#connectionState');
const diagnostics = document.querySelector('#diagnostics');

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readRoute() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(ROUTE_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

async function writeRoute(route) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(route, ROUTE_KEY);
    request.onsuccess = resolve; request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

async function deleteRoute() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(ROUTE_KEY);
    request.onsuccess = resolve; request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

function routeFromForm() { return Object.fromEntries(new FormData(form).entries()); }
function fillForm(route) { Object.entries(route).forEach(([key, value]) => { const field = form.elements.namedItem(key); if (field) field.value = value; }); }
function setConnectionState() {
  const online = navigator.onLine;
  connectionState.textContent = online ? 'ONLINE' : 'OFFLINE';
  connectionState.className = `connection-state ${online ? 'online' : 'offline'}`;
}
function standalone() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
function statusRow(label, ok, detail = '') { return `<div><dt>${label}</dt><dd class="${ok ? 'yes' : 'no'}">${ok ? 'Ja' : 'Nein'}${detail ? ` (${detail})` : ''}</dd></div>`; }
async function refreshDiagnostics() {
  const serviceWorkerAvailable = 'serviceWorker' in navigator;
  const registration = serviceWorkerAvailable ? await navigator.serviceWorker.getRegistration() : null;
  const cacheAvailable = 'caches' in window;
  let cacheDetail = '';
  if (cacheAvailable) { try { cacheDetail = `${(await caches.keys()).length} Cache(s)`; } catch { cacheDetail = 'nicht lesbar'; } }
  diagnostics.innerHTML = [
    statusRow('Service Worker unterstützt', serviceWorkerAvailable),
    statusRow('Service Worker registriert', Boolean(registration && registration.active)),
    statusRow('IndexedDB verfügbar', 'indexedDB' in window),
    statusRow('Cache Storage verfügbar', cacheAvailable, cacheDetail),
    statusRow('Online', navigator.onLine),
    statusRow('Installiert / Standalone', standalone())
  ].join('');
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try { await navigator.serviceWorker.register('./sw.js', { scope: './' }); }
  catch (error) { console.warn('Service Worker konnte nicht registriert werden.', error); }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  try { await writeRoute({ ...routeFromForm(), savedAt: new Date().toISOString() }); saveState.textContent = 'Lokal in IndexedDB gespeichert.'; }
  catch { saveState.textContent = 'Speichern fehlgeschlagen – IndexedDB prüfen.'; }
  await refreshDiagnostics();
});
document.querySelector('#deleteData').addEventListener('click', async () => {
  if (!confirm('Lokale Testdaten wirklich löschen?')) return;
  try { await deleteRoute(); saveState.textContent = 'Lokale Testdaten gelöscht.'; } catch { saveState.textContent = 'Löschen fehlgeschlagen.'; }
});
document.querySelector('#refreshDiagnostics').addEventListener('click', refreshDiagnostics);
window.addEventListener('online', () => { setConnectionState(); refreshDiagnostics(); });
window.addEventListener('offline', () => { setConnectionState(); refreshDiagnostics(); });

(async () => {
  setConnectionState();
  await registerServiceWorker();
  try { const route = await readRoute(); if (route) { fillForm(route); saveState.textContent = 'Zuletzt gespeicherte lokale Daten geladen.'; } } catch { saveState.textContent = 'IndexedDB konnte nicht geöffnet werden.'; }
  await refreshDiagnostics();
})();
