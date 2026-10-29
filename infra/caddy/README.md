# infra/caddy

Configuración de Caddy (DESIGN.md §15 y §19). Implementado: `Caddyfile`, con el sitio real
(`ORIGEN_PUBLICO`) y el de prueba (`ORIGEN_PRUEBA`). Ver `docs/despliegue.md`.

- El host sale de `ORIGEN_PUBLICO` (variable `{$ORIGEN_HOST}` en el
  `Caddyfile`). El dominio no se escribe en ningún archivo de esta carpeta.
- TLS automático.
- Cabeceras de seguridad: CSP sin terceros (`default-src 'self'`),
  `Referrer-Policy: no-referrer`, `Permissions-Policy: geolocation=(self)`.
- **Log de acceso desactivado** para `/api/*` y `/tiles/*`; en el resto, IP
  truncada y 7 días.
- Con `ENTORNO=prueba`: `X-Robots-Tag: noindex, nofollow` en **todas** las
  respuestas, `robots.txt` sin `Disallow` (para que Google pueda leer el
  noindex), sin `sitemap.xml` y sin `/.well-known/*`.
