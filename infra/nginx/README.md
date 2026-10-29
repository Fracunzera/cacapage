# infra/nginx

Para cuando el VPS ya tiene nginx en los puertos 80 y 443 (en vez de Caddy).
`sitio.conf.plantilla` se completa con `sed`; los pasos están en
`docs/despliegue.md`.

- Producción: `__CABECERAS__` → `add_header Strict-Transport-Security "max-age=31536000" always;`
- Prueba: `__CABECERAS__` → `add_header X-Robots-Tag "noindex, nofollow" always;`
