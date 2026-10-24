# ADR 0002 — Licencia de la base de baños: ¿derivada o colectiva?

- **Estado:** propuesta, **pendiente de consulta legal**. Lo único adoptado es
  la parte técnica: un esquema que no cierre ninguna de las opciones (sección 5).
- **Fecha:** 2026-10-24
- **Relacionado:** [ADR 0001](0001-osm-importacion-una-via.md) (importación de
  una sola vía), DESIGN.md §6 y §11, OPEN-QUESTIONS.md Q-L6, Q-L9.

> Esto **no es una conclusión legal**. Describe arquitecturas y sus
> consecuencias para poder consultarlas con alguien que sepa de licencias de
> datos. Las guías de la OSMF que se citan son orientación de la comunidad, no
> fallos judiciales, y sus propios textos lo aclaran.

## 1. Contexto

La capa de baños combina dos tipos de dato:

- **Datos de OSM**: 5 `amenity=toilets` y ~73 lugares donde probablemente haya
  baño (SEEDING.md).
- **Datos propios**: lo que se levante en la recorrida a pie (con GPS de
  campo), las observaciones del puente, las ediciones del wiki y la
  información de fuentes externas (por ejemplo, la Municipalidad).

La importación es de una sola vía (ADR 0001), pero eso no decide la licencia.
Si la base resulta **derivada** de OSM y se usa públicamente, la cláusula
share-alike de la ODbL alcanza también a los datos propios: cualquiera puede
pedir la base y levantar un competidor con el trabajo de campo adentro.

Cambiar la estructura con datos cargados es carísimo. Por eso esto se decide
antes de escribir el esquema.

## 2. Qué dicen las guías de la OSMF (resumen, con fuentes)

1. **La licencia mira la base lógica, no el almacenamiento.** Un moderador del
   foro de ayuda de OSM lo dice explícitamente: tablas, esquemas, motores o
   edificios distintos no deciden la cuestión; decide cómo se usan los datos.
   ([fuente](https://help.openstreetmap.org/questions/77395/use-and-or-reference-of-osm-data-in-a-closed-software))
2. **Guía de capas horizontales (2014):** si todos los datos de un tipo de
   elemento (calles, restaurantes, parques…) vienen de fuera de OSM, el
   share-alike no se aplica a ese tipo, aunque el mapa use OSM para otros. **Si
   dentro de un mismo tipo se combina OSM con datos propios, sí se aplica,
   aunque estén en capas distintas.** El ejemplo de la guía: restaurantes de OSM
   más restaurantes propios que llenan huecos → los propios hay que compartirlos.
   ([fuente](https://osmfoundation.org/wiki/Community_Guidelines/Horizontal_Map_Layers_-_Guideline))
3. **Guía de bases colectivas (2016):** el criterio es la independencia. Los
   dos conjuntos son independientes cuando, dentro de un mismo recorte
   regional, los datos de cada tipo son enteramente de OSM o enteramente
   propios. Los dos casos que la guía describe como seguros: que los conjuntos
   **no se referencien entre sí**, o que los datos propios **reemplacen por
   completo** un tipo de geometría. La guía aclara que no son los únicos
   caminos posibles.
   ([fuente](https://osmfoundation.org/wiki/Community_Guidelines/Collective_Database_Guideline_Guideline))
4. **Guía de "sustancial" (2014):** un extracto de menos de 100 elementos se
   considera no sustancial, **salvo que sea sistemático** ("todos los lugares
   para comer de una zona"). El nuestro son 78 elementos, pero es sistemático
   (todas las estaciones de servicio, todos los supermercados…). No sirve como
   salida.
   ([fuente](https://osmfoundation.org/wiki/Community_Guidelines/Substantial_-_Guideline))
5. **Usar OSM para elegir qué datos propios levantar** (por ejemplo, usar la lista
   de OSM como hoja de ruta de la recorrida) está discutido en la lista
   legal-talk y no tiene una respuesta clara.
   ([fuente](https://lists.openstreetmap.org/pipermail/legal-talk/2019-December/008864.html))

## 3. Las arquitecturas

### A — Base mezclada (derivada asumida)

Una sola tabla de baños; los valores de OSM y los propios conviven en las mismas
filas.

| Aspecto | Qué implica |
|---|---|
| Lectura probable según las guías | Derivada. Todo lo que se use públicamente sale bajo ODbL. |
| Esquema | El más simple. |
| IDs | Se puede usar el id de OSM como clave, aunque no conviene (los ids de OSM cambian cuando alguien divide o reemplaza un objeto). |
| Consultas y API | Sin restricciones. |
| Competidor | Puede pedir la base y llevarse todo, incluida la recorrida. Pero si la mejora y la usa en público, tiene que compartir sus mejoras con la misma licencia. |
| Ventajas | Se puede devolver a OSM sin problemas de licencia. Coherente con la comunidad OSM. |
| Reversibilidad | **Ninguna.** Con los datos mezclados no se puede saber después qué vino de dónde. |

### B — Separadas en almacenamiento, unidas en presentación (la propuesta)

Dos bases: una con lo que viene de OSM y otra con los aportes propios, que se
referencian por id y se unen recién al mostrar.

| Aspecto | Qué implica |
|---|---|
| Lectura probable según las guías | **Probablemente derivada igual.** (1) La separación física no decide (punto 1 de §2). (2) Los aportes propios referencian objetos de OSM ("este horario es del baño OSM 6765403662"), así que no estamos en el caso "no se referencian" (punto 3). (3) Baños de OSM y baños propios son el mismo tipo de elemento (punto 2). |
| Qué exigiría intentar sostenerla | Ids propios; tabla de enlace con OSM aparte; la API **nunca devuelve un conjunto de datos ya unido** (dos archivos separados que une el cliente); las páginas HTML, que son "obras producidas", sí pueden mostrar todo junto con atribución. |
| Competidor | Si la lectura de "derivada" se confirma, lo mismo que A. |
| Costo | La complejidad de C sin su beneficio legal claro. |
| Reversibilidad | Alta: se puede pasar a A (publicar la vista unida) o a C (borrar la parte OSM y el enlace). |

### C — La capa de baños es 100 % propia (colectiva por reemplazo de tipo)

OSM aporta solo el mapa base (calles, edificios, agua) y nada del tipo "baños".
La base de baños se arma entera con datos propios.

| Aspecto | Qué implica |
|---|---|
| Lectura probable según las guías | Colectiva: el dato propio reemplaza por completo el tipo de elemento (puntos 2 y 3). La parte OSM (mapa base) queda bajo ODbL; la de baños, bajo la licencia que elijamos. |
| Esquema | **Ningún id de OSM** en la capa de baños. Sin tabla de enlace. |
| Geometría | Toda posición sale del GPS de campo o de una fuente externa propia. El mapa base **no muestra puntos de interés** (no hay YPF dibujada para tocar). |
| Proceso | Sin sembrado desde OSM: los 5 baños y los 73 probables no entran. La recorrida reemplaza al sembrado. |
| Choque con privacidad | Para proponer un baño nuevo, P-28 pide marcar el punto a mano en el mapa, nunca con el GPS del usuario. Marcar mirando un mapa de OSM puede leerse como derivado de OSM. Si el mapa base no tiene puntos de interés y el usuario marca sobre calles, es zona gris. |
| Competidor | **Tampoco queda del todo afuera.** Un horario es un hecho. En Argentina no hay un derecho específico sobre bases de datos como el europeo, y la Ley 11.723 protege selecciones y disposiciones originales, no hechos. Alguien puede reconstruir la base leyendo las fichas públicas. La protección real son los términos de uso y las medidas técnicas, no la licencia. |
| Costo | Cada ciudad nueva arranca de cero en la calle (OPEN-QUESTIONS.md Q-O5). No se puede usar OSM para actualizar nada. |
| Reversibilidad | Se puede pasar a A o B después (importar OSM y mezclar). |

### C' — Variante: OSM como hoja de ruta de la recorrida

Igual que C, pero quien hace la recorrida usa la lista de OSM para decidir qué
lugares visitar, y todo lo que carga lo levanta en la calle con GPS. Es el
punto 5 de §2: no está claro si "elegir qué levantar a partir de OSM" contamina
el dato. Para reducir el riesgo: la recorrida incluye lugares que no están en OSM
y carga datos que OSM no tiene (atributos completos).

## 4. Preguntas concretas para el abogado

1. Con nuestros aportes referenciando objetos de OSM por id (arquitectura B),
   ¿la base es derivada o colectiva?
2. ¿Los baños de OSM y los baños propios son el mismo "tipo de elemento" en el
   sentido de la guía de capas horizontales?
3. Una posición tomada con GPS en la calle, de un lugar que también está en
   OSM, ¿es un dato independiente?
4. Usar la lista de OSM para decidir qué lugares visitar (C'), ¿contamina lo
   levantado?
5. Una posición marcada por un usuario tocando un mapa base renderizado desde
   OSM (sin puntos de interés), ¿deriva de OSM?
6. Si se elige A, ¿alcanza con ofrecer la base derivada (o un archivo con las
   alteraciones) a pedido, y qué partes hay que incluir? Las observaciones del
   puente tienen `cuenta_id` interno: ¿se pueden excluir los datos personales
   de lo que se ofrece?
7. Con C, ¿qué protección real tiene la base frente a una copia hecha leyendo
   las páginas públicas, bajo la ley argentina?

## 5. Decisión técnica adoptada mientras tanto: esquema que preserva las opciones

Hasta tener respuesta, el almacenamiento se arma con la forma de B, que es la
única que se puede llevar a A o a C sin perder nada:

1. **Tres esquemas de Postgres separados:**
   - `osm`: copia de lo importado de OSM y todo lo que se calcula **solo** a
     partir de OSM (incluida la fusión baño ↔ estación). Se regenera en cada
     importación. Los usuarios nunca escriben acá.
   - `propio`: todo lo que no viene de OSM. Ids propios.
   - `enlace`: la única tabla que une ambos (`propio.banios.id` ↔
     `osm_tipo/osm_id`). Pasar a C = borrar este esquema y `osm`.
2. **Campo `procedencia` en cada fila de cada tabla de `osm`, `propio` y
   `enlace`, NOT NULL y sin valor por defecto.** Valores: `osm`, `gps_campo`,
   `aporte_usuario`, `fuente_externa`. `fuente_externa` (Municipalidad, un
   comercio que informa su horario) no estaba en la lista original y hace
   falta: si no, esos datos se cargarían con una procedencia falsa. Un CHECK
   impide `procedencia = 'osm'` en `propio`.
3. **La geometría tiene procedencia propia**, distinta de la del resto de la
   fila: `geom_procedencia` (`gps_campo`, `fuente_externa`,
   `aporte_usuario_mapa`). Un baño en `propio` puede no tener geometría propia
   (por ejemplo, un probable de OSM sobre el que llegó una observación). En ese
   caso el mapa usa la de OSM vía `enlace`, y en C ese baño desaparece hasta que
   alguien lo levante en la calle.
4. **Nada de lo propio se rellena con datos de OSM.** Los formularios (propuesta
   de baño, edición del wiki, ficha de la recorrida) no autocompletan nombre,
   dirección ni horario desde OSM. Copiar un valor de OSM a `propio` lo
   contamina sin dejar rastro.
5. **Dos archivos públicos que el cliente une:** `banios-osm.v{n}.json` (ODbL,
   con atribución) y `banios-propio.v{n}.json` (licencia a definir). La API
   nunca devuelve el conjunto ya unido. Las páginas SSR muestran todo junto, con
   atribución.
6. **Métrica nocturna "supervivencia a C":** qué porcentaje de los baños
   visibles tiene geometría propia y existencia confirmada por datos propios.
   Es el costo real de pasar a C en cada momento, en un número.

Costo de esta decisión: dos archivos en vez de uno, una unión en el cliente, un
esquema más y disciplina en los formularios. Es poco comparado con no poder
elegir después.
