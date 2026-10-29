# apps/worker

Proceso Node aparte, disparado por cron del sistema. Jobs (DESIGN.md §12):

- `publicar-lote`: publicación nocturna de las observaciones del puente.
- `recalcular`: estado reciente de cada baño, resumen mensual, confirmación de
  probables y de atributos.
- `vencer-observaciones`: borra observaciones de más de 90 días.
- `importar-osm`: **solo descarga** (ver abajo).
- `generar-bundles`: `banios.v{n}.json`, `sitemap.xml`, PMTiles.
- `notificar`: push agregado, una vez por día.
- `purgar`: sesiones, tokens, feed de amigos vencido.

## Importación de OSM: de una sola vía

> **OpenStreetMap es una fuente de solo lectura. Este worker nunca escribe en
> OSM. Si alguna vez se devuelve algo, lo hace una persona, a mano, con
> revisión.** — [ADR 0001](../../docs/adr/0001-osm-importacion-una-via.md)

**(i5)** La importación ya no vive acá: la hace la app web, en
`apps/web/src/lib/server/osm/` (DESIGN.md §0, iteración 5). No hay credenciales de edición de OSM en ningún
lado del proyecto, y un chequeo de CI rechaza cualquier llamada de escritura a
la API de OSM.

Sin implementar.
