# SEEDING.md — ¿Con qué arranca el mapa de baños?

Medición del 24 de octubre de 2026 sobre OpenStreetMap, para Río Gallegos.

## TL;DR

- **5 baños** (`amenity=toilets`) en el bbox pedido.
- **0 %** tiene horario cargado. **0** figuran como accesibles (ninguno tiene
  `wheelchair`). Ninguno tiene `name`, `fee`, `changing_table` ni `operator`.
  2 de 5 tienen `access=yes`; los otros 3 solo tienen `amenity=toilets`.
- **Los 5 están a entre 21 y 39 m de una estación de servicio.** En la práctica
  son los baños de 5 de las 13 estaciones de servicio mapeadas. **No hay ningún
  baño público municipal (de plaza, costanera o terminal) mapeado en OSM.**
- **No alcanza para lanzar.** Sembrar solo con `amenity=toilets` da un mapa de
  5 puntos sin datos. Hace falta sumar los lugares donde probablemente haya baño
  (~45-55 después de curar) y una recorrida a mano.

---

## 1. Cómo se obtuvo

**Consulta** (la exacta que pediste):

```
[out:json][timeout:60];
nwr[amenity=toilets](-51.70,-69.35,-51.55,-69.13);
out center;
```

**Endpoints:**

| Endpoint | Resultado |
|---|---|
| `https://overpass-api.de/api/interpreter` | Conexión cortada (`Connection reset by peer`) en todos los intentos, por POST y por GET, a lo largo de ~40 minutos. |
| `https://overpass.kumi.systems/api/interpreter` | Timeout de 65-90 s sin respuesta. |
| `https://overpass.private.coffee/api/interpreter` | Timeout. |
| `https://maps.mail.ru/osm/tools/overpass/api/interpreter` | **HTTP 200.** Es el que respondió. En las consultas de contexto siguientes devolvió 504 en la mitad de los intentos. |

El resultado viene de un espejo público de Overpass distinto de los dos que
indicaste. Los datos son los mismos de OSM: el espejo informa
`timestamp_osm_base = 2026-10-24T19:32:55Z`, o sea, datos de ese día. Cuando
`overpass-api.de` responda vale la pena repetir la consulta y comparar, aunque
no espero diferencias.

### 1.1 Registro de corridas

Cada vez que se corre la consulta de baños, se anota acá: desde qué instancia,
cuándo, y qué dio. **Estado: el dato no está verificado contra los servidores
oficiales** (Q-T10).

| Fecha y hora (UTC) | Instancia | Resultado | `timestamp_osm_base` | Elementos | Notas |
|---|---|---|---|---|---|
| 2026-10-24 19:11 | overpass-api.de | Conexión cortada | — | — | Primer intento (bbox levemente distinto, -51.57). |
| 2026-10-24 19:12-19:15 | overpass-api.de, overpass.kumi.systems, overpass.private.coffee | Cortada / timeout / timeout | — | — | |
| 2026-10-24 19:31-19:34 | overpass-api.de, overpass.kumi.systems, overpass.private.coffee | Cortada / timeout / timeout | — | — | Consulta exacta pedida. |
| **2026-10-24 19:34** | **maps.mail.ru** (espejo público) | **HTTP 200** | 2026-10-24T19:32:55Z | **5** | **Fuente del archivo crudo.** SHA-256 abajo. |
| 2026-10-24 19:44-19:47 | overpass-api.de, overpass.kumi.systems | Cortada / timeout | — | — | |
| 2026-10-24 19:58 | overpass-api.de | Conexión cortada | — | — | |
| 2026-10-24 20:00 | overpass.kumi.systems | Timeout (95 s) | — | — | |
| 2026-10-24 21:32 | overpass-api.de, overpass.kumi.systems | *Programado* | | | Reintento automático de la sesión. |

Que fallen siempre los mismos dos servidores, mientras otro espejo responde,
sugiere un problema de alcance desde el entorno de trabajo más que una caída de
los servidores. La verificación más rápida es correr la consulta desde otra
máquina y comparar los ids:

```
curl -s https://overpass-api.de/api/interpreter \
  --data-urlencode 'data=[out:json][timeout:60];nwr[amenity=toilets](-51.70,-69.35,-51.55,-69.13);out ids;'
```

Ids esperados: 6765403662, 6821671319, 7333713861, 12617116019, 12617116028.
**Si el resultado difiere, se frena todo lo que depende de este número hasta
revisarlo.**

**Archivo crudo:** [`data/osm-toilets-rio-gallegos.json`](data/osm-toilets-rio-gallegos.json),
sin modificar. SHA-256
`88e0d970c231d341f5ee6a7459a75d210534412774fdfa8bfde2b984910ffb4d`.
Datos © colaboradores de OpenStreetMap, bajo ODbL.

## 2. Los 5 baños

| OSM id | Lat | Lon | name | access | fee | opening_hours | wheelchair | changing_table | operator | Estación de servicio más cercana | Al lado (< 25 m) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| node 6765403662 | -51.6170213 | -69.2260112 | — | — | — | — | — | — | — | Axion (LA ESTACION S.A.), **21 m** | Spot (tienda Axion), 16 m |
| node 6821671319 | -51.6336951 | -69.2118601 | — | — | — | — | — | — | — | YPF (GUMERCINDO PACHECO SRL), **39 m** | Servicompras (tienda YPF), 22 m |
| node 7333713861 | -51.6193362 | -69.2241609 | — | — | — | — | — | — | — | YPF (GUMERCINDO PACHECO SRL), **21 m** | Full (tienda YPF), 12 m |
| node 12617116019 | -51.6168524 | -69.2092270 | — | yes | — | — | — | — | — | YPF / ACA, **21 m** | ACA tienda (9 m) y café (20 m) |
| node 12617116028 | -51.6374624 | -69.2799568 | — | yes | — | — | — | — | — | YPF (sin operador), **28 m** | Full (tienda YPF), 13 m |

Cada baño está además pegado a la tienda de su estación (Full, Servicompras,
Spot, ACA), que es donde suele estar el baño de clientes. Los dos últimos tienen
ids casi consecutivos con su estación (12617116019,
12617116028 y la YPF 12617116031): los cargó la misma persona en la misma
sesión, mapeando la estación con su baño.

**Porcentajes sobre los 5:**

| Tag | Con dato | % |
|---|---:|---:|
| `opening_hours` | 0 | **0 %** |
| `wheelchair` (accesible) | 0 | **0 %**. Ninguno figura como accesible ni como no accesible. |
| `changing_table` | 0 | 0 % |
| `fee` | 0 | 0 % |
| `name` | 0 | 0 % |
| `operator` | 0 | 0 % |
| `access` | 2 (`yes`) | 40 % |

Además consulté si había objetos con `toilets=*` (la forma de decir "este
lugar tiene baño" sobre un comercio): **0**.

## 3. Contexto: dónde más puede haber baño

Mismas coordenadas, mismo espejo, mismo día. Estas consultas no las pediste;
las hice porque sin ellas no se puede evaluar si el mapa se ve vacío.

| Categoría (tags) | En OSM | Con nombre | Con `opening_hours` | Con `wheelchair=yes` | Nota |
|---|---:|---:|---:|---:|---|
| Estaciones de servicio (`amenity=fuel`) | 13 | 12 | 1 (YPF San Cristóbal, 24/7) | 0 | 8 YPF, 4 Axion, 1 Petrobras. Es la categoría mejor mapeada: casi todas con marca y operador. |
| Gastronomía (`restaurant`, `cafe`, `fast_food`, `bar`) | 30 | 29 | 1 | 3 | 11 restaurantes, 10 cafés, 5 de comida rápida, 4 bares. **Para una ciudad de 110 mil es evidente que falta la mayoría.** |
| Supermercados (`shop=supermarket`) | 13 | 13 | 1 | 0 | 9 La Anónima, Carrefour, Diarco, El Gringo y uno llamado **"Almacén"**: justo el comercio de barrio que la whitelist quería dejar afuera, etiquetado como supermercado. |
| Hospitales (`amenity=hospital`) | 5 | 4 | 1 | 0 | Incluye el Hospital Regional, pero también una **salita de primeros auxilios** y un **dispensario** barriales. |
| Shoppings / galerías (`shop=mall`) | 4 | 3 | 0 | 0 | Patio Central, La Popular, Marcos III y uno sin nombre. |
| Terminal (`amenity=bus_station`) | 2 | 1 | 0 | 0 | Terminal de Ómnibus de Río Gallegos, más un nodo sin nombre. |
| Aeropuerto (`aeroway=aerodrome`) | 2 | 2 | 0 | 0 | Aeropuerto Internacional Piloto Civil Norberto Fernández, y el Aeródromo Río Chico. |
| Universidades (`amenity=university`) | 2 | 2 | 0 | 1 | UNPA UARG (accesible) y UTN. |
| Municipalidad / oficinas (`amenity=townhall`) | 2 | 2 | 1 | 0 | Municipalidad (lun-vie 8-15) y Archivo Histórico Municipal. |
| **Total de candidatos** | **73** | | **5 (7 %)** | **4 (5 %)** | |

## 4. Evaluación: ¿alcanza para lanzar con un mapa que no se vea vacío?

**No.** Por partes:

**Solo con `amenity=toilets`: claramente no.** Cinco puntos en una ciudad de
110 mil se ven como un mapa vacío, y encima son mudos: sin nombre, sin horario,
sin nada que diga si se puede entrar sin comprar. Quien entra buscando "baño
abierto el domingo" no encuentra la respuesta en ninguno. Y lo que sí sabemos
de ellos (que están en estaciones de servicio) es lo que cualquier vecino ya
sabe.

**Con los lugares probables: se ve poblado, pero es una promesa sin
verificar.** Los 73 candidatos, después de sacar el ruido (el "Almacén", las
salitas barriales, el archivo histórico, el aeródromo chico, los objetos sin
nombre, los duplicados), dejan **unos 45-55 lugares**. Más los 5 baños
fusionados con su estación, eso da del orden de **60 puntos**. Visualmente
alcanza para que el mapa no parezca abandonado. Pero casi todos son
"probable": no sabemos si el bar de la esquina deja usar el baño sin consumir,
si la terminal cobra o si el baño del supermercado existe. Un mapa lleno de
promesas falsas es peor que un mapa vacío: el primer usuario que va a un
"probable" y no hay baño no vuelve.

**Lo que sí alcanza: probables + recorrida a mano.** Dos o tres días
recorriendo los ~30 lugares con más tránsito (las 13 estaciones, la terminal,
el aeropuerto, el Hospital Regional, las La Anónima grandes, Carrefour, los
shoppings y una decena de bares y cafés del centro), cargando existencia,
acceso, si cobra, horario por tipo de día, accesibilidad y cambiador. Con 30
baños **confirmados y completos** más ~30 probables marcados claramente como
"sin confirmar", el mapa del lanzamiento:

- se ve poblado,
- responde de verdad la pregunta útil en los lugares donde más se la hace,
- y deja trabajo visible para que el puente convierta probables en confirmados.

**Qué contradice esto de las decisiones tomadas:**

1. **"El mapa tiene contenido el día del lanzamiento aunque no haya usuarios,
   gracias al sembrado desde OSM"** es falso con `amenity=toilets`. El sembrado
   desde OSM da **el esqueleto** (dónde están las estaciones, la terminal, los
   supermercados), no el contenido. El contenido sale de la recorrida a mano.
   La importación de una vía sigue siendo correcta; lo que cambia es la
   expectativa.
2. **El puente solo pregunta "en un lugar que ya existe en la base de baños".**
   Con 5 baños casi nunca preguntaría. Funciona solo si la base incluye los
   probables. Eso ya está incorporado en DESIGN.md §7.4: una observación en un
   probable cuenta como evidencia de que el baño existe.
3. **La whitelist por tags no alcanza sola.** El "Almacén" etiquetado como
   supermercado y las salitas como hospital muestran que filtrar por tags deja
   pasar exactamente los lugares que P-06 quería excluir. Cada probable tiene
   que pasar por una revisión humana antes de ser publicable
   (`data/curated/lugares-overrides.json`), y eso es trabajo de sembrado, no
   solo de código.
4. **La pregunta "¿hay baños públicos municipales en Río Gallegos?" no la
   responde OSM.** No hay ninguno mapeado. Puede que no existan, o que existan
   (plazas, costanera, terminal) y nadie los haya cargado. Eso solo se resuelve
   en la calle o preguntando a la Municipalidad, y define si el mapa es de
   "baños públicos" o de "baños de lugares públicos" (Q-D5).

## 5. Plan de sembrado propuesto

| Paso | Qué | Resultado esperado |
|---|---|---|
| 1 | Importar de OSM (una vía): 5 `amenity=toilets` + 73 candidatos. | ~78 objetos crudos. |
| 2 | Fusionar baños con su estación (< 50 m) y curar a mano (sacar almacenes, salitas, duplicados, sin nombre). | ~60 baños: 5 confirmados sin datos, ~55 probables. |
| 3 | Recorrida: ~30 lugares de más tránsito, con una ficha por lugar. **Ubicación con el GPS del celular en el lugar** y cada dato levantado ahí, sin copiar nada de OSM (ADR 0002). Se carga con la herramienta `/app/relevamiento` del entorno de prueba (DESIGN.md §15.6), que exporta archivos para `data/curated/recorridas/`; no se edita el wiki del entorno de prueba. | 30 confirmados con atributos completos, `procedencia = gps_campo`. |
| 4 | Consultar a la Municipalidad por baños públicos propios (ubicación, horario, si cobran). **Lo hace el responsable del producto.** | 0 a N baños públicos de verdad, `procedencia = fuente_externa`. Si son 0, la capa útil pasa a ser "comercios que te dejan pasar" (cambia el texto, no el modelo). |
| 5 | Lanzamiento. | ~60 puntos, la mitad confirmada y completa. |
| 6 | El puente y las ediciones del wiki trabajan sobre los probables. | Confirmaciones de a poco. |

**Sobre la hoja de ruta:** usar la lista de OSM para decidir qué lugares visitar
puede leerse como derivación aunque cada dato se levante en la calle (Q-L9).
Para reducirlo, la recorrida incluye también lugares que no están en OSM.

**Lo que la recorrida no debería hacer:** cargar estos datos en OSM de forma
masiva como parte del proyecto. Si se quieren devolver, es otra decisión,
manual, revisada, y con las guías de OSM para ediciones organizadas (ver
DESIGN.md §10.0).

## 6. Cómo reproducir

```
# Baños (la consulta pedida)
[out:json][timeout:60];
nwr[amenity=toilets](-51.70,-69.35,-51.55,-69.13);
out center;

# Contexto
[out:json][timeout:60];nwr[toilets](-51.70,-69.35,-51.55,-69.13);out tags center;
[out:json][timeout:60];nwr[amenity=fuel](-51.70,-69.35,-51.55,-69.13);out tags center;
[out:json][timeout:60];nwr[amenity~"^(restaurant|cafe|bar|fast_food|pub)$"](-51.70,-69.35,-51.55,-69.13);out tags center;
[out:json][timeout:60];(nwr[shop~"^(supermarket|mall)$"](-51.70,-69.35,-51.55,-69.13);nwr[amenity~"^(bus_station|hospital|university|townhall)$"](-51.70,-69.35,-51.55,-69.13);nwr[aeroway=aerodrome](-51.70,-69.35,-51.55,-69.13););out tags center;
```

Las distancias baño → estación son haversine entre el nodo del baño y el nodo o
centroide de la estación.
