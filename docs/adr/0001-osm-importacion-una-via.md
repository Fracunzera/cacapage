# ADR 0001 — La importación de OpenStreetMap es de una sola vía

- **Estado:** aceptada
- **Fecha:** 2026-10-24
- **Contexto completo:** [DESIGN.md §10](../../DESIGN.md#10-pipeline-de-importación-de-osm-una-sola-vía)

## Contexto

La base de baños se siembra desde OpenStreetMap. Nuestros usuarios después
corrigen y completan esos datos (horarios, si cobra, accesibilidad, existencia).
Sería técnicamente fácil sincronizar esas correcciones de vuelta a OSM.

## Decisión

**OSM es una fuente de solo lectura.** Ninguna corrección de nuestros usuarios
se escribe en OSM de forma automática. Si alguna vez se devuelve algo, lo hace
una persona, a mano, con revisión, desde una cuenta de OSM personal y siguiendo
las guías de OSM para ediciones organizadas.

## Por qué

- Las ediciones automáticas e importaciones masivas en OSM tienen reglas propias
  (discusión previa con la comunidad, documentación, cuenta dedicada). Un bot
  que sube correcciones de usuarios anónimos de una app no las cumple.
- Nuestros usuarios no aceptaron los términos de colaboración de OSM. Sus
  aportes no son, por defecto, contribuciones a OSM.
- Un error nuestro (vandalismo no detectado, un bug en el mapeo de tags) se
  propagaría a un bien común que usan muchos otros.

## Cómo se hace cumplir

1. El código de importación vive en `apps/worker/src/osm/` y **solo descarga**
   (extractos de Geofabrik; Overpass solo para exploración manual).
2. **No existen credenciales de la API de edición de OSM** en ningún archivo de
   configuración, variable de entorno ni gestor de secretos del proyecto.
3. **No hay dependencias** de clientes de escritura de la API de OSM ni de OAuth
   de OSM.
4. **Chequeo de CI**: falla si en el código aparece `api.openstreetmap.org` con
   un método distinto de GET, o los paths `/api/0.6/changeset`,
   `/api/0.6/*/create`, `/api/0.6/*/upload`.
5. Cada archivo del módulo `osm/` empieza con un comentario de cabecera que
   enuncia esta regla y enlaza este ADR.
6. La única salida "hacia OSM" es un **reporte para humanos** (CSV) con los
   atributos confirmados localmente que difieren de OSM. Nadie lo sube; una
   persona lo lee.

## Consecuencias

- Los datos de OSM y los nuestros divergen con el tiempo. Cada reimportación
  resuelve la divergencia con reglas de precedencia: lo editado localmente
  gana, y el cambio de OSM se registra como conflicto para revisión manual
  (DESIGN.md §10.5).
- **Esta decisión no resuelve la licencia.** Una base que mezcla datos de OSM con
  aportes propios y se muestra en público es probablemente una base de datos
  derivada bajo ODbL. Por eso los aportes al wiki se licencian bajo ODbL
  (DESIGN.md §10.7, OPEN-QUESTIONS.md Q-L6).
