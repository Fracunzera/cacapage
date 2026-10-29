# apps/worker/src/osm

Importación de OpenStreetMap → base de baños. DESIGN.md §10.

## REGLA: IMPORTACIÓN DE UNA SOLA VÍA

**Este módulo solo lee de OSM. Nunca escribe.**

- **(i5)** Implementado en `apps/web/src/lib/server/osm/` con Overpass (DESIGN.md
  §0, iteración 5). Esta carpeta queda para los jobs que vengan después.
- Prohibido: credenciales de la API de edición de OSM, clientes de escritura,
  OAuth de OSM, llamadas que no sean GET a `api.openstreetmap.org`.
- Las correcciones de nuestros usuarios viven en nuestra base. Si alguna vez se
  devuelven a OSM, es a mano, por una persona, con revisión, a partir del
  reporte CSV que genera `reporte-devolucion`.
- Cada archivo de código de esta carpeta tiene que empezar con un comentario de
  cabecera que repita esta regla y enlace
  [ADR 0001](../../../../docs/adr/0001-osm-importacion-una-via.md).

Contenido previsto (sin implementar): `descargar` (Geofabrik + checksum),
`recortar` (osmium extract), `filtrar` (osmium tags-filter con
`data/curated/categorias.json`), `normalizar`, `fusionar` (baño ↔ lugar a
< 50 m), `precedencia` (lo local gana; conflictos a revisión),
`reporte-devolucion` (CSV para humanos).
