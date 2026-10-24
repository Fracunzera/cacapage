# apps/web

App SvelteKit (TypeScript, adapter-node). Un solo proceso sirve:

- La interfaz (registro, mapa, historial, logros, amigos, ajustes).
- El SSR de las páginas compartibles (fichas de lugar, tarjetas de logro con
  imagen OpenGraph), que es lo que hace que un link de WhatsApp se vea bien.
- La API `/api/v1/*` (rutas `+server.ts`). Ver DESIGN.md §8.
- El service worker: registro offline y cola de salida diferida.

Lo sensible (coordenadas, zonas privadas, detección de domicilio, cifrado) corre
en el navegador, usando `packages/core` y `packages/vault`. La parte servidor de
esta app nunca recibe coordenadas.

Sin implementar.
