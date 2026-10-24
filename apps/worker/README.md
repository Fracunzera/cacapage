# apps/worker

Proceso Node aparte, disparado por cron del sistema. Jobs (DESIGN.md §9):

- `publicar-lote`: publicación nocturna de aportes pendientes.
- `recalcular-agregados`: aplica umbrales de k-anonimato y escribe las tablas
  `stats_*` que lee la API pública.
- `importar-osm`: baja el extracto, filtra, actualiza `lugares`.
- `generar-bundles`: genera `lugares.json`, `zonas.geojson`, PMTiles.
- `purgar`: sesiones, tokens, feed de amigos vencido, cuentas borradas.

Sin implementar.
