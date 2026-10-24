# apps/web

App SvelteKit (TypeScript, adapter-node). Dos tipos de rutas (DESIGN.md §13.2):

- **Públicas con SSR**: fichas del wiki de baños (`/b/{slug}`), tarjetas
  compartibles (`/c/{token}`), `sitemap.xml`. Indexables, con vista previa en
  WhatsApp. Solo existen en la web.
- **De app, solo CSR** (`/app/*`): mapa con el toggle "Mis registros / Baños
  públicos", registro, historial, puente, amigos, ajustes. Sin `load` de
  servidor: todo por el cliente de la API, para poder compilarlas con
  `adapter-static` y meterlas en Capacitor.

Además sirve la API `/api/v1/*` (DESIGN.md §11), el manifest de la PWA, el
service worker (solo caché: ninguna lógica de negocio, regla R5) y
`/.well-known/assetlinks.json` y `apple-app-site-association`.

Lo sensible (coordenadas, zonas privadas, detección de domicilio, cifrado) corre
en el cliente con `packages/core`, `packages/vault` y `packages/platform`.

## Qué está implementado

Solo la herramienta de relevamiento (`/app/relevamiento`, DESIGN.md §15.6), que
existe únicamente con `ENTORNO=prueba`. El resto de la app, no.

```sh
pnpm install
pnpm --filter web check   # tipos
pnpm --filter web test    # unitarias (modelo y almacenamiento)
pnpm --filter web build
pnpm --filter web e2e     # punta a punta en Chromium con GPS simulado
ENTORNO=prueba node apps/web/build   # correr el build
```

Despliegue: `docs/despliegue-prueba.md`.
