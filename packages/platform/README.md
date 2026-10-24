# packages/platform

Interfaces de plataforma, para que la misma app corra como PWA hoy y dentro de
Capacitor después sin reescribir la UI ni `core` (DESIGN.md §13.2, R4 y R10).

Interfaces: `geolocalizacion`, `almacenamiento`, `passkeys`, `push`,
`compartir`, `segundoPlano`, `instalacion`.

- `web/`: implementación actual (Geolocation API, IndexedDB, WebAuthn, Web Push
  con VAPID, Web Share).
- `nativa/`: futura (plugins de Capacitor, Credential Manager / ASAuthorization,
  FCM / APNs).

La UI y `packages/core` importan solo las interfaces, nunca las APIs del
navegador directamente.

Sin implementar.
