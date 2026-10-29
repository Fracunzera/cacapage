# DESIGN.md — Documento de diseño

Estado: **borrador para crítica, iteración 3**. Nada de esto está implementado.

Índice:

0. [Historial de cambios](#0-historial-de-cambios)
1. [Objetivos y no-objetivos](#1-objetivos-y-no-objetivos)
2. [Modelo de amenazas](#2-modelo-de-amenazas)
3. [Las dos capas y el puente](#3-las-dos-capas-y-el-puente)
4. [Arquitectura](#4-arquitectura)
5. [Stack](#5-stack)
6. [Modelo de datos](#6-modelo-de-datos)
7. [El puente, en detalle](#7-el-puente-en-detalle)
8. [Pipeline de anonimización, paso a paso](#8-pipeline-de-anonimización-paso-a-paso)
9. [Umbrales, atribución y arranque en frío](#9-umbrales-atribución-y-arranque-en-frío)
10. [Decaimiento de datos](#10-decaimiento-de-datos)
11. [Pipeline de importación de OSM (una sola vía)](#11-pipeline-de-importación-de-osm-una-sola-vía)
12. [Endpoints](#12-endpoints)
13. [Jobs del worker](#13-jobs-del-worker)
14. [PWA ahora, app nativa después](#14-pwa-ahora-app-nativa-después)
15. [Entornos: prueba y definitivo](#15-entornos-prueba-y-definitivo)
16. [Postergado: mapa general y ranking de ciudades](#16-postergado-mapa-general-y-ranking-de-ciudades)
17. [Logros y medallas](#17-logros-y-medallas)
18. [En evaluación: "Baño amigo"](#18-en-evaluación-baño-amigo)
19. [Operación en el VPS](#19-operación-en-el-vps)
20. [Alcance de v1 y después](#20-alcance-de-v1-y-después)

---

## 0. Historial de cambios

### Iteración 5: la capa de baños, construida

Lo que se implementó y en qué se aparta de lo escrito más abajo:

| # | Cambio | Por qué |
|---|---|---|
| 1 | **Importación por Overpass, no por Geofabrik + osmium** (§11.1). Una consulta de solo lectura para toda la Argentina, una vez por semana, con tres servidores de respaldo (`overpass-api.de`, `maps.mail.ru`, `overpass.private.coffee`). | Con el filtro de §11.3 son ~11 mil objetos (6 MB): una consulta por semana es un uso razonable de Overpass y evita instalar osmium en el VPS y bajar 486 MB por semana. Si fallan los tres, se registra, se reintenta a las 6 h y se sigue mostrando la importación anterior. |
| 2 | **La importa la misma app web**, no un worker aparte con cron (§13): revisa al arrancar y cada hora, e importa si la última buena tiene más de 7 días. Un lock de Postgres evita dos importaciones a la vez. | No hay recorrida ni operación garantizada: lo que no depende de que alguien se acuerde de configurar un cron es más confiable. Código en `apps/web/src/lib/server/osm/`. |
| 3 | **Filtro de v1, más chico que §11.3:** `amenity=toilets`, cualquier objeto con `toilets=yes` o `toilets:access`, y como *probables* `amenity=fuel`, `amenity=bus_station`, `shop=mall` y `aeroway=aerodrome` con código IATA. Quedan afuera restaurantes, cafés, supermercados, hospitales y universidades **sin** `toilets=yes`. | Con todos los restaurantes (12 mil) y supermercados (7 mil) como "probables", el mapa se llenaba de puntos que no dicen nada, y P-32 los mostraría a todos como "consultá". Si un comercio tiene `toilets=yes`, entra. |
| 4 | **Un solo catálogo nacional** (`GET /api/v1/banios`, 377 KB comprimido, 10.325 puntos), no 24 archivos por provincia (iteración 4, puntos 2 y 3). | Entra entero en un pedido. Además pedir el catálogo no revela la provincia: P-01 vuelve a valer completo. Se cachea una hora con ETag. |
| 5 | **Existencia vencida: se dibuja apagada**, no se esconde (§10.4). | Casi todo lo de OSM tiene la última modificación hace más de dos años (§10.3 lo da por vencido). Esconderlo dejaba el mapa casi vacío. La ficha dice "Dato de OpenStreetMap, de abril 2022" y los filtros (Gratis, Accesible, Cambiador) nunca usan un dato vencido. |
| 6 | **Mapa base:** MapLibre (build CSP, sin `blob:` ni `eval`) con un PMTiles de la Argentina de Protomaps (z14, 1,1 GB) servido por la propia app con pedidos por rango; fuentes y sprites copiados al repo (`static/mapa/`). | Sin terceros (P-16). Sin el archivo, el mapa igual funciona con fondo liso. Instrucciones en `docs/despliegue.md`. |
| 7 | **"Cerca mío"** calcula las distancias en el celular; "Cómo llegar" abre openstreetmap.org con el destino (nunca el origen). | PRIVACY.md P-36. |

Primera importación nacional (29/10/2026): 10.325 puntos; 3.143 con baño
confirmado (1.861 baños públicos sueltos, 670 fusionados con su estación,
terminal o shopping, y 454 comercios con `toilets=yes`) y 7.182 probables
(5.454 estaciones de servicio sin el dato). Detalle en SEEDING.md §8.

**Registrar, historial y medallas** (`/app`, código en `apps/web/src/lib/boveda/`):

| # | Cambio | Por qué |
|---|---|---|
| 8 | **El código de recuperación es obligatorio** al crear el historial: se muestra una vez, con "Copiar" y "Descargar", y no se sigue sin tildar "Ya lo guardé". La llave de las passkeys (PRF) queda para después. | Saltearlo dejaba la llave solo en ese navegador: al entrar desde otro celular se crearía una segunda bóveda y las dos no se podrían juntar. P-03 ya contaba con esta fricción. |
| 9 | **Salir borra la copia local** del historial (llave incluida). Al volver a entrar se pide el código. | Un celular prestado no tiene que quedar con el historial de otro (P-37). |
| 10 | **"Perdí el código" → empezar de cero** (`DELETE /api/v1/boveda`, exige haber entrado hace menos de 5 minutos). Borra páginas y llave. | Sin el código el historial ya no se puede leer; lo único útil es poder empezar otro. |
| 11 | El registro tiene dónde fue (7 tipos), cuándo ("Recién" o "Fue antes"), ubicación opcional con los baños del catálogo a menos de 150 m (preselección según P-05 y P-29), "No había papel" y "¿Alguna anécdota?". | §6.1, §8 pasos 1-2, §8.1. Lo que publica (puente, amigos, zonas privadas, detección de casa) sigue sin implementar: hoy nada sale del historial. |
| 12 | Cifrado: un secreto de 32 bytes del que salen por HKDF la llave AES-GCM de las páginas y la HMAC de sus ids; las dos quedan en IndexedDB como llaves **no exportables**. El secreto se envuelve con PBKDF2-SHA256 (310 mil iteraciones) del código de 128 bits. | §6.2 y P-04: páginas mensuales con id opaco y relleno a 4 KB. La sincronización mezcla por registro (gana el último cambio; los borrados quedan marcados para que ganen en todos los celulares). |
| 13 | **Asociar un mail a una cuenta que ya existe** (creada con passkey o contraseña), desde "Mi cuenta": `POST /api/v1/cuenta/mail` manda un link y el mail se asocia recién al abrirlo. Si la cuenta ya tenía uno, lo reemplaza; se puede quitar si queda otra forma de entrar (`DELETE`). | Pedido del producto: poder entrar con mail aunque te hayas registrado con passkey. Igual que el alta (P-12): se guarda solo el HMAC, y la respuesta es siempre 202, así que no revela si el mail ya es de otra cuenta (ese aviso le llega solo al dueño del mail). |
| 14 | **Tope de la bóveda por cuenta:** 500 páginas y 10 MB en total; 256 KB por página. Se controla dentro de la transacción del `PUT`, con la fila de la cuenta bloqueada, y responde 413 con un mensaje claro. | Sin tope, cualquier cuenta podía usar la bóveda como disco. Con páginas mensuales de 4 KB, el tope son más de 40 años de historial. Los 256 KB por página son lo que entra en el límite de cuerpo de adapter-node (512 KB en base64). |
| 15 | **Cacas públicas (opt-in por registro)** y **mapa de cacas** (`/cacas`), con seudónimo y día, nunca casa/laburo/lo de alguien, 2 h de demora. Tabla `publicaciones`; `PUT`/`DELETE /api/v1/publicaciones/{id}` y `GET /api/v1/publicaciones`. En un baño del catálogo se publica el baño; en el resto, el punto a ~11 m. La ficha de cada baño en `/mapa` muestra sus visitas públicas. | Decisión del producto: "que cada uno decida si es público; ver los lugares más raros donde hizo la gente". Cambia P-01 y el invariante de superficies para lo publicado: PRIVACY.md P-38. No es el mapa general agregado de §16.1, que sigue postergado. |
| 16 | **Mi mapa** (`/app/mapa`): las cacas propias con ubicación, armado en el celular desde la bóveda, con el cambio público/privado en la ficha. | No expone nada: no sale del celular. |
| 17 | **Puntaje y reportes de baños**, en la ficha de `/mapa`, con cuenta. Puntaje de 1 a 5 rollos 🧻 (uno por cuenta y baño, se puede cambiar); se muestra solo el promedio y la cantidad. Reporte con motivo (no existe, no es público, mal ubicado, otro), uno por cuenta. **Con 15 reportes de cuentas elegibles (7 días o más y al menos un día con registros), el baño queda "en revisión"**: sigue en el mapa con un aviso y el motivo más reportado. **Nada se oculta solo:** ocultar y des-ocultar es a mano (`banios_ocultos`, que sobrevive a las importaciones de OSM), con los comandos de `docs/despliegue.md`, "Reportes de baños". | Pedido del producto, con revisión: ocultar automáticamente dejaba que 15 cuentas truchas sacaran un baño. La elegibilidad usa `dias_activos` (el servidor sabe en cuántos días se escribió la bóveda, no qué). Un reporte no se escribe en OSM (ADR 0001). |
| 18 | **Entrar con Google** (opcional, con `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`): crear cuenta, entrar, y asociarlo o quitarlo desde "Mi cuenta". OIDC por redirección desde el servidor, solo `openid`, PKCE + `state` + `nonce`; se guarda el HMAC del `sub`. | Pedido del producto: es el botón de menor fricción en Argentina. Revierte D-06: PRIVACY.md P-39. Sin las variables, el botón no aparece. |
| 19 | **Sin código de recuperación: la llave del historial queda en custodia del servidor** (`GET`/`PUT /api/v1/boveda/custodia`), sellada con una llave derivada de `PIMIENTA_MAIL`. Al entrar con cualquier método el historial se abre solo; los historiales viejos con código lo piden una última vez. Reemplaza a los puntos 8 y 9 en lo del código: salir sigue borrando la copia del celular, pero vuelve sola al entrar. | Decisión del producto. Deja de ser cifrado de punta a punta frente a nosotros: PRIVACY.md P-40. |
| 20 | **SEO y vista previa al compartir:** `/sitemap.xml` dinámico (las 5 páginas públicas, con `lastmod`: la importación de OSM para `/mapa`, la última caca pública para `/cacas`, la versión del texto para las legales, el build para `/`); `robots.txt` con `Disallow: /api/` y `Sitemap:`; `noindex` (meta y `X-Robots-Tag`) en `/app/*` y `/api/*`; canonical, Open Graph y Twitter Card en cada página pública (`Seo.svelte`) con `static/og.png` de 1200×630 (`scripts/generar-og.mjs`). | `/app/` va con `noindex` y **sin** `Disallow`: si robots.txt la bloquea, Google no puede leer el `noindex` y la URL puede aparecer igual. En prueba, robots.txt no bloquea nada y todo es `noindex`. Pendiente: una página por baño (`/banio/n123`), server-side y en el sitemap. |
| 21 | **Ubicación a mano** al registrar: dirección, coordenadas o link de un mapa, además del GPS (`src/lib/ubicacion/interpretar.ts`). Links cortos de Google y direcciones se resuelven en el servidor (`/api/v1/ubicacion/corto` y `/buscar`, con Nominatim; `NOMINATIM_URL` opcional). El registro guarda `fuente_ubicacion: 'manual'`; precisión 20 m para coordenadas y links, 50 m para direcciones (así una dirección nunca preselecciona un baño, P-05). | Pedido del producto: "por si alguien no quiere compartir la ubicación". PRIVACY.md P-41. |
| 22 | **Mapa mundial:** `teselas/mundo.pmtiles` (hasta zoom 8) de fondo en todos los zooms y, encima, `argentina.pmtiles` desde el zoom 9 (`estilo.ts`, capas `ar-*`). Sin `maxBounds`: el mapa arranca en la Argentina pero se puede ir a cualquier lado. Se registra y se publica desde cualquier país; Nominatim busca en todo el mundo. **Los baños siguen siendo solo de la Argentina**: afuera no se sugieren. | Pedido del producto. PRIVACY.md P-38 y P-41 actualizadas. |
| 23 | **Seguridad:** cambiar o quitar el mail o Google exige haber entrado hace menos de 5 minutos (`exigirReautenticacion`), como borrar la cuenta. Contraseña: demora creciente en vez de bloqueo de una hora (por cuenta y conexión: 5 libres, después 2 s duplicando hasta 15 min; por cuenta desde cualquier lado: 20 libres, tope 60 s). `servidor.js` arranca adapter-node con una protección: un estático ilegible responde 500 en vez de tirar el proceso; `/tiles` abre el archivo antes de responder. | Con la custodia del historial (P-40), una sesión robada alcanzaba para cambiar el mail y quedarse con la cuenta. Con seudónimos públicos en `/cacas`, el bloqueo fijo dejaba a cualquiera sin entrar. |

### Iteración 4: alcance nacional

Decisión del producto: **el producto es para toda la Argentina, con un mapa
nacional de baños desde el lanzamiento**, no un piloto de Río Gallegos. Motivos:
una web para una ciudad de 110 mil habitantes es difícil de vender, y en un
lugar donde todos se conocen el seudónimo protege poco (A2 tiene más contexto en
un pueblo que en un país).

Lo que cambia (detalle de lo pendiente en OPEN-QUESTIONS.md, sección
"Iteración 4"):

| # | Cambio | Consecuencia |
|---|---|---|
| 1 | El sembrado nacional sale de OSM: 2.636 baños y 6.048 estaciones de servicio (SEEDING.md §7). La recorrida a pie queda para Río Gallegos. | El mapa no se ve vacío, pero casi todos los puntos son "probables" o tienen pocos datos (1 de cada 5 dice si cobra). |
| 2 | **El catálogo se parte por provincia** (24 archivos) en vez de uno por ciudad. El cliente baja la provincia que está mirando o donde está. | P-01 se mantiene: ninguna coordenada viaja. El costo declarado en P-01 ("pedir la región revela la región") ahora es "revela la provincia". |
| 3 | **Mapa nacional:** a zoom de país se muestra un resumen por provincia (cantidad de baños); al acercarse, se carga el catálogo de esa provincia. | No hace falta bajar ~50 mil puntos de entrada. |
| 4 | **Mapa base nacional:** PMTiles de la Argentina servido desde el VPS, sin terceros (P-16). | Un archivo de varios cientos de MB a algunos GB según el zoom máximo (a medir, Q-T11). Los pedidos de tiles dicen qué zona se mira; como no hay log de acceso en `/tiles`, no se guardan. |
| 5 | **Licencia:** a escala nacional la arquitectura C del ADR 0002 (base 100 % propia) deja de ser viable: no se puede relevar el país a pie. Quedan A o B. | Lo más probable es que los aportes de usuarios salgan bajo ODbL. La pregunta para el abogado pasa de "¿derivada o colectiva?" a "¿cómo se cumple ODbL y qué se puede proteger?" (Q-L6). Lo relevado en Río Gallegos queda separable por `procedencia = gps_campo`. |
| 6 | El ranking de ciudades (§16.2) se vuelve viable antes: su condición es "2 ciudades con ≥ 10 participantes". | Sigue postergado hasta cumplirla. |
| 7 | El mapa general de registros (heatmap, §16.1) **sigue postergado**: "mapa nacional" en esta iteración es el mapa de baños, no un mapa de dónde caga la gente. | Ver Q-N16. |
| 8 | **Marca y dominio:** "Dónde Cagué", `dondecague.com.ar`. | Q-N4 resuelta. |
| 9 | **Primera versión con cuentas** (no sin cuentas): un historial que se pierde al cambiar de celular no es un historial real. Implementadas las cuentas (§6.3): passkey, link por mail, sesión, borrado. | Pendiente: registro, historial cifrado (§6.2), medallas, mapa. |
| 10 | `MAIL_MODO=desactivado`: producción puede arrancar solo con passkeys y contraseña hasta tener proveedor de mail. | El link por mail queda para después (Q-L5). |
| 12 | **Contraseña** como tercer método (seudónimo + contraseña, sin mail), además de passkey y link por mail. Decisión del producto: solo passkey dejaba afuera a mucha gente. | Si te olvidás la contraseña y no tenés otro método, la cuenta no se recupera (no tenemos tu mail). PRIVACY.md P-35. |
| 11 | Un solo `docker compose` con Caddy para producción (`ORIGEN_PUBLICO`) y prueba (`ORIGEN_PRUEBA`), y un Postgres con una base para cada uno (`docs/despliegue.md`). | Cada contenedor sigue viendo un único `ORIGEN_PUBLICO` (§15.1). |

### Iteración 3

| # | Cambio | Origen |
|---|---|---|
| 1 | El **mapa general** (heatmap) pasa de "eliminado" a **postergado**, con condiciones de reactivación (§16). | Decisión del producto: era un requisito explícito; v1 sale sin él. |
| 2 | **Invariante de superficies** en PRIVACY.md: sin agregado, lo único público es el wiki de baños; toda superficie que derive de registros está inventariada. | Pedido explícito, para que una vista social en v2 no reintroduzca el problema. |
| 3 | **Estado reciente por atribución, no por umbral**: "1 persona, esta semana: limpio" / "4 de 5, últimos 30 días: limpio". Una observación por persona, por baño y por ventana. | Decisión del producto. Ajuste mío: la fecha va con granularidad de semana, no "hace 3 días" (§9.2). |
| 4 | **Almacenamiento que preserva las opciones de licencia**: esquemas `osm`, `propio` y `enlace`; campo `procedencia` NOT NULL sin default en todas las filas; geometría con procedencia propia; dos archivos públicos que une el cliente. | ADR 0002. `procedencia` es requisito del producto; agregué el valor `fuente_externa`. |
| 5 | **Recorrida con GPS de campo**; los formularios propios no se rellenan desde OSM. | Decisión del producto + ADR 0002 §5. |
| 6 | **Tercera pregunta del puente**, opcional, una por registro, solo para horario, cobro y acceso, que se pausa después de dos salteos seguidos (§7.3). | Decisión del producto. |
| 7 | **Decaimiento de datos** diseñado asumiendo que no hay recorrida periódica (§10). | Pedido explícito. |
| 8 | **Entorno de prueba** en `caca.blucaro.site`: sin passkeys, cuentas descartables, noindex, dominio en una sola variable, banner (§15). | Decisión del producto. Corrección: el `noindex` no va en robots.txt (§15.3). |
| 9 | **"Baño amigo"** evaluado como alternativa, sin adoptar (§18). | Pedido explícito. |
| 9b | **Regla asimétrica de exposición** adoptada para v1 (§18.4, P-32). **Medallas** cada 5 registros con nombres graciosos y **logro por el primer registro** (§17). **Caja de comentario privada** "¿Alguna anécdota?" al registrar (§8.1, P-34). | Decisiones del producto, posteriores a la primera versión de la iteración 3. |
| 10 | Se unifican ediciones del wiki y confirmaciones en una tabla de **evidencias** con procedencia y fecha. Las fichas muestran fuente y fecha de cada dato. | Consecuencia de 3, 4 y 7: si cada dato lleva procedencia y fecha, la atribución vale para todo el wiki, no solo para el estado reciente. |

### Iteración 2 (resumen)

OSM tiene 5 `amenity=toilets` en Río Gallegos, todos en estaciones de servicio
(SEEDING.md). Dos capas con toggle (Registros = evento privado, Baños = lugar en
un wiki público). Base de baños con probables. Limpieza y papel como
observaciones que vencen, no como atributos. Leer el wiki sin login, editar con
cuenta. Sin contadores de visitas, ranking ni heatmap en v1. Importación de OSM
de una sola vía (ADR 0001). PWA empaquetable con Capacitor. Correcciones de la
crítica adversarial: sin `faltan` exacto, viajes a amigos recién a la vuelta,
madrugada y noche sin preselección, precisión GPS mínima de 50 m.

### Iteración 1 (resumen)

El servidor nunca recibe coordenadas; historial cifrado de punta a punta; snap
como sugerencia con confirmación; whitelist de categorías; sin jitter; zonas
privadas y detección de domicilio solo en el dispositivo; passkeys y mail como
HMAC; tiempo generalizado y publicación diferida; tiles propios. El detalle está
en PRIVACY.md.

---

## 1. Objetivos y no-objetivos

**Objetivos**

- O1. Registrar en menos de 10 segundos, con una mano, aunque no haya señal.
- O2. Una capa de baños **nacional** que se vea poblada el día uno y que Google
  indexe.
- O3. Que el chiste alimente el dato útil sin que se sienta un formulario.
- O4. Que ni otro usuario, ni un amigo, ni alguien con un dump pueda saber dónde
  vive un usuario o cuándo no está en casa.
- O5. Que lo opere una persona sola en un VPS.
- O6. Que la misma base de código se pueda empaquetar como app nativa.
- O7. **(i3)** Que los datos se degraden bien solos: ningún atributo depende de
  un refresco manual del equipo para seguir siendo útil, y un dato viejo nunca se
  muestra como vigente.
- O8. **(i3)** Que la decisión de licencia (derivada o colectiva) se pueda
  tomar después sin rehacer la base.

**No-objetivos**

- No es una app de salud (P-02).
- No es una red social: sin fotos, sin texto libre público, sin seguidores.
- No escribe en OpenStreetMap, nunca de forma automática (ADR 0001).
- No protege contra un operador malicioso que modifique el código servido (L1).

## 2. Modelo de amenazas

Actores (sin cambios respecto de la iteración 1, más A8):

| Actor | Qué sabe / puede | Qué queremos que **no** pueda |
|---|---|---|
| A1. Público general | Lee el wiki de baños, sin cuenta. | Identificar a una persona o un domicilio. |
| A2. Conocido con contexto (amigo, ex, vecino) | Sabe tu seudónimo; puede ser tu amigo en la app. | Saber cuándo no estás en casa; ubicar tu casa. |
| A3. Atacante con dump o backup | Todo lo guardado en el servidor. | Leer historiales, ubicar domicilios, vincular seudónimos con personas. |
| A4. Operador curioso | A3 + mirar en vivo. | Lo mismo que A3 sobre lo guardado. |
| A5. Pedido judicial | Lo guardado. | Que haya algo comprometedor. |
| A6. Terceros de red (tiles, fuentes, mail, **servicios de push**) | IP, metadatos. | Saber que usás esto, dónde estás y cuándo registrás. |
| A7. Sybil / spam / vandalismo del wiki | Crea cuentas, edita. | Degradar umbrales; ensuciar o borrar datos de baños. |
| A8. Comercio afectado | Lee el wiki. | Identificar a quien dijo "evitalo" de su baño. |

**Limitaciones declaradas:**

- **L1. Cripto en una web.** El servidor sirve el JS que cifra. Un servidor
  comprometido puede robar llaves. Una app nativa firmada mejora esto (§14.5),
  pero solo para quien la instale.
- **L2. Metadatos de tráfico.** El servidor ve cuándo se conecta cada cuenta.
  Achicado con envío diferido y sin logs de acceso.
- **L3. Observaciones con autor durante 90 días.** Para frenar spam y deduplicar,
  las observaciones del puente y las evidencias del wiki guardan `cuenta_id`.
  Las observaciones y las evidencias del puente y de la tercera pregunta lo
  pierden a los 90 días; las ediciones del wiki lo conservan para poder
  revertir vandalismo (Q-P3).

**(i3)** A8 suma un caso: un comercio adherido a "Baño amigo" (si se adopta)
podría pedir datos de "cuánta gente vino". La respuesta está en el invariante de
superficies de PRIVACY.md.

## 3. Las dos capas y el puente

Una sola web, un solo mapa, un toggle arriba: **Mis registros / Baños
públicos**.

| | **Registro** | **Baño** |
|---|---|---|
| Qué es | Un **evento**: usuario + momento + lugar. | Un **lugar**: existe, persiste, tiene atributos. |
| Modelo | Log que se acumula. | Wiki con evidencias: cada dato con procedencia y fecha. |
| Quién lo ve | Su dueño (y sus amigos, con protecciones). | Todo el mundo, sin login, indexado. |
| Quién lo escribe | Su dueño. | Usuarios con cuenta, la recorrida, fuentes externas, OSM (de una vía). |
| Dónde vive | En el dispositivo; en el servidor, cifrado. | En el servidor, en claro, en los esquemas `osm`, `propio` y `enlace`. |
| Vida útil | La que quiera el dueño. | Indefinida, con decaimiento por atributo (§10). |

Lo que cruza de Registros a Baños, siempre por acción del usuario:

1. **El puente** (§7): "¿cómo estaba?" y "¿había papel?", más una tercera
   pregunta ocasional sobre un atributo dudoso.
2. **Una edición o una confirmación del wiki** desde la ficha del baño ("Sigue
   igual").

Nada más cruza. El inventario completo de lo que deriva de registros está en
PRIVACY.md, "Invariante de superficies".

**Qué muestra el toggle:**

- **Baños públicos** (default sin sesión, y default para quien entra por un link
  de baño): baños confirmados con estilo lleno; probables con estilo hueco y la
  leyenda "sin confirmar"; filtros por "abierto ahora según horario cargado",
  "gratis", "accesible", "cambiador".
- **Mis registros** (default con sesión): mis pines en el mapa (dibujados en el
  cliente desde la bóveda descifrada; el servidor no los conoce), mis zonas
  privadas sombreadas, logros. Dentro de esta capa, una pestaña "Amigos" con el
  feed.

Las dos capas comparten el mapa base y el catálogo de baños: en "Mis
registros" los baños aparecen tenues para dar contexto.

**(i3)** En "Baños públicos", cada pin se dibuja además según la frescura de
sus datos (§10.4), y los filtros nunca usan datos vencidos.

## 4. Arquitectura

```
┌────────────────────────── Cliente (PWA hoy · Capacitor mañana) ──────────────────────────┐
│ UI /app/* (sin SSR) · packages/core · packages/vault · packages/platform                  │
│ Une en memoria: banios-osm.v{n}.json (ODbL) + banios-propio.v{n}.json (licencia a definir)│
│ Cola de salida en IndexedDB (la maneja la app, no el service worker)                      │
└──────────────────────────────┬───────────────────────────────────────────────────────────┘
                               │ HTTPS · cookie __Host- (web) o bearer (nativo)
                               ▼
┌────────────────────────────────────── VPS ───────────────────────────────────────────────┐
│ Caddy ── apps/web (SSR público /b/* + API /api/v1) ── config: ORIGEN_PUBLICO, ENTORNO     │
│              │                                                                           │
│              ▼  Postgres + PostGIS                                                       │
│   ┌──────────────── esquema osm ────────────────┐  ┌──────── esquema enlace ────────┐    │
│   │ objetos, fusiones (solo derivado de OSM)    │◄─┤ banio_osm (propio ↔ osm)       │    │
│   │ procedencia = 'osm'; lo regenera la import. │  │ procedencia por fila           │    │
│   └─────────────────────────────────────────────┘  └───────────────┬────────────────┘    │
│   ┌──────────────── esquema propio ─────────────────────────────────▼─────────────────┐  │
│   │ banios · evidencias · atributos_vigentes · observaciones (90 d) · estado_reciente │  │
│   │ propuestas · procedencia NOT NULL sin default, nunca 'osm'                        │  │
│   └───────────────────────────────────────────────────────────────────────────────────┘  │
│   cuentas · bóveda (cifrada) · feed_amigos (30 d) · push · consentimientos               │
│                                                                                          │
│ apps/worker (cron): import OSM (solo descarga) · publicación nocturna · frescura ·       │
│                     bundles · métrica de supervivencia a C · backups                     │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

Lo que no cambia: **ninguna coordenada de usuario llega al servidor**.

## 5. Stack

| Pieza | Elección | Por qué | Alternativa razonable |
|---|---|---|---|
| Frontend + API | **SvelteKit** (TypeScript, adapter-node), un solo proceso | Una persona, un deploy. SSR para que los links compartidos tengan vista previa (crítico para el viral). Bundles chicos para Android baratos en 4G patagónico. | Vite + Preact SPA y una API Fastify aparte. Más piezas, sin SSR fácil. |
| Mapa | **MapLibre GL JS** + **PMTiles** autoalojado | Tiles vectoriales: se puede dar estilo propio (identidad local), un solo archivo estático servido con range requests, sin servidor de tiles. Sin terceros. | **Leaflet + protomaps-leaflet** sobre el mismo PMTiles. Más liviano (~40 KB contra ~200+ KB de MapLibre), menos lindo. Si el peso en celulares baratos resulta un problema, se cambia sin tocar los datos. Lo que no es negociable es la fuente de los tiles (PRIVACY.md D-07). |
| Offline | Service worker + IndexedDB | La Ruta 3 en Santa Cruz tiene tramos largos sin señal. Registrar offline y mandar después coincide con el envío diferido que igual queremos por privacidad. | — |
| Cripto cliente | **WebCrypto** (AES-GCM 256, HKDF) | Nativo, sin dependencias. | libsodium-wasm si hiciera falta algo que WebCrypto no tiene. |
| Auth | **WebAuthn/passkeys** (`@simplewebauthn`), magic link de respaldo | Sin datos personales; la extensión PRF permite derivar la llave de la bóveda (P-03, P-11). | — |
| Índice espacial cliente | **h3-js** | Agrupar registros para detectar domicilio. | Distancia haversine directa; con pocos miles de registros alcanza. |
| Base | **Postgres 16+ con PostGIS 3** | Se mantiene. Aunque el servidor ya no recibe coordenadas de usuarios, PostGIS sigue siendo útil para importar OSM, filtrar por categoría y corredor (Ruta 3), y para las macrozonas si vuelve el ranking. | — |
| Acceso a datos | SQL plano en migraciones + query builder tipado (Kysely) | Migraciones legibles; tipos sin ORM pesado. | Drizzle. |
| Worker | Node + cron del sistema | Cinco jobs nocturnos no justifican una cola. | — |
| Proxy | **Caddy** | TLS automático, configuración corta, fácil apagar logs por ruta. | nginx + certbot. |
| Mail (solo magic link) | Proveedor transaccional | Mandar mail desde la IP de un VPS a Hotmail/Outlook o Gmail termina en spam. Costo: un tercero ve las direcciones (ver Q-L5). Si las passkeys alcanzan, se elimina. | SMTP propio con SPF/DKIM/DMARC; probable fracaso de entregabilidad. |
| Analytics | Ninguno en v1, o contador propio sin cookies y sin IP | Cualquier analytics de terceros es A6. | Umami/Plausible autoalojado. |
| Despliegue | Docker Compose en el VPS, backups con restic | Simple y reproducible. | — |

Todo en un monorepo TypeScript (pnpm workspaces) para que el cliente y el
servidor compartan los mismos esquemas de validación y la misma lógica de
franjas y semanas.

**Ajustes de la iteración 2**, por la PWA y el camino a Capacitor:

| Pieza | Elección | Nota de esta iteración |
|---|---|---|
| Frontend + API | SvelteKit (TS) | **Dos tipos de rutas**: públicas con SSR (wiki de baños, tarjetas compartibles, para SEO y vista previa en WhatsApp) y de app bajo `/app/*`, solo CSR, compilables con `adapter-static` para meterlas en Capacitor (§14). |
| PWA | Web App Manifest + service worker (Workbox o a mano) | El service worker solo cachea assets y tiles. **Ninguna lógica de negocio en el service worker.** |
| Push | Web Push con VAPID (Android, e iOS si la PWA está instalada) | Servidor con abstracción de transporte para sumar FCM/APNs en la app nativa. |
| Mapa | MapLibre GL JS + PMTiles propio | Igual. |
| Auth | Passkeys (WebAuthn) + magic link | **Dominio definitivo antes del lanzamiento**: las passkeys quedan atadas a él (§14.3, Q-N4). |
| Empaquetado futuro | Capacitor | No se instala en v1; la arquitectura lo prevé. |
| Import OSM | osmium-tool + script propio | Fuente: extracto de Geofabrik. Overpass solo para exploración manual (§11.1). |

**(i3)** Ajustes:

- **Tres esquemas de Postgres** (`osm`, `propio`, `enlace`) en la misma base
  (ADR 0002 §5).
- **Mapa base sin puntos de interés**: el estilo de PMTiles no dibuja comercios
  ni estaciones de OSM, solo calles, edificios, agua y nombres de calles. Así
  nadie "marca un baño" tocando un punto de OSM (ADR 0002, arquitectura C). Los
  baños los dibuja la capa propia.
- **Configuración por entorno** con `ORIGEN_PUBLICO` y `ENTORNO` (§15).

## 6. Modelo de datos

Convenciones: castellano, `snake_case`. Ninguna tabla guarda coordenadas de
usuarios, IPs ni user agents.

### 6.1 Capa REGISTROS — en el dispositivo (IndexedDB)

No es una tabla del servidor: vive en el cliente y se sincroniza cifrada.

**`registros`**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid v4 | Generado en el cliente. |
| `ocurrido_en` | timestamp con zona | Exacto. |
| `lat`, `lon`, `precision_m` | double / real, nullable | Exactos. `precision_m` es la informada por la plataforma; el pipeline usa `max(precision_m, 50)` (§8). |
| `fuente_ubicacion` | enum | `gps`, `manual`, `ninguna`. |
| `banio_id` | bigint, nullable | Solo si el usuario confirmó un baño del catálogo. |
| `tipo` | enum | `casa`, `laburo`, `casa_ajena`, `banio_publico`, `ruta`, `naturaleza`, `otro`. |
| `sin_papel` | bool | Para logros. |
| `comentario` | texto, nullable, hasta 500 caracteres | Privado: vive solo en la bóveda cifrada y nunca sale del dispositivo en claro. Se carga con la caja "¿Alguna anécdota?" (§8.1). |
| `en_zona_privada` | uuid, nullable | Calculado. Si no es null, no se publica nada de este registro, nunca. |
| `puente` | objeto, nullable | `{ estado: 'pendiente'|'respondido'|'descartado', estado_banio?, habia_papel?, id_remoto? }`. |
| `amigos` | objeto, nullable | `{ estado: 'no'|'en_cola'|'diferido_a_la_vuelta'|'enviado', id_remoto? }`. |
| `actualizado_en` | timestamp | Solo dentro de la bóveda. |

**`zonas_privadas`**: `id`, `nombre`, `lat`, `lon`, `radio_m` (default 200,
rango 100-1000), `rol` (`casa`, `laburo`, `otra`), `origen` (`manual`,
`sugerida_noche`, `sugerida_laburo`), `creada_en`.

**`preferencias`**: reglas de publicación recordadas (p. ej. "contarle siempre a
mis amigos cuando estoy en una estación de servicio"; no se aplican en madrugada
ni noche, P-29), estado del onboarding (`casa_definida: si | no_quiero`),
progreso de logros cacheado y `puente_activo` (default `true`; apagarlo hace que
nunca se pregunte).

**`cola_salida`**: aportes generalizados pendientes de envío (§8, paso 9).

**`descartes_sugerencia`**: grupos de registros que el usuario dijo que no son
su casa ni su laburo, para no volver a preguntar.

Los **logros** se calculan acá, sobre `registros`, incluidas las zonas
privadas.

**(i3)** Nuevo en `preferencias`: `tercera_pregunta = { salteos_seguidos: n,
pausada_hasta: fecha | null }` (§7.3).

**(i3)** `medallas_obtenidas`: `numero`, `obtenida_en`. Dentro de la bóveda;
el servidor no las conoce (§17.7).

### 6.2 Bóveda (servidor, cifrada)

El servidor guarda bytes que no puede leer. Para no revelar cuántos registros
hay ni cuándo se hicieron (L2):

- Los registros se agrupan en **páginas mensuales** (`2026-10`), más una página
  de `zonas_y_preferencias`. Lo que ve el servidor es "esta cuenta tiene 14
  páginas", no "esta cuenta tiene 412 registros".
- Cada página se rellena (padding) al múltiplo de 4 KB siguiente antes de
  cifrar.
- Las filas no tienen timestamps: la sincronización usa un número de secuencia.

**`boveda_paginas`**

| Campo | Tipo | Notas |
|---|---|---|
| `cuenta_id` | uuid FK | |
| `pagina_id` | texto | Identificador opaco elegido por el cliente: `HMAC(llave, "2026-10")`, para que el servidor no sepa a qué mes corresponde. |
| `seq` | bigint | Secuencia global, para "dame lo que cambió desde N". |
| `version` | int | Concurrencia optimista entre dispositivos. |
| `nonce` | bytea (12) | |
| `cifrado` | bytea | AES-GCM 256. |

PK `(cuenta_id, pagina_id)`.

**`boveda_llaves`**: la llave de bóveda envuelta, una fila por forma de
desenvolverla.

| Campo | Tipo | Notas |
|---|---|---|
| `cuenta_id` | uuid FK | |
| `metodo` | enum | `passkey_prf` (envuelta con una llave derivada por PRF de esa credencial), `recuperacion` (envuelta con una llave derivada del código de recuperación con un KDF lento). |
| `credencial_id` | bytea, nullable | Solo para `passkey_prf`. |
| `envuelta` | bytea | |
| `parametros` | jsonb | Sal, parámetros del KDF. |

Sin PRF ni código de recuperación, la llave vive solo en ese navegador: si se
borra, el historial se pierde (P-03 detalla el costo).

### 6.3 Cuentas y autenticación

**`cuentas`**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `seudonimo` | citext único | 3-24 caracteres, `[a-z0-9_]`, lista de palabras reservadas. Obligatorio. |
| `creada_en` | date | Día, no hora. Se usa para la elegibilidad anti-Sybil (§9.4). |
| `mayor_de_edad` | bool | Declaración al registrarse (ver Q-L3). |
| `estado` | enum | `activa`, `suspendida`. |
| `dias_con_aportes` | smallint | Contador para elegibilidad (§9.4). Se incrementa por lote recibido, a lo sumo una vez por día. |

No hay nombre, mail, teléfono, fecha de nacimiento ni foto.

**`credenciales_passkey`**: `id`, `cuenta_id`, `credencial_id` (bytea único),
`clave_publica` (bytea), `contador_firma`, `transportes` (text[]), `soporta_prf`
(bool), `creada_en` (date). Sin "último uso".

**`logins_mail`**: `cuenta_id` (único), `mail_hmac` (bytea único) =
`HMAC-SHA256(PIMIENTA, normalizar(mail))`. La pimienta vive en una variable de
entorno, no en la base. El mail en claro existe solo en memoria durante el
pedido, para mandar el link.

**`tokens_magic_link`**: `token_hash` (bytea), `mail_hmac`, `vence_en`
(timestamptz, 15 min), `usado` (bool). Se purga cada hora.

**`sesiones`**: `id_hash`, `cuenta_id`, `vence_en`. Sin IP, sin user agent.
Cookie `HttpOnly`, `Secure`, `SameSite=Lax`.

**`consentimientos`**: prueba del consentimiento exigida por la Ley 25.326
(art. 5).

| Campo | Tipo | Notas |
|---|---|---|
| `cuenta_id` | uuid FK | |
| `tipo` | enum | `terminos`, `publicar_lugares`, `publicar_zona`, `amigos`, `insignias_publicas`. |
| `version_texto` | texto | Remite al texto exacto en `docs/legal/`. |
| `otorgado_en` | date | |
| `revocado_en` | date, nullable | |

**Cambios de la iteración 2:**

- **`cuentas`**: se reemplaza `dias_con_aportes` por `dias_activos` (smallint):
  días distintos con al menos una sincronización, sea cual sea su contenido.
  Elegibilidad = `creada_en ≤ hoy − 7` y `dias_activos ≥ 3` (§9.3).
- **`sesiones`**: nuevo campo `tipo` (`cookie`, `bearer`). Las sesiones bearer
  son para la app nativa futura (§14.2).
- **`consentimientos.tipo`**: `terminos`, `puente`, `editar_wiki`, `amigos`,
  `insignias_publicas`, `push`.

**`push_suscripciones`** (nueva)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `cuenta_id` | uuid FK | |
| `transporte` | enum | `webpush` (hoy), `fcm`, `apns` (después). |
| `endpoint` | texto cifrado en reposo | La URL de Web Push es un identificador del dispositivo ante Google/Mozilla/Apple. |
| `claves` | jsonb cifrado en reposo | `p256dh`, `auth` para Web Push. |
| `creada_en` | date | |

### 6.4 Capa BAÑOS — principios de almacenamiento (i3)

1. **Tres esquemas.** `osm` es una copia regenerable de OSM; `propio` es todo lo
   demás; `enlace` es lo único que los une. Detalle y motivo en
   [ADR 0002](docs/adr/0002-licencia-base-derivada-vs-colectiva.md).
2. **`procedencia` en cada fila**, tipo enum `procedencia_t = ('osm',
   'gps_campo', 'aporte_usuario', 'fuente_externa')`, **NOT NULL y sin
   DEFAULT**. En `propio`, un CHECK impide `'osm'`. Una inserción que no diga de
   dónde viene el dato falla.
3. **Lo derivado de OSM vive en `osm`.** Si un valor se calculó a partir de OSM
   (la fusión baño ↔ estación, un nombre generado con la calle de OSM), va en
   `osm`, no en `propio`.
4. **Ningún formulario rellena `propio` con valores de OSM.**
5. **Los dos lados se unen en la presentación**: en las páginas SSR y en el
   cliente, nunca en un archivo descargable único.

### 6.5 Esquema `osm`

**`osm.objetos`** — lo importado, tal cual.

| Campo | Tipo | Notas |
|---|---|---|
| `osm_tipo`, `osm_id` | texto, bigint | PK compuesta. |
| `procedencia` | `procedencia_t` | Siempre `'osm'`. Explícito, sin default. |
| `geom` | geography(Point, 4326) | Nodo o centroide. |
| `tags` | jsonb | Solo los relevantes (§11.3). |
| `osm_timestamp` | timestamptz | Última modificación del objeto en OSM. Alimenta la frescura (§10.3). |
| `check_date` | date, nullable | Tags `check_date` y `check_date:*` si existen. |
| `importacion_id` | FK | |

**`osm.candidatos`** — lo que la importación interpreta como baño o probable.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | bigint | Id interno del lado OSM, regenerable. |
| `procedencia` | `procedencia_t` | `'osm'`. |
| `objetos` | jsonb | Lista de `(osm_tipo, osm_id)` que lo forman (p. ej. baño + estación fusionados). |
| `categoria`, `nombre`, `marca` | | Interpretados de los tags. |
| `existencia_osm` | enum | `confirmado` (había `amenity=toilets`) o `probable`. |
| `atributos_osm` | jsonb | `acceso`, `cobra`, `horario`, `accesible`, `cambiador`, `operador` según los tags (§11.4). |
| `geom` | geography(Point) | |

### 6.6 Esquema `enlace`

**`enlace.banio_osm`**

| Campo | Tipo | Notas |
|---|---|---|
| `banio_id` | FK a `propio.banios` | |
| `osm_candidato_id` | FK a `osm.candidatos` | |
| `osm_objetos` | jsonb | Copia de los ids de OSM al momento de enlazar, para reenlazar si el candidato se regenera con otro id. |
| `procedencia` | `procedencia_t` | Cómo se decidió el enlace: `aporte_usuario` (alguien confirmó que es el mismo lugar), `gps_campo` (la recorrida lo verificó en la calle) u `osm` (enlace automático en la importación). |
| `creado_en` | date | |

Pasar a la arquitectura C = `DROP SCHEMA enlace, osm`.

### 6.7 Esquema `propio`

**`propio.banios`** — identidad del lugar, con id propio.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | bigint | Id propio, estable. Nunca un id de OSM. |
| `slug` | texto único | `/b/{slug}`. |
| `procedencia` | `procedencia_t` | De la fila: quién dio de alta este baño en `propio`. |
| `nombre` | texto, nullable | Solo si se levantó en la calle o lo dio una fuente externa. Si es null, la presentación usa el de OSM vía `enlace`. |
| `categoria` | enum | Igual que la iteración 2. |
| `geom` | geography(Point), nullable | Solo con procedencia propia. |
| `geom_procedencia` | enum, nullable | `gps_campo`, `fuente_externa`, `aporte_usuario_mapa` (marcado a mano en el mapa base sin puntos de interés). NOT NULL si `geom` no es null. |
| `publicable` | bool | |
| `creado_en` | date | |

Un probable de OSM no tiene fila en `propio.banios` hasta que llegue la primera
evidencia propia (observación, edición, recorrida). Ahí se crea la fila (sin
`nombre` ni `geom` si la evidencia no los trae) y su enlace.

**`propio.evidencias`** — **(i3)** reemplaza a `ediciones_banio`. Cada dato
sobre un atributo o sobre la existencia, con procedencia y fecha.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | bigint | |
| `banio_id` | FK | |
| `atributo` | enum | `existencia`, `acceso`, `cobra`, `horario`, `accesible`, `cambiador`, `nombre`, `ubicacion`. |
| `valor` | jsonb | Validado por esquema según atributo. Para `existencia`: `hay`, `no_hay`, `cerrado_definitivo`. |
| `tipo` | enum | `edicion` (cambia el valor), `confirmacion` (dice "sigue igual"), `implicita` (el puente: alguien usó el baño → existe), `contradiccion` (la tercera pregunta dice que el valor vigente está mal). |
| `procedencia` | `procedencia_t` | Sin default. |
| `canal` | enum | `wiki`, `sigue_igual`, `puente`, `tercera_pregunta`, `recorrida`, `fuente_externa`. |
| `fecha` | date | Granularidad según canal: semana (lunes) para `puente` y `tercera_pregunta`; mes para `wiki` y `sigue_igual`; día para `recorrida` y `fuente_externa`. |
| `contexto` | jsonb, nullable | Solo para `tercera_pregunta` con contradicción de horario: `{ tipo_dia, franja }` (§7.3 y PRIVACY.md P-13). |
| `cuenta_id` | uuid, nullable | Interno. Para `aporte_usuario`. **Se borra (pasa a null) a los 90 días** en `puente` y `tercera_pregunta`; se conserva en `wiki` para revertir vandalismo (Q-P3). |
| `estado` | enum | `pendiente` (espera el lote nocturno), `vigente`, `revertida`. |

El historial público de la ficha es esta tabla filtrada (sin `cuenta_id`).

**`propio.atributos_vigentes`** — derivada cada noche de `evidencias` (y, en
arquitecturas A/B, de `osm.candidatos` vía `enlace`).

| Campo | Tipo | Notas |
|---|---|---|
| `banio_id`, `atributo` | | PK. |
| `valor` | jsonb | El de la evidencia más reciente de tipo `edicion`, o el de OSM si no hay propias. |
| `fuente_valor` | `procedencia_t` | De dónde sale el valor mostrado. |
| `ultima_evidencia` | date | La más reciente que coincide con el valor (edición, confirmación o implícita). |
| `personas_90d` | smallint | Personas distintas que lo confirmaron en 90 días. |
| `contradicciones_90d` | smallint | |
| `frescura` | enum | `vigente`, `dudoso`, `vencido` (§10). |

**`propio.observaciones`** — lo que entra por el puente (limpieza y papel). Se
borran a los 90 días.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | Devuelto al cliente para que pueda borrarla. |
| `banio_id` | bigint FK | |
| `cuenta_id` | uuid FK | Interno. Anti-spam y deduplicación. **La fila completa se borra a los 90 días.** |
| `estado_banio` | enum, nullable | `limpio`, `aceptable`, `evitalo`. |
| `habia_papel` | bool, nullable | |
| `semana` | date | Lunes ISO. |
| `lote` | date | Para la publicación diferida. |
| `estado` | enum | `pendiente`, `publicada`. |

Sin franja ni tipo de día: la observación responde "¿cómo está este baño
últimamente?", no "¿a qué hora va la gente?".

**(i3)** Cambios:

- **Una por persona, por baño y por ventana de 30 días.** Si la misma cuenta
  responde de nuevo dentro de la ventana, **reemplaza** su observación anterior
  (se conserva la más reciente). Así, "4 de 5" son 5 personas, no 5 respuestas
  de una persona.
- Columna `procedencia` (`aporte_usuario`), NOT NULL sin default.

**`propio.estado_reciente`** — **(i3)** pasa de "predominante" a atribución:

| Campo | Tipo | Notas |
|---|---|---|
| `banio_id`, `ventana` | | `30d`. |
| `personas` | smallint | Personas distintas con observación en la ventana. |
| `limpio`, `aceptable`, `evitalo` | smallint | Cuántas personas eligieron cada uno. |
| `con_papel`, `sin_papel` | smallint | |
| `semana_mas_reciente` | date | Para "esta semana", "hace 2 semanas". |

**`propio.resumen_mensual`** — historia larga sin autor: `banio_id`, `mes`,
`n_limpio`, `n_aceptable`, `n_evitalo`, `n_con_papel`, `n_sin_papel`. Es lo
único que queda de las observaciones después de 90 días.

**`propio.propuestas_banio`** — un usuario propone un baño que no está: `id`,
`cuenta_id`, `nombre`, `categoria`, `ubicacion_aprox` (punto que el usuario
**marca a mano en el mapa**, nunca su GPS), `estado` (`pendiente`,
`aceptada`, `rechazada`). Pasa a `banios` con `existencia = probable` cuando
otra persona la confirma o el equipo la revisa.

**(i3)** Con `procedencia = aporte_usuario` y `geom_procedencia =
aporte_usuario_mapa`. El formulario no autocompleta nada desde OSM (ADR 0002 §5).

### 6.8 Amigos

**`amistades`**: `cuenta_a`, `cuenta_b` (con `cuenta_a < cuenta_b`),
`creada_en` (date). Mutua.

**`invitaciones_amistad`**: `token_hash`, `emisor_id`, `vence_en` (48 h),
`usada`. Se comparte por link.

**`feed_amigos`**: lo que ven los amigos. Se borra a los 30 días.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `autor_id` | uuid FK | |
| `banio_id` | bigint FK, nullable | Solo si es publicable y no está en zona privada. Si no, null. |
| `etiqueta` | enum | `casa`, `laburo`, `otra_zona_privada`, `casa_ajena`, `banio_publico`, `ruta`, `naturaleza`, `otro`. Sin ubicación cuando `banio_id` es null: "Fulano cagó en casa". **(i2)** Los registros en zona privada llevan siempre la etiqueta de la zona, nunca la que eligió el usuario (cierra el camino D de la crítica). |
| `dia` | date | Más preciso que en lo público, a propósito: entre amigos el chiste es "hoy". |
| `franja` | enum | |
| `vence_en` | date | `dia + 30`. |

**(i2)** Los ítems de viaje (baño a más de 30 km de la zona casa, o etiqueta
`ruta`) llegan recién a la vuelta (§8, paso 7).

### 6.9 Insignias públicas (opt-in)

**`insignias_publicas`**: `cuenta_id`, `insignia_id` (del catálogo
`logros.json`), sin fecha. El cliente declara la insignia y el servidor no la
puede verificar porque no tiene el historial (ver Q-P5). Una insignia nunca
muestra cuándo ni en qué lugares se logró. Las insignias de ruta
("Conquistador de la Ruta 3") solo se pueden mostrar cuando están **completas**,
nunca el progreso: un progreso que avanza en vivo es un rastreador de viajes.

### 6.10 Moderación

**`denuncias`**: `id`, `objetivo_tipo` (`seudonimo`, `evidencia`, `observacion`,
`propuesta`, `adhesion`),
`objetivo_id`, `motivo` (enum), `denunciante_id`, `creada_en` (date), `estado`.
La administración en v1 es un CLI en el servidor, no un panel web (una superficie
de ataque menos).

Los límites de frecuencia (rate limit) viven en memoria del proceso, no en la
base.

---

## 7. El puente, en detalle

### 7.1 Cuándo aparece

Después de guardar un registro (el registro ya está guardado; el puente no lo
demora), si se cumplen **todas**:

1. El usuario confirmó un `banio_id` del catálogo (no basta con estar cerca).
2. El registro no está en zona privada ni en un grupo con sugerencia de
   domicilio abierta.
3. El onboarding de casa está resuelto.
4. `preferencias.puente_activo = true`.
5. No respondió ya el puente para ese baño esa semana.

### 7.2 Las dos preguntas de siempre

```
  ¿Cómo estaba el baño de YPF Av. San Martín?
  [ 🧼 Limpio ]  [ 😐 Aceptable ]  [ 🚫 Evitalo ]

  ¿Había papel?
  [ Sí ]  [ No ]
                                      Se suma anónimo al mapa · No preguntar más
```

- Se responde con dos toques, uno o ninguno. Cada fila es independiente.
- **Se cierra sola** a los 15 segundos o al tocar fuera. Cerrarla es "no
  respondo", no "después".
- Si quedó sin responder, el registro queda con `puente.estado = pendiente`
  durante 48 h: aparece un punto discreto en el historial para responder más
  tarde. Después pasa a `descartado`.
- **La primera vez**, la tarjeta tiene una línea más: "Tu respuesta se publica
  sin tu nombre, sin hora y con un día de demora. Tu registro sigue siendo
  privado." Responder es el consentimiento `puente` (se registra en
  `consentimientos` con la versión del texto).
- "No preguntar más" apaga `puente_activo`.

### 7.3 La tercera pregunta (i3)

Debajo de las dos de siempre, separada, **como mucho una por registro**:

```
  Una más, si sabés: ¿sigue siendo gratis?
  [ Sí, gratis ]  [ Ahora cobra ]  [ No sé ]                         Saltar
```

**Cuándo aparece:** solo si el baño tiene un atributo que hace caminar de
balde en estado `dudoso` o `vencido` (§10), o en contradicción. Solo esos
atributos: **horario, cobra, acceso**. Nunca limpieza ni papel, que ya cubre la
pregunta normal. Nunca accesible ni cambiador (cambian poco y se refrescan desde
la ficha).

**Cuál, si hay varios.** Orden de prioridad (el más consecuente primero):

1. **Contradicción de horario detectada en el cliente.** El cliente sabe la hora
   del registro y el horario cargado. Si el horario dice "cerrado los domingos" y
   el usuario está ahí un domingo, la pregunta es "Según el mapa, acá cierra los
   domingos. ¿Estaba abierto?". Es la más valiosa: el dato está mal **ahora**.
2. Horario `vencido`.
3. Acceso `vencido` o `dudoso` ("¿Te dejaron pasar sin consumir?").
4. Cobra `vencido` o `dudoso`.
5. Horario `dudoso`.

Existencia y "estaba abierto" no se preguntan: el registro ya los prueba
(evidencia `implicita`).

**Formas de las preguntas:**

| Atributo | Pregunta | Respuestas |
|---|---|---|
| Horario (contradicción) | "Según el mapa, acá cierra los {tipo de día} a esta hora. ¿Estaba abierto?" | Sí / No / No sé |
| Horario (dudoso o vencido) | "¿El horario sigue siendo este? {resumen de una línea}" | Sí / Cambió / No sé |
| Acceso | "¿Te dejaron pasar sin consumir?" | Sí / Solo clientes / No sé |
| Cobra | "¿Sigue siendo gratis?" (o "¿Sigue cobrando?") | Sí / No / No sé |

"Cambió" no abre un formulario: registra una `contradiccion` que pasa el
atributo a `dudoso` y deja un acceso discreto "corregir el horario" en la ficha.

**Saltear:** "Saltar" con un toque, del mismo peso visual que "No sé", sin
mensaje de vuelta. Que la tarjeta se cierre sola **cuenta como salteo**. **Dos
salteos seguidos pausan la tercera pregunta 30 días**
(`preferencias.tercera_pregunta.pausada_hasta`). Responder cualquier cosa,
incluido "No sé", reinicia el contador.

**Privacidad:** la respuesta viaja por la misma cola diferida, con fecha
generalizada a la semana. **Solo** en el caso 1 (contradicción de horario) se
manda además `{ tipo_dia, franja }`, porque sin eso la respuesta no sirve. Es el
único dato público que dice "alguien estuvo en este baño un domingo a la noche
de la semana X". En madrugada y noche (P-29), el caso 1 no se pregunta: el costo
de privacidad es más alto justo ahí.

### 7.4 Qué efecto tiene

- Las respuestas de las dos preguntas de siempre actualizan `estado_reciente`.
- El registro deja una evidencia `implicita` de existencia, y con ella un
  probable puede pasar a confirmado (§9.3).
- La tercera pregunta deja una evidencia `confirmacion` o `contradiccion` sobre
  el atributo, que mueve su frescura (§10).

### 7.5 Qué viaja

La respuesta se generaliza y entra en la misma cola diferida que todo lo demás:
`{ banio_id, semana, estado_banio?, habia_papel? }`. Sin franja, sin día, sin
seudónimo visible. El servidor la publica en el lote nocturno (≥ 24 h).

### 7.6 Por qué limpieza y papel no son atributos del wiki

Son estados que cambian de un día para el otro. Un wiki muestra el último valor
como si fuera la verdad; "limpio" editado en marzo es falso en abril. Como
observaciones con fecha y vencimiento, el mapa puede decir "últimos 30 días:
mayormente limpio (4 reportes)" o "sin datos recientes", que es honesto.

---

## 8. Pipeline de anonimización, paso a paso

Pasos 1-9 en el cliente, 10-13 en el servidor. Cambios respecto de la iteración
1 marcados con **(i2)**.

**Onboarding.** Antes de poder publicar nada (puente, amigos, edición del wiki
desde un registro), el usuario marca su casa o elige "no quiero marcarla".
Registrar está permitido desde el primer segundo.

1. **Ubicación.** Al tocar "Registrar" se pide geolocalización a través de
   `platform.geolocalizacion`. Si se niega: mapa, lista o "sin ubicación".
2. **Registro privado** en IndexedDB con coordenada, hora y precisión exactas, y
   el comentario si el usuario escribió algo (§8.1).
3. **Zonas privadas.** `distancia ≤ radio + max(precision_m, 50)` → registro
   en zona privada, fin del pipeline público. **(i2)** Precisión mínima de 50 m:
   las ubicaciones por wifi informan errores optimistas.
4. **Detección de domicilio y laburo.** Agrupación H3 res 10 + vecinas de los
   registros fuera de zona. **(i2)** Un solo registro entre 22 y 7 h fuera de
   toda zona abre la sugerencia "¿Esto es tu casa?" (sí preseleccionado) si el
   usuario eligió "no quiero marcar casa"; con 3 noches en el mismo grupo se
   propone también a quien ya marcó una casa (puede tener dos). 3 días hábiles
   entre 8 y 19 h → "¿Es tu laburo?". Mientras la sugerencia está abierta,
   nada de ese grupo se publica.
5. **Candidatos.** Baños del catálogo dentro de `min(150 m, max(60 m, 2 ×
   max(precision_m, 50)))`, más las opciones En casa / En lo de alguien / En el
   laburo / En la ruta / Otro. Preselección del más cercano solo si está a
   < 40 m, la precisión informada es ≤ 30 m **y (i2) la franja no es
   madrugada ni noche**.
6. **Decisión de publicar.** El puente aparece según §7.1. "Contarle a mis
   amigos": toggle apagado por defecto; las reglas recordadas ("siempre a mis
   amigos") **(i2) no se aplican en madrugada ni noche**: ahí siempre se
   pregunta.
7. **Generalización.** Puente: `banio_id + semana`. Amigos: `banio_id` o
   etiqueta + día + franja. **(i2)** Si el baño está a más de 30 km de la zona
   "casa" (o fuera de la ciudad, si no hay zona casa), el ítem de amigos queda
   `diferido_a_la_vuelta`: se manda cuando el usuario vuelve a registrar dentro
   de su zona casa o a los 7 días, lo que pase primero. Lo mismo para la
   etiqueta `ruta`.
8. **Cola de salida** en IndexedDB.
9. **Envío diferido**: retraso aleatorio de 1 a 6 h, en un solo `POST /lote`
   junto con la bóveda, la próxima vez que la app esté abierta. La cola la
   maneja la app (no el service worker) para que funcione igual en Capacitor.
10. **Validación** en el servidor: sesión, rate limit, `banio.publicable`,
    `semana` no futura y no más vieja que 8 semanas, consentimiento vigente,
    unicidad. Estado `pendiente`, `lote = hoy`. Sin log de acceso.
11. **Publicación nocturna** (04:00): `pendiente → publicada` si `lote ≤ ayer`.
12. **Agregados**: `estado_reciente`, `resumen_mensual`, confirmación de
    probables (§7.4) y de atributos (§9.3), contando solo cuentas elegibles.
13. **Lectura pública**: solo `osm.candidatos`, `propio.banios`,
    `propio.atributos_vigentes`, `propio.evidencias` (vía vista, sin
    `cuenta_id`), `propio.estado_reciente` y `propio.resumen_mensual`.

**Ediciones del wiki** no pasan por este pipeline porque no salen de un
registro: el usuario edita un atributo de un baño desde su ficha. **(i3)** Son
evidencias de tipo `edicion` (o `confirmacion`, con "Sigue igual"), se guardan con
`mes`, no con fecha, y se aplican en el momento (un wiki con 24 h de demora es
frustrante). Ver Q-P8 sobre lo que esto puede revelar.

**Cambios de la iteración 3:**

- **Paso 6:** la tercera pregunta aparece según §7.3, la elige el cliente con el
  catálogo local y el horario cargado, sin consultar al servidor.
- **Paso 7:** la respuesta a la tercera pregunta se generaliza a
  `{ banio_id, semana, atributo, respuesta }`, más `{ tipo_dia, franja }` solo en
  el caso de contradicción de horario.
- **Paso 10:** el servidor aplica el **reemplazo** de observaciones dentro de la
  ventana de 30 días y valida que la tercera pregunta corresponda a un atributo
  de la lista permitida.
- **Paso 12:** el recálculo nocturno incluye `atributos_vigentes` y la frescura
  (§10).

### 8.1 La caja de comentario: "¿Alguna anécdota?" (i3)

En la pantalla de registro, debajo del selector de lugar, una caja de texto
opcional:

```
  ¿Alguna anécdota?
  ┌──────────────────────────────────────────────────────┐
  │ Se cortó la luz en lo mejor…                         │
  └──────────────────────────────────────────────────────┘
  🔒 Solo lo ves vos                              0/500
```

- **Opcional y sin fricción.** Una sola línea que crece al escribir. Guardar no
  la exige ni la espera: el registro se guarda igual en menos de 10 segundos (O1).
  También se puede escribir o editar después, desde el historial.
- **El texto de la pregunta.** El pedido era "¿Cómo te fue?" o algo así. Elegí
  **"¿Alguna anécdota?"** porque "¿cómo te fue?", en rioplatense, pregunta por
  el resultado, o sea por el cuerpo, y es justo lo que P-02 decide no pedir. La
  caja es texto libre y cada uno escribe lo que quiere, pero la pregunta y los
  ejemplos empujan hacia la historia y el lugar, no hacia el cuerpo.
- **Ejemplos rotativos** en el placeholder, todos sobre la situación: "Se cortó
  la luz en lo mejor…", "El secamanos sonaba como un avión", "Había fila
  afuera", "Viento de 90 km/h para llegar", "Música funcional de los 90".
- **Privado de verdad:** el comentario vive solo en la bóveda cifrada (P-03). No
  va al puente, ni al feed de amigos, ni a las tarjetas compartibles, ni a ningún
  lado del servidor en claro. Lo ves en tu historial y en la ficha de tu
  registro.
- **Exportación:** sale en `GET /cuenta/exportar` (descifrado en el cliente),
  con el resto del historial.
- **Tamaño:** hasta 500 caracteres. El padding de las páginas de la bóveda
  (P-04) evita que el largo de los comentarios revele cuánto se escribe.

---

## 9. Umbrales, atribución y arranque en frío

### 9.1 Lo que se mantiene de la iteración 2

- Sin agregados de eventos en v1. El mapa general y el ranking de ciudades están
  **postergados** (§16).
- Umbral dinámico descartado (D-09): un k bajo llega justo cuando cada persona
  es más identificable.

### 9.2 Atribución en lugar de umbral (i3)

**El principio:** no se muestra un dato como hecho, se muestra **quién lo dice y
cuándo**. Con eso, la palabra de una persona no se lee como verdad, y no hace
falta esperar a dos.

**Estado reciente:**

| Personas en 30 días | Se muestra |
|---|---|
| 0 | "Sin reportes recientes" |
| 1 | "1 persona, esta semana: limpio · con papel" |
| > 1 | "4 de 5 personas, últimos 30 días: limpio · la última, hace 2 semanas" |

**Ajuste respecto del pedido:** el ejemplo decía "hace 3 días". La observación
guarda la **semana** a propósito (P-13): un día exacto, junto con un baño, es
"alguien estuvo acá el martes". Por eso se muestra "esta semana", "la semana
pasada", "hace 3 semanas". Si se quisiera el día, habría que guardarlo, y eso
cambia P-13.

**Atributos del wiki:** el mismo principio, ahora posible porque cada evidencia
tiene procedencia y fecha:

- "Horario: lun-sáb 7-23, dom cerrado · según la recorrida, noviembre 2026"
- "Cobra: no · según 1 persona, hace 2 semanas"
- "Accesible: sí · según OpenStreetMap, dato de 2023"
- "Cobra: **en duda** · 2 personas dicen que no, 1 que sí (la última, esta semana)"

**Límite antifraude:** una observación por persona, por baño y por ventana de 30
días (§6.7). Sumado a eso, la elegibilidad (≥ 7 días, ≥ 3 días activos) sigue
aplicándose a lo que cambia estados: pasar un probable a confirmado y marcar un
atributo como "confirmado por 2 personas".

**Lo que no cambia con la atribución:** que se publique es un dato individual
derivado de un registro, sin autor, por semana y con demora. Está en el
invariante de superficies de PRIVACY.md, inventariado. No es un agregado.

### 9.3 Umbrales que quedan

| Qué | Regla |
|---|---|
| Mostrar un baño | Ninguna (lugar público). |
| Mostrar estado reciente | Por atribución, desde 1 persona (§9.2). |
| Mostrar un atributo | Siempre, con procedencia, fecha y frescura (§10). |
| Probable → confirmado | Evidencia propia de 2 cuentas elegibles distintas, o 1 evidencia `gps_campo` o `fuente_externa`. |
| Atributo "confirmado por varias personas" | ≥ 2 personas elegibles coincidentes en 180 días. Es un rótulo, no una condición para mostrarlo. |
| Elegibilidad | Cuenta de ≥ 7 días y ≥ 3 días activos. |

### 9.4 Cómo se ve el mapa el día uno

Sin cambios respecto de la iteración 2 (SEEDING.md): 5 baños confirmados de OSM
sin datos, ~55 probables después de curar, recorrida inicial para dejar 30
confirmados completos. **(i3)** La recorrida se carga con GPS de campo y
`procedencia = gps_campo`, en archivos de `data/curated/`, no editando el wiki
del entorno de prueba (§15.4).

---

## 10. Decaimiento de datos

### 10.1 El problema

Un horario cargado en noviembre puede ser falso en marzo. Si no se renueva, en
seis meses el mapa vuelve a estar vacío, pero con datos viejos encima, y eso es
peor: la gente camina hasta un baño cerrado.

**Supuesto de diseño:** **no hay recorrida periódica garantizada.** Si después
se confirma, suma. Todo lo que sigue tiene que funcionar sin ella.

### 10.2 Vida útil por atributo

Cada atributo tiene una vida útil **T**, contada desde `ultima_evidencia` (la
evidencia más reciente que coincide con el valor vigente, de cualquier fuente):

| Atributo | T | Motivo |
|---|---|---|
| Horario | 4 meses, y además **dudoso al cambiar de temporada** si se verificó en la otra (alta: diciembre-marzo; baja: abril-noviembre) | Cambia con la temporada turística y con el negocio. |
| Acceso (libre / clientes / llave) | 6 meses | Cambia por política del comercio, a veces de un día para otro. |
| Cobra | 6 meses | Igual. |
| Cambiador | 12 meses | Se rompe o se saca, pero no seguido. |
| Existencia | 12 meses | Los lugares cierran o cambian de dueño. |
| Accesible | 24 meses | Es estructural. |
| Nombre, operador | 12 meses | Cambio de dueño o de marca (pasa con las estaciones de servicio). |
| Limpieza, papel | 30 días (ventana del estado reciente) | Ya modelados como observaciones (§9.2). |

### 10.3 Estados de frescura

| Estado | Cuándo | Cómo se muestra | ¿Entra en filtros? |
|---|---|---|---|
| **Vigente** | `ultima_evidencia` < T | Normal, con fuente y fecha. | Sí. |
| **Dudoso** | Entre T y 2T, o con una contradicción en los últimos 90 días | En gris con "sin confirmar desde marzo". | Sí, con la etiqueta "puede haber cambiado". |
| **Vencido** | > 2T | Tachado suave, "dato de noviembre 2026". | **No.** "Abierto ahora", "Gratis", "Accesible" y "Cambiador" nunca usan un dato vencido. |

**Datos de OSM:** su fecha es `check_date` si existe, y si no `osm_timestamp`
(la última modificación del objeto). Un `fee=no` cargado en OSM en 2019 entra
**vencido** desde el día de la importación. Es lo honesto.

**Existencia vencida:** el baño se esconde de la vista por defecto y aparece con
"Mostrar baños sin noticias recientes". No se borra.

### 10.4 Cómo se dibuja en el mapa

- Pin lleno: existencia vigente y al menos un atributo útil vigente.
- Pin lleno con borde gris: existencia vigente, atributos dudosos o vencidos
  ("existe, pero no sabemos los detalles").
- Pin hueco: probable (nadie confirmó que haya baño).
- Oculto por defecto: existencia vencida.

### 10.5 Qué lo refresca, sin recorrida

| Mecanismo | Qué refresca | Costo para el usuario | Costo para el equipo |
|---|---|---|---|
| Registro + puente (implícito) | Existencia | Cero: ya registró. | Cero. |
| Tercera pregunta (§7.3) | Horario, acceso, cobra | Un toque, ocasional, saltable. | Cero. |
| "Sigue igual" en la ficha | Cualquier atributo | Un toque por atributo, con cuenta. | Cero. |
| Edición del wiki | Cualquier atributo | Un formulario corto. | Revisar el historial de vez en cuando (vandalismo). |
| Reimportación de OSM (si se mantiene A o B) | Lo que alguien actualice en OSM | Cero. | Cero. En Río Gallegos casi nadie actualiza OSM: aporta poco. |
| Fuente externa (Municipalidad, comercio) | Lo que informen | Cero. | Una consulta. |
| **Recorrida (si se confirma)** | Todo | Cero. | ~1 día por cada 30 baños. |

### 10.6 ¿El puente alcanza? No del todo, y conviene saber hasta dónde llega

Estimación con 20 usuarios activos (mismos supuestos que §9 de la iteración 2:
~4 registros publicables por persona por trimestre, concentrados en pocos
baños):

- ~80 registros por trimestre en baños del catálogo → **existencia renovada en
  los ~10-15 baños más usados**. El resto envejece.
- La tercera pregunta aparece en una fracción de esos registros (solo con
  atributos dudosos) y se responde en una fracción de esas. Con 30-50 % de
  aparición y 30-50 % de respuesta: **unas 10-20 renovaciones de horario, acceso o
  cobro por trimestre**, casi todas en los mismos baños más usados.

**Cómo queda el mapa a los seis meses sin recorrida:**

- Los ~10-15 baños más usados: existencia vigente, horario y cobro mayormente
  vigentes o dudosos.
- El resto de los 30 de la recorrida inicial: existencia vigente (T = 12
  meses); horario **dudoso** desde el cuarto mes y **vencido** desde el octavo;
  cobro y acceso dudosos desde el sexto.
- Los probables nunca visitados: siguen huecos.
- El filtro "abierto ahora" devuelve pocos resultados, **pero todos con dato
  vigente o marcado como dudoso**. Nadie camina hasta un baño cerrado por un
  horario vencido que se muestra como verdad.

Eso es degradar bien: el mapa se vacía de **certezas**, no de **lugares**, y lo
dice. Lo que no se puede hacer es mantener vigentes los horarios del long tail
sin alguien que vaya o sin una fuente externa.

### 10.7 Lo que sumaría la recorrida si se confirma

Una recorrida de los 30 baños principales cada 4 meses mantiene vigente el
horario de esos 30 (T = 4 meses). Sin ella, el diseño funciona y degrada como en
§10.6. Con ella, el mapa útil de verdad pasa de ~10-15 a ~30 baños.

---

## 11. Pipeline de importación de OSM (una sola vía)

### 11.0 La regla

> **OpenStreetMap es una fuente de solo lectura. Nada de lo que hagan nuestros
> usuarios se escribe en OSM de forma automática. Si alguna vez se devuelve
> algo, lo hace una persona, a mano, con revisión.**
> — [ADR 0001](docs/adr/0001-osm-importacion-una-via.md)

Cómo se hace cumplir: sin credenciales de edición de OSM en ningún lado, sin
librerías de escritura, chequeo de CI contra llamadas de escritura a la API, un
comentario de cabecera en cada archivo de `apps/worker/src/osm/`, y la única
salida "hacia OSM" es un reporte CSV para humanos.

### 11.1 Fuente y recorte

> **(i5)** Implementado con Overpass, no con Geofabrik: ver §0, iteración 5,
> punto 1. Lo que sigue queda como alternativa si Overpass deja de servir.

- **Producción: extracto de Geofabrik** (`south-america/argentina`),
  descargado semanalmente. Es un archivo, se puede verificar con su checksum y
  no depende de un servidor público saturado.
- **Exploración manual: Overpass.** No para producción: en la medición de esta
  iteración, de cuatro servidores públicos, dos no respondieron, uno se colgó y el
  único que contestó tiraba 504 en la mitad de los intentos (SEEDING.md).

**Recorte.** `osmium extract` con el polígono del ejido de Río Gallegos (o el bbox
`-51.70,-69.35,-51.55,-69.13` mientras no haya polígono curado), y la
estrategia `smart` para no cortar ways en el borde.

### 11.2 Destino (i3)

La importación escribe **solo** en el esquema `osm` (`osm.objetos`,
`osm.candidatos`, `osm.importaciones`, `osm.conflictos`). Nunca toca `propio`.
Puede crear enlaces automáticos en `enlace.banio_osm` con `procedencia = 'osm'`
cuando un candidato nuevo coincide con un baño propio existente (< 30 m, misma
categoría), marcados para revisión.

### 11.3 Filtro

`osmium tags-filter` con:

- `nwr/amenity=toilets` → `origen = osm_toilets`.
- `nwr/toilets=yes` y `nwr/toilets:*` en cualquier objeto → `osm_toilets` sobre
  ese objeto (hoy hay 0 en Río Gallegos, pero puede haber).
- Categorías de la whitelist (`amenity=fuel|bus_station|hospital|restaurant|
  cafe|bar|fast_food|pub|townhall|university`, `shop=supermarket|mall`,
  `aeroway=aerodrome|terminal`, `leisure=park` con `toilets=yes`, `tourism=museum`,
  `leisure=stadium`) → `origen = osm_probable`.
- Se descarta todo lo que tenga `access=private|no` o `disused:*`.

El mapeo exacto de tags a categoría vive en `data/curated/categorias.json`.

### 11.4 Normalización y fusión

1. Cada objeto pasa a punto (nodo: su posición; way/relation: centroide).
2. **Fusión toilets ↔ lugar**: un `amenity=toilets` a < 50 m de un lugar de la
   whitelist se fusiona con él en un solo baño, `existencia = confirmado`, con
   el nombre y la marca del lugar (en Río Gallegos, los 5 casos). Los ids de
   ambos objetos quedan en `osm_ids_fusionados`.
3. Mapeo de tags a atributos:

| Tag de OSM | Atributo | Regla |
|---|---|---|
| `name`, `brand`, `operator` | `nombre`, `marca`, `operador` | Si no hay `name`: "{marca} — {calle más cercana}". |
| `access` | `acceso` | `yes`/`permissive` → `libre`; `customers` → `clientes`; `private`/`no` → se descarta. |
| `fee` | `cobra` | `yes` → true; `no` → false. |
| `opening_hours` | `horario` | Se parsea a la estructura por tipo de día con una librería de `opening_hours`; si no se puede, queda solo el crudo. En los baños de estación de servicio se toma el horario de la estación. |
| `wheelchair`, `toilets:wheelchair` | `accesible` | `yes` → true; `no` → false; `limited` → null + nota. |
| `changing_table` | `cambiador` | `yes` → true; `no` → false. |

4. Slug estable a partir de nombre + calle; colisiones con sufijo.

**(i3)** La fusión se guarda en `osm.candidatos.objetos`, del lado OSM, porque
es un resultado calculado solo con datos de OSM. El nombre generado
("{marca} — {calle}") también queda del lado OSM. Se importan además
`check_date` y `osm_timestamp` para la frescura (§10.3).

### 11.5 Precedencia

| Situación | Qué pasa |
|---|---|
| Candidato nuevo en OSM | Se crea en `osm.candidatos`. Aparece en el mapa vía `banios-osm.json`. |
| Atributo cambió en OSM y no hay evidencias propias | El valor mostrado cambia (sale de `osm`). |
| Atributo cambió en OSM y hay evidencias propias | **Gana lo propio** si es más reciente; si lo de OSM es más reciente (`osm_timestamp`), se abre un conflicto para revisión y el atributo pasa a `dudoso`. |
| Objeto desaparece de OSM | El candidato se marca `desaparecido`. Si el baño tiene fila propia con geometría propia, sigue igual. Si no, se esconde. |

### 11.6 Salida

Dos archivos (ADR 0002 §5): `banios-osm.v{n}.json` (ODbL, con atribución) y
`banios-propio.v{n}.json`. Se calcula además la **métrica de supervivencia a C**.

### 11.7 Licencia

Ver [ADR 0002](docs/adr/0002-licencia-base-derivada-vs-colectiva.md). Hasta que
haya respuesta legal, el almacenamiento preserva las tres opciones.

---

## 12. Endpoints

Base `/api/v1`. JSON. Autenticación por cookie (web) o `Authorization: Bearer`
(app nativa, §14.2). Ningún endpoint recibe ni devuelve coordenadas de
usuarios; ningún parámetro describe la posición del usuario.

### 12.1 Autenticación y cuenta

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/passkey/registro/opciones` | Inicia el alta: devuelve el desafío WebAuthn (pide la extensión PRF). Body: `{ seudonimo, mayor_de_edad, acepta_terminos_version }`. |
| POST | `/auth/passkey/registro/verificar` | Verifica la credencial, crea la cuenta y la sesión. |
| POST | `/auth/passkey/login/opciones` | Desafío de login (passkeys descubribles: no hace falta ingresar nada). |
| POST | `/auth/passkey/login/verificar` | |
| POST | `/auth/mail/solicitar` | `{ mail }`. Siempre responde 202 (no revela si la cuenta existe). |
| POST | `/auth/mail/canjear` | `{ token }`. El link del mail abre una página que hace este POST con un botón: los escáneres de links de Outlook/Gmail hacen GET y si el canje fuera por GET quemarían el token. |
| POST | `/auth/salir` | |
| GET | `/cuenta` | Seudónimo, métodos de login, consentimientos vigentes. |
| PATCH | `/cuenta` | Cambiar seudónimo. |
| POST | `/cuenta/consentimientos` | `{ tipo, version }`. Otorga. |
| DELETE | `/cuenta/consentimientos/{tipo}` | Revoca. Revocar `publicar_lugares` ofrece además borrar los aportes ya hechos. |
| GET | `/cuenta/exportar` | Todo lo que el servidor tiene de la cuenta: datos de cuenta, consentimientos, aportes, amistades, y la bóveda cifrada (el cliente la descifra y arma un JSON legible). Derecho de acceso, art. 14. |
| DELETE | `/cuenta` | Borrado total. Requiere reautenticación reciente (< 5 min). Ver PRIVACY.md P-18. |

**(i2)**

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/sesion-bearer` | Convierte una autenticación válida en un token bearer, para la app nativa. En la web no se usa. |

### 12.2 Capa REGISTROS (autenticado)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/boveda?desde={seq}` | Páginas cambiadas. |
| PUT | `/boveda/paginas/{pagina_id}` | Concurrencia optimista. |
| DELETE | `/boveda/paginas/{pagina_id}` | |
| GET / PUT | `/boveda/llaves[/{metodo}]` | Llaves envueltas. |
| POST | `/lote` | `{ observaciones: [...], amigos: [...], paginas_boveda: [...] }`. Sin log de acceso. Devuelve ids remotos. |
| GET | `/aportes/mios` | Mis observaciones vigentes y mis ítems en feeds de amigos. |
| DELETE | `/aportes/{tipo}/{id}` | `tipo ∈ observacion, amigos`. |
| GET | `/amigos/feed` | |

Amigos:

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/amigos/invitaciones` | Devuelve un link de un solo uso, válido 48 h. |
| POST | `/amigos/invitaciones/{token}/aceptar` | |
| GET | `/amigos` | Lista. |
| DELETE | `/amigos/{seudonimo}` | Corta la amistad y borra del feed del otro lo que yo le había mostrado. |
| GET | `/amigos/feed` | Últimos 30 días. |

### 12.3 Capa BAÑOS — lectura pública (sin autenticación, cacheable)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/estaticos/{ciudad}/banios-osm.v{n}.json` | **(i3)** Candidatos del lado OSM (ODbL, con atribución). |
| GET | `/estaticos/{ciudad}/banios-propio.v{n}.json` | **(i3)** Baños propios, atributos vigentes con procedencia, fecha y frescura, estado reciente. El cliente baja los dos archivos enteros y los une en memoria (ADR 0002 §5). |
| GET | `/banios/{id}` | Ficha en JSON. |
| GET | `/banios/{id}/evidencias` | **(i3)** Evidencias públicas: atributo, valor, tipo, canal, procedencia, fecha. Sin `cuenta_id`. |
| GET | `/tiles/{region}.pmtiles` | Range requests. |
| — | `/b/{slug}` (SSR, fuera de `/api`) | Ficha HTML indexable, con datos estructurados (schema.org `PublicToilet` / `Place`) y atribución de OSM. |
| — | `/sitemap.xml` | Todas las fichas de baños. |

### 12.4 Capa BAÑOS — escritura (autenticado, cuentas activas)

| Método | Ruta | Descripción |
|---|---|---|
| PATCH | `/banios/{id}/atributos/{atributo}` | `{ valor }`. Edición del wiki. Requiere consentimiento `editar_wiki`. Rate limit por cuenta. |
| POST | `/banios/{id}/existencia` | `{ existencia: 'no_hay' | 'cerrado_definitivo' | 'confirmado' }`. |
| POST | `/banios/propuestas` | `{ nombre, categoria, ubicacion_aprox }`. La ubicación la marca el usuario a mano en el mapa; la interfaz no ofrece "usar mi ubicación". |
| POST | `/banios/propuestas/{id}/confirmar` | Otra persona confirma una propuesta. |

Las observaciones del puente **no** usan estos endpoints: van por `/lote`, con
demora (§7.3).

### 12.5 Push, moderación, salud

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/push/suscripciones` | `{ transporte, endpoint, claves }`. Requiere consentimiento `push`. |
| DELETE | `/push/suscripciones/{id}` | |
| POST | `/denuncias` | |
| GET | `/salud` | |
| — | `/.well-known/assetlinks.json`, `/.well-known/apple-app-site-association` | Desde el día uno, aunque todavía no haya app (§14.3). |

**Contenido de las notificaciones push:** genérico y nunca en tiempo real
respecto de un evento de otro usuario. Permitido: "Tenés 3 novedades de tus
amigos" (en lote, una vez por día), "Te falta una YPF para el logro" (calculado
en el cliente; el servidor manda un aviso genérico de "abrí la app"). Prohibido:
"Fulano acaba de registrar en...". Motivo: el push es tiempo real por
definición, y el tiempo real es el camino A del ataque (casa vacía).

### 12.6 Cambios de la iteración 3

Los que siguen reemplazan o se suman a lo anterior:

| Método | Ruta | Cambio |
|---|---|---|
| GET | `/estaticos/{ciudad}/banios-osm.v{n}.json` | **Nuevo.** Candidatos del lado OSM. ODbL. |
| GET | `/estaticos/{ciudad}/banios-propio.v{n}.json` | **Nuevo.** Baños, atributos vigentes con procedencia, fecha y frescura, estado reciente. Reemplaza a `banios.v{n}.json`. |
| GET | `/banios/{id}/evidencias` | Reemplaza a `/historial`: evidencias públicas (atributo, valor, tipo, canal, procedencia, fecha). Sin `cuenta_id`. |
| POST | `/banios/{id}/confirmaciones` | **Nuevo.** "Sigue igual": `{ atributo }`. Requiere cuenta y `editar_wiki`. Una por persona, por atributo y por mes. |
| PATCH | `/banios/{id}/atributos/{atributo}` | Ahora crea una evidencia `edicion` con `procedencia = aporte_usuario`. |
| POST | `/lote` | Acepta además `terceras: [{ banio_id, semana, atributo, respuesta, contexto? }]`. |
| — | `/robots.txt` | Distinto según `ENTORNO` (§15.3). |
| — | `/sitemap.xml`, `/.well-known/*` | Solo con `ENTORNO=produccion`. |

La carga de la recorrida **no** tiene endpoint: entra por archivos versionados
en `data/curated/` y un comando del worker, con `procedencia = gps_campo`.

## 13. Jobs del worker

| Job | Cuándo | Qué hace |
|---|---|---|
| `publicar-lote` | Diario 04:00 | Observaciones `pendiente → publicada`. |
| `recalcular` | Después | `estado_reciente`, `resumen_mensual`, confirmación de probables y de atributos con cuentas elegibles. |
| `vencer-observaciones` | Diario | Borra las filas de `observaciones` con más de 90 días (después de volcarlas a `resumen_mensual`). |
| `importar-osm` | Semanal | §11. Solo descarga. |
| `generar-bundles` | Después de importar o de recalcular | **(i3)** `banios-osm.v{n}.json` y `banios-propio.v{n}.json`, `sitemap.xml` (solo producción), PMTiles si cambió. |
| `notificar` | Diario 19:00 | Avisos push agregados (§12.5). |
| `purgar` | Horario / diario | Tokens, sesiones, feed de amigos > 30 días, invitaciones. |
| `backup` | Diario | restic, 30 días. |

**(i3)** Se suman:

| Job | Cuándo | Qué hace |
|---|---|---|
| `frescura` | Diario, después de `recalcular` | Recalcula `atributos_vigentes.frescura` con T por atributo y cambio de temporada. |
| `anonimizar-evidencias` | Diario | Pasa a null el `cuenta_id` de evidencias de `puente` y `tercera_pregunta` con más de 90 días. |
| `supervivencia-c` | Diario | Métrica de ADR 0002 §5.6. |
| `cargar-curado` | A mano | Importa `data/curated/` (recorrida, fuentes externas) a `propio` con su procedencia. |

## 14. PWA ahora, app nativa después

### 14.1 Qué tiene la PWA en v1

- Manifest instalable con ícono, `display: standalone`, colores y nombre
  definitivos.
- Offline básico: el app shell, el catálogo de baños, los tiles de la ciudad y
  la cola de salida funcionan sin señal.
- Geolocalización recién al registrar.
- Push en Android (Web Push con VAPID). En iOS, solo si la PWA está instalada en
  la pantalla de inicio; se ofrece pero no se promete.
- Instalación sugerida después del segundo registro (no al entrar), con
  `beforeinstallprompt` en Android e instrucciones a mano en iOS.

### 14.2 Reglas de arquitectura para que Capacitor no obligue a rehacer nada

| # | Regla | Por qué |
|---|---|---|
| R1 | Las rutas de la app (`/app/*`) **no usan SSR ni `load` de servidor**: todo dato llega por el cliente de la API. Tienen que poder compilarse con `adapter-static`. | Capacitor carga archivos locales; no hay servidor Node adentro del celular. Las páginas públicas indexables (`/b/*`) sí usan SSR y quedan solo en la web. |
| R2 | Cliente de API con **URL base configurable** y CORS habilitado en el servidor para los orígenes de Capacitor (`capacitor://localhost`, `https://localhost`). | En la app nativa el origen no es tu dominio. |
| R3 | La API acepta **cookie HttpOnly (web) y bearer (nativo)**. El token nativo se guarda en el almacenamiento seguro del sistema (Keystore / Keychain). | Las cookies entre orígenes en un WebView son una fuente de problemas; un bearer en IndexedDB en la web sería robable por XSS. Dos mecanismos, una sola tabla de sesiones. |
| R4 | `packages/platform` define **interfaces** (`geolocalizacion`, `almacenamiento`, `passkeys`, `push`, `compartir`, `segundoPlano`, `instalacion`). La UI y `core` solo importan interfaces. Hoy hay una sola implementación (web). | Al empaquetar se agrega una implementación nativa, sin tocar UI ni lógica. |
| R5 | **Ninguna lógica de negocio en el service worker.** La cola de salida, el reintento y la sincronización los maneja la app. El SW solo cachea. | En Capacitor para iOS no hay service worker para el esquema local. Si la lógica vive en el SW, la app nativa no anda offline. |
| R6 | Almacenamiento local detrás de la interfaz; IndexedDB en ambos casos en v1. | En el WebView de la app el almacenamiento no se desaloja como en Safari (mejora Q-T2). SQLite queda como opción futura sin cambiar `core`. |
| R7 | **Dominio definitivo antes de la primera passkey** (el entorno de prueba no usa passkeys, §15) y archivos `/.well-known/assetlinks.json` y `apple-app-site-association` servidos desde el día uno. | Las passkeys quedan atadas al RP ID (el dominio). Cambiar de dominio después invalida todas las passkeys de todos los usuarios. La app nativa usa las mismas passkeys si el dominio está asociado. |
| R8 | Push con abstracción de transporte en el servidor (`webpush` hoy, `fcm`/`apns` después). | La app nativa no usa Web Push. |
| R9 | URLs compartibles idénticas en web y app (`/b/{slug}`, `/c/{token}`), para que después funcionen como App Links / Universal Links. | Los links que ya circulan por WhatsApp siguen sirviendo cuando exista la app. |
| R10 | Nada de APIs solo-navegador sin pasar por `platform` (Web Share, Background Sync, `beforeinstallprompt`, `navigator.storage.persist`). | Mismo motivo que R4. |

### 14.3 Lo que **sí** va a requerir trabajo nuevo al empaquetar

"No rehacer nada" es alcanzable para la UI, `core` y la API. No es "cero
trabajo". Lo nuevo:

- **Passkeys en el WebView.** El WebView de Android tiene soporte de Credential
  Manager desde `androidx.webkit` 1.12 con configuración adicional y Digital
  Asset Links; hay plugins de Capacitor que hacen de puente a las APIs nativas.
  Hay reportes de que `PublicKeyCredential` no existe en el WebView sin esa
  configuración. **No está verificado que la extensión PRF funcione por ese
  camino**, y la bóveda depende de PRF o del código de recuperación (Q-T7).
- Implementaciones nativas de `geolocalizacion`, `push` (FCM/APNs) y
  `compartir`.
- Ficha de la tienda, formulario de seguridad de datos de Google Play y
  revisión.

### 14.4 Los 12 testers de Google Play

Verificado en la ayuda de Play Console: las cuentas de desarrollador
**personales** creadas después del 13 de noviembre de 2023 tienen que hacer una
prueba cerrada con **al menos 12 testers inscriptos durante 14 días seguidos**
antes de pedir acceso a producción (antes eran 20). Las cuentas de
organización están exentas. Consecuencias para el diseño:

- Los testers se inscriben con su cuenta de Google y el desarrollador los carga
  por mail en Play Console. **Eso es un dato personal que este proyecto evita en
  todo lo demás.** Es voluntario y está fuera de la app, pero hay que decirlo en
  la invitación y no guardar esa lista en ningún sistema del proyecto.
- Si un tester se da de baja, el reloj de 14 días puede reiniciarse: hacen falta
  más de 12 (apuntar a 15-20).
- La PWA sirve para conseguirlos: una sección "Probá la app de Android antes que
  nadie" para usuarios con más de N días activos.
- Una cuenta de organización evitaría el requisito, pero exige una entidad
  registrada (Q-L4).

### 14.5 Qué gana la privacidad con la app nativa

- El código va firmado en la tienda: un servidor comprometido no puede cambiar
  el JS de cifrado de quien usa la app (mitiga L1 para esos usuarios).
- El almacenamiento no se desaloja (mitiga Q-T2).

Y qué pierde: Google o Apple pasan a ver instalación, actualizaciones y tokens
de push (A6), y el formulario de seguridad de datos obliga a declarar datos de
ubicación y quizás de salud (Q-L8).

---

## 15. Entornos: prueba y definitivo

### 15.1 Dos variables, un solo lugar

| Variable | Valores | Qué define |
|---|---|---|
| `ORIGEN_PUBLICO` | `https://caca.blucaro.site` hoy, el dominio definitivo después | **El único lugar donde aparece el dominio.** De ella salen: el RP ID de WebAuthn (solo en producción), CORS, los links de los mails, el remitente de los mails (`no-responder@{host}`), el `scope` y el `id` del manifest de la PWA, el `subject` de VAPID, las URLs absolutas de las tarjetas OpenGraph, el `Caddyfile` (`{$ORIGEN_HOST}`). |
| `ENTORNO` | `prueba` / `produccion` | Passkeys, banner, indexación, `.well-known`, sitemap. |

**Cómo se hace cumplir:** un chequeo de CI falla si aparece `blucaro` o el
dominio definitivo como texto en cualquier archivo fuera de `.env*` y de la
documentación. `.env.example` documenta las variables.

### 15.2 Reglas del entorno de prueba

| Regla | Cómo |
|---|---|
| **Sin passkeys** | Con `ENTORNO=prueba` el servidor no expone `/auth/passkey/*` (404) y la UI no muestra la opción. **No hay variable para encenderlas en prueba**: el código se niega. Las passkeys quedan atadas al dominio y no migran. |
| Login | Solo magic link. |
| Bóveda | Sin passkey no hay PRF: el código de recuperación es **obligatorio** en el alta. |
| **Cuentas descartables** | Base de datos propia del entorno. Al migrar, se borra entera. **No hay código de migración de usuarios.** Los términos del entorno de prueba lo dicen. |
| **Banner** | En todas las páginas (SSR y app), arriba, no descartable del todo (se puede achicar): "Entorno de prueba: lo que cargues acá se borra". También en el asunto de los mails ("[PRUEBA]"). |
| **Sin indexación** | §15.3. |
| Secretos | Pimienta del HMAC, llaves VAPID y secretos de sesión propios del entorno. |
| Cookie | `__Host-sesion` (sin atributo `Domain`): ningún otro subdominio de `blucaro.site` puede leerla ni pisarla. |
| `.well-known` | No se sirven. |
| Push | Funciona, con llaves propias. Las suscripciones quedan atadas al origen y se pierden al migrar. |

### 15.3 Indexación: por qué no alcanza con robots.txt

El pedido era "noindex en robots.txt y meta". Dos problemas:

1. Google no soporta `noindex` en robots.txt desde 2019.
2. Si robots.txt dice `Disallow: /`, Google no rastrea las páginas, **no ve el
   `noindex`**, y puede indexar igual la URL (sin contenido) si alguien la
   enlaza.

Lo que se hace con `ENTORNO=prueba`:

- Cabecera `X-Robots-Tag: noindex, nofollow` en **todas** las respuestas (HTML,
  JSON, imágenes OpenGraph), desde Caddy.
- `<meta name="robots" content="noindex, nofollow">` en todas las páginas.
- `robots.txt` **sin** `Disallow`, para que Google pueda leer el noindex.
- Sin `sitemap.xml` y sin `<link rel="canonical">`.

La vista previa de los links en WhatsApp sigue funcionando: no depende de la
indexación.

### 15.4 Qué sobrevive a la migración

- **Sobrevive:** todo lo que está en el repo (código, `data/curated/` con la
  recorrida y las fuentes externas). Por eso la recorrida se carga en archivos, no
  editando el wiki de prueba.
- **No sobrevive:** cuentas, bóvedas, observaciones, evidencias y ediciones hechas
  por cuentas de prueba, amistades, suscripciones push, PWA instaladas.

### 15.5 El día de la migración

1. Registrar el dominio definitivo y configurar DNS, SPF y DKIM para los mails.
2. Base nueva, secretos nuevos.
3. `ORIGEN_PUBLICO = https://{definitivo}`, `ENTORNO = produccion`.
4. `cargar-curado` y `importar-osm` en la base nueva.
5. Verificar `/.well-known/*`, sitemap y passkeys con una cuenta propia.
6. `caca.blucaro.site`: o se apaga con un 301 al dominio definitivo, o se deja
   como entorno de prueba permanente (`ENTORNO=prueba`, base propia). Lo segundo
   sirve para probar cambios antes de producción.

Q-N4 deja de bloquear: el único que depende del dominio definitivo es la
primera passkey.

### 15.6 Herramienta de relevamiento (solo en prueba)

Ruta `/app/relevamiento`, que existe solo con `ENTORNO=prueba` (con
`produccion` responde 404). Sirve para cargar la recorrida de sembrado
(SEEDING.md §5) parado en la vereda, con una mano y sin señal.

- **Ubicación:** GPS del navegador siempre encendido; la ubicación se fija
  cuando el usuario toca "Fijar ubicación acá", y solo con precisión de 30 m o
  mejor. No se fija sola: si no, el baño siguiente heredaría la posición del
  anterior.
- **Campos:** nombre, categoría, acceso, cobra, horario (lun a vie, sábado,
  domingos y feriados), accesible, cambiador. Todos con la opción
  "desconocido", que es el valor inicial. Nada se rellena desde OSM (ADR 0002).
- **Guardado:** IndexedDB en cada cambio, con transacciones `durability:
  'strict'`. Cerrar el navegador no pierde nada.
- **Offline:** el service worker guarda la página la primera vez que se abre
  con señal.
- **Exportación:** `recorrida-AAAA-MM-DD.json` con todo lo acumulado
  (`formato: cacapage-recorrida`, `procedencia: gps_campo` en cada baño y en su
  geometría). Exportar no borra.
- Código: `apps/web/src/routes/app/relevamiento/` y
  `apps/web/src/lib/relevamiento/`. Despliegue: `docs/despliegue.md`.

---

## 16. Postergado: mapa general y ranking de ciudades

### 16.1 Mapa general

> **(i5)** Existe un mapa de cacas **individual y opt-in** (§0, iteración 5,
> punto 15; PRIVACY.md P-38). Lo de abajo, el agregado anónimo, sigue
> postergado.

**Estado:** postergado, no cancelado. Era un requisito explícito del producto. v1
sale sin él porque con 5 baños y 20 usuarios se vería roto (simulación en
[`docs/analisis/sim_umbral_k.py`](docs/analisis/sim_umbral_k.py): 2 a 4 celdas
de ~40 con 20 usuarios).

**Condiciones de reactivación** (tienen que cumplirse las dos):

1. Hay un uso claro que el wiki de baños no cubre.
2. Hay ≥ 50 cuentas elegibles activas en 90 días.

**Cómo se haría:**

- Multirresolución: H3 res 8 donde haya ≥ 3 personas elegibles distintas; res 7
  de respaldo; nada donde ni eso.
- Cuenta personas, no registros (la condición de "5 registros" no protege).
- Acumulado de 90 días, actualizado en el lote nocturno, en rangos.
- Antes de agregarlo: **releer el invariante de superficies de PRIVACY.md** y
  repetir el ejercicio de ataque de desanonimización.

**Qué alimentaría el mapa general:** la pregunta sigue abierta. Con solo
registros en lugares públicos, es un mapa de estaciones de servicio borroneado
(redundante con el wiki). Con registros de casa (opt-in), es un mapa de dónde
viven los usuarios. Antes de reactivarlo hay que decidir qué mide.

### 16.2 Ranking de ciudades y países

**Estado:** postergado. Idea del producto: un ranking público de qué ciudad (y,
más adelante, qué país) "caga más", para generar rivalidad entre ciudades ("Río
Gallegos vs. Caleta Olivia") y que cada uno sume gente de la suya.

**Por qué no en v1:**

1. Con una sola ciudad piloto, el ranking tiene una fila.
2. El servidor no sabe cuántos registros tiene nadie: están cifrados en cada
   celular (P-03). Hace falta un aporte nuevo, opt-in.

**Condición de reactivación:** al menos **2 ciudades** con **≥ 10 personas
elegibles** participando en un mismo mes. El ranking de países, cuando haya al
menos 2 países que cumplan lo mismo.

**Qué se compara:** ciudades (y países), **nunca personas**. Un ranking de
personas por cantidad de registros es publicar la frecuencia con la que cada uno
va al baño, casi un dato de salud (P-02, P-33). No se hace con ningún umbral.

**Cómo se haría:**

- **Opt-in explícito**, con consentimiento propio (`ranking_ciudades`) y
  revocable.
- **Ciudad declarada**: el usuario la elige de una lista. Si tiene marcada una
  zona "casa", el cliente puede sugerirla calculando la ciudad localmente; el
  servidor nunca recibe la zona ni una coordenada.
- **Aporte mensual en rangos**: al cerrar el mes, el cliente manda
  `{ ciudad_id, mes, rango }` con la cantidad de registros de ese mes en rangos
  (`1_10`, `11_20`, `21_31`, `mas_31`), por la cola diferida. Nunca el número
  exacto.
- **Una cuenta, una ciudad, un aporte por mes.** Solo cuentan cuentas elegibles
  (≥ 7 días, ≥ 3 días activos).
- **Índice de la ciudad**: promedio de registros por participante usando el
  punto medio de cada rango (5,5 · 15,5 · 26 · 35), redondeado a entero. El tope
  del último rango limita cuánto puede inflar una cuenta a su ciudad (el número
  lo declara el celular y se puede trampear; como es un chiste, alcanza con
  acotarlo).
- **Umbral**: una ciudad aparece con ≥ 10 participantes elegibles ese mes. Los
  participantes se muestran en rangos (10-49, 50-199, 200+), nunca exactos.
- **Países, solo con ciudades visibles**: el índice de un país se calcula
  **solo** con los participantes de sus ciudades que ya aparecen. Si se usara el
  total del país, restándole las ciudades visibles quedaría el promedio de las
  ciudades ocultas (ataque de diferencia).
- **Publicación mensual**, una semana después de cerrado el mes (para que
  lleguen los envíos atrasados), sin actualizaciones en vivo. Que alguien se
  sume a mitad de mes no cambia nada visible.
- **Estado vacío sin conteo exacto**: "Tu ciudad todavía no tiene suficiente
  gente para entrar al ranking". Nada de "faltan 3" (D-12).
- **Retención**: el `cuenta_id` de cada aporte se borra al publicar el mes;
  queda solo el agregado.
- **Tarjeta compartible**: "Río Gallegos, 3.ª en el ranking cagón de octubre".
  Es un dato agregado de la ciudad; no dice nada de quien la comparte.

**Datos (cuando se implemente):**

| Tabla | Campos |
|---|---|
| `ciudades` | `id`, `nombre`, `provincia`, `pais`. Catálogo curado. |
| `ranking_aportes` | `cuenta_id` (se borra al publicar), `ciudad_id`, `mes`, `rango`, `lote`, `procedencia = aporte_usuario`. Único `(cuenta_id, mes)`. |
| `ranking_ciudades` | `ciudad_id`, `mes`, `participantes_rango`, `indice`, `posicion`, `visible`. Lo único que lee la API pública. |
| `ranking_paises` | `pais`, `mes`, `participantes_rango`, `indice`, `posicion`. Calculado solo desde ciudades visibles. |

**Relación con las macrozonas (X-02 en PRIVACY.md):** es el mismo mecanismo a
otra escala. Si alguna vez vuelve el ranking de barrios o macrozonas dentro de
una ciudad, usa este diseño, con el umbral de 10 personas por zona.

Antes de implementarlo: agregarlo al **invariante de superficies** de
PRIVACY.md y repetir el ejercicio de ataque de desanonimización.

---

## 17. Logros y medallas

### 17.1 Dos cosas distintas

| | **Logros** | **Medallas** |
|---|---|---|
| Qué premian | Una hazaña: conquistar las YPF de la Ruta 3, el baño ajeno sin papel, el baño del laburo. | La constancia: **una medalla cada 5 registros**, con nombre gracioso. |
| Catálogo | [`data/curated/logros.json`](data/curated/logros.json) (por ahora, solo el de bienvenida) | [`data/curated/medallas.json`](data/curated/medallas.json) |
| Ritmo | Irregular, a veces nunca. | Predecible: con un registro por día, una cada 5 días. Es la recompensa que vuelve seguido. |

Las dos se calculan **en el dispositivo**, sobre el historial privado
(`registros`), incluidos los registros en zonas privadas. El servidor no sabe
cuántas medallas tiene nadie.

### 17.2 El logro de bienvenida

El primer registro, cualquiera sea (en casa, sin ubicación, offline), da el
logro **"Bautismo de Porcelana"** (`primer-registro` en
[`data/curated/logros.json`](data/curated/logros.json)). Existe para que quien
llegó por el chiste reciba algo en el primer uso, sin esperar a la primera
medalla en el quinto registro.

- Aparece después de guardar el registro y después del puente, igual que una
  medalla.
- No es un conteo, así que **sí** se puede mostrar como insignia pública
  (opt-in, P-20): solo dice que la persona registró al menos una vez.
- Si después se borran todos los registros, el logro se conserva.

### 17.3 La regla de las medallas

- Medalla número *n* = registro número 5·*n*. Cuentan **todos** los registros
  propios, sin importar dónde fueron (casa, laburo, ruta).
- **De 5 a 200:** 40 medallas con nombre propio (`medallas.json`).
- **Después de 200:** cada 5 registros, "Inmortalidad Sanitaria, nivel *N*",
  más medallas especiales con nombre en 300, 500 y 1000.
- Si el usuario borra registros y baja de un umbral, **la medalla se conserva**:
  quitarla sería castigar el borrado, y borrar tiene que ser gratis (P-18).
- Cargar registros viejos a mano cuenta. Se puede trampear; como todo pasa en el
  dispositivo del propio usuario y no hay ranking público, no importa (Q-P5).

### 17.4 Los nombres

Criterios para el catálogo:

1. **Rioplatenses y locales**: el viento patagónico, el pingüino, el guanaco, la
   meseta, el río Gallegos, el mate, el bidet, la mochila del inodoro.
2. **Sin género gramatical de persona.** No sabemos (ni queremos saber) el género
   de nadie, así que los nombres nombran la hazaña o el objeto ("Capitanía de la
   Cisterna"), no a la persona ("Capitán de la Cisterna").
3. **Nada sobre el cuerpo ni sobre la salud** (P-02): nada de diarrea,
   estreñimiento ni chistes que un diagnóstico pueda volver hirientes.
4. **Nada de marcas, política, religión ni personas reales.** En Río Gallegos un
   chiste político no es neutro.

Muestra: 5 "Debut en el Trono" · 20 "Sommelier de Papel Higiénico" · 25 "Bodas
de Plata con el Inodoro" · 60 "Resistencia al Viento Patagónico" · 100 "Trono
de Bronce" · 125 "Pingüino Emperador" · 170 "Cacería del Baño Abierto en
Domingo" · 200 "Trono de Oro". La lista completa está en `medallas.json`.

### 17.5 Dónde se ven

| Lugar | ¿Se ve? | Cómo |
|---|---|---|
| Al registrar | Sí | Si el registro completa un múltiplo de 5, una animación corta con el nombre de la medalla, **después** de guardar el registro y del puente (no los demora ni los tapa). |
| "Mis registros" | Sí | Vitrina con las ganadas y "te faltan 3 para la próxima" (sin revelar el nombre: la sorpresa es parte del chiste). |
| Tarjeta compartible | Si el usuario la genera | `/c/{token}` con el nombre de la medalla. Acto explícito, en el momento. Sin fecha ni lugar. El nombre ya implica la cantidad (cada medalla es un múltiplo de 5), y eso se avisa al generar la tarjeta. |
| Feed de amigos | Solo si el usuario toca "Contarle a mis amigos" en esa medalla | Va por la cola diferida (1 a 6 h) y con fecha de día. Por default, no se anuncia. |
| Perfil público (`/u/{seudonimo}`) | **No** | Ver §17.6. |

### 17.6 Por qué las medallas no van al perfil público

Una medalla de conteo publicada en un perfil es **un contador acumulado de
registros que cualquiera puede mirar cada semana**. Dos miradas separadas siete
días dicen cuántas veces fue al baño esa persona en esa semana: frecuencia
intestinal, que es lo más cercano a un dato de salud que tiene el sistema (P-02,
Ley 25.326 art. 7). Las insignias públicas (P-20) no tienen ese problema porque
no son conteos.

Por la misma razón, el anuncio automático a amigos está apagado: si el usuario
no les cuenta sus registros de casa a sus amigos, un "ganó una medalla hoy"
automático les diría que registró algo ese día.

### 17.7 Datos

En el dispositivo, dentro de la bóveda: `medallas_obtenidas` (`numero`,
`obtenida_en`), y en `preferencias` el último umbral anunciado. En el servidor
no hay tabla de medallas. Cambios mínimos en lo que ya existe:

- `feed_amigos`: nuevo campo `tipo` (`registro`, `medalla`) y `medalla_numero`
  (nullable). Un ítem de tipo `medalla` no tiene `banio_id` ni etiqueta.
- `POST /tarjetas`: `{ tipo: 'insignia' | 'medalla', id }` → devuelve el token
  de `/c/{token}`. El servidor guarda solo el tipo, el id y la cuenta (para que
  el dueño pueda borrar la tarjeta).

---

## 18. En evaluación: "Baño amigo"

**Estado:** en evaluación, **no adoptado**. Esta sección es para decidir.

### 18.1 La idea

En vez de publicar "acá te dejan pasar gratis" (la forma más rápida de que el
comercio deje de hacerlo), convertirlo en **reputación**: un distintivo de
"Baño amigo" que el comercio quiera tener, visible en su ficha, que puede pedir
por un canal simple y dejar cuando quiera.

### 18.2 Precedentes (y qué enseñan)

- **Nette Toilette (Alemania, desde 2000):** las ciudades pagan a los comercios
  unos 30 a 100 € por mes para que abran el baño al público, y el comercio pone
  un calco en la vidriera. Unas 210 ciudades adheridas.
- **Community Toilet Scheme (Reino Unido):** los municipios pagan, por ejemplo,
  £800-1.000 por año (Richmond) o £500-1.300 (Wealden), con calco del municipio.
- **Brighton**, en una versión anterior **sin incentivo económico**, llegó a solo
  **19 comercios**. Las objeciones: comportamiento antisocial, costos de
  limpieza e insumos, seguros.

Lección: **los esquemas que funcionan están pagados y respaldados por el
municipio.** Uno basado solo en reputación probablemente consiga pocas
adhesiones. Eso conecta con la consulta pendiente a la Municipalidad (Q-D5): si
no hay baños públicos municipales, "Baño amigo" con respaldo municipal (aunque
sea sin pago, con el sello de la Municipalidad) es una propuesta concreta para
llevarle.

### 18.3 Qué agrega al modelo

**`propio.adhesiones`**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `banio_id` | FK | |
| `estado` | enum | `solicitada`, `verificada`, `activa`, `pausada`, `baja`. |
| `condiciones` | jsonb | Lo que el comercio promete: `sin_consumir` (bool), `horario_banio` (puede diferir del comercio), `cambiador`, `accesible`. Se cargan como evidencias con `procedencia = fuente_externa`. |
| `contacto` | texto cifrado en reposo | Un solo canal (teléfono o mail del comercio), para renovaciones y bajas. Suele ser el WhatsApp del dueño: **es un dato personal**. |
| `verificacion` | jsonb | Método y fecha (`visita`, `llamada_al_numero_publico`, `codigo_en_calco`). |
| `alta`, `renovar_antes_de`, `baja` | date | Renovación anual: la adhesión también decae (§10). |
| `procedencia` | `procedencia_t` | `fuente_externa`. |

Endpoints nuevos: `POST /adhesiones` (formulario público "¿Es tu comercio?" en la
ficha, sin cuenta de usuario), `POST /adhesiones/{id}/baja` (con un token que
recibe el comercio). La verificación y la activación son comandos del CLI.

### 18.4 Qué cambia en el producto

1. **Regla asimétrica de exposición** (**adoptada para v1**, aunque no se
   adopte el resto): para un comercio **no adherido**, la ficha nunca dice "libre" ni
   "sin consumir". Dice "baño para clientes" o "consultá", aunque haya reportes
   de usuarios de que dejaron pasar. Solo un comercio adherido muestra "te dejan
   pasar sin consumir". Costo: se esconde un dato verdadero. Beneficio: el
   proyecto nunca expone a un comercio que no lo eligió.
2. **La tercera pregunta verifica la promesa:** para un baño amigo, "¿Te dejaron
   pasar sin consumir?" (§7.3) es la forma barata de saber si la promesa se
   cumple.
3. **Texto y marca:** un comercio no va a pegar en la vidriera un calco de un
   sitio que se llama "dónde cagaste". El programa necesita una **submarca
   sobria** ("Baños amigos de Río Gallegos") con su propia página. Q-N3 pasa de
   tono a decisión necesaria.
4. **Calco con QR a `/b/{slug}`:** el distintivo físico es además el mejor canal
   de adquisición que tiene el proyecto. Cada vidriera es un cartel.
5. **Filtro "Baños amigos"** en el mapa.

### 18.5 Qué cuesta

| Rubro | Costo |
|---|---|
| Modelo y código | Una entidad, una máquina de estados, dos endpoints, comandos de CLI, el distintivo en la ficha, un filtro. Chico. |
| Operación | **Verificar cada solicitud** (¿quien la pide representa al comercio?) y **renovar cada año**. Sin recorrida garantizada, la verificación tiene que ser por llamada al número público del comercio o con un código impreso en el calco que un usuario confirma en la tercera pregunta. Es trabajo del equipo que no escala solo. |
| Materiales | Diseño e impresión de calcos. Poco dinero, pero dinero. |
| Producto | Submarca, textos, página del programa, términos para comercios. |
| Legal | Términos para comercios adheridos; datos de contacto (personales) bajo la Ley 25.326. |
| Privacidad | **Presión previsible:** un comercio adherido va a pedir "¿cuánta gente vino por ustedes?". La respuesta tiene que ser "nada individual"; como mucho, un agregado mensual con k ≥ 3 cuentas elegibles, en rangos. Está en el invariante de superficies. |
| Riesgo | Sin pago ni respaldo municipal, pocas adhesiones (Brighton: 19). Un programa con 2 comercios se ve peor que no tener programa. |

### 18.6 Recomendación

- **Adoptada para v1, independiente del resto:** la regla asimétrica de
  exposición (§18.4, punto 1; PRIVACY.md P-32). Cuesta poco en código y cierra
  el riesgo original; su costo es esconder un dato verdadero.
- **No meter "Baño amigo" en v1.** Llevarlo como propuesta a la Municipalidad
  junto con la consulta de Q-D5. Si hay respaldo municipal, piloto con 5
  comercios después del lanzamiento.
- Si no hay respaldo, piloto igual con 3-5 comercios elegidos a mano y medir si
  el calco trae tráfico (el QR se puede contar sin datos personales: es una
  visita a una página pública).

---

## 19. Operación en el VPS

- Docker Compose: `caddy`, `web`, `worker` (cron), `postgres`.
- Caddy: TLS automático; `log` desactivado para `/api/*` y `/tiles/*`; en el resto,
  IP truncada a /24 y retención 7 días.
- Cabeceras: CSP sin orígenes de terceros (`default-src 'self'`), sin fuentes de
  Google, sin CDN, `Referrer-Policy: no-referrer`, `Permissions-Policy:
  geolocation=(self)`.
- Postgres sin exponer a internet. Usuario de la app sin permisos de DDL. La
  API pública usa un rol de solo lectura (ver abajo, i2 e i3).
- Secretos (pimienta del HMAC de mail, claves de sesión) en variables de entorno
  fuera del repo y fuera de los backups de la base.
- Backups: restic, cifrados, a otro proveedor; 30 días. Un backup filtrado
  contiene aportes con `cuenta_id`, bóvedas cifradas y HMACs de mail: nada que
  ubique un domicilio.
- Actualizaciones de seguridad automáticas del sistema operativo. Esto, en un VPS
  autogestionado, es más importante que cualquier decisión de este documento.

**(i2)**

- **(actualizado en i3)** El rol de base que usa la API pública lee
  `osm.candidatos`, `propio.banios`, `propio.atributos_vigentes`, la vista
  `propio.evidencias_publicas` (sin `cuenta_id`), `propio.estado_reciente` y
  `propio.resumen_mensual`. No lee `propio.observaciones` ni `enlace`.
- `push_suscripciones.endpoint` y `claves` cifrados en reposo con una llave del
  entorno.
- El worker de importación tiene salida a `download.geofabrik.de` y a nada más
  de OSM.

**(i3)**

- Dos bases de datos (prueba y producción) con usuarios de base separados.
- `propio.adhesiones.contacto` cifrado en reposo, si se adopta.
- Backups de `propio` y `enlace` por separado de `osm` (`osm` se regenera desde
  el extracto).

## 20. Alcance de v1 y después

**v1 (piloto Río Gallegos, PWA)**

- Toggle "Mis registros / Baños públicos".
- Registro offline con el pipeline de §8, con la caja de comentario privada
  "¿Alguna anécdota?" (§8.1).
- Bóveda cifrada.
- Wiki de baños con evidencias, procedencia, atribución y frescura.
- Puente con tercera pregunta.
- "Sigue igual" en la ficha.
- Modo amigos con viajes a la vuelta.
- Logros (incluido "Bautismo de Porcelana" por el primer registro) y **medallas
  cada 5 registros** (§17), con tarjetas compartibles.
- **Regla asimétrica de exposición de comercios** (§18.4, PRIVACY.md P-32): a un
  comercio no adherido nunca se lo muestra como "te dejan pasar sin consumir".
- Push agregado en Android.
- Exportación y borrado de cuenta.
- Entorno de prueba en `caca.blucaro.site` mientras llega el dominio definitivo.

**v1.5**

- Prueba cerrada en Google Play (15-20 testers).

**Postergado o en evaluación**

- Mapa general (§16.1).
- Ranking de ciudades y países (§16.2), con ≥ 2 ciudades de ≥ 10 participantes.
- "Baño amigo" (§18), según la respuesta de la Municipalidad.
- Ligas entre amigos (Q-N9).
- Más ciudades sobre la Ruta 3.
- Devolución manual a OSM (ADR 0001).
