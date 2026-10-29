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

- Portada, términos y privacidad (borradores).
- **Cuentas** (DESIGN.md §6.3): alta con seudónimo y passkey (solo producción) o
  link por mail (HMAC, el mail no se guarda), sesión, salir, borrar la cuenta.
  Pantallas `/app/entrar`, `/app/entrar/mail`, `/app/cuenta`; API en
  `src/routes/api/v1/`; migraciones en `src/lib/server/migraciones/`, que se
  aplican solas al arrancar.
- Herramienta de relevamiento (`/app/relevamiento`, DESIGN.md §15.6), solo con
  `ENTORNO=prueba`.

Todavía no: registrar, historial, bóveda cifrada, medallas, mapa de baños.

```sh
pnpm install
pnpm --filter web check   # tipos
pnpm --filter web test    # unitarias (modelo y almacenamiento)
pnpm --filter web build
# Punta a punta (Chromium con GPS y passkey virtuales). Necesita un Postgres:
DATABASE_URL=postgres://usuario@host:puerto/base pnpm --filter web e2e

# Correr el build (variables en .env.example y DESIGN.md §15):
ENTORNO=prueba ORIGEN_PUBLICO=http://localhost:3000 DATABASE_URL=… PIMIENTA_MAIL=… MAIL_MODO=consola node apps/web/build
```

Despliegue: `docs/despliegue.md`.
