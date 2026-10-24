# PRIVACY.md — Decisiones de privacidad

Cada decisión está escrita como decisión: qué se hace, qué riesgo mitiga (con
el actor del modelo de amenazas de [DESIGN.md §2](DESIGN.md#2-modelo-de-amenazas))
y qué cuesta en experiencia de usuario. Si una decisión no cuesta nada, no
debería estar en esta lista.

**Iteración 2.** Las decisiones nuevas o modificadas llevan **(i2)**. Los
cambios vienen de tres fuentes: las dos capas con toggle y el puente, la
crítica adversarial de la iteración 1 (los caminos A-D del ataque de
desanonimización) y el dato de OSM ([SEEDING.md](SEEDING.md)).

Actores: **A1** público · **A2** conocido con contexto · **A3** dump/backup ·
**A4** operador curioso · **A5** pedido judicial · **A6** terceros de red ·
**A7** Sybil/spam/vandalismo · **A8** comercio afectado.

---

## Principios

1. **Lo que no se guarda no se filtra.**
2. **Fallar del lado privado.** Ante la duda, el registro queda privado.
3. **La publicación es un acto del usuario, nunca una inferencia del sistema.**
4. **El servidor solo ve lo que ya está generalizado.**
5. **(i2) Un lugar no es una persona.** La capa de baños es pública y no
   necesita k-anonimato para existir. Lo que necesita protección es lo que
   cruza desde la capa de registros: las observaciones del puente.

---

## Decisiones adoptadas

### P-01 · El servidor nunca recibe coordenadas de usuarios

**Decisión.** Zonas privadas, candidatos de lugar y detección de domicilio
corren en el dispositivo. Al servidor viajan `banio_id` + tiempo generalizado,
o bytes cifrados. **(i2)** Las propuestas de baños nuevos usan un punto marcado
a mano en el mapa; la interfaz no ofrece "usar mi ubicación" para eso (P-28).

**Mitiga.** A3, A4, A5.

**Cuesta.** El cliente baja el catálogo entero (para Río Gallegos, unos 60
baños: trivial). Un bug en el pipeline vive en los dispositivos hasta el
próximo deploy. Escalar a muchas ciudades obliga a partir el catálogo por
región.

### P-02 · No se registra nada sobre el cuerpo

**Decisión.** Nada de consistencia, color, duración, dolor ni síntomas. Ni
privado. **(i2)** El puente pregunta por el **baño** (limpio / aceptable /
evitalo, ¿había papel?), nunca por la persona.

**Mitiga.** Que el sistema sea un registro de salud (Ley 25.326, arts. 2 y 7).

**Cuesta.** Se pierde el humor escatológico detallado y una posible capa de
autocuidado.

### P-03 · La capa de registros está cifrada de punta a punta

Sin cambios. Llave AES-GCM 256 generada en el dispositivo, envuelta por PRF de
passkey y/o código de recuperación.

**Mitiga.** A3, A4 sobre lo guardado, A5. Borrar la cuenta destruye las llaves
(crypto-shredding).

**Cuesta.** Perder todas las formas de desenvolver la llave es perder el
historial. Fricción del código de recuperación. Desalojo del almacenamiento en
Safari (Q-T2). **(i2)** La app nativa futura mejora el desalojo y L1, pero el
camino de passkeys con PRF dentro de un WebView no está verificado (Q-T7).

### P-04 · La bóveda no revela cuántos registros hay ni cuándo

Sin cambios. Páginas mensuales opacas, padding de 4 KB, sin timestamps.

### P-05 · El lugar se sugiere; el usuario lo confirma

**Decisión.** El sistema propone baños cercanos del catálogo; el usuario elige.
Preselección solo con baño a < 40 m y precisión informada ≤ 30 m. **(i2)** Nunca
en madrugada ni noche (P-29).

**Mitiga.** A1/A2: la casa al lado de un comercio publicada como el comercio.
Errores de GPS en interiores.

**Cuesta.** Un toque más por registro.

### P-06 · (i2) El catálogo es la base de baños, y cada lugar pasa por revisión humana

**Decisión.** Solo se puede asociar un registro a un baño del catálogo
(confirmado o probable). El catálogo se siembra desde OSM con una whitelist de
categorías, **y cada probable se revisa a mano antes de ser publicable**.

**Mitiga.** A1/A2: la vivienda pegada a un negocio. **El dato de OSM lo
demuestra:** de los 73 candidatos de Río Gallegos, uno es un "Almacén"
etiquetado como supermercado y dos son salitas barriales etiquetadas como
hospital, justo el tipo de lugar entre casas que la whitelist quería excluir
(SEEDING.md §3).

**Cuesta.** Trabajo manual en el sembrado y en cada ciudad nueva. Lugares
legítimos que quedan afuera hasta que alguien los revise.

### P-07 · Las zonas privadas viven solo en el dispositivo

**Decisión.** Casa, laburo y las que el usuario quiera; radio default 200 m.
Chequeo **(i2)** `distancia ≤ radio + max(precision_m, 50)`. Lo que cae adentro
no se publica nunca. **(i2)** A los amigos les llega con la etiqueta de la zona
("en casa", "en el laburo"), nunca con la que eligió el usuario.

**Mitiga.** A3/A4: la tabla de zonas sería la lista de domicilios. A1/A2:
publicar desde casa por error. **(i2)** Camino C de la crítica: las
ubicaciones por wifi informan errores optimistas (±15 m cuando el error real es
de 200 m) y sacaban el registro de la zona. Camino D: "estuvo en un lugar
público, sin lugar" revelaba "un lugar público cerca de su casa".

**Cuesta.** Si vivís a 150 m de una YPF, nunca podés publicar en esa YPF ni
usar el puente ahí. La precisión mínima de 50 m agranda de hecho la zona a
~250 m.

### P-08 · No se publica nada hasta resolver "dónde vivís"

**Decisión.** Onboarding: marcar la casa o elegir "no quiero marcarla".
Detección local de domicilio y laburo con "sí" preseleccionado. **(i2)** Si el
usuario eligió no marcar casa, **un solo** registro nocturno fuera de toda zona
abre la sugerencia (antes hacían falta tres noches). Con la sugerencia abierta,
nada de ese grupo se publica.

**Mitiga.** A1/A2: el caso documentado del precedente. **(i2)** Camino C de la
crítica: las dos primeras noches eran una ventana para publicar desde casa.

**Cuesta.** Fricción en el primer uso. Falsos positivos (la casa de la pareja,
la de la vieja) que hay que descartar.

### P-09 · Privado por defecto, consentimiento explícito por tipo

**Decisión.** Consentimientos separados y versionados: **(i2)** `puente`,
`editar_wiki`, `amigos`, `insignias_publicas`, `push`. El del puente se otorga
al responder la primera tarjeta, que explica qué se publica (DESIGN.md §7.2).

**Mitiga.** Art. 5 de la Ley 25.326. A1/A2 por publicación accidental.

**Cuesta.** Menos datos útiles que con "público por defecto".

### P-10 · Modo amigos sin jitter y sin ubicación de casa

**Decisión.** Los amigos ven `banio_id` (si es publicable y no está en zona
privada), día y franja; lo demás como etiqueta sin ubicación. **(i2)** Los
viajes (baños a más de 30 km de la zona casa, o la etiqueta "ruta") se muestran
**recién cuando el usuario vuelve** (próximo registro en la zona casa, o 7 días
después). Es el default; se puede desactivar.

**Mitiga.** A2: el jitter se revierte con un punto conocido. **(i2)** Camino A
de la crítica, el más probable y el más dañino: con lugar del viaje + día +
1-6 h de demora, un amigo (o un ex que sigue en la lista) sabía en el momento
que la casa estaba vacía.

**Cuesta.** El chiste de "¡estás cagando en Piedra Buena!" llega tarde. El modo
amigos es menos "en vivo" justo en los registros más graciosos (los de viaje).

### P-11 · Passkeys como login principal

Sin cambios. **(i2)** Agregado: **el dominio tiene que ser el definitivo antes
del lanzamiento**, porque cambiarlo invalida todas las passkeys (DESIGN.md
§13.2, R7).

### P-12 · Mail solo como HMAC, sin Google OAuth

Sin cambios.

### P-13 · Tiempo generalizado en todo lo que sale del dispositivo

**Decisión.** **(i2)** Observaciones del puente: solo semana (sin franja ni tipo
de día). Ediciones del wiki: mes. Amigos: día + franja.

**Mitiga.** A1/A2: reconstruir rutinas. A3/A4: el servidor no tiene horarios
exactos.

**Cuesta.** **(i2)** Las observaciones no sirven para "¿a qué hora está limpio?".
El horario del baño sale del wiki, no de las observaciones.

### P-14 · (i2) Envío diferido y publicación nocturna, y qué cubre cada uno

**Decisión.** El cliente manda todo en lote con un retraso aleatorio de 1 a 6
horas. Las observaciones del puente se publican en el lote nocturno (entre
24 y 48 h). **Los ítems para amigos no esperan al lote nocturno**: su protección
contra "casa vacía" es P-10 (viajes recién a la vuelta), no esta.

**Mitiga.** A3/A4: el momento del pedido no es el del registro (L2). A1/A8: el
estado de un baño no permite saber quién estuvo ayer. Ataques de diferencia.

**Cuesta.** Sin gratificación instantánea en la capa pública: respondés el
puente y el baño se actualiza mañana.

**Corrección respecto de la iteración 1:** la versión anterior decía que esta
decisión mitigaba "la casa está vacía" frente a A2 en general. Era falso para
el modo amigos, que recibía el día exacto con 1-6 h de demora. Ahora cada
superficie tiene su protección explícita.

### P-15 · Sin texto libre público ni imágenes en v1

Sin cambios. **(i2)** Aplica también al wiki: los atributos son estructurados;
no hay campo "notas". Ver Q-W3 sobre indicaciones como "pedir la llave en caja".

### P-16 · Cero terceros en el navegador

**Decisión.** Sin cambios. **(i2)** Excepción declarada: el servicio de push del
navegador (FCM para Chrome en Android, el de Mozilla o Apple en otros). Es
inevitable si hay push. Se mitiga con P-26.

### P-17 · (i2) Umbrales: lo que queda después de sacar los agregados de eventos

**Decisión.** Sin contadores de visitas, sin heatmap y sin ranking en v1. Los
umbrales que quedan:

| Qué | Umbral |
|---|---|
| Baño confirmado o probable, atributos del wiki | Ninguno (lugar público). |
| Estado reciente (puente) | ≥ 1 observación publicada, sin autor, por semana, con ≥ 24 h de demora. |
| Probable → confirmado | ≥ 2 cuentas elegibles distintas. |
| Atributo "confirmado" | ≥ 2 personas distintas con el mismo valor en 180 días. |
| Elegibilidad | Cuenta de ≥ 7 días y ≥ 3 días activos (cualquier sincronización). |

**Mitiga.** A7: una cuenta sola no confirma nada. La condición de "5 registros"
y los umbrales sobre eventos desaparecen con las superficies que protegían.

**Cuesta.** Mostrar estado reciente con una sola observación es menos protector
que con dos (Q-P9). Los primeros usuarios tardan una semana en poder confirmar.

**Por qué cambió la elegibilidad:** la regla de la iteración 1 (14 días y 5 días
con aportes públicos) era inalcanzable con ~4 aportes publicables cada tres
meses. Contar cualquier sincronización no le revela al servidor nada que no
viera ya.

### P-18 · Borrado de cuenta real

**Decisión.** Como en la iteración 1. **(i2)** Además: las observaciones se
borran (las de menos de 90 días; las más viejas ya no tienen autor); las
ediciones del wiki quedan **sin `cuenta_id`** (un wiki no puede deshacer las
correcciones de quien se va sin romper el historial de los demás); las
suscripciones push se borran.

**Mitiga.** Art. 16.

**Cuesta.** Las ediciones quedan aunque la persona se haya ido. Hay que
declararlo en los términos.

### P-19 · Sin logs que vinculen personas con momentos

Sin cambios.

### P-20 · Insignias públicas opt-in, sin fechas, las de ruta solo completas

Sin cambios.

### P-21 · El feed de amigos vence a los 30 días

Sin cambios.

### P-22 · ~~Rangos en el ranking de macrozonas~~ — suspendida (i2)

Sin ranking en v1 (DESIGN.md §9). Si vuelve, tiene que volver con rangos y
**sin el campo `faltan` exacto** (ver D-12).

### P-23 · Mayoría de edad declarada (provisoria)

Sin cambios.

### P-24 · (i2) El puente publica observaciones anónimas que vencen

**Decisión.** La respuesta al puente se convierte en una observación
`{ banio_id, semana, estado_banio?, habia_papel? }`. Se guarda con `cuenta_id`
para deduplicar y frenar spam, y **la fila entera se borra a los 90 días**;
queda solo un resumen mensual sin autor. Lo público muestra "últimos 30 días:
mayormente limpio (4 reportes)", nunca la lista de observaciones.

**Mitiga.** A1/A8: el comercio no puede saber quién dijo "evitalo". A3/A4: la
ventana en que el servidor sabe "la cuenta X estuvo en el baño Y la semana Z"
dura 90 días, no para siempre (cierra parte de L3 y de Q-P3).

**Cuesta.** No hay historia larga por persona: no se puede detectar a alguien
que reporta "evitalo" en todos los baños de una cadena durante un año. El
resumen mensual no deja auditar un patrón sospechoso viejo.

### P-25 · (i2) Wiki: leer sin login, editar con cuenta, historial sin seudónimos

**Decisión.** Las fichas de baños son públicas e indexables. Editar requiere
cuenta y consentimiento `editar_wiki`. El historial público muestra mes,
atributo, valor anterior y nuevo, sin seudónimo. Internamente se guarda
`cuenta_id` para poder revertir vandalismo.

**Mitiga.** A7: sin cuenta no hay forma de frenar vandalismo sin guardar IPs, y
no guardar IPs es P-19. A1/A2: un historial con seudónimo y fecha ("lu_rg editó
'cobra' en la YPF de la ruta el 14/3") es una traza de dónde estuvo alguien.

**Cuesta.** Pedir cuenta para corregir un horario espanta a quien solo pasaba.
Sin seudónimos en el historial no hay reconocimiento público a quien más
aporta (un incentivo típico de los wikis).

### P-26 · (i2) Push agregado y nunca en tiempo real

**Decisión.** Las notificaciones son genéricas y en lote (una por día como
máximo). Nunca "Fulano acaba de registrar". El contenido no nombra lugares de
otros usuarios.

**Mitiga.** A2: el push es tiempo real por definición, y el tiempo real es
"casa vacía". A6: el servicio de push del navegador (Google, Apple, Mozilla) ve
cuándo llega cada notificación y a qué dispositivo; con lotes diarios
genéricos, eso no dice nada de los eventos.

**Cuesta.** Se pierde la notificación más enganchadora posible ("tu amigo acaba
de cagar en la YPF de Caleta"). Eso duele en retención.

### P-27 · (i2) Los atributos que cambian no son atributos del wiki

**Decisión.** Limpieza y papel son observaciones con fecha y vencimiento, no
campos editables del wiki.

**Mitiga.** No es un riesgo de privacidad: es de calidad de datos. Está acá
porque sin esto, "limpio" sería un dato público falso pegado a un comercio con
nombre (A8, Q-N5).

**Cuesta.** Dos modelos de datos en vez de uno; la ficha del baño muestra dos
cosas distintas (lo que es y cómo está últimamente).

### P-28 · (i2) Proponer un baño nuevo no usa tu ubicación

**Decisión.** Para proponer un baño que no está en el catálogo, el usuario
marca el punto a mano en el mapa. No hay botón de "usar mi ubicación".

**Mitiga.** A3/A4: sin esto, una propuesta sería una coordenada exacta del
usuario en un momento dado, enviada al servidor, que es lo que P-01 prohíbe.
A1: alguien que "propone" su casa como baño.

**Cuesta.** Marcar un punto a mano es más lento y menos preciso. Las propuestas
necesitan revisión o una segunda confirmación antes de ser visibles.

### P-29 · (i2) Madrugada y noche: sin preselección y sin reglas recordadas

**Decisión.** Entre las 20 y las 6 h, el selector de lugar no preselecciona
nada y las reglas del tipo "siempre a mis amigos" no se aplican: cada
publicación se pregunta.

**Mitiga.** A2, camino C de la crítica: "Lu en el Bar X, madrugada" dos noches
seguidas = Lu vive arriba del Bar X.

**Cuesta.** Más toques justo cuando el usuario está medio dormido.

### P-30 · (i2) La lista de testers de Google Play no entra en el sistema

**Decisión.** Los mails de los testers de la prueba cerrada viven solo en Play
Console. No se guardan en la base, ni se cruzan con cuentas, ni se usan para
nada más.

**Mitiga.** A3/A4: es la única lista de mails de usuarios reales que va a
existir; cruzarla con seudónimos anula P-11 y P-12 para esas personas.

**Cuesta.** No se puede agradecer ni avisar a los testers desde la app; hay que
hacerlo por fuera.

---

## Decisiones descartadas

| Id | Propuesta | Por qué se descarta | Reemplazo |
|---|---|---|---|
| D-01 | Capa privada en claro en el servidor. | La ven A3, A4, A5. | P-01, P-03, P-04. |
| D-02 | Snap automático a POI < 40 m. | Falla abierto con la casa pegada a un comercio. | P-05, P-06. |
| D-03 | Jitter determinístico por usuario. | Se revierte con un punto conocido. | P-10. |
| D-04 | Heatmap H3/geohash con 5 registros / 3 usuarios. | Mide lo equivocado; la condición de registros no protege y apaga el mapa. | Sin heatmap en v1 (P-17). |
| D-05 | Zonas y detección de domicilio en el servidor. | Lista de domicilios. | P-07, P-08. |
| D-06 | Google OAuth. | Señal a Google, mail y nombre. | P-11, P-12. |
| D-07 | Tiles de `tile.openstreetmap.org`. | Política de uso; filtra la ubicación a un tercero. | P-16. |
| D-08 | Franja horaria como único borroneo. | Con fecha exacta y en vivo revela presencia. | P-13, P-14. |
| D-09 | **(i2)** Umbral de k dinámico (más bajo al principio). | El k bajo llega justo cuando cada persona es más identificable, y el cambio de umbral deja ver diferencias. | Sin agregados de eventos en v1. |
| D-10 | **(i2)** Limpieza como atributo editable del wiki. | Es un estado que cambia; el wiki lo muestra como verdad permanente. | P-27. |
| D-11 | **(i2)** Edición del wiki sin login. | Sin cuenta, frenar vandalismo exige guardar IPs. | P-25. |
| D-12 | **(i2)** `faltan` exacto en el ranking de macrozonas. | Publicaba el conteo exacto por zona cada mes y anulaba los rangos; con pocos usuarios, revelaba la zona de quien se sumaba (camino B de la crítica). | Ranking fuera de v1; si vuelve, solo en rangos. |
| D-13 | **(i2)** Contadores de visitas por lugar. | Vacíos con 20 usuarios y principal fuente de eventos con autor en el servidor. | Observaciones del puente (P-24). |

---

## Correspondencia con la Ley 25.326

No es asesoramiento legal. Necesita revisión de un abogado (Q-L1).

| Artículo | Qué exige | Cómo se atiende |
|---|---|---|
| Art. 2 | Define datos sensibles (incluye salud) y dato disociado. | P-02. Lo público es dato disociado (P-13, P-24, P-25). **(i2)** La capa de baños no tiene datos personales salvo el `cuenta_id` interno de ediciones y observaciones. |
| Art. 4 | Datos adecuados, no excesivos; destruirlos cuando no hacen falta. | P-01, P-12, P-19, P-21, **(i2)** P-24 (90 días), P-28. |
| Art. 5 | Consentimiento libre, expreso e informado, con prueba. | P-09, con consentimientos separados y versionados. |
| Art. 6 | Informar finalidad, destinatarios, derechos. | Política en `docs/legal/`; **(i2)** el texto de la primera tarjeta del puente. |
| Art. 7 | Datos sensibles; inc. 3 prohíbe bancos que los revelen. | Q-L1. P-02, P-03, P-04. |
| Art. 9 | Seguridad. | DESIGN.md §14. |
| Art. 12 | Transferencia internacional. | Mail transaccional, backups, **(i2)** servicios de push (Q-L5). |
| Art. 14 | Acceso en 10 días corridos. | `GET /cuenta/exportar`. |
| Art. 16 | Supresión en 5 días hábiles. | `DELETE /cuenta`, `DELETE /aportes/...` (P-18). |
| Art. 21 | Inscripción en el registro de la AAIP. | Q-L2. |
