# DESIGN.md — Documento de diseño

Estado: **borrador para crítica**. Nada de esto está implementado.

Índice:

0. [Qué cambié de la propuesta original y por qué](#0-qué-cambié-de-la-propuesta-original-y-por-qué)
1. [Objetivos y no-objetivos](#1-objetivos-y-no-objetivos)
2. [Modelo de amenazas](#2-modelo-de-amenazas)
3. [Arquitectura](#3-arquitectura)
4. [Stack](#4-stack)
5. [Modelo de datos](#5-modelo-de-datos)
6. [Pipeline de anonimización, paso a paso](#6-pipeline-de-anonimización-paso-a-paso)
7. [Umbrales y arranque en frío (¿queda vacío el mapa?)](#7-umbrales-y-arranque-en-frío-queda-vacío-el-mapa)
8. [Endpoints](#8-endpoints)
9. [Jobs del worker](#9-jobs-del-worker)
10. [Datos geográficos](#10-datos-geográficos)
11. [Operación en el VPS](#11-operación-en-el-vps)
12. [Alcance de v1 y después](#12-alcance-de-v1-y-después)

---

## 0. Qué cambié de la propuesta original y por qué

La propuesta tenía la intuición correcta (dos capas, nada pasa sin filtro), pero
varios filtros protegían lo que no hacía falta y dejaban abierto lo que sí. Los
cambios, de más grave a menos:

| # | Propuesta original | Problema | Qué queda |
|---|---|---|---|
| 1 | Capa privada en el servidor: lat/long y timestamp exactos, "solo la ve el dueño". | "Solo la ve el dueño" en la interfaz. En la base la ven vos, cualquiera que entre al VPS, cualquier backup filtrado y cualquier pedido judicial. Un VPS autogestionado por una persona es justamente el eslabón más débil. Y un archivo de registros intestinales con ubicación y hora es, leído estrictamente, un banco de datos que "revela datos sensibles" (Ley 25.326, art. 7 inc. 3). | **El servidor nunca recibe coordenadas.** El pipeline de anonimización corre en el navegador. El historial privado se guarda cifrado con una llave que solo tiene el dispositivo del usuario (P-01, P-03). |
| 2 | Snap automático a un POI de OSM a <40 m; si hay POI, se publica. | Falla abierto exactamente en el caso peligroso. En un barrio argentino hay kioscos, almacenes y verdulerías entre las casas, y mucha gente vive arriba o atrás de su negocio. Tu casa queda a 30 m del "Kiosco Don Pepe" y tu cagada de las 7 AM sale publicada ahí todos los días. Además, el GPS del navegador adentro de un edificio tiene errores de 20 a 150 m: 40 m engancha el lugar equivocado tanto como el correcto. | El snap es **una sugerencia**, nunca una decisión. Publicar requiere que el usuario confirme el lugar y que el lugar sea de una categoría que plausiblemente tenga baño de uso público o de clientes (whitelist: estaciones de servicio, terminal, bares, etc.; nunca kioscos ni almacenes). Sin confirmación, privado (P-05, P-06). |
| 3 | Jitter determinístico por usuario, 60-80 m, siempre el mismo desplazamiento. | Un desplazamiento constante se rompe con **un solo punto conocido**. Si tu amigo sabe que fuiste a la YPF de la San Martín (estaba con vos, o el pin está a 70 m de una YPF obvia), calcula el vector y se lo resta a todos tus pines, incluido el de tu casa. Además, un anillo de 60-80 m le dice al atacante que el punto real **no** está en los 60 m más cercanos: le achica la búsqueda. | **Sin jitter.** El modo amigos usa la misma regla que lo público (solo lugares públicos confirmados) con más detalle temporal. Lo de casa aparece como "en casa", sin ubicación (P-10). |
| 4 | Heatmap por celdas H3/geohash con k = 5 registros de 3 usuarios. | Ver §7 en detalle. Resumen: si lo público solo tiene registros en lugares públicos, el heatmap es un mapa de estaciones de servicio borroneado, redundante con los pines. Si incluye registros de casa, es un mapa de dónde viven los usuarios. La condición de "5 registros" no agrega privacidad (la protección viene de cuántas **personas** hay, no de cuántas veces se repitió una) y en la simulación apaga la mitad de las celdas con pocos usuarios. | Sin heatmap en v1. El k-anonimato se aplica donde importa: contadores por lugar (k = 3 personas) y ranking por macrozona con datos de casa opt-in (k = 5 personas). El mapa de baños no depende de ningún umbral: nunca está vacío (§7). |
| 5 | Zonas de exclusión casa/trabajo guardadas (implícitamente) en el servidor. | La tabla de zonas de exclusión es, literalmente, la lista de domicilios y lugares de trabajo de usuarios seudónimos. Es el dato más sensible del sistema. | Las zonas viven solo en el dispositivo (dentro de la bóveda cifrada). El servidor no sabe que existen (P-07). |
| 6 | Detección de domicilio: coordenada repetida de noche **sin POI cerca**. | Hacerlo en el servidor es construir la capacidad de inferir el domicilio de cada usuario. Y la condición "sin POI cerca" vuelve a fallar con el kiosco de la esquina. | Corre en el cliente, sin la condición de POI, y también detecta el laburo (repetición en días hábiles de día). Además, **no se puede publicar nada hasta haber marcado la casa o haber dicho explícitamente que no** (P-08). |
| 7 | Auth: magic link o Google OAuth, "sin nombre real". | El mail **es** el nombre real la mitad de las veces (`juan.perez@gmail.com`). Guardarlo en claro al lado del historial es el vínculo identificatorio en una filtración. Google OAuth además le avisa a Google que usás esto, y no da nada que una passkey no dé. | Passkey como método principal (no hay ningún dato personal). Magic link como alternativa, guardando solo un HMAC del mail. Sin Google en v1 (P-11, P-12). |
| 8 | Tiempo borroso solo como franja horaria. | Franja + día exacto + lugar + seudónimo sigue siendo una traza. Y si se publica en vivo, "Fulano acaba de cagar en la YPF de Piedra Buena" significa "la casa de Fulano está vacía". | En lo público: semana + franja + tipo de día, sin seudónimo, publicado en lote nocturno con al menos 24 h de retraso. El cliente además difiere el envío (P-13, P-14). |
| 9 | Leaflet sobre tiles de OSM. | Leaflet está bien. Los tiles de `tile.openstreetmap.org`, no: su política de uso no tolera picos de un viral y te pueden bloquear, y cada pedido le manda a un tercero tu IP y qué parte del mapa mirás, que en el momento de registrar es **dónde estás**. | Tiles vectoriales propios (PMTiles generado de OSM) servidos desde el mismo VPS. Cero pedidos a terceros (P-16, §4). |
| 10 | "Baño de laburo" como logro, y zona de exclusión en el laburo. | Contradicción: si la zona del laburo es privada para siempre, el logro nunca se cumple. | Los logros se calculan en el cliente sobre el historial privado. Las zonas privadas solo afectan qué se **publica**, no qué se **cuenta** (§5.1). |

Lo que se mantiene tal cual: dos capas con filtro en el medio, privado por
defecto, permiso de geolocalización recién al registrar, seudónimo obligatorio,
sin imágenes en v1, Postgres + PostGIS, VPS propio.

---

## 1. Objetivos y no-objetivos

**Objetivos**

- O1. Que registrar sea gracioso y rápido (menos de 10 segundos, con una mano).
- O2. Un mapa de baños públicos de Río Gallegos útil desde el día uno, aunque
  nadie haya registrado nada.
- O3. Que ni otro usuario, ni un amigo, ni alguien con un dump de la base pueda
  saber dónde vive un usuario o cuándo no está en casa.
- O4. Que lo pueda operar una persona sola en un VPS.
- O5. Que funcione offline en la ruta y sincronice después.

**No-objetivos**

- No es una app de salud ni de seguimiento intestinal. No se registra nada
  sobre el cuerpo (P-02).
- No es una red social: sin fotos, sin texto libre público, sin seguidores.
- No protege contra un operador que decida volverse malicioso y modificar el
  código que sirve (§2, limitación L1).
- No intenta escalar a todo el país en v1. El diseño no lo impide, pero los
  bundles y los umbrales están pensados para una ciudad.

## 2. Modelo de amenazas

Contra quién nos protegemos, en orden de probabilidad:

| Actor | Qué sabe / puede | Qué queremos que **no** pueda |
|---|---|---|
| A1. Público general | Mira el mapa y los rankings. | Identificar a una persona, o un domicilio. |
| A2. Conocido con contexto (amigo, ex, vecino, compañero de laburo) | Sabe tu seudónimo o lo adivina; sabe dónde vivís y dónde trabajás; puede estar en la lista de amigos. | Saber cuándo no estás en casa; reconstruir tus recorridos; ubicar tu casa si no la sabe. |
| A3. Atacante con un dump de la base o un backup | Todo lo que esté guardado en el servidor. | Leer historiales, ubicar domicilios, vincular seudónimos con identidades reales. |
| A4. Operador curioso con acceso a la base (vos, o quien herede el proyecto) | Lo mismo que A3, más la posibilidad de mirar en vivo. | Lo mismo que A3 sobre los datos guardados. |
| A5. Pedido judicial o administrativo | Puede exigir lo que esté guardado. | Que haya algo comprometedor para entregar. |
| A6. Terceros de red (tiles, CDN, fuentes, analytics, proveedor de mail) | IP, cabeceras, qué recursos pide el navegador. | Saber que usás esto y dónde estás. |
| A7. Spammer / atacante Sybil | Crea cuentas. | Degradar el k-anonimato con cuentas falsas; ensuciar los datos de un lugar. |

**Limitaciones que asumimos y declaramos:**

- **L1. Cripto en una web.** El servidor sirve el JavaScript que cifra. Un
  operador malicioso (o alguien que tome el servidor) puede servir un JS que
  robe la llave. El cifrado de la bóveda protege contra A3, A4-sobre-lo-guardado
  y A5; **no** contra un servidor comprometido en vivo. Mitigaciones parciales:
  código abierto, builds reproducibles, CSP estricta, sin scripts de terceros.
  No hay solución completa en navegadores.
- **L2. Metadatos de tráfico.** Aunque el contenido esté cifrado, el servidor ve
  cuándo se conecta cada cuenta. Lo achicamos (envío diferido, sin logs de acceso
  en la API, sin timestamps en las filas de la bóveda) pero no lo eliminamos.
- **L3. El operador ve aportes públicos con su autor.** Para contar personas
  distintas (k-anonimato), frenar spam y permitir borrado, los aportes públicos
  se guardan con `cuenta_id`. Nunca se exponen, pero A3/A4 ven "la cuenta X
  aportó a la YPF Y en la semana Z". Ver OPEN-QUESTIONS.md, Q-P3.

## 3. Arquitectura

```
┌───────────────────────── Navegador (dispositivo del usuario) ─────────────────────────┐
│                                                                                       │
│  Geolocalización ──► Registro privado (coords + hora exactas, comentario)              │
│   (recién al tocar          │                                                         │
│    "Registrar")             ▼                                                         │
│                     IndexedDB (en claro, solo local)                                  │
│                             │                                                         │
│        ┌────────────────────┼──────────────────────────┐                              │
│        ▼                    ▼                          ▼                              │
│  Zonas privadas      Candidatos de lugar        Detección de domicilio                │
│  (solo local)        (bundle local de POIs)     y laburo (solo local)                 │
│        │                    │                                                         │
│        └──────► Confirmación explícita del usuario ◄── whitelist de categorías        │
│                             │                                                         │
│                             ▼                                                         │
│                 Generalización: lugar_id + semana + franja + tipo de día              │
│                             │                                                         │
│                             ▼                                                         │
│                 Cola de salida (envío diferido ≥ 1 h, aleatorio)                      │
│                             │                     Bóveda: páginas mensuales           │
│                             │                     cifradas AES-GCM, con padding       │
└─────────────────────────────┼─────────────────────────────┼───────────────────────────┘
                              │ POST /api/v1/lote           │
                              ▼                             ▼
┌──────────────────────────────────── VPS ─────────────────────────────────────────────┐
│  Caddy (TLS; sin log de acceso en /api y /tiles)                                      │
│     │                                                                                 │
│     ├── apps/web (SvelteKit: UI + SSR + API)                                          │
│     │       │                                                                         │
│     │       ▼                                                                         │
│     │   Postgres + PostGIS                                                            │
│     │     ├─ cuentas, credenciales (sin mail en claro)                                │
│     │     ├─ boveda_paginas (bytes que el servidor no puede leer)                     │
│     │     ├─ aportes pendientes (lugar, semana, franja; nunca coordenadas)            │
│     │     └─ stats_* (agregados que pasaron los umbrales) ◄── lo único que lee la API │
│     │                                       ▲                    pública             │
│     │                                       │                                         │
│     ├── apps/worker (cron) ─────────────────┘  publicación nocturna, agregados,       │
│     │                                           import OSM, bundles, purgas           │
│     └── estáticos: lugares.json, zonas.geojson, *.pmtiles, logros.json               │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

La idea central: **todo lo que necesita la coordenada exacta pasa en el
dispositivo**. Eso se puede hacer porque el universo de lugares de una ciudad
de 110 mil habitantes entra en un archivo chico (estimado: unos pocos miles de
POIs, decenas a cientos de KB comprimido; a medir, ver Q-D1) que el cliente baja
entero. Bajar el archivo entero también evita que el pedido revele dónde estás
(no hay `?lat=…&lon=…` en ninguna URL).

## 4. Stack

| Pieza | Elección | Por qué | Alternativa razonable |
|---|---|---|---|
| Frontend + API | **SvelteKit** (TypeScript, adapter-node), un solo proceso | Una persona, un deploy. SSR para que los links compartidos tengan vista previa (crítico para el viral). Bundles chicos para Android baratos en 4G patagónico. | Vite + Preact SPA y una API Fastify aparte. Más piezas, sin SSR fácil. |
| Mapa | **MapLibre GL JS** + **PMTiles** autoalojado | Tiles vectoriales: se puede dar estilo propio (identidad local), un solo archivo estático servido con range requests, sin servidor de tiles. Sin terceros. | **Leaflet + protomaps-leaflet** sobre el mismo PMTiles. Más liviano (~40 KB contra ~200+ KB de MapLibre), menos lindo. Si el peso en celulares baratos resulta un problema, se cambia sin tocar los datos. Lo que no es negociable es la fuente de los tiles (§0, punto 9). |
| Offline | Service worker + IndexedDB | La Ruta 3 en Santa Cruz tiene tramos largos sin señal. Registrar offline y mandar después coincide con el envío diferido que igual queremos por privacidad. | — |
| Cripto cliente | **WebCrypto** (AES-GCM 256, HKDF) | Nativo, sin dependencias. | libsodium-wasm si hiciera falta algo que WebCrypto no tiene. |
| Auth | **WebAuthn/passkeys** (`@simplewebauthn`), magic link de respaldo | Sin datos personales; la extensión PRF permite derivar la llave de la bóveda (P-03, P-11). | — |
| Índice espacial cliente | **h3-js** | Agrupar registros para detectar domicilio. | Distancia haversine directa; con pocos miles de registros alcanza. |
| Base | **Postgres 16+ con PostGIS 3** | Se mantiene. Aunque el servidor ya no recibe coordenadas de usuarios, PostGIS sigue siendo útil para importar OSM, filtrar por categoría y corredor (Ruta 3), y para las macrozonas. | — |
| Acceso a datos | SQL plano en migraciones + query builder tipado (Kysely) | Migraciones legibles; tipos sin ORM pesado. | Drizzle. |
| Worker | Node + cron del sistema | Cinco jobs nocturnos no justifican una cola. | — |
| Proxy | **Caddy** | TLS automático, configuración corta, fácil apagar logs por ruta. | nginx + certbot. |
| Mail (solo magic link) | Proveedor transaccional | Mandar mail desde la IP de un VPS a Hotmail/Outlook o Gmail termina en spam. Costo: un tercero ve las direcciones (ver Q-L5). Si las passkeys alcanzan, se elimina. | SMTP propio con SPF/DKIM/DMARC; probable fracaso de entregabilidad. |
| Analytics | Ninguno en v1, o contador propio sin cookies y sin IP | Cualquier analytics de terceros es A6. | Umami/Plausible autoalojado. |
| Despliegue | Docker Compose en el VPS, backups con restic | Simple y reproducible. | — |

Todo en un monorepo TypeScript (pnpm workspaces) para que el cliente y el
servidor compartan los mismos esquemas de validación y la misma lógica de
franjas y semanas.

---

## 5. Modelo de datos

Convenciones: nombres en castellano, `snake_case`. Ningún campo del servidor
guarda coordenadas de usuarios, IPs, user agents ni timestamps con precisión
mayor a la necesaria.

### 5.1 Capa privada — en el dispositivo (IndexedDB, en claro solo local)

Esto **no** es una tabla del servidor. Es lo que vive en el navegador y se
sincroniza cifrado (§5.2).

**`registros`**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid v4 | Generado en el cliente. |
| `ocurrido_en` | timestamp con zona | Exacto. Editable (para cargar uno viejo). |
| `lat`, `lon` | double, nullable | Exactos. Null si el usuario eligió "sin ubicación". |
| `precision_m` | real, nullable | `coords.accuracy` de la Geolocation API. |
| `fuente_ubicacion` | enum | `gps`, `manual`, `ninguna`. |
| `lugar_id` | bigint, nullable | Solo si el usuario confirmó un lugar del catálogo. |
| `tipo` | enum | `casa`, `laburo`, `casa_ajena`, `lugar_publico`, `ruta`, `naturaleza`, `otro`. Lo elige el usuario; alimenta logros. |
| `sin_papel` | bool | Para el logro del baño ajeno sin papel. Es una condición del baño, no del cuerpo. |
| `puntaje` | smallint 1-5, nullable | Opinión personal del baño. |
| `comentario` | texto, nullable | Privado, nunca se publica. |
| `en_zona_privada` | uuid, nullable | Id de la zona privada en que cayó (calculado). Si no es null, el registro no puede publicarse, nunca. |
| `publicado` | objeto | `{ publico: id_remoto?, amigos: id_remoto?, reporte: id_remoto? }`. Guarda los ids que devolvió el servidor para poder borrarlos. |
| `actualizado_en` | timestamp | Para resolver conflictos de sincronización (dentro de la bóveda cifrada, nunca visible al servidor). |

**`zonas_privadas`**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `nombre` | texto | "Casa", "Laburo", "Lo de mi vieja". |
| `lat`, `lon` | double | Centro. |
| `radio_m` | smallint | Default 200. Mínimo 100, máximo 1000. |
| `origen` | enum | `manual`, `sugerida_noche`, `sugerida_laburo`. |
| `creada_en` | timestamp | |

**`preferencias`**: reglas de publicación recordadas
(p. ej. "siempre ofrecer publicar en estaciones de servicio"), estado de
onboarding (`casa_definida: si | no_quiero`), progreso de logros cacheado.

**`cola_salida`**: aportes generalizados pendientes de envío (§6, paso 9).

**`descartes_sugerencia`**: clusters que el usuario dijo que no son su casa, para
no volver a preguntar.

Los **logros** se evalúan acá, sobre `registros`, sin importar si están en zona
privada. "Baño de laburo" se cumple aunque el laburo sea zona privada.

### 5.2 Bóveda — en el servidor, cifrada

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

### 5.3 Cuentas y autenticación

**`cuentas`**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `seudonimo` | citext único | 3-24 caracteres, `[a-z0-9_]`, lista de palabras reservadas. Obligatorio. |
| `creada_en` | date | Día, no hora. Se usa para la elegibilidad anti-Sybil (§7.4). |
| `mayor_de_edad` | bool | Declaración al registrarse (ver Q-L3). |
| `estado` | enum | `activa`, `suspendida`. |
| `dias_con_aportes` | smallint | Contador para elegibilidad (§7.4). Se incrementa por lote recibido, a lo sumo una vez por día. |

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

### 5.4 Catálogo geográfico (público por naturaleza)

Los lugares son datos públicos de OSM o curados. No son datos de usuarios.

**`lugares`**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | bigint | Estable entre imports. |
| `osm_tipo`, `osm_id` | texto, bigint, nullable | Null si es curado a mano. |
| `nombre` | texto | |
| `categoria` | enum | Ver whitelist abajo. |
| `marca` | texto, nullable | `YPF`, `Axion`, `Shell`, `La Anónima`… |
| `geom` | geography(Point, 4326) | Punto del lugar (de OSM; no de un usuario). |
| `publicable` | bool | `true` si la categoría está en la whitelist y no hay override en contra. |
| `banio` | enum | `confirmado`, `probable`, `desconocido`. Semilla desde tags de OSM (`toilets=*`, `amenity=toilets`) y categoría; después lo corrigen los reportes. |
| `tags_osm` | jsonb | Solo los relevantes: `fee`, `wheelchair`, `changing_table`, `opening_hours`, `toilets:*`, `brand`. |
| `corredores` | text[] | P. ej. `{RN3}` si está a menos de X m del trazado. Alimenta logros de ruta. |
| `macrozona_id` | int FK, nullable | |
| `fuente` | enum | `osm`, `curado`. |
| `importado_en` | date | |

**Whitelist de categorías publicables (v1):** `estacion_servicio`,
`banio_publico` (`amenity=toilets`), `terminal_omnibus`, `aeropuerto`,
`shopping`, `supermercado_grande`, `gastronomia` (restaurant, cafe, bar,
fast_food, pub), `salud_publica` (hospital), `educacion_superior`,
`oficina_publica` (con atención al público), `parque_con_banio`, `museo`,
`estadio`. Quedan **afuera** a propósito: kioscos, almacenes, verdulerías,
peluquerías, talleres, oficinas privadas, cualquier comercio chico de barrio y
todo lo residencial. El mapeo desde tags de OSM va en
`data/curated/categorias.json`.

**`macrozonas`**: `id`, `nombre`, `geom` (geography MultiPolygon), `ciudad`.
Agrupación curada a mano de barrios en ~8-10 zonas (ver §7.3 por qué no barrios).

### 5.5 Capa pública — aportes (entrada) y agregados (salida)

Dos tipos de tabla: **aportes**, que guardan quién aportó (necesario para
k-anonimato, spam y borrado) y que la API pública nunca lee; y **stats**, que el
worker calcula de noche y son lo único que la API pública lee.

#### Aportes

**`visitas`** — "alguien usó este baño".

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | Generado por el servidor; se devuelve al cliente para que pueda borrar. |
| `cuenta_id` | uuid FK | Interno. Nunca expuesto. |
| `lugar_id` | bigint FK | Debe ser `publicable`. |
| `semana` | date | Lunes de la semana ISO. |
| `franja` | enum | `madrugada` (0-6), `manana` (6-12), `mediodia` (12-15), `tarde` (15-20), `noche` (20-24). |
| `tipo_dia` | enum | `habil`, `sabado`, `domingo_feriado`. |
| `lote` | date | Día en que llegó el lote. Se usa para la publicación diferida. |
| `estado` | enum | `pendiente`, `publicada`. |

Único `(cuenta_id, lugar_id, semana, franja)`: una persona no infla un lugar.

**`reportes_banio`** — "así está el baño". Es una opinión sobre el lugar, no un
evento de la persona. Se puede reportar sin registrar una visita.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `cuenta_id` | uuid FK | Interno. |
| `lugar_id` | bigint FK | |
| `semana` | date | |
| `tipo_dia`, `franja` | enum | Para "abierto el domingo a la tarde". |
| `hay_banio` | bool, nullable | |
| `acceso` | enum, nullable | `libre`, `clientes`, `pedir_llave`, `cerrado`. |
| `abierto` | bool, nullable | Observación puntual en ese tipo de día y franja. |
| `cobra` | bool, nullable | Sin monto: con la inflación, un precio viejo es un dato falso. |
| `limpieza` | smallint 1-3, nullable | Asqueroso / zafa / impecable. |
| `papel`, `jabon` | bool, nullable | |
| `cambiador` | bool, nullable | |
| `accesible` | bool, nullable | Silla de ruedas. |
| `lote`, `estado` | | Igual que `visitas`. |

Sin texto libre (P-15). Único `(cuenta_id, lugar_id, semana)`.

**`aportes_zona`** — opt-in explícito para el ranking de macrozonas. Es el
único aporte que incluye registros hechos en casa, y por eso tiene el umbral más
alto.

| Campo | Tipo | Notas |
|---|---|---|
| `cuenta_id` | uuid FK | Interno. |
| `macrozona_id` | int FK | Calculado en el cliente con el polígono local. |
| `mes` | date | Primer día del mes. |
| `rango` | enum | `1_10`, `11_20`, `21_31`, `mas_31`. Cantidad de registros del mes, en rangos: el servidor no aprende la frecuencia exacta de nadie (dato cercano a salud). |
| `lote` | date | |

PK `(cuenta_id, mes)`: una cuenta aporta a una sola macrozona por mes.

#### Agregados (lo único que lee la API pública)

**`stats_lugar`**: `lugar_id`, `ventana` (`90d`, `historico`),
`personas_rango` (`3_9`, `10_49`, `50_mas`; null si < 3), `franja_pico` (null si
no visible), `tipo_dia_pico`, `actualizado` (date). Si no hay al menos 3
personas elegibles distintas, la fila no tiene contadores, pero **el lugar
igual aparece en el mapa** con sus atributos.

**`atributos_lugar`**: `lugar_id`, `atributo`, `valor`, `personas` (int),
`ultima_semana` (date), `estado` (`sin_confirmar` con 1 persona, `confirmado`
con ≥ 2 personas concordantes en 90 días, `en_disputa` si hay reportes
contradictorios recientes). Para atributos de horario (`abierto` por tipo de día
y franja) se guarda la combinación.

**`stats_macrozona`**: `macrozona_id`, `mes`, `personas_rango`,
`indice` (promedio de registros por persona, a partir de los rangos, redondeado
a entero), `visible` (≥ 5 personas elegibles), `faltan` (cuántas personas
faltan para aparecer, para el estado vacío "a Zona Norte le faltan 2 cagones").

**`stats_ciudad`**: `ciudad`, `semana`, `personas_rango`, `visitas_rango`.
Visible con ≥ 10 personas.

### 5.6 Amigos

**`amistades`**: `cuenta_a`, `cuenta_b` (con `cuenta_a < cuenta_b`),
`creada_en` (date). Mutua.

**`invitaciones_amistad`**: `token_hash`, `emisor_id`, `vence_en` (48 h),
`usada`. Se comparte por link.

**`feed_amigos`**: lo que ven los amigos. Se borra a los 30 días.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `autor_id` | uuid FK | |
| `lugar_id` | bigint FK, nullable | Solo si es publicable y no está en zona privada. Si no, null. |
| `etiqueta` | enum | `casa`, `laburo`, `casa_ajena`, `lugar_publico`, `ruta`, `naturaleza`, `otro`. Sin ubicación cuando `lugar_id` es null: "Fulano cagó en casa". |
| `dia` | date | Más preciso que en lo público, a propósito: entre amigos el chiste es "hoy". |
| `franja` | enum | |
| `vence_en` | date | `dia + 30`. |

### 5.7 Insignias públicas (opt-in)

**`insignias_publicas`**: `cuenta_id`, `insignia_id` (del catálogo
`logros.json`), sin fecha. El cliente declara la insignia y el servidor no la
puede verificar porque no tiene el historial (ver Q-P5). Una insignia nunca
muestra cuándo ni en qué lugares se logró. Las insignias de ruta
("Conquistador de la Ruta 3") solo se pueden mostrar cuando están **completas**,
nunca el progreso: un progreso que avanza en vivo es un rastreador de viajes.

### 5.8 Moderación

**`denuncias`**: `id`, `objetivo_tipo` (`seudonimo`, `lugar`, `reporte`),
`objetivo_id`, `motivo` (enum), `denunciante_id`, `creada_en` (date), `estado`.
La administración en v1 es un CLI en el servidor, no un panel web (una superficie
de ataque menos).

Los límites de frecuencia (rate limit) viven en memoria del proceso, no en la
base.

---

## 6. Pipeline de anonimización, paso a paso

Pasos 1 a 9 en el **cliente**. Pasos 10 a 13 en el **servidor**. En ningún paso
viaja una coordenada.

**Onboarding (una vez).** Antes de poder publicar nada, el usuario marca su
casa como zona privada o elige explícitamente "no quiero marcar casa" (con una
advertencia). Mientras no lo haga, todos los toggles de publicación están
deshabilitados (P-08).

1. **Pedido de ubicación.** El usuario toca "Registrar". Recién ahí se pide
   permiso de geolocalización (`enableHighAccuracy: true`, `maximumAge: 0`,
   timeout 10 s). Si lo niega o falla: elige en el mapa, elige un lugar de la
   lista o registra "sin ubicación". Registrar nunca depende del permiso.

2. **Registro privado.** Se crea el registro en IndexedDB con coordenada, hora
   y precisión exactas. Todavía no salió nada del dispositivo.

3. **Chequeo de zonas privadas.** Si `distancia(registro, centro_zona) ≤
   radio_zona + precision_m` para alguna zona, el registro queda marcado
   `en_zona_privada` y **se termina el pipeline público**. Se suma la precisión
   para fallar del lado seguro: un GPS que dice "estás a 210 m ± 80 m de tu
   casa" cuenta como adentro.

4. **Detección de domicilio y laburo.** Sobre los registros que no están en
   ninguna zona, se agrupan por celda H3 res 10 (~66 m de lado) más sus vecinas.
   Si un grupo tiene registros en **3 noches distintas** (22 a 7 h), se propone
   "¿Esto es tu casa?" con **sí** preseleccionado. Si tiene registros en **3 días
   hábiles distintos** entre 8 y 19 h, se propone "¿Es tu laburo?". No se mira si
   hay un POI cerca (§0, punto 6). Si el usuario dice que no, se guarda en
   `descartes_sugerencia`. Mientras la sugerencia está abierta, los registros
   del grupo no se pueden publicar.

5. **Candidatos de lugar.** Con el bundle local de lugares: los `publicables`
   dentro de `min(150 m, max(60 m, 2 × precision_m))`, ordenados por distancia.
   Se muestra "¿Dónde fue?" con esos candidatos y además **En casa**, **En lo de
   alguien**, **En el laburo**, **En la ruta / al aire libre**, **Otro**. Se
   preselecciona el más cercano solo si está a < 40 m **y** la precisión es
   ≤ 30 m. La preselección elige el lugar, no la publicación.

6. **Decisión de publicar.** Solo si se cumplen todas: el usuario confirmó un
   lugar `publicable`, el registro no está en zona privada ni en un cluster con
   sugerencia abierta, y el onboarding de casa está resuelto. Entonces aparecen
   los toggles **Sumar al mapa** y **Contarle a mis amigos**, apagados por
   defecto. El usuario puede elegir "recordar para estaciones de servicio" o
   "para este lugar" (consentimiento explícito persistente, revocable).
   Aparte, puede **reportar cómo está el baño** (formulario de 8 casilleros).

7. **Generalización.** `lugar_id` (nunca la coordenada); `ocurrido_en` →
   `semana` (lunes ISO), `franja`, `tipo_dia` (usando `feriados-ar.json`), en la
   zona horaria `America/Argentina/Rio_Gallegos`. Para amigos, `dia` en vez de
   `semana`. Para el ranking de macrozona (si hay opt-in), al cierre de cada mes:
   macrozona de la zona privada "Casa" (calculada localmente) + rango de cantidad
   del mes.

8. **Cola de salida.** El aporte generalizado se guarda en `cola_salida`.

9. **Envío diferido.** La cola y las páginas de bóveda modificadas se mandan
   juntas en un solo `POST /api/v1/lote`, no antes de un retraso aleatorio entre
   1 y 6 horas desde el primer ítem encolado, en la siguiente vez que la página
   esté abierta (o vía Background Sync donde exista). El servidor ve "esta
   cuenta sincronizó", no "esta cuenta acaba de cagar". Para amigos el retraso
   es el mismo (ver Q-P4).

10. **Validación.** Sesión válida; rate limit; `lugar.publicable`; `semana` no
    futura y no más vieja que 8 semanas; consentimiento vigente para ese tipo de
    aporte; unicidad. Se guarda con `estado = pendiente` y `lote = hoy` (fecha,
    no hora). La ruta `/api/v1/lote` no tiene log de acceso.

11. **Publicación nocturna** (04:00, hora local). Pasan a `publicada` los
    aportes con `lote ≤ ayer`. Todo aporte espera al menos 24 h y a lo sumo 48 h.

12. **Agregados con umbrales.** Se recalculan `stats_*` contando solo cuentas
    **elegibles** (§7.4) y aplicando los umbrales de §7. Los valores se publican
    en rangos, no en números exactos, para que un aporte nuevo casi nunca cambie
    lo visible (defensa contra ataques de diferencia).

13. **Lectura pública.** La API pública lee únicamente `stats_*`,
    `atributos_lugar` y `lugares`. Nunca lee `visitas`, `reportes_banio` ni
    `aportes_zona`.

**Borrado de un aporte.** El cliente guarda el id remoto de cada aporte
(`registros.publicado`). Borrar el registro local ofrece borrar también los
aportes remotos; el borrado remoto es inmediato y los agregados se recalculan
esa noche.

---

## 7. Umbrales y arranque en frío (¿queda vacío el mapa?)

Esta es tu duda principal. Respuesta corta: **con 5 registros / 3 usuarios a
H3 res 8, el mapa no queda vacío: queda el centro y las estaciones de servicio,
y el resto aparece recién con unos 100 a 150 usuarios activos. Pero el problema
de fondo no es el umbral, es que el heatmap mide lo que no sirve.**

### 7.1 Qué tamaño tienen las celdas en Río Gallegos

| Grilla | Área aprox. | Comentario |
|---|---|---|
| H3 res 7 | 5,2 km² | La ciudad entera son ~6-8 celdas. |
| H3 res 8 | 0,74 km² | La mancha urbana (estimada en ~30 km², a medir) son ~40 celdas. |
| H3 res 9 | 0,11 km² | ~280 celdas. |
| geohash 6 | ~0,46 km² (0,76 × 0,61 km a 51,6° S) | |
| geohash 7 | ~0,015 km² (95 × 153 m) | Demasiado fino para k-anonimato con pocos usuarios. |

Si se usara una grilla, H3 antes que geohash: a 51,6° de latitud las celdas de
geohash se achican en sentido este-oeste (factor cos 51,6° ≈ 0,62) y quedan
rectángulos alargados.

### 7.2 Simulación

Modelo deliberadamente simple (script en
[`docs/analisis/sim_umbral_k.py`](docs/analisis/sim_umbral_k.py), 300
repeticiones por escenario; los números varían un poco entre corridas):

- 40 celdas res 8 con actividad.
- La popularidad de las celdas sigue una ley de Zipf (s = 1): pocas celdas
  (centro, accesos de la Ruta 3, terminal, aeropuerto, hospital, supermercados)
  concentran casi todo.
- Cada usuario activo tiene, en la ventana de tiempo, una cantidad de **visitas
  publicables** con distribución exponencial de media V. V es chico porque la
  mayoría de la gente caga en su casa: con ~25 registros en 3 meses y ~15 % en
  lugares públicos fuera de zonas privadas, V ≈ 4. V = 2 representa una ventana
  más corta o gente que publica menos.

Celdas visibles (de 40):

| Usuarios activos | V=2, regla 5 reg / 3 us | V=2, solo 3 us | V=4, regla 5 reg / 3 us | V=4, solo 3 us |
|---:|---:|---:|---:|---:|
| 10 | 0,6 | 1,3 | 1,8 | 3,4 |
| 20 | 1,8 | 3,8 | 4,1 | 7,7 |
| 50 | 5,4 | 10,4 | 11,1 | 19,0 |
| 100 | 11,0 | 19,3 | 21,0 | 30,6 |
| 150 | 16,3 | 26,2 | 29,4 | 36,3 |
| 300 | 29,3 | 36,5 | 38,7 | 39,8 |

Lecturas:

1. **La condición de 5 registros es la que manda con pocos usuarios** y corta a
   la mitad las celdas visibles. No agrega privacidad: tres personas distintas
   ocultan a cada una igual con 3 registros que con 5. Si cinco registros son
   de tres personas, uno de ellos puede tener tres y dominar la forma del mapa,
   que es lo contrario de lo que se quiere. **Se elimina: el k cuenta
   personas.**
2. **Con 20 a 50 usuarios activos se ve el centro y los puntos calientes.** Eso
   no es un mapa vacío, es un mapa que parece roto: un par de manchas y el
   resto gris.
3. **Con ~150 activos sostenidos durante 3 meses se cubre la mayor parte de la
   ciudad.** ¿Es realista? En una ciudad de 110 mil, un viral local (radios,
   cuentas de memes de la ciudad) puede traer miles de visitas y cientos de
   registros de cuenta; que 150 sigan registrando tres meses después es
   optimista. Hay que asumir que el escenario real del primer trimestre es la
   fila de 20 a 50.

Supuestos que pueden estar mal: la cantidad de celdas, el exponente de Zipf, la
fracción publicable. Ninguno cambia la conclusión cualitativa.

### 7.3 El problema de fondo: qué mide el heatmap

Con la regla de que solo se publica lo que pasa en lugares públicos, el heatmap
es **el mapa de los lugares públicos más usados, borroneado**. Ya tenemos esos
lugares como pines con nombre y datos útiles. El heatmap no agrega nada.

Si se incluyeran los registros de casa (opt-in), el heatmap sería **el mapa de
dónde viven los usuarios**. Es más riesgoso y, francamente, es poco gracioso: se
parece al mapa de densidad de población.

Por eso, en v1:

| Superficie pública | Unidad | Umbral | ¿Puede estar vacía? |
|---|---|---|---|
| **Mapa de baños** (lugares + atributos) | Lugar | Ninguno: el lugar es público (OSM). Los atributos se muestran como `sin_confirmar` con 1 reporte y `confirmado` con 2 personas. | **No.** Arranca con todo lo que haya en OSM más lo sembrado a mano. |
| **Contadores por lugar** ("acá cagaron 10-49 personas", "pico: domingo a la tarde") | Lugar | **k = 3 personas elegibles** distintas, ventana 90 días o histórica, en rangos. | Sí para lugares chicos; el lugar igual aparece. |
| **Ranking de macrozonas** (opt-in de registros de casa) | Macrozona (~8-10 en la ciudad) | **k = 5 personas elegibles** por mes. | Sí al principio. El estado vacío es un llamado: "A Zona Norte le faltan 2 cagones para entrar al ranking". |
| **Contador de la ciudad** ("Río Gallegos lleva X") | Ciudad | k = 10 personas por semana, en rangos. | Solo la primera semana. |

¿Por qué k más alto para macrozonas? Porque es el único lugar donde entran
registros hechos en casa. ¿Por qué macrozonas y no barrios? Misma simulación con
asignación uniforme y k = 5: con 40 barrios hacen falta ~200 personas con opt-in
para ver la mitad (22,5 de 40) y con 50 personas se ve 0,3 de 40; con 10
macrozonas, 50 personas ya muestran 5,7 de 10 y 100 personas las muestran
todas. Cuando haya densidad se puede bajar a barrios donde el umbral se cumpla.

¿Y un heatmap en el futuro? Solo multirresolución (mostrar res 8 donde haya k,
caer a res 7 donde no), acumulado histórico, actualizado de noche y en rangos.
Queda para v2 y solo si alguien lo extraña.

### 7.4 Elegibilidad: cuentas que cuentan para k

Sin esto, el k-anonimato se rompe con dos cuentas falsas (A7): el atacante pone
2 cuentas truchas en la YPF de un pueblo, y cuando aparece "3-9 personas" sabe
que hubo una real, y si sabe quién viaja, sabe que viajó.

Una cuenta cuenta para k si tiene **al menos 14 días** de antigüedad y aportes
en **al menos 5 días distintos** (`cuentas.dias_con_aportes`). Costo: los primeros
usuarios tardan dos semanas en "contar"; con 20-50 usuarios eso retrasa todavía
más los contadores. Los atributos de baño (§7.3, primera fila) no dependen de
esto, así que el mapa útil no se retrasa.

### 7.5 Estrategia de arranque en frío (no técnica, pero decide todo)

- Sembrar el mapa de baños antes del lanzamiento: import de OSM + una recorrida
  propia de las estaciones de servicio, la terminal, el aeropuerto, los
  supermercados grandes y los bares del centro, cargando atributos reales. Con
  30-60 lugares bien cargados el mapa útil ya existe el día uno. (Cuántos baños
  tiene hoy OSM en Río Gallegos está sin medir: Q-D1.)
- El chiste vive en el modo amigos y en las tarjetas compartibles de logros,
  que no dependen de ningún umbral.
- Los estados vacíos son llamados a sumar gente, no grises.

---

## 8. Endpoints

Base `/api/v1`. JSON. Autenticación por cookie de sesión. Ningún endpoint
recibe ni devuelve coordenadas de usuarios. Ningún parámetro de URL describe la
posición del usuario.

### 8.1 Autenticación y cuenta

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

### 8.2 Bóveda

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/boveda?desde={seq}` | Páginas cambiadas desde `seq`. |
| PUT | `/boveda/paginas/{pagina_id}` | `{ nonce, cifrado, version_esperada }`. 409 si cambió en otro dispositivo; el cliente mezcla y reintenta. |
| DELETE | `/boveda/paginas/{pagina_id}` | |
| GET | `/boveda/llaves` | Llaves envueltas disponibles para esta cuenta. |
| PUT | `/boveda/llaves/{metodo}` | Guarda o reemplaza una llave envuelta. |

### 8.3 Aportes (autenticado)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/lote` | Un solo endpoint para todo lo diferido: `{ visitas: [...], reportes: [...], amigos: [...], zona: {...}?, paginas_boveda: [...] }`. Devuelve los ids remotos. Sin log de acceso. |
| GET | `/aportes/mios` | Lista de mis aportes públicos y de amigos vigentes, para transparencia y borrado. |
| DELETE | `/aportes/{tipo}/{id}` | `tipo ∈ visita, reporte, amigos, zona`. |

### 8.4 Lectura pública (sin autenticación)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/estaticos/{ciudad}/lugares.v{n}.json` | Catálogo completo de la ciudad (id, nombre, categoría, marca, punto, `publicable`, `banio`). Estático, cacheable. El cliente siempre lo baja entero. |
| GET | `/estaticos/{ciudad}/macrozonas.v{n}.geojson` | |
| GET | `/estaticos/logros.v{n}.json` | Catálogo de logros. |
| GET | `/tiles/{region}.pmtiles` | Range requests. Sin log. |
| GET | `/mapa/{ciudad}` | Para todos los lugares: atributos agregados y contadores visibles. Toda la ciudad de una vez (no hay bbox, para no revelar qué zona mira el usuario). |
| GET | `/lugares/{id}` | Ficha de un lugar. También tiene versión SSR en `/l/{id}` para compartir. |
| GET | `/ranking/{ciudad}?mes=YYYY-MM` | Macrozonas visibles y cuántas personas le faltan a cada una. |
| GET | `/ciudad/{ciudad}/resumen` | Contador de la ciudad. |
| GET | `/u/{seudonimo}` | Insignias públicas, si la persona las hizo públicas. Nada más. |
| GET | `/c/{token}` | Tarjeta compartible (SSR + imagen OpenGraph) de una insignia. Sin fechas, sin lugares. |

### 8.5 Amigos (autenticado)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/amigos/invitaciones` | Devuelve un link de un solo uso, válido 48 h. |
| POST | `/amigos/invitaciones/{token}/aceptar` | |
| GET | `/amigos` | Lista. |
| DELETE | `/amigos/{seudonimo}` | Corta la amistad y borra del feed del otro lo que yo le había mostrado. |
| GET | `/amigos/feed` | Últimos 30 días. |

### 8.6 Moderación y salud

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/denuncias` | `{ objetivo_tipo, objetivo_id, motivo }`. |
| GET | `/salud` | Estado del servicio. |

La administración (resolver denuncias, suspender cuentas, overrides de lugares)
es un CLI que corre en el servidor por SSH. No hay rutas `/admin`.

---

## 9. Jobs del worker

| Job | Cuándo | Qué hace |
|---|---|---|
| `publicar-lote` | Diario 04:00 | `pendiente → publicada` para aportes con `lote ≤ ayer`. |
| `recalcular-agregados` | Diario, después del anterior | Recalcula `stats_lugar`, `atributos_lugar`, `stats_macrozona`, `stats_ciudad` con los umbrales de §7 y solo cuentas elegibles. Regenera la caché de `/mapa/{ciudad}`. |
| `importar-osm` | Semanal | Baja el extracto de Argentina (Geofabrik), recorta Santa Cruz con osmium, filtra tags, actualiza `lugares` preservando `id`. Aplica `lugares-overrides.json`. Marca corredores (RN3) por distancia al trazado. |
| `generar-bundles` | Después de `importar-osm` | `lugares.v{n}.json`, `macrozonas.v{n}.geojson`, `logros.v{n}.json`; PMTiles si cambió el mapa base (mensual alcanza). |
| `purgar` | Cada hora / diario | Tokens de magic link vencidos, sesiones vencidas, `feed_amigos` > 30 días, invitaciones vencidas. |
| `backup` | Diario | restic cifrado fuera del VPS, retención 30 días. |

---

## 10. Datos geográficos

- **Fuente:** OpenStreetMap vía extracto de Geofabrik (no Overpass en
  producción: no es para uso automatizado intensivo).
- **Catálogo de lugares:** filtro por los tags de la whitelist (§5.4), más
  `amenity=toilets`, más cualquier objeto con `toilets=yes`. Normalización de
  marca (`brand=YPF`, `brand:wikidata`).
- **Corredor Ruta 3:** relación de la RN3 en OSM; un lugar está en el corredor si
  está a menos de ~300 m del trazado. El logro "Las YPF de la Ruta 3" se define
  sobre una lista curada (`logros.json`), no sobre el cálculo automático, porque
  hay estaciones cerradas, mal cargadas o duplicadas.
- **Mapa base:** PMTiles generado con Planetiler o el pipeline de Protomaps a
  partir del mismo extracto, recortado a la Patagonia sur. Estilo propio.
- **Licencia:** ODbL. Atribución visible en el mapa. Ver Q-L6 sobre la
  combinación con aportes de usuarios.

## 11. Operación en el VPS

- Docker Compose: `caddy`, `web`, `worker` (cron), `postgres`.
- Caddy: TLS automático; `log` desactivado para `/api/*` y `/tiles/*`; en el resto,
  IP truncada a /24 y retención 7 días.
- Cabeceras: CSP sin orígenes de terceros (`default-src 'self'`), sin fuentes de
  Google, sin CDN, `Referrer-Policy: no-referrer`, `Permissions-Policy:
  geolocation=(self)`.
- Postgres sin exponer a internet. Usuario de la app sin permisos de DDL. La
  API pública usa un rol que solo puede leer `stats_*`, `atributos_lugar` y
  `lugares`.
- Secretos (pimienta del HMAC de mail, claves de sesión) en variables de entorno
  fuera del repo y fuera de los backups de la base.
- Backups: restic, cifrados, a otro proveedor; 30 días. Un backup filtrado
  contiene aportes con `cuenta_id`, bóvedas cifradas y HMACs de mail: nada que
  ubique un domicilio.
- Actualizaciones de seguridad automáticas del sistema operativo. Esto, en un VPS
  autogestionado, es más importante que cualquier decisión de este documento.

## 12. Alcance de v1 y después

**v1 (piloto Río Gallegos)**

- Registro offline con pipeline completo de §6.
- Bóveda cifrada con passkey + PRF y código de recuperación.
- Mapa de baños con atributos y contadores por lugar.
- Modo amigos.
- Logros locales y tarjetas compartibles.
- Ranking de macrozonas (opt-in).
- Exportación y borrado de cuenta.

**Después, si el piloto anda**

- Más ciudades sobre la Ruta 3 (bundles por ciudad).
- Heatmap multirresolución, solo si se justifica (§7.3).
- Barrios en lugar de macrozonas donde el umbral se cumpla.
- Devolver a OSM atributos confirmados (Q-L6).
- Fotos de baños (no de personas), con moderación previa.
