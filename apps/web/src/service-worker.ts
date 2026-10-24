/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
// Service worker: solo caché (DESIGN.md §14.2 R5). Ninguna lógica de negocio
// vive acá; el guardado lo hace la página en IndexedDB.
import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `cacapage-${version}`;
const ESTATICOS = [...build, ...files];
// Páginas que tienen que abrir sin conexión.
const PAGINAS_OFFLINE = ['/app/relevamiento'];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(ESTATICOS);
			// Si la página no existe en este entorno (404), no se cachea.
			for (const ruta of PAGINAS_OFFLINE) {
				try {
					const r = await fetch(ruta, { cache: 'reload' });
					if (r.ok) await cache.put(ruta, r);
				} catch {
					// Sin red durante la instalación: se cachea en la próxima visita.
				}
			}
			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const clave of await caches.keys()) if (clave !== CACHE) await caches.delete(clave);
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== sw.location.origin) return;

	if (ESTATICOS.includes(url.pathname)) {
		event.respondWith(caches.match(url.pathname).then((r) => r ?? fetch(req)));
		return;
	}

	if (req.mode === 'navigate' && PAGINAS_OFFLINE.includes(url.pathname)) {
		// Primero la copia guardada (con señal mala, esperar a la red es lento) y
		// se actualiza en segundo plano.
		event.respondWith(
			(async () => {
				const cache = await caches.open(CACHE);
				const guardada = await cache.match(url.pathname);
				const deRed = fetch(req)
					.then(async (r) => {
						if (r.ok) await cache.put(url.pathname, r.clone());
						else if (r.status === 404) await cache.delete(url.pathname);
						return r;
					})
					.catch(() => undefined);
				if (guardada) {
					event.waitUntil(deRed);
					return guardada;
				}
				return (await deRed) ?? new Response('Sin conexión y sin copia guardada.', { status: 503 });
			})()
		);
	}
});
