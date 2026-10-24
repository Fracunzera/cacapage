# DESIGN.md — Documento de diseño

Estado: **borrador para crítica, iteración 2**. Nada de esto está implementado.

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
9. [Umbrales y arranque en frío](#9-umbrales-y-arranque-en-frío)
10. [Pipeline de importación de OSM (una sola vía)](#10-pipeline-de-importación-de-osm-una-sola-vía)
11. [Endpoints](#11-endpoints)
12. [Jobs del worker](#12-jobs-del-worker)
13. [PWA ahora, app nativa después](#13-pwa-ahora-app-nativa-después)
14. [Operación en el VPS](#14-operación-en-el-vps)
15. [Alcance de v1 y después](#15-alcance-de-v1-y-después)

---

## 0. Historial de cambios

### Iteración 2

Disparadores: el conteo real de OSM ([SEEDING.md](SEEDING.md)), cuatro
decisiones de producto tomadas (dos capas con toggle, puente, sembrado de una
vía, PWA primero) y la crítica adversarial de la iteración 1.

**El dato que cambia todo:** OSM tiene **5** `amenity=toilets` en Río Gallegos,
**todos a 21-39 m de una estación de servicio**, sin nombre, sin horario, sin
accesibilidad. No hay ningún baño público municipal mapeado. Sembrar "desde
OSM" con `amenity=toilets` da 5 puntos mudos.

| # | Cambio | Por qué |
|---|---|---|
| 1 | La base de baños es un **wiki de lugares**, separada de los **registros** (eventos). Toggle "Mis registros / Baños públicos". | Decisión tomada. Coincide con lo que ya separaba el diseño (reporte de lugar vs. visita), ahora como dos capas explícitas. |
| 2 | La base de baños incluye **baños probables** (estaciones de servicio, terminal, aeropuerto, hospital, supermercados grandes, gastronomía) marcados como "sin confirmar", además de los 5 `amenity=toilets`. | Con 5 baños la capa pública está vacía y el puente casi nunca se dispara (solo pregunta en lugares que ya están en la base). Ver §9 y SEEDING.md. |
| 3 | **Limpieza y papel no son atributos del wiki**: son observaciones con fecha que vencen. El wiki tiene atributos estables (acceso, si cobra, horario, accesible, cambiador). | Un wiki es "el último que edita gana", y eso aplicado a "¿está limpio?" es falso al día siguiente. Lo que el usuario llamó "limpieza" como atributo se modela como observación del puente (§6.4, §7). |
| 4 | **Leer el wiki es público, sin login e indexable. Editarlo requiere cuenta** (seudónima). | "Sin login" para editar significa que no hay forma de frenar vandalismo sin guardar IPs, y no guardar IPs es una decisión de privacidad (P-19). Si la intención era permitir edición anónima, no estoy de acuerdo: ver Q-W1. |
| 5 | **Sin contadores de visitas por lugar, sin ranking de macrozonas y sin heatmap en v1.** La tabla `visitas` desaparece. | Con 20 usuarios estaban todos vacíos (crítica de la iteración 1 y §9). Además eran la principal fuente de eventos con autor en el servidor (limitación L3). |
| 6 | Las observaciones del puente se guardan con `cuenta_id` **solo 90 días** y después se borran; queda un resumen mensual sin autor. | Cierra en parte la limitación L3 de la iteración 1 (Q-P3). |
| 7 | Importación de OSM **de una sola vía**, explícita en el diseño, en un ADR y en el código cuando exista. | Decisión tomada. Además: la importación de una vía no evita la cláusula share-alike de ODbL (§10.7, Q-L6). |
| 8 | Arquitectura **PWA primero, empaquetable con Capacitor sin reescribir**: capa de plataforma con interfaces, rutas de app sin SSR, API con token además de cookie, lógica offline fuera del service worker, dominio de passkeys definitivo desde el día uno. | Decisión tomada (§13). |
| 9 | Correcciones de la crítica de la iteración 1: sin `faltan` exacto; viajes visibles para amigos recién a la vuelta; en madrugada y noche no hay preselección ni reglas recordadas; precisión GPS mínima de 50 m; registros en zona privada siempre con la etiqueta de la zona; detección de domicilio desde la primera noche; elegibilidad que se puede alcanzar. | Cada una cierra un camino del ataque de desanonimización o un error de cálculo. Detalle en PRIVACY.md. |

### Iteración 1 (respecto de la propuesta original)

Resumen de lo que ya se había cambiado y sigue vigente: el servidor nunca
recibe coordenadas (el pipeline corre en el cliente); historial cifrado de
punta a punta; snap a lugar como sugerencia con confirmación; whitelist de
categorías publicables; sin jitter; zonas privadas y detección de domicilio
solo en el dispositivo; passkeys y mail como HMAC, sin Google OAuth; tiempo
generalizado y publicación diferida; tiles propios; logros calculados en el
cliente. El razonamiento completo de cada uno está en PRIVACY.md (decisiones
P-xx y descartadas D-xx).

---

## 1. Objetivos y no-objetivos

**Objetivos**

- O1. Registrar en menos de 10 segundos, con una mano, aunque no haya señal.
- O2. Una capa de baños públicos que se vea poblada el día uno y que Google
  indexe ("baño abierto domingo Río Gallegos").
- O3. Que el chiste alimente el dato útil sin formularios (el puente).
- O4. Que ni otro usuario, ni un amigo, ni alguien con un dump de la base pueda
  saber dónde vive un usuario o cuándo no está en casa.
- O5. Que lo opere una persona sola en un VPS.
- O6. Que la misma base de código se pueda empaquetar como app nativa sin
  reescribirla.

**No-objetivos**

- No es una app de salud: nada sobre el cuerpo (P-02).
- No es una red social: sin fotos, sin texto libre público, sin seguidores.
- No escribe en OpenStreetMap. Nunca de forma automática (§10).
- No protege contra un operador que se vuelva malicioso y modifique el código
  servido (§2, L1).

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
  comprometido puede robar llaves. Una app nativa firmada mejora esto (§13.5),
  pero solo para quien la instale.
- **L2. Metadatos de tráfico.** El servidor ve cuándo se conecta cada cuenta.
  Achicado con envío diferido y sin logs de acceso.
- **L3. Observaciones con autor durante 90 días.** Para frenar spam y deduplicar,
  las observaciones del puente y las ediciones del wiki guardan `cuenta_id`.
  Las observaciones lo pierden a los 90 días; las ediciones lo conservan para
  poder revertir vandalismo (Q-P3).

## 3. Las dos capas y el puente

Una sola web, un solo mapa, un toggle arriba: **Mis registros / Baños
públicos**. Son dos capas con modelos de datos distintos porque son cosas
distintas:

| | **Registro** | **Baño** |
|---|---|---|
| Qué es | Un **evento**: usuario + momento + lugar. | Un **lugar**: existe, persiste, tiene atributos. |
| Modelo | Log que se acumula. | Wiki: estado vigente + historial de ediciones. |
| Quién lo ve | Solo su dueño (y, si quiere, sus amigos, sin ubicación de casa). | Todo el mundo, sin login, indexado por buscadores. |
| Quién lo escribe | Su dueño. | Cualquier usuario con cuenta. |
| Dónde vive | En el dispositivo; en el servidor, cifrado (bóveda). | En el servidor, en claro. |
| Requiere login | Sí, para sincronizar. Registrar offline sin cuenta es posible pero se pierde si se borra el navegador (Q-N8). | No para leer. Sí para editar. |
| Vida útil | La que quiera el dueño. | Indefinida. Las observaciones vencen (90 días). |

Lo que pasa de una capa a la otra es **solo** esto, y siempre por acción del
usuario:

1. **El puente** (§7): después de registrar en un lugar que está en la base de
   baños, dos toques opcionales: "¿cómo estaba?" (limpio / aceptable /
   evitalo) y "¿había papel?". Se convierte en una **observación** anónima
   sobre el baño. Si el baño era "probable", la observación además cuenta como
   evidencia de que el baño existe.
2. **Una edición del wiki**: el usuario corrige un atributo de un baño (horario,
   si cobra, accesible). No necesita haber registrado nada.

Nada más cruza. El registro en sí (cuándo, con qué frecuencia, desde dónde)
nunca pasa a la capa pública.

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

## 4. Arquitectura

```
┌────────────────────────── Cliente (PWA hoy · Capacitor mañana) ───────────────────────────┐
│                                                                                           │
│  UI (SvelteKit, rutas /app/* sin SSR)            Páginas públicas SSR (/b/{slug}, /c/...)  │
│        │                                         ← solo en la web, indexables             │
│        ▼                                                                                  │
│  packages/core ── pipeline de anonimización, franjas, puente, logros, validación          │
│  packages/vault ─ cifrado de la capa de registros                                         │
│        │                                                                                  │
│        ▼                                                                                  │
│  packages/platform (interfaces) ── geolocalización · almacenamiento · passkeys · push     │
│        │                            · compartir · segundo plano                            │
│        ├─ impl web (hoy):     Geolocation API · IndexedDB · WebAuthn · Web Push · Web Share │
│        └─ impl nativa (luego): plugins Capacitor · Credential Manager / ASAuthorization ·  │
│                                FCM/APNs · share nativo                                    │
│                                                                                           │
│  Cola de salida (IndexedDB, manejada por la app, NO por el service worker)                │
└───────────────────────────────┬───────────────────────────────────────────────────────────┘
                                │ HTTPS · cookie (web) o bearer (nativo)
                                ▼
┌─────────────────────────────────────── VPS ───────────────────────────────────────────────┐
│ Caddy ── apps/web (SvelteKit adapter-node: SSR público + API /api/v1)                     │
│              │                                                                            │
│              ▼                                                                            │
│          Postgres + PostGIS                                                               │
│            ├─ CAPA REGISTROS:  boveda_paginas (cifrado) · feed_amigos (30 d)               │
│            ├─ CAPA BAÑOS:      banios · banio_atributos · ediciones_banio ·                │
│            │                   observaciones (90 d, con autor) · estado_reciente (sin autor)│
│            ├─ IMPORTACIÓN OSM: importaciones_osm · conflictos_osm   (solo lectura de OSM) │
│            └─ CUENTAS:         cuentas · credenciales · consentimientos · push_suscripciones│
│                                                                                           │
│ apps/worker (cron) ── import OSM (descarga, nunca sube) · vencimientos · agregados ·      │
│                       bundles · backups                                                    │
│ estáticos ── banios.v{n}.json · *.pmtiles · logros.v{n}.json · /.well-known/*             │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

Lo que no cambia: **ninguna coordenada de usuario llega al servidor**. El
cliente baja el catálogo de baños entero (confirmados + probables; para Río
Gallegos, unos 60-70 puntos después de curar, ver SEEDING.md) y resuelve todo
localmente.

## 5. Stack

Sin cambios de fondo respecto de la iteración 1, con estos ajustes por la PWA y
el camino a Capacitor:

| Pieza | Elección | Nota de esta iteración |
|---|---|---|
| Frontend + API | SvelteKit (TS) | **Dos tipos de rutas**: públicas con SSR (wiki de baños, tarjetas compartibles, para SEO y vista previa en WhatsApp) y de app bajo `/app/*`, solo CSR, compilables con `adapter-static` para meterlas en Capacitor (§13). |
| PWA | Web App Manifest + service worker (Workbox o a mano) | El service worker solo cachea assets y tiles. **Ninguna lógica de negocio en el service worker.** |
| Push | Web Push con VAPID (Android, e iOS si la PWA está instalada) | Servidor con abstracción de transporte para sumar FCM/APNs en la app nativa. |
| Mapa | MapLibre GL JS + PMTiles propio | Igual. |
| Auth | Passkeys (WebAuthn) + magic link | **Dominio definitivo antes del lanzamiento**: las passkeys quedan atadas a él (§13.3, Q-N4). |
| Empaquetado futuro | Capacitor | No se instala en v1; la arquitectura lo prevé. |
| Import OSM | osmium-tool + script propio | Fuente: extracto de Geofabrik. Overpass solo para exploración manual (§10.1). |

## 6. Modelo de datos

Convenciones: nombres en castellano, `snake_case`. Ninguna tabla del servidor
guarda coordenadas de usuarios, IPs ni user agents.

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
| `comentario` | texto, nullable | Privado. |
| `en_zona_privada` | uuid, nullable | Calculado. Si no es null, no se publica nada de este registro, nunca. |
| `puente` | objeto, nullable | `{ estado: 'pendiente'|'respondido'|'descartado', estado_banio?, habia_papel?, id_remoto? }`. |
| `amigos` | objeto, nullable | `{ estado: 'no'|'en_cola'|'diferido_a_la_vuelta'|'enviado', id_remoto? }`. |
| `actualizado_en` | timestamp | Solo dentro de la bóveda. |

**`zonas_privadas`**: `id`, `nombre`, `lat`, `lon`, `radio_m` (default 200,
rango 100-1000), `rol` (`casa`, `laburo`, `otra`), `origen` (`manual`,
`sugerida_noche`, `sugerida_laburo`), `creada_en`.

**`preferencias`**, **`cola_salida`**, **`descartes_sugerencia`**: como en la
iteración 1. Nueva preferencia: `puente_activo` (default `true`; apagarlo hace
que nunca se pregunte).

Los **logros** se calculan acá, sobre `registros`, incluidas las zonas
privadas.

### 6.2 Bóveda (servidor, cifrada)

Sin cambios: `boveda_paginas` (páginas mensuales con id opaco, padding a 4 KB,
secuencia sin timestamps) y `boveda_llaves` (llave envuelta por PRF de passkey
y/o código de recuperación).

### 6.3 Cuentas

Como en la iteración 1 (`cuentas`, `credenciales_passkey`, `logins_mail`,
`tokens_magic_link`, `sesiones`, `consentimientos`), con estos cambios:

- **`cuentas`**: se reemplaza `dias_con_aportes` por `dias_activos` (smallint):
  días distintos con al menos una sincronización, sea cual sea su contenido.
  Elegibilidad = `creada_en ≤ hoy − 7` y `dias_activos ≥ 3` (§9.3).
- **`sesiones`**: nuevo campo `tipo` (`cookie`, `bearer`). Las sesiones bearer
  son para la app nativa futura (§13.2).
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

### 6.4 Capa BAÑOS — wiki público (servidor, en claro)

Tres tipos de dato con tres reglas distintas:

| Tipo | Ejemplos | Regla | Tabla |
|---|---|---|---|
| **Identidad del lugar** | nombre, ubicación, categoría, existe/no existe | Wiki con historial; semilla desde OSM. | `banios` |
| **Atributos estables** | acceso, cobra, horario, accesible, cambiador, operador | Wiki: último valor vigente + historial + "confirmado" si dos personas coinciden. | `banio_atributos`, `ediciones_banio` |
| **Observaciones** | cómo estaba, había papel | Eventos anónimos que vencen; se muestra un resumen reciente. | `observaciones`, `estado_reciente` |

**`banios`**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | bigint | Estable. |
| `slug` | texto único | Para la URL pública indexable: `/b/ypf-av-san-martin-rio-gallegos`. |
| `nombre` | texto | De OSM, o generado ("YPF — Av. San Martín"). |
| `geom` | geography(Point, 4326) | Del lugar, no de un usuario. |
| `categoria` | enum | `banio_publico`, `estacion_servicio`, `terminal`, `aeropuerto`, `hospital`, `supermercado`, `gastronomia`, `shopping`, `oficina_publica`, `parque`, `museo`, `estadio`, `educacion_superior`, `otro`. |
| `marca` | texto, nullable | `YPF`, `Axion`, `ACA`, `La Anónima`... |
| `existencia` | enum | `confirmado`, `probable`, `no_hay`, `cerrado_definitivo`. |
| `origen` | enum | `osm_toilets` (era `amenity=toilets`), `osm_probable` (lugar de OSM de categoría con baño probable), `curado` (cargado por el equipo), `usuario` (propuesto por un usuario). |
| `osm_tipo`, `osm_id` | texto, bigint, nullable | Referencia al objeto de OSM de origen. Si un `amenity=toilets` está a < 50 m de un lugar de OSM de la whitelist, se fusionan en un solo baño (§10.4). |
| `osm_ids_fusionados` | jsonb | Todos los objetos de OSM que aportaron a este baño. |
| `corredores` | text[] | `{RN3}`. |
| `publicable` | bool | `false` para lo que nunca debe aparecer (override manual). |
| `creado_en` | date | |

**`banio_atributos`** — el valor vigente de cada atributo.

| Campo | Tipo | Notas |
|---|---|---|
| `banio_id` | bigint FK | |
| `atributo` | enum | `acceso` (`libre`, `clientes`, `pedir_llave`, `con_costo`), `cobra` (bool), `horario` (estructura por tipo de día, ver abajo), `accesible` (bool), `cambiador` (bool), `operador` (texto corto, de OSM). |
| `valor` | jsonb | Validado por esquema según atributo. |
| `fuente` | enum | `osm`, `usuario`, `curado`. |
| `confirmaciones` | smallint | Personas distintas que dieron este mismo valor en los últimos 180 días. `≥ 2` → "confirmado". |
| `actualizado_mes` | date | Primer día del mes de la última edición. |

PK `(banio_id, atributo)`.

**Horario**: `{ habil: {abre, cierra} | "24h" | "cerrado", sabado: …,
domingo_feriado: … }`, más `osm_opening_hours` en crudo si vino de OSM. La
granularidad por tipo de día es la que sirve para "¿está abierto el domingo?"
y la que un usuario puede cargar en tres toques.

**`ediciones_banio`** — historial del wiki.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | bigint | |
| `banio_id` | bigint FK | |
| `atributo` | enum o `existencia`, `nombre`, `ubicacion` | |
| `valor_anterior`, `valor_nuevo` | jsonb | |
| `cuenta_id` | uuid FK, nullable | Interno, para revertir vandalismo. Nunca expuesto. Null si la edición vino de OSM o del equipo. |
| `fuente` | enum | `usuario`, `osm_import`, `curado`, `reversion`. |
| `mes` | date | Público: el historial muestra "marzo 2027: cobra → no". Sin día, sin seudónimo. |
| `estado` | enum | `vigente`, `revertida`. |

**`observaciones`** — lo que entra por el puente. Se borran a los 90 días.

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

Único `(cuenta_id, banio_id, semana)`. No guarda franja ni tipo de día: la
observación responde "¿cómo está este baño últimamente?", no "¿a qué hora va
la gente?".

**`estado_reciente`** — lo que se muestra, recalculado cada noche sin autor.

| Campo | Tipo | Notas |
|---|---|---|
| `banio_id` | bigint FK | |
| `ventana` | enum | `30d`, `90d`. |
| `n_observaciones` | smallint | |
| `predominante` | enum, nullable | El estado más reportado. |
| `papel_pct` | smallint, nullable | % de observaciones con papel. |
| `actualizado` | date | |

**`resumen_mensual`** — historia larga sin autor: `banio_id`, `mes`,
`n_limpio`, `n_aceptable`, `n_evitalo`, `n_con_papel`, `n_sin_papel`. Es lo
único que queda de las observaciones después de 90 días.

**`propuestas_banio`** — un usuario propone un baño que no está: `id`,
`cuenta_id`, `nombre`, `categoria`, `ubicacion_aprox` (punto que el usuario
**marca a mano en el mapa**, nunca su GPS), `estado` (`pendiente`,
`aceptada`, `rechazada`). Pasa a `banios` con `existencia = probable` cuando
otra persona la confirma o el equipo la revisa.

### 6.5 Amigos

Como en la iteración 1 (`amistades`, `invitaciones_amistad`, `feed_amigos` con
vencimiento de 30 días), con dos cambios:

- `feed_amigos.lugar_id` pasa a `banio_id`.
- Nuevo valor de `etiqueta`: los registros en zona privada siempre llevan la
  etiqueta de la zona (`casa`, `laburo`, `otra_zona_privada`), nunca la que
  eligió el usuario (cierra el camino D de la crítica).

### 6.6 Insignias, moderación

Sin cambios: `insignias_publicas` (opt-in, sin fecha, las de ruta solo
completas), `denuncias` (ahora con `objetivo_tipo = edicion | observacion |
propuesta | seudonimo`).

### 6.7 Importación de OSM

**`importaciones_osm`**: `id`, `fecha`, `fuente` (URL del extracto),
`osm_base` (timestamp del extracto), `sha256`, `n_nuevos`, `n_actualizados`,
`n_desaparecidos`, `n_conflictos`, `estado`.

**`conflictos_osm`**: `id`, `importacion_id`, `banio_id`, `atributo`,
`valor_osm_nuevo`, `valor_local`, `estado` (`abierto`, `resuelto_local`,
`resuelto_osm`). Se generan cuando OSM cambia un atributo que nuestros usuarios
ya habían editado (§10.5).

### 6.8 Lo que se fue

- `visitas`, `stats_lugar`, `aportes_zona`, `stats_macrozona`, `stats_ciudad`,
  `macrozonas`: fuera de v1 (§9).
- `lugares` se reemplaza por `banios`: el catálogo para hacer snap **es** la
  base de baños (confirmados + probables). Lo que no puede tener baño no está en
  el catálogo y no se puede elegir.
- `reportes_banio` se separa en atributos estables (wiki) y observaciones (puente).

---

## 7. El puente, en detalle

**Objetivo:** que el chiste alimente el dato útil sin formularios, sin bloquear
el registro y sin abrir un canal de eventos de la capa privada a la pública.

### 7.1 Cuándo aparece

Después de guardar un registro (el registro ya está guardado; el puente no lo
demora), si se cumplen **todas**:

1. El usuario confirmó un `banio_id` del catálogo (no basta con estar cerca).
2. El registro no está en zona privada ni en un grupo con sugerencia de
   domicilio abierta.
3. El onboarding de casa está resuelto.
4. `preferencias.puente_activo = true`.
5. No respondió ya el puente para ese baño esa semana.

### 7.2 Cómo se ve

Una tarjeta abajo, que no tapa el mapa, con dos filas de botones grandes:

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

### 7.3 Qué viaja

La respuesta se generaliza y entra en la misma cola diferida que todo lo demás:
`{ banio_id, semana, estado_banio?, habia_papel? }`. Sin franja, sin día, sin
seudónimo visible. El servidor la publica en el lote nocturno (≥ 24 h).

### 7.4 Qué efecto tiene

- Actualiza `estado_reciente` del baño esa noche.
- Si el baño era `probable`: **cada observación es evidencia de que el baño
  existe** (alguien lo usó). Con observaciones de **2 cuentas elegibles
  distintas** el baño pasa a `confirmado`. Es el mecanismo principal para
  convertir los probables sembrados en confirmados (§9.4).
- No toca los atributos del wiki. Que alguien diga "evitalo" no edita nada.

### 7.5 Por qué limpieza y papel no son atributos del wiki

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
2. **Registro privado** en IndexedDB con coordenada, hora y precisión exactas.
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
    probables (§7.4) y de atributos (§6.4), contando solo cuentas elegibles.
13. **Lectura pública**: solo `banios`, `banio_atributos`, `ediciones_banio`
    (sin `cuenta_id`), `estado_reciente`, `resumen_mensual`.

**Ediciones del wiki** no pasan por este pipeline porque no salen de un
registro: el usuario edita un atributo de un baño desde su ficha. Se guardan con
`mes`, no con fecha, y se aplican en el momento (un wiki con 24 h de demora es
frustrante). Ver Q-P8 sobre lo que esto puede revelar.

---

## 9. Umbrales y arranque en frío

### 9.1 La pregunta, con el dato de OSM en la mano

La pregunta fue: con 5 registros / 3 usuarios por celda y 20 usuarios, ¿el
heatmap queda vacío?

- **Con esa regla y 20 usuarios**, la simulación de la iteración 1
  ([`docs/analisis/sim_umbral_k.py`](docs/analisis/sim_umbral_k.py)) da entre
  ~2 y ~4 celdas H3 res 8 visibles de ~40. No queda completamente vacío: quedan
  una o dos manchas en el centro. Para el usuario, eso es un mapa roto.
- **Ese heatmap ya no existe en el diseño**, desde la iteración 1, y la decisión
  de producto de esta iteración (toggle "Mis registros / Baños públicos") lo deja
  sin lugar: ninguna de las dos capas es un agregado de eventos. La capa
  personal no tiene umbral porque solo la ve su dueño. La capa de baños no
  necesita k-anonimato para existir, porque los baños son lugares públicos.
- **Donde sí hay umbral es en lo que cruza por el puente**, y ahí el problema de
  arranque no es el k: es que hay 5 baños.

### 9.2 Las tres alternativas que pediste evaluar

| Alternativa | Qué es | Evaluación |
|---|---|---|
| **Umbral dinámico** (bajar k mientras hay pocos usuarios) | k = 2 al principio, sube con la masa. | **No.** El k bajo justo cuando hay pocos usuarios es cuando cada persona es más identificable: con 20 usuarios, k = 2 en una celda es "vos y uno más". Además, un umbral que cambia con el tiempo deja ver diferencias: lo que aparece el día que baja el k son exactamente las celdas con 2 personas. |
| **Celdas más grandes al principio** (H3 res 7 → res 8 cuando haya masa) | Agregar sobre ~5 km² en lugar de ~0,7 km². | **Funciona, pero da un mapa sin información.** Río Gallegos son ~6-8 celdas res 7. Con 20 usuarios se encenderían 2-3: "en el centro se caga más". No sirve ni como chiste ni como dato. Útil más adelante como **nivel de respaldo** de un heatmap multirresolución, no como arranque. |
| **Arrancar sin heatmap y solo con la capa de baños** | Lo público es el wiki de baños; los agregados de eventos esperan. | **Esta.** Es además lo que implica la decisión del toggle. Lo que hay que resolver no es el umbral, sino que la capa de baños no esté vacía (§9.4). |

### 9.3 Umbrales que quedan en v1

| Qué | Umbral | Por qué |
|---|---|---|
| Mostrar un baño confirmado o probable | Ninguno | Es un lugar público. |
| Mostrar un atributo del wiki | Ninguno; "confirmado" con ≥ 2 personas | Es información sobre un lugar, no sobre una persona. |
| Mostrar `estado_reciente` | ≥ 1 observación publicada, sin autor, por semana, con ≥ 24 h de demora | Una observación dice "alguien usó este baño la semana X". Sin seudónimo, con demora y sin hora, no identifica. Con ≥ 2 sería más seguro, pero en el arranque nada mostraría estado (Q-P9). |
| Pasar un baño probable a confirmado | ≥ 2 cuentas **elegibles** distintas | Freno contra una cuenta que confirma todo. |
| Elegibilidad | `creada_en ≤ hoy − 7` y `dias_activos ≥ 3` | **(i2)** La regla de la iteración 1 (14 días + 5 días con aportes públicos) casi no se alcanzaba con ~4 aportes publicables cada 3 meses. Ahora cuenta cualquier actividad (sincronizar ya es actividad, y el servidor la ve igual). |
| Feed de amigos | Ninguno | Lo ven amigos elegidos; las protecciones son otras (§8, paso 7). |

### 9.4 Cómo se ve el mapa el día uno (lo que sí decide el arranque)

Con el dato real (SEEDING.md):

1. **5 baños `osm_toilets`**, todos en estaciones de servicio → se fusionan con
   su estación y quedan `confirmado` con poca información.
2. **13 estaciones de servicio** de OSM (YPF, Axion, ACA, Petrobras) → 5 ya
   confirmadas por el punto anterior; 8 como `probable`.
3. **Terminal, aeropuerto, hospital, supermercados grandes y gastronomía** →
   `probable`. OSM tiene 60 candidatos en esas categorías, con ruido (un
   "Almacén" etiquetado como supermercado, salitas barriales como hospital):
   después de curar a mano quedan unos 45-55 (SEEDING.md).
4. **Sembrado a mano** antes del lanzamiento: una recorrida de 2-3 días por los
   probables con más tránsito, cargando existencia, acceso, si cobra, horario,
   accesible y cambiador (`origen = curado`). Objetivo: **30 baños confirmados
   con atributos completos** el día del lanzamiento.
5. **El puente convierte probables en confirmados** a medida que la gente
   registra (§7.4).
6. **Los probables se dibujan distinto** (estilo hueco, "sin confirmar") para no
   prometer un baño que quizás es solo para empleados. Mandar a alguien a un
   baño que no existe le hace más daño a la capa útil que un mapa con pocos
   puntos.

### 9.5 Cuándo volver a pensar en un heatmap (v2)

Solo si se cumplen las dos: (a) hay un uso claro que el wiki de baños no
cubre, y (b) hay ≥ 50 cuentas elegibles activas en 90 días. Si se hace:
multirresolución (res 8 donde haya ≥ 3 personas elegibles distintas, res 7 de
respaldo, nada donde ni eso), acumulado de 90 días, actualizado de noche, en
rangos, y sin la condición de cantidad de registros.

---

## 10. Pipeline de importación de OSM (una sola vía)

### 10.0 La regla

> **OpenStreetMap es una fuente de lectura. Nada de lo que hagan nuestros
> usuarios se escribe en OSM de forma automática. Si alguna vez se devuelve
> algo, es a mano, por una persona, con revisión, desde una cuenta de OSM
> personal y siguiendo las guías de OSM para ediciones organizadas.**

Cómo se hace cumplir (ver también
[docs/adr/0001-osm-importacion-una-via.md](docs/adr/0001-osm-importacion-una-via.md)):

- El código de importación vive en `apps/worker/src/osm/` y solo descarga.
- **No hay credenciales de la API de edición de OSM** en ninguna configuración,
  variable de entorno ni secreto del proyecto.
- **No hay dependencias** de librerías de edición de OSM (clientes de la API
  0.6 de escritura, OAuth de OSM).
- Un chequeo de CI falla si aparece en el código una llamada a
  `api.openstreetmap.org` con método distinto de GET, o los paths
  `/api/0.6/changeset` o `/api/0.6/*/create`.
- El módulo de importación tiene un comentario de cabecera con esta regla y el
  link al ADR.
- La única salida "hacia OSM" que existe es un **reporte para humanos**
  (`apps/worker/src/osm/reporte-devolucion`): una lista de atributos
  confirmados localmente que difieren de OSM, en CSV, para que una persona los
  revise y, si quiere, los cargue a mano en un editor de OSM.

### 10.1 Fuente

- **Producción: extracto de Geofabrik** (`south-america/argentina`),
  descargado semanalmente. Es un archivo, se puede verificar con su checksum y
  no depende de un servidor público saturado.
- **Exploración manual: Overpass.** No para producción: en la medición de esta
  iteración, de cuatro servidores públicos, dos no respondieron, uno se colgó y el
  único que contestó tiraba 504 en la mitad de los intentos (SEEDING.md).

### 10.2 Recorte

`osmium extract` con el polígono del ejido de Río Gallegos (o el bbox
`-51.70,-69.35,-51.55,-69.13` mientras no haya polígono curado), y la
estrategia `smart` para no cortar ways en el borde.

### 10.3 Filtro

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

### 10.4 Normalización y fusión

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

### 10.5 Reglas de precedencia en cada reimportación

| Situación | Qué pasa |
|---|---|
| Objeto nuevo en OSM | Se crea el baño. |
| Atributo cambió en OSM y **nadie lo editó localmente** | Se actualiza; queda una fila en `ediciones_banio` con `fuente = osm_import`. |
| Atributo cambió en OSM y **un usuario lo había editado** | **Gana lo local.** Se abre un `conflictos_osm` para revisión manual. |
| Objeto desapareció de OSM | Si no tiene datos locales: `publicable = false`. Si tiene: queda, y se abre conflicto. Nunca se borra solo. |
| Usuario editó algo que OSM no tiene | Queda local. Va al reporte de devolución (§10.0) si está confirmado. |

### 10.6 Salida

Actualiza `banios` y `banio_atributos`, registra la corrida en
`importaciones_osm` y dispara `generar-bundles` (`banios.v{n}.json`, PMTiles si
cambió el mapa base).

### 10.7 Licencia (no lo resuelve la importación de una vía)

Que la importación sea de una vía resuelve la parte de **no ensuciar OSM**. No
resuelve la de **ODbL**: si mezclamos datos de OSM con aportes de usuarios en la
misma tabla de baños y la mostramos en público, es muy probable que sea una
"base de datos derivada" y que haya que ofrecerla bajo ODbL. Consecuencia
práctica: los aportes al wiki se licencian bajo ODbL en los términos de uso
desde el día uno. Eso además hace legalmente posible la devolución manual.
Atribución "© colaboradores de OpenStreetMap" visible en el mapa y en cada ficha.
Ver Q-L6.

---

## 11. Endpoints

Base `/api/v1`. JSON. Autenticación por cookie (web) o `Authorization: Bearer`
(app nativa, §13.2). Ningún endpoint recibe ni devuelve coordenadas de
usuarios; ningún parámetro describe la posición del usuario.

### 11.1 Autenticación y cuenta

Como en la iteración 1 (`/auth/passkey/*`, `/auth/mail/*`, `/auth/salir`,
`/cuenta`, `/cuenta/consentimientos`, `/cuenta/exportar`, `DELETE /cuenta`),
más:

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/sesion-bearer` | Convierte una autenticación válida en un token bearer, para la app nativa. En la web no se usa. |

### 11.2 Capa REGISTROS (autenticado)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/boveda?desde={seq}` | Páginas cambiadas. |
| PUT | `/boveda/paginas/{pagina_id}` | Concurrencia optimista. |
| DELETE | `/boveda/paginas/{pagina_id}` | |
| GET / PUT | `/boveda/llaves[/{metodo}]` | Llaves envueltas. |
| POST | `/lote` | `{ observaciones: [...], amigos: [...], paginas_boveda: [...] }`. Sin log de acceso. Devuelve ids remotos. |
| GET | `/aportes/mios` | Mis observaciones vigentes y mis ítems en feeds de amigos. |
| DELETE | `/aportes/{tipo}/{id}` | `tipo ∈ observacion, amigos`. |
| GET / POST / DELETE | `/amigos/...` | Como en la iteración 1. |
| GET | `/amigos/feed` | |

### 11.3 Capa BAÑOS — lectura pública (sin autenticación, cacheable)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/estaticos/{ciudad}/banios.v{n}.json` | Catálogo completo para el mapa y el snap: id, slug, nombre, categoría, marca, punto, existencia, atributos vigentes, estado reciente. El cliente siempre lo baja entero. |
| GET | `/banios/{id}` | Ficha en JSON. |
| GET | `/banios/{id}/historial` | Ediciones (mes, atributo, antes → después, fuente). Sin seudónimos. |
| GET | `/tiles/{region}.pmtiles` | Range requests. |
| — | `/b/{slug}` (SSR, fuera de `/api`) | Ficha HTML indexable, con datos estructurados (schema.org `PublicToilet` / `Place`) y atribución de OSM. |
| — | `/sitemap.xml` | Todas las fichas de baños. |

### 11.4 Capa BAÑOS — escritura (autenticado, cuentas activas)

| Método | Ruta | Descripción |
|---|---|---|
| PATCH | `/banios/{id}/atributos/{atributo}` | `{ valor }`. Edición del wiki. Requiere consentimiento `editar_wiki`. Rate limit por cuenta. |
| POST | `/banios/{id}/existencia` | `{ existencia: 'no_hay' | 'cerrado_definitivo' | 'confirmado' }`. |
| POST | `/banios/propuestas` | `{ nombre, categoria, ubicacion_aprox }`. La ubicación la marca el usuario a mano en el mapa; la interfaz no ofrece "usar mi ubicación". |
| POST | `/banios/propuestas/{id}/confirmar` | Otra persona confirma una propuesta. |

Las observaciones del puente **no** usan estos endpoints: van por `/lote`, con
demora (§7.3).

### 11.5 Push, moderación, salud

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/push/suscripciones` | `{ transporte, endpoint, claves }`. Requiere consentimiento `push`. |
| DELETE | `/push/suscripciones/{id}` | |
| POST | `/denuncias` | |
| GET | `/salud` | |
| — | `/.well-known/assetlinks.json`, `/.well-known/apple-app-site-association` | Desde el día uno, aunque todavía no haya app (§13.3). |

**Contenido de las notificaciones push:** genérico y nunca en tiempo real
respecto de un evento de otro usuario. Permitido: "Tenés 3 novedades de tus
amigos" (en lote, una vez por día), "Te falta una YPF para el logro" (calculado
en el cliente; el servidor manda un aviso genérico de "abrí la app"). Prohibido:
"Fulano acaba de registrar en...". Motivo: el push es tiempo real por
definición, y el tiempo real es el camino A del ataque (casa vacía).

---

## 12. Jobs del worker

| Job | Cuándo | Qué hace |
|---|---|---|
| `publicar-lote` | Diario 04:00 | Observaciones `pendiente → publicada`. |
| `recalcular` | Después | `estado_reciente`, `resumen_mensual`, confirmación de probables y de atributos con cuentas elegibles. |
| `vencer-observaciones` | Diario | Borra las filas de `observaciones` con más de 90 días (después de volcarlas a `resumen_mensual`). |
| `importar-osm` | Semanal | §10. Solo descarga. |
| `generar-bundles` | Después de importar o de recalcular | `banios.v{n}.json`, `sitemap.xml`, PMTiles si cambió. |
| `notificar` | Diario 19:00 | Avisos push agregados (§11.5). |
| `purgar` | Horario / diario | Tokens, sesiones, feed de amigos > 30 días, invitaciones. |
| `backup` | Diario | restic, 30 días. |

---

## 13. PWA ahora, app nativa después

### 13.1 Qué tiene la PWA en v1

- Manifest instalable con ícono, `display: standalone`, colores y nombre
  definitivos.
- Offline básico: el app shell, el catálogo de baños, los tiles de la ciudad y
  la cola de salida funcionan sin señal.
- Geolocalización recién al registrar.
- Push en Android (Web Push con VAPID). En iOS, solo si la PWA está instalada en
  la pantalla de inicio; se ofrece pero no se promete.
- Instalación sugerida después del segundo registro (no al entrar), con
  `beforeinstallprompt` en Android e instrucciones a mano en iOS.

### 13.2 Reglas de arquitectura para que Capacitor no obligue a rehacer nada

| # | Regla | Por qué |
|---|---|---|
| R1 | Las rutas de la app (`/app/*`) **no usan SSR ni `load` de servidor**: todo dato llega por el cliente de la API. Tienen que poder compilarse con `adapter-static`. | Capacitor carga archivos locales; no hay servidor Node adentro del celular. Las páginas públicas indexables (`/b/*`) sí usan SSR y quedan solo en la web. |
| R2 | Cliente de API con **URL base configurable** y CORS habilitado en el servidor para los orígenes de Capacitor (`capacitor://localhost`, `https://localhost`). | En la app nativa el origen no es tu dominio. |
| R3 | La API acepta **cookie HttpOnly (web) y bearer (nativo)**. El token nativo se guarda en el almacenamiento seguro del sistema (Keystore / Keychain). | Las cookies entre orígenes en un WebView son una fuente de problemas; un bearer en IndexedDB en la web sería robable por XSS. Dos mecanismos, una sola tabla de sesiones. |
| R4 | `packages/platform` define **interfaces** (`geolocalizacion`, `almacenamiento`, `passkeys`, `push`, `compartir`, `segundoPlano`, `instalacion`). La UI y `core` solo importan interfaces. Hoy hay una sola implementación (web). | Al empaquetar se agrega una implementación nativa, sin tocar UI ni lógica. |
| R5 | **Ninguna lógica de negocio en el service worker.** La cola de salida, el reintento y la sincronización los maneja la app. El SW solo cachea. | En Capacitor para iOS no hay service worker para el esquema local. Si la lógica vive en el SW, la app nativa no anda offline. |
| R6 | Almacenamiento local detrás de la interfaz; IndexedDB en ambos casos en v1. | En el WebView de la app el almacenamiento no se desaloja como en Safari (mejora Q-T2). SQLite queda como opción futura sin cambiar `core`. |
| R7 | **Dominio definitivo antes del lanzamiento** y archivos `/.well-known/assetlinks.json` y `apple-app-site-association` servidos desde el día uno. | Las passkeys quedan atadas al RP ID (el dominio). Cambiar de dominio después invalida todas las passkeys de todos los usuarios. La app nativa usa las mismas passkeys si el dominio está asociado. |
| R8 | Push con abstracción de transporte en el servidor (`webpush` hoy, `fcm`/`apns` después). | La app nativa no usa Web Push. |
| R9 | URLs compartibles idénticas en web y app (`/b/{slug}`, `/c/{token}`), para que después funcionen como App Links / Universal Links. | Los links que ya circulan por WhatsApp siguen sirviendo cuando exista la app. |
| R10 | Nada de APIs solo-navegador sin pasar por `platform` (Web Share, Background Sync, `beforeinstallprompt`, `navigator.storage.persist`). | Mismo motivo que R4. |

### 13.3 Lo que **sí** va a requerir trabajo nuevo al empaquetar

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

### 13.4 Los 12 testers de Google Play

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

### 13.5 Qué gana la privacidad con la app nativa

- El código va firmado en la tienda: un servidor comprometido no puede cambiar
  el JS de cifrado de quien usa la app (mitiga L1 para esos usuarios).
- El almacenamiento no se desaloja (mitiga Q-T2).

Y qué pierde: Google o Apple pasan a ver instalación, actualizaciones y tokens
de push (A6), y el formulario de seguridad de datos obliga a declarar datos de
ubicación y quizás de salud (Q-L8).

---

## 14. Operación en el VPS

Sin cambios respecto de la iteración 1 (Docker Compose, Caddy sin logs en
`/api` y `/tiles`, CSP sin terceros, Postgres sin exponer, roles separados,
restic con 30 días, actualizaciones automáticas), más:

- El rol de base que usa la API pública lee `banios`, `banio_atributos`,
  `ediciones_banio` (sin la columna `cuenta_id`, vía vista), `estado_reciente`,
  `resumen_mensual`. No lee `observaciones`.
- `push_suscripciones.endpoint` y `claves` cifrados en reposo con una llave del
  entorno.
- El worker de importación tiene salida a `download.geofabrik.de` y a nada más
  de OSM.

## 15. Alcance de v1 y después

**v1 (piloto Río Gallegos, PWA)**

- Toggle "Mis registros / Baños públicos" sobre un solo mapa.
- Registro offline con el pipeline de §8.
- Bóveda cifrada.
- Wiki de baños: ~60-70 baños entre confirmados y probables, 30 sembrados a
  mano con atributos completos.
- Puente (§7).
- Edición del wiki con cuenta, historial público sin seudónimos.
- Modo amigos con viajes diferidos a la vuelta.
- Logros locales y tarjetas compartibles.
- Push en Android (agregado, diario).
- Exportación y borrado de cuenta.

**v1.5 (cuando haya 15-20 usuarios dispuestos)**

- Prueba cerrada en Google Play con la app de Capacitor.

**Después**

- Ligas entre amigos (Q-N9).
- Más ciudades sobre la Ruta 3.
- Heatmap multirresolución, solo bajo las condiciones de §9.5.
- Devolución manual a OSM (§10.0).
