# PRIVACY.md — Decisiones de privacidad

Cada decisión está escrita como decisión: qué se hace, qué riesgo mitiga (con
el actor del modelo de amenazas de [DESIGN.md §2](DESIGN.md#2-modelo-de-amenazas))
y qué cuesta en experiencia de usuario. Si una decisión no cuesta nada, no
debería estar en esta lista.

**Iteración 3.** Las decisiones nuevas o modificadas llevan **(i2)** o **(i3)**.
La iteración 2 incorporó las dos capas con toggle y el puente, la crítica
adversarial de la iteración 1 (caminos A-D del ataque de desanonimización) y el
dato de OSM ([SEEDING.md](SEEDING.md)). La iteración 3 agrega el **invariante de
superficies**, la atribución en lugar del umbral, la tercera pregunta del
puente, el entorno de prueba y la postergación del mapa general.

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
6. **(i3) Atribución antes que umbral.** Un dato se muestra con quién lo dice
   (sin identificar a nadie: "1 persona", "según la recorrida") y cuándo. Eso
   resuelve que la palabra de uno no se lea como verdad. **No** resuelve la
   privacidad de quien aportó: para eso están el invariante de superficies y las
   decisiones P-13, P-14 y P-24.

---

## Invariante de superficies (i3)

> **Sin agregado, lo único público es el wiki de baños.** Todo el diseño de
> k-anonimato existía para que lo público derivado de registros fuera un
> agregado. En v1 no hay agregados de eventos (el mapa general está postergado,
> DESIGN.md §16). Por lo tanto, ninguna superficie fuera de la bóveda puede
> mostrar un registro individual, salvo las inventariadas acá, cada una con sus
> protecciones.

**Inventario de todo lo que, fuera de la bóveda, deriva de registros o de actos
individuales:**

| Superficie | Quién la ve | Qué deriva de un acto individual | Protecciones |
|---|---|---|---|
| Bóveda | Solo el dueño | Todo, incluido el comentario "¿Alguna anécdota?" (P-34) | Cifrado de punta a punta (P-03, P-04). |
| Feed de amigos | Amigos elegidos (mutuos) | Registro individual: baño o etiqueta, día, franja | P-07 (etiqueta de zona), P-10 (viajes a la vuelta), P-21 (30 días), P-29 (noche). **Es la única superficie social con registros individuales.** |
| Estado reciente de un baño | Público, indexado | Observación individual del puente: "1 persona, esta semana: limpio" | Sin autor, semana (no día), ≥ 24 h de demora, una por persona y ventana, nunca en zona privada (P-13, P-14, P-24). **Es un dato individual publicado, no un agregado.** |
| Evidencias de atributos (incluida la tercera pregunta) | Público, indexado | "1 persona, hace 2 semanas: no cobra"; en contradicción de horario, además tipo de día y franja | Sin autor, semana, demora, sin `cuenta_id` a los 90 días (P-13, P-24). |
| Historial del wiki | Público, indexado | Una edición: atributo, antes → después, mes | Sin seudónimo, mes (P-25). Riesgo residual: Q-P8. |
| Insignias públicas | Público, opt-in | Que la persona completó un logro | Sin lugar ni fecha; las de ruta solo completas (P-20). |
| Tarjetas compartibles | Quien reciba el link | Lo mismo que la insignia; **(i3)** para medallas, el nombre implica la cantidad de registros (múltiplo de 5) | Acto explícito del usuario en el momento; sin fecha ni lugar (P-33). |
| **(i3)** Anuncio de medalla a amigos | Amigos elegidos | Que hubo un registro ese día | Solo si el usuario lo pide para esa medalla; cola diferida (P-33). |
| **(i5)** Puntaje de un baño | Público | Promedio y cantidad de votos; nunca quién votó ni cuándo | Un voto por cuenta; se guarda con `cuenta_id` solo para poder cambiarlo y se borra con la cuenta. Con 1 voto, el promedio es ese voto (atribución como P-17, sin autor). |
| **(i5)** Cacas de amigos (`/app/amigos`) | Amigos (mutuos, por link de invitación) | Lo mismo que una pública, con seudónimo, durante 30 días | Opt-in por registro con advertencia; nunca casa/laburo/lo de alguien; 30 min de demora; sin búsqueda ni solicitudes (P-43). |
| **(i5)** Mapa de cacas (`/cacas`) y visitas públicas en la ficha de un baño | Público, sin cuenta | **Registro individual con seudónimo:** el baño o el punto (±11 m), el tipo de lugar y el día; **la anécdota, solo si su dueño la muestra (P-42)** | **Excepción a la regla de abajo, por decisión del producto (P-38):** opt-in registro por registro con advertencia explícita, nunca casa/laburo/lo de alguien, sin hora, 30 min de demora para los demás (el dueño la ve enseguida), despublicar borra en el acto. |

**Regla para cualquier superficie nueva** (vista social, perfil público, liga,
ranking, mapa general, estadísticas para comercios adheridos):

1. O es un **agregado** con k ≥ 3 cuentas elegibles distintas, en rangos y
   actualizado en el lote nocturno;
2. o es individual y pasa por **las mismas protecciones que el feed de amigos**
   (destinatarios elegidos, etiqueta de zona, viajes a la vuelta, vencimiento);
3. y en ambos casos se agrega a esta tabla y se repite el ejercicio de ataque
   de desanonimización antes de implementarla.

**(i5)** El mapa de cacas no cumple el punto 2: es individual, público y con
seudónimo. Se adoptó igual, como decisión del producto, con las protecciones y
el ejercicio de ataque de P-38.

Una superficie que no está en esta tabla no existe. Si alguien la agrega sin
pasar por acá, reintroduce el problema que este documento entero intenta
resolver.

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

**(i3)** El comentario privado (P-34) es texto libre: alguien puede escribir
detalles del cuerpo igual. P-02 no lo impide (no hay forma sin leer lo que la
gente escribe), pero el sistema **no lo pide**: la pregunta es "¿Alguna
anécdota?", no "¿Cómo te fue?", y el texto queda cifrado, sin que el operador
pueda leerlo.

### P-03 · La capa de registros está cifrada de punta a punta

> **(i5)** Cambiada por P-40: la llave queda también en custodia del servidor.

**Decisión.** El historial se cifra en el dispositivo con una llave AES-GCM 256
generada ahí. El servidor guarda la llave solo **envuelta**: con una llave
derivada de la extensión PRF de la passkey (si el autenticador la soporta) y/o
con un código de recuperación que el usuario guarda.

**Mitiga.** A3, A4 sobre datos guardados, A5. Borrar la cuenta es destruir las
llaves envueltas (crypto-shredding): los backups quedan con bytes ilegibles.

**Cuesta.** Es la decisión más cara de esta lista.
- Si el usuario pierde todas las formas de desenvolver la llave, **pierde el
  historial** y nadie lo puede recuperar. Hay que decirlo claro y va a pasar.
- Pedir que guarden un código de recuperación es fricción en el alta; muchos lo
  van a saltear.
- En iOS/Safari, el almacenamiento de un sitio no instalado se puede borrar
  después de 7 días sin uso. Sin PRF ni código, eso es pérdida de historial
  (Q-T2).
- No hay "olvidé mi contraseña" del lado servidor: soporte no puede ayudar.
- Las estadísticas personales se calculan en el cliente (bien para privacidad,
  peor para celulares lentos con años de historial).
- No protege contra un servidor comprometido que sirva JS malicioso
  (DESIGN.md §2, L1).

**(i2)** La app nativa futura mejora el desalojo del almacenamiento y la
limitación L1, pero el camino de passkeys con PRF dentro de un WebView no está
verificado (Q-T7).

### P-04 · La bóveda no revela cuántos registros hay ni cuándo

**Decisión.** Páginas mensuales con identificador opaco, padding a múltiplos de
4 KB, sin timestamps en las filas (solo número de secuencia).

**Mitiga.** A3/A4: sin esto, el cifrado es casi decorativo, porque la cantidad y
el momento de las filas cifradas **son** la frecuencia intestinal.

**Cuesta.** Más bytes transferidos y guardados por sincronización (se reescribe
la página del mes entera). Mezclar cambios hechos en dos dispositivos es más
complejo.

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

**Decisión.** WebAuthn con passkeys descubribles. Al alta solo se pide un
seudónimo. Se pide la extensión PRF para la bóveda.

**Mitiga.** A3/A4/A5: no hay mail, teléfono ni nombre que vincule el seudónimo
con una persona. A6: no hay proveedor de identidad que se entere.

**Cuesta.** Mucha gente no sabe qué es una passkey y desconfía de "entrar con la
huella" en una web. Celulares viejos o navegadores raros pueden no tenerlas.
Sin PRF, la bóveda depende del código de recuperación. Perder el celular sin
passkey sincronizada (Google Password Manager / iCloud) es perder la cuenta.

**(i2)** El dominio tiene que ser el definitivo antes de la **primera
passkey**, porque cambiarlo las invalida todas (DESIGN.md §14.2, R7).

**(i3)** En el entorno de prueba no hay passkeys (P-31).

### P-12 · Mail solo como HMAC, sin Google OAuth

**Decisión.** El login por magic link guarda `HMAC-SHA256(pimienta, mail)`. El
mail en claro existe solo en memoria para enviar el link. No hay Google OAuth en
v1.

**Mitiga.** A3: el dump no tiene mails. Con la pimienta fuera de la base, no se
puede probar un mail contra el HMAC. A6: Google no se entera de que la cuenta
existe.

**Cuesta.** No se le puede escribir a nadie: ni avisos de cambios en los
términos, ni aviso de incidente de seguridad, ni "volvé". Si la pimienta se
pierde, todos los logins por mail se rompen. Sin el botón "Entrar con Google",
que es el de menor fricción en Argentina (casi todo el mundo tiene Android y
Gmail). El proveedor de mail transaccional ve las direcciones (Q-L5).

**(i3)** En el entorno de prueba, el magic link es el único método de login.

### P-13 · Tiempo generalizado en todo lo que sale del dispositivo

**Decisión.** **(i2)** Observaciones del puente: solo semana (sin franja ni tipo
de día). Ediciones del wiki: mes. Amigos: día + franja.

**(i3)** Dos agregados:
- El estado reciente y las evidencias se muestran relativos a la semana ("esta
  semana", "hace 2 semanas"), nunca "hace 3 días": el día no se guarda.
- **Excepción acotada:** la respuesta a la tercera pregunta del puente en caso
  de **contradicción de horario** ("según el mapa cierra los domingos, ¿estaba
  abierto?") viaja con `{ tipo_dia, franja }`, porque sin eso no sirve. Es el
  único dato público que dice "alguien estuvo en este baño un domingo a la noche
  de la semana X". No se pregunta en madrugada ni noche (P-29).

**Mitiga.** A1/A2: reconstruir rutinas. A3/A4: el servidor no tiene horarios
exactos.

**Cuesta.** **(i2)** Las observaciones no sirven para "¿a qué hora está limpio?".
El horario del baño sale del wiki, no de las observaciones. **(i3)** "Hace 3
días" sería más claro que "esta semana"; no se hace para no guardar el día.

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

> **(i5)** Excepción opt-in: la anécdota en el mapa de cacas (P-42).

**Decisión.** Lo público son atributos estructurados (8 casilleros). Los
comentarios son privados. No hay subida de imágenes.

**Mitiga.** Moderación (una persona no puede moderar texto libre), difamación
de comercios o personas con nombre y apellido, doxxing ("en lo de Pérez de la
calle tal"), metadatos EXIF con ubicación.

**Cuesta.** Lo más divertido de una reseña es el texto. Sin texto, lo público es
seco; el humor queda en lo privado, el modo amigos y las tarjetas de logros.

**(i2)** Aplica también al wiki: los atributos son estructurados; no hay campo
"notas". Ver Q-W3 sobre indicaciones como "pedir la llave en caja".

### P-16 · Cero terceros en el navegador

**Decisión.** Tiles, fuentes, scripts y estilos servidos desde el propio
dominio. Sin analytics de terceros, sin CDN, sin píxeles. CSP
`default-src 'self'`.

**Mitiga.** A6: el proveedor de tiles es el más grave, porque en el momento de
registrar el mapa está centrado en el usuario, así que el pedido de tiles revela
su ubicación a un tercero junto con su IP. También reduce la superficie de L1.

**Cuesta.** Hay que generar y servir PMTiles propios (trabajo de pipeline y
ancho de banda del VPS). Sin analytics no sabés bien cómo se usa el producto.

**(i2)** Excepción declarada: el servicio de push del navegador (FCM para
Chrome en Android, el de Mozilla o Apple en otros). Es inevitable si hay push.
Se mitiga con P-26.

### P-17 · (i3) Atribución en lugar de umbral, y lo que queda de los umbrales

**Decisión.** Sin agregados de eventos en v1 (sin contadores de visitas, sin
ranking; el mapa general está postergado). **El estado reciente y los atributos
se muestran por atribución**: "1 persona, esta semana: limpio"; "4 de 5
personas, últimos 30 días: limpio"; "Cobra: no · según 1 persona, hace 2
semanas"; "según la recorrida, noviembre 2026". Límite antifraude: una
observación por persona, por baño y por ventana de 30 días (reemplaza a la
anterior). Lo que queda como umbral:

| Qué | Regla |
|---|---|
| Baño confirmado o probable | Se muestra siempre (lugar público). |
| Estado reciente y atributos | Siempre, con procedencia, fecha y frescura. |
| Probable → confirmado | Evidencia de 2 cuentas elegibles distintas, o 1 de `gps_campo` o `fuente_externa`. |
| Rótulo "confirmado por varias personas" | ≥ 2 personas elegibles coincidentes en 180 días. |
| Elegibilidad | Cuenta de ≥ 7 días y ≥ 3 días activos (cualquier sincronización). |

**Mitiga.** Que la palabra de una persona se lea como verdad (la atribución lo
dice). A7: una cuenta sola no infla un baño ("4 de 5" son personas) ni cambia
estados. La condición de "5 registros" y los umbrales sobre eventos
desaparecieron con las superficies que protegían.

**Cuesta.** La atribución no protege a quien aportó: una sola observación sigue
diciendo "alguien usó este baño esta semana". Eso lo cubren P-13, P-14 y P-24, y
queda inventariado en el invariante de superficies. Las fichas son más largas
(cada dato con su fuente y fecha). Los primeros usuarios tardan una semana en
poder confirmar.

**Por qué cambió la elegibilidad:** la regla de la iteración 1 (14 días y 5 días
con aportes públicos) era inalcanzable con ~4 aportes publicables cada tres
meses. Contar cualquier sincronización no le revela al servidor nada que no
viera ya.

### P-18 · Borrado de cuenta real

**Decisión.** `DELETE /cuenta` borra en el acto: cuenta, credenciales, HMAC de
mail, sesiones, consentimientos, llaves envueltas, páginas de bóveda, aportes
de todo tipo, amistades, feed, insignias, denuncias hechas. Los agregados se
recalculan esa noche (un lugar que tenía 3 personas puede dejar de mostrar
contadores). Los backups expiran en 30 días; como las llaves envueltas también
se borran, la bóveda de los backups no se puede descifrar ni antes de esos 30
días. Se ofrece, como opt-in explícito al borrar, donar los reportes de baño
disociados (sin `cuenta_id`).

**Mitiga.** Derecho de supresión (art. 16). A3/A5 a futuro.

**Cuesta.** Irreversible, sin período de gracia. Si se dona, el lugar conserva
los atributos; si no (default), el mapa útil pierde datos cada vez que alguien
se va.

**(i2)** Además: las observaciones se borran (las de menos de 90 días; las más
viejas ya no tienen autor); las ediciones del wiki quedan **sin `cuenta_id`** (un
wiki no puede deshacer las correcciones de quien se va sin romper el historial
de los demás); las suscripciones push se borran. Costo: las ediciones quedan
aunque la persona se haya ido; hay que declararlo en los términos.

**(i3)** Las evidencias (incluidas las de "Sigue igual" y la tercera pregunta)
siguen la misma regla que las ediciones: quedan sin `cuenta_id`.

### P-19 · Sin logs que vinculen personas con momentos

**Decisión.** Sin log de acceso en `/api/*` y `/tiles/*`. En el resto, IP
truncada y 7 días. Sesiones sin IP ni user agent. Rate limit en memoria. Fechas
en las tablas con precisión de día salvo donde hace falta más (vencimientos).

**Mitiga.** A3/A4/A5: el log de acceso es donde los sistemas "anónimos" suelen
dejar todo lo que dicen no guardar.

**Cuesta.** Depurar incidentes es más difícil. Un abuso se investiga con menos
datos. El rate limit se reinicia si se reinicia el proceso.

### P-20 · Insignias públicas opt-in, sin fechas, las de ruta solo completas

**Decisión.** Mostrar una insignia es opcional. Nunca dice cuándo ni dónde. Las
insignias de progreso en un corredor (Ruta 3) solo se muestran completas.

**Mitiga.** A2: un progreso que avanza en vivo ("7/12 YPF de la Ruta 3") es un
rastreador de viajes.

**Cuesta.** Lo más compartible ("me faltan 2 YPF") no se puede mostrar en
público. Sí se puede compartir como tarjeta puntual, decidida por el usuario en
ese momento (es un acto explícito, igual que publicar).

### P-21 · El feed de amigos vence a los 30 días

**Decisión.** Borrado automático. Cortar una amistad borra del feed del otro lo
que le habías mostrado.

**Mitiga.** A2 cuando la relación cambia (ex parejas). A3: limita lo que hay
para filtrar.

**Cuesta.** No hay "historia compartida" larga entre amigos.

### P-22 · ~~Rangos en el ranking de macrozonas~~ — postergada (ver X-02)

Sin ranking en v1 (DESIGN.md §16). Si vuelve, tiene que volver con rangos y
**sin el campo `faltan` exacto** (ver D-12).

### P-23 · Mayoría de edad declarada (provisoria)

**Decisión.** v1 solo para mayores de 18, por declaración en el alta.

**Mitiga.** Tratamiento de datos de menores con ubicación, que es el escenario
legal y reputacional más feo posible para un proyecto así.

**Cuesta.** El público adolescente es probablemente el que más viraliza. Una
declaración no verifica nada. Está en discusión (Q-L3).

### P-24 · (i2) El puente publica observaciones anónimas que vencen

**Decisión.** La respuesta al puente se convierte en una observación
`{ banio_id, semana, estado_banio?, habia_papel? }`. Se guarda con `cuenta_id`
para deduplicar y frenar spam, y **la fila entera se borra a los 90 días**;
queda solo un resumen mensual sin autor. **(i3)** Una por persona, por baño y por
ventana de 30 días (una nueva reemplaza a la anterior). Lo público muestra la
atribución ("4 de 5 personas, últimos 30 días: limpio"), nunca la lista de
observaciones. Las respuestas a la tercera pregunta son evidencias con la misma
regla: `cuenta_id` a null a los 90 días.

**Mitiga.** A1/A8: el comercio no puede saber quién dijo "evitalo". A3/A4: la
ventana en que el servidor sabe "la cuenta X estuvo en el baño Y la semana Z"
dura 90 días, no para siempre (cierra parte de L3 y de Q-P3).

**Cuesta.** No hay historia larga por persona: no se puede detectar a alguien
que reporta "evitalo" en todos los baños de una cadena durante un año. El
resumen mensual no deja auditar un patrón sospechoso viejo.

### P-25 · (i2) Wiki: leer sin login, editar con cuenta, historial sin seudónimos

**Decisión.** Las fichas de baños son públicas e indexables. Editar (o
confirmar con "Sigue igual") requiere cuenta y consentimiento `editar_wiki`. El
historial público muestra mes, atributo, valor anterior y nuevo, procedencia,
sin seudónimo. Internamente se guarda `cuenta_id` para poder revertir
vandalismo.

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

### P-31 · (i3) Entorno de prueba sin passkeys y con cuentas descartables

**Decisión.** En `caca.blucaro.site` (`ENTORNO=prueba`): sin passkeys (el código
se niega a habilitarlas en ese entorno), login solo por magic link, código de
recuperación obligatorio para la bóveda, base de datos propia que se borra
entera al migrar, sin migración de usuarios, banner permanente, `noindex` por
cabecera y meta, secretos propios. El dominio aparece en una sola variable
(`ORIGEN_PUBLICO`). Detalle en DESIGN.md §15.

**Mitiga.** Que las passkeys queden atadas a un dominio que se va a abandonar
(no migran). Que alguien cargue datos reales creyendo que quedan. Que Google
indexe el contenido bajo el dominio equivocado.

**Cuesta.** El flujo más importante (alta con passkey y PRF) no se prueba en ese
entorno: se prueba en `localhost`. Quien use el entorno de prueba pierde todo al
migrar, incluidas sus PWA instaladas y sus suscripciones push. **Los mails de los
magic links son de personas reales**: la política de privacidad aplica igual,
aunque las cuentas sean descartables, y el borrado al migrar tiene que ser real
(incluidos los backups de ese entorno).

### P-32 · (i3) Regla asimétrica de exposición de comercios

**Estado:** adoptada para v1, independiente de que se adopte "Baño amigo"
(DESIGN.md §18.4).

**Decisión.** Para un comercio que no adhirió a "Baño amigo", la ficha
nunca dice "libre" ni "sin consumir", aunque haya reportes de usuarios en ese
sentido: dice "baño para clientes" o "consultá". Solo un comercio adherido
muestra "te dejan pasar sin consumir".

**Mitiga.** A8 y el riesgo de producto: publicar que un comercio deja pasar
gratis es la forma más rápida de que deje de hacerlo, y el comercio no lo
eligió.

**Cuesta.** Se esconde un dato verdadero y útil. Si "Baño amigo" no se adopta,
el atributo "acceso" de los comercios pierde casi todo su valor.

### P-33 · (i3) Medallas: privadas por defecto y nunca en el perfil público

**Decisión.** Una medalla cada 5 registros, calculada en el dispositivo sobre el
historial privado (DESIGN.md §17). Se ven en "Mis registros". Se pueden
compartir como tarjeta o contar a los amigos, **una por una y a pedido**. No se
muestran en el perfil público. Los nombres no hablan del cuerpo ni de la salud.

**Mitiga.** Una medalla de conteo en un perfil público es un contador acumulado
que cualquiera puede mirar dos veces: la diferencia es la frecuencia intestinal
de esa persona en ese período (P-02, art. 7). Un anuncio automático a amigos
revelaría que hubo un registro ese día aunque el usuario no les cuente sus
registros. Nombres sobre condiciones de salud podrían ser hirientes para quien
las tiene.

**Cuesta.** Lo más compartible ("¡llegué al Trono de Oro!") no se luce solo en
el perfil: hay que compartirlo a mano. Sin anuncio automático, el modo amigos
pierde un empujón social. El servidor no puede verificar ninguna medalla.

### P-34 · (i3) Comentario privado al registrar

> **(i5)** Sigue siendo privado salvo que su dueño lo muestre al publicar (P-42).

**Decisión.** Una caja opcional "¿Alguna anécdota?" en la pantalla de registro
(DESIGN.md §8.1), de hasta 500 caracteres. El texto vive solo en la bóveda
cifrada. Nunca va al puente, al feed de amigos, a las tarjetas compartibles ni a
ninguna superficie pública. La pregunta y los ejemplos hablan de la situación y
del lugar, no del cuerpo.

**Mitiga.** Que el texto libre se convierta en el registro de salud que P-02
evita: no se pide información del cuerpo y, si alguien la escribe, el operador
no la puede leer (A3, A4, A5). Que haga falta moderar: un texto que solo ve su
autor no se modera.

**Cuesta.** Lo más gracioso que escriba la gente queda invisible para todos
menos para su autor. La tentación de un "muro de anécdotas" público va a
aparecer: sería texto libre público, con moderación y riesgo de difamación
(P-15), y tiene que pasar por el invariante de superficies (ver Q-N14 para una
alternativa que no aloja nada en el servidor).

### P-35 · (i4) Contraseña sin mail, guardada solo como huella

**Decisión.** Se puede crear la cuenta con seudónimo y contraseña, sin dar
ningún mail. Se guarda solo una huella scrypt (N=2^15, r=8, p=1, con sal
propia). Mínimo 10 caracteres, sin las más obvias ni el seudónimo adentro.
Límite de intentos por IP (en memoria) y por cuenta. El mismo mensaje para
"seudónimo inexistente" y "contraseña incorrecta", y el mismo tiempo de
respuesta.

**Mitiga.** Que solo puedan entrar quienes tienen passkey (exclusión). Con una
filtración de la base, adivinar contraseñas cuesta caro (A3). Enumerar
seudónimos con cuenta de contraseña por el mensaje o el tiempo (A7).

**Cuesta.** Si te olvidás la contraseña y no tenés passkey ni mail, la cuenta no
se recupera: no hay mail al que mandar nada (se avisa al crearla). Las
contraseñas se reutilizan entre sitios; una filtración de otro sitio puede
abrir cuentas acá (credential stuffing): lo frena el límite por cuenta, no lo
evita.

### P-36 · (i5) El mapa de baños no sabe quién lo mira ni dónde está

**Decisión.** El catálogo de baños es un solo archivo para todo el país, igual
para todos, sin cookies ni cuenta. "Cerca mío" pide la ubicación al navegador y
calcula las distancias en el celular: la ubicación nunca se manda al servidor.
"Cómo llegar" abre openstreetmap.org con el destino (el baño), no con el origen;
recién ahí, y solo si el usuario toca el botón, sale algo hacia un tercero. El
mapa base, las fuentes y los íconos se sirven desde nuestro dominio. Los
nombres de usuario de OSM que trae Overpass se descartan al importar: no se
guardan ni se publican.

**Mitiga.** Que el servidor (o una filtración de sus datos) diga dónde estaba
alguien cuando buscó un baño (A3, A6). Que pedir el catálogo revele la zona
(P-01): como es uno solo, no revela nada.

**Cuesta.** Los pedidos de teselas del mapa base sí dicen qué zona se mira, con
la precisión del zoom. No se guardan (sin log de acceso, P-19), pero el
servidor los ve pasar. Bajar 377 KB de entrada es más que bajar una provincia.

### P-37 · (i5) Salir borra el historial del celular

**Decisión.** "Salir" y "Borrar la cuenta" borran la base local del historial
(registros descifrados y llaves). Para volver a verlo en ese celular hay que
entrar y poner el código de recuperación. El código es obligatorio al crear el
historial (DESIGN.md §0, iteración 5, punto 8).

**Mitiga.** Un celular prestado, compartido o vendido que se queda con el
historial de otra persona, con hora y ubicación exactas (A5).

**Cuesta.** Quien sale y vuelve a entrar necesita el código cada vez. Quien lo
perdió pierde el historial (P-03): "Perdí el código" solo permite empezar de
cero.

### P-38 · (i5) Cacas públicas: opt-in por registro, con seudónimo

**Estado:** adoptada por decisión del producto. Reemplaza, para lo que cada uno
elige publicar, a P-01 ("el servidor nunca recibe coordenadas") y a la regla del
invariante de superficies, y reactiva una forma del mapa general (X-01) que no
es el agregado de §16.1.

**Decisión.** Cada registro es privado. El dueño puede hacerlo público, uno por
uno, al registrarlo o después (desde el historial o "Mi mapa"), siempre después
de una advertencia que dice exactamente qué se ve. Se publica:

- el seudónimo;
- el día (no la hora);
- el tipo de lugar (baño público, ruta, aire libre u otro);
- si fue en un baño del catálogo, **el baño** (no la posición del usuario); si
  no, el punto redondeado a 4 decimales (~11 m);
- "sin papel", si lo marcó.

No se publica nunca: la hora, la anécdota, la precisión del GPS. Casa, laburo y
lo de alguien no se pueden publicar (la interfaz no lo ofrece y el servidor lo
rechaza). Cada publicación la ven los demás 30 minutos después de hecha (era 2
horas; se bajó por pedido del producto); su dueño la ve enseguida, marcada "por
ahora solo la ves vos" (`/api/v1/publicaciones/mias`). Despublicar, borrar
el registro, "empezar de cero" o borrar la cuenta la borran en el acto. Tope de
60 publicaciones por día por cuenta.

**Ejercicio de ataque.**
- *Seguir a alguien* (A2): con el seudónimo se ve por dónde anduvo, por día.
  Lo acotan la demora de 30 min (no hay "dónde está ahora"; sí "dónde
  estaba hace media hora" para quien mira seguido) y que es opt-in caso
  por caso. No se elimina: la advertencia lo dice.
- *Encontrar la casa* (A1/A2): casa no se puede publicar, pero alguien puede
  registrar su casa como "otro" y publicarla. La advertencia muestra que se
  publica "el lugar donde estabas, con unos 10 m de precisión". Riesgo residual
  aceptado por el producto.
- *Rutina* (A2): varias publicaciones en el mismo punto en días hábiles revelan
  un lugar habitual. Igual que el anterior.
- *Frecuencia intestinal* (P-02, P-33): contar las publicaciones de un
  seudónimo da una cota inferior de su frecuencia. Solo de lo que eligió
  publicar.

**(i5) Desde cualquier país.** Se puede registrar y publicar fuera de la
Argentina: el punto publicado dice entonces en qué país estuvo la persona ese
día (como cualquier punto). Los baños del catálogo siguen siendo solo de la
Argentina.

**Cuesta.** Es la primera superficie pública con datos individuales y
seudónimo. La política de privacidad publicada cambió (versión
`privacidad-borrador-2026-10-30c`) y la revisión legal pendiente (Q-L*) tiene
que incluirla.

### P-39 · (i5) Entrar con Google, con lo mínimo

**Estado:** adoptada por decisión del producto. Revierte D-06 y la parte "sin
Google OAuth" de P-12.

**Decisión.** OpenID Connect por redirección desde el servidor: ningún script
de Google en nuestras páginas (P-16 sigue valiendo). Se pide solo el permiso
`openid`: ni mail ni nombre ni foto. Flujo con código, PKCE (S256), `state` y
`nonce`; el `id_token` llega directo del endpoint de Google por TLS y se valida
emisor, audiencia, vencimiento y nonce. Se guarda `HMAC(pimienta, "google:" +
sub)`, nunca el `sub` en claro. Sirve para crear la cuenta, entrar, y asociarlo
o quitarlo desde "Mi cuenta" (si queda otra forma de entrar).

**Mitiga.** A3: el dump no tiene ni mail ni identificador de Google. Que Google
reciba más datos que los necesarios para decir "es la misma persona que la vez
anterior".

**Cuesta.** A6: Google sabe que la persona tiene cuenta en Dónde Cagué y cada
vez que entra. Se avisa en el botón y en la política de privacidad. Si Google
suspende el cliente OAuth, quien solo tiene Google pierde el acceso (por eso
conviene sumar otro método).

### P-40 · (i5) La llave del historial en custodia del servidor

**Estado:** adoptada por decisión del producto ("no me gusta usar un código para
traer tu historial; que quede ligado a cómo entrás"). Cambia P-03: el historial
deja de ser cifrado de punta a punta frente a nosotros.

**Decisión.** El historial se sigue cifrando en el celular, con páginas opacas
y relleno (P-04 sigue igual). Lo que cambia es la llave: además del celular, el
servidor guarda una copia (`boveda_llaves`, método `servidor`) sellada con
AES-256-GCM, atada a la cuenta, con una llave que sale de `PIMIENTA_MAIL` por
HKDF. `PIMIENTA_MAIL` vive en el `.env`, no en la base. Con sesión, cualquier
método de entrada (passkey, contraseña, mail, Google) trae la llave y el
historial se abre solo. Ya no hay código de recuperación; los historiales que
se crearon con código lo piden una última vez y pasan a custodia.

**Mitiga.** La pérdida de historiales (P-03, "va a pasar"): ahora se pierde
solo si se pierde la cuenta. A3 sobre la base sola: un volcado o un backup de
Postgres sin el `.env` siguen siendo bytes ilegibles.

**Cuesta.**
- **"Ni nosotros podemos leerlo" deja de ser cierto.** Quien tenga la base y el
  `.env` (nosotros, o alguien que tome el servidor) puede leer los historiales,
  con ubicaciones y horas exactas. La política de privacidad lo dice.
- Un pedido judicial sobre una cuenta ya no se responde con "no podemos": se
  puede descifrar (Q-L*: revisarlo con el abogado).
- Perder `PIMIENTA_MAIL` es perder todos los historiales (además de los logins
  por mail y Google). Tiene que estar en el backup del `.env`, separado del de
  la base.
- Borrar la cuenta sigue destruyendo la llave (crypto-shredding), pero ya no
  hay garantía frente a un servidor comprometido antes del borrado.

### P-41 · (i5) Cargar la ubicación a mano, sin GPS

**Decisión.** Al registrar, la ubicación puede salir del GPS o cargarse a mano:
coordenadas (decimales o grados), un link de un mapa (Google Maps, OpenStreetMap,
Apple Maps, Waze, `geo:`) o una dirección. Las coordenadas y los links largos
se leen **en el celular**. Dos casos pasan por nuestro servidor, con sesión y
con límite de pedidos: los links cortos (`maps.app.goo.gl`), que el servidor
sigue sin bajar las páginas y solo hacia dominios de Google, y las direcciones,
que el servidor busca en Nominatim (OpenStreetMap), en todo el mundo. Lo
buscado no se guarda ni se escribe en logs; la respuesta vuelve al celular y
la ubicación queda, como siempre, cifrada en el historial.

**Mitiga.** Quien no quiere darle permiso de ubicación al navegador (o no tiene
GPS) igual puede registrar dónde fue y ver los baños cercanos. El celular no
habla con Google ni con OpenStreetMap (P-16).

**Cuesta.** Para una dirección o un link corto, nuestro servidor ve esa
ubicación en memoria mientras la resuelve, y Google o Nominatim reciben el
pedido (desde la IP del servidor, no la del usuario). Nominatim pide como
mucho un pedido por segundo: con mucho uso habrá que montar uno propio.

### P-42 · (i5) La anécdota en el mapa de cacas, si su dueño quiere

**Estado:** adoptada por decisión del producto ("es en parte la gracia"). Es una
excepción a P-15 (sin texto libre público) y a P-34 (el comentario es privado),
solo para lo que cada uno elige.

**Decisión.** Al hacer pública una caca que tiene anécdota, la advertencia
ofrece "Mostrar también mi anécdota", sin marcar, con la vista previa del texto.
Si se marca, el texto se guarda en claro junto a la publicación y se muestra en
el mapa de cacas con el seudónimo. No puede tener links, mails ni teléfonos
(lo rechazan el celular y el servidor). Cualquiera con cuenta puede reportarlo
(una vez, no el propio); con **3 reportes de cuentas elegibles** (7 días o más
y algún día con registros) se oculta el texto, no el punto, hasta revisarlo a
mano (docs/despliegue.md, "Comentarios públicos"). Despublicar, borrar el
registro o la cuenta lo borran en el acto.

**Mitiga.** Spam y que alguien publique datos de contacto de otra persona
(el filtro). Insultos, acoso o datos de terceros escritos de otra forma (los
reportes, que actúan rápido porque dejar el texto a la vista es lo que hace
daño; a diferencia de los baños, P-17 de la iteración 5, donde ocultar le
saca algo útil a todos).

**Cuesta.** Hace falta moderar: alguien tiene que mirar lo reportado. El
filtro no entiende contexto ("vivo en Zapiola 50" pasa). Tres cuentas
elegibles de acuerdo pueden ocultar un texto inocente hasta la revisión. El
texto publicado queda en la base en claro, fuera de la bóveda.

### P-43 · (i5) Compartir solo con amigos

**Estado:** adoptada por decisión del producto. Se suma al mapa público (P-38),
no lo reemplaza. Es una versión más simple del feed de amigos del diseño
(P-07, P-10, P-21), que no se había implementado.

**Decisión.** Cada caca es privada, de amigos o pública. "Solo amigos" publica
lo mismo que una pública (seudónimo, día, baño o punto a ~11 m, y la anécdota
solo si se elige, P-42), pero lo ven únicamente las cuentas amigas, durante 30
días (P-21), con la misma demora de 30 minutos. No gasta número del mapa
público. Casa, laburo y lo de alguien tampoco se comparten con amigos.

La amistad es mutua y se hace **solo con un link de invitación**: quien lo abre
con su cuenta queda como amigo de los dos lados. No hay búsqueda por seudónimo
ni solicitudes: nadie puede pedirte amistad si no le pasaste el link. Un link
vigente por cuenta, que dura 7 días y sirve para varias personas; crear uno
nuevo anula el anterior. El token viaja en el fragmento (#) y la base guarda
solo su hash. Cualquiera de los dos puede sacar al otro, sin aviso. El servidor
guarda la lista de amistades (pares de cuentas y fecha), que se borra con la
cuenta.

**Mitiga.** Lo que la gente quiere compartir con conocidos no tiene que ir al
mapa de todo el mundo.

**Cuesta.** Un link reenviado (un grupo de WhatsApp grande) suma como amigos a
desconocidos: por eso vence y se puede anular. El servidor sabe quién es amigo
de quién (un grafo social), además de lo que cada uno compartió. Lo de amigos
no tiene las protecciones del feed original (etiqueta de zona en vez de punto,
P-07; viajes a la vuelta, P-10): el punto es el mismo que en una pública.

---

## Decisiones postergadas (i3)

| Id | Qué | Por qué se posterga | Condición para volver |
|---|---|---|---|
| X-01 | **(i5) Reemplazado en parte por el mapa de cacas opt-in (P-38).** **Mapa general** (heatmap). Era un requisito explícito del producto. | Con 5 baños y 20 usuarios, 2 a 4 celdas de ~40 encendidas: se ve roto. | DESIGN.md §16.1: un uso que el wiki no cubra y ≥ 50 cuentas elegibles activas en 90 días. Debe ser agregado con k ≥ 3 personas, multirresolución y en rangos, y pasar por el invariante de superficies. |
| X-02 | Ranking de macrozonas (ex P-22). | Vacío con pocos usuarios y con un historial de fuga (D-12). | Igual que X-01, solo en rangos y sin `faltan`. |
| X-03 | **Ranking de ciudades y países** (idea del producto). Compara ciudades, **nunca personas**. | Con una ciudad piloto tiene una sola fila; además exige un aporte nuevo, porque el servidor no conoce la cantidad de registros de nadie (P-03). | DESIGN.md §16.2: ≥ 2 ciudades con ≥ 10 personas elegibles en el mismo mes. Opt-in, aporte mensual en rangos, índice con tope, países calculados solo con ciudades visibles, publicación mensual sin conteos exactos, `cuenta_id` borrado al publicar. Entra al invariante de superficies antes de implementarse. |

## Decisiones descartadas

| Id | Propuesta | Por qué se descarta | Reemplazo |
|---|---|---|---|
| D-01 | Capa privada en claro en el servidor. | La ven A3, A4, A5. | P-01, P-03, P-04. |
| D-02 | Snap automático a POI < 40 m. | Falla abierto con la casa pegada a un comercio. | P-05, P-06. |
| D-03 | Jitter determinístico por usuario. | Se revierte con un punto conocido. | P-10. |
| D-04 | **Regla** del heatmap original: H3/geohash con 5 registros / 3 usuarios por celda. (El mapa general en sí no está descartado: está postergado, X-01.) | La condición de registros no protege (protege la cantidad de personas) y apaga la mitad de las celdas; geohash 7 es demasiado fino. | Si vuelve el mapa general: k ≥ 3 personas, sin condición de registros (X-01). |
| D-05 | Zonas y detección de domicilio en el servidor. | Lista de domicilios. | P-07, P-08. |
| D-06 | ~~Google OAuth.~~ **(i5) Revertida: ver P-39** (solo `openid`, sin mail ni nombre). | Señal a Google, mail y nombre. | P-11, P-12. |
| D-07 | Tiles de `tile.openstreetmap.org`. | Política de uso; filtra la ubicación a un tercero. | P-16. |
| D-08 | Franja horaria como único borroneo. | Con fecha exacta y en vivo revela presencia. | P-13, P-14. |
| D-09 | **(i2)** Umbral de k dinámico (más bajo al principio). | El k bajo llega justo cuando cada persona es más identificable, y el cambio de umbral deja ver diferencias. | Sin agregados de eventos en v1. |
| D-10 | **(i2)** Limpieza como atributo editable del wiki. | Es un estado que cambia; el wiki lo muestra como verdad permanente. | P-27. |
| D-11 | **(i2)** Edición del wiki sin login. | Sin cuenta, frenar vandalismo exige guardar IPs. | P-25. |
| D-12 | **(i2)** `faltan` exacto en el ranking de macrozonas. | Publicaba el conteo exacto por zona cada mes y anulaba los rangos; con pocos usuarios, revelaba la zona de quien se sumaba (camino B de la crítica). | Ranking fuera de v1; si vuelve, solo en rangos. |
| D-13 | **(i2)** Contadores de visitas por lugar. | Vacíos con 20 usuarios y principal fuente de eventos con autor en el servidor. | Observaciones del puente (P-24). |
| D-14 | **(i3)** Umbral de 2 cuentas para mostrar el estado reciente (o declararlo excepción con 1). | El umbral existía para que la palabra de uno no se leyera como verdad; mostrar quién y cuándo lo resuelve sin esperar. | Atribución (P-17). |

---

## Correspondencia con la Ley 25.326

No es asesoramiento legal. Necesita revisión de un abogado (Q-L1).

| Artículo | Qué exige | Cómo se atiende |
|---|---|---|
| Art. 2 | Define datos sensibles (incluye salud) y dato disociado. | P-02. Lo público es dato disociado (P-13, P-24, P-25). **(i2)** La capa de baños no tiene datos personales salvo el `cuenta_id` interno de ediciones y observaciones. |
| Art. 4 | Datos adecuados, no excesivos; destruirlos cuando no hacen falta. | P-01, P-12, P-19, P-21, **(i2)** P-24 (90 días), P-28, **(i3)** P-31 (borrado del entorno de prueba). |
| Art. 5 | Consentimiento libre, expreso e informado, con prueba. | P-09, con consentimientos separados y versionados. |
| Art. 6 | Informar finalidad, destinatarios, derechos. | Política en `docs/legal/`; **(i2)** el texto de la primera tarjeta del puente. |
| Art. 7 | Datos sensibles; inc. 3 prohíbe bancos que los revelen. | Q-L1. P-02, P-03, P-04. |
| Art. 9 | Seguridad. | DESIGN.md §19. |
| Art. 12 | Transferencia internacional. | Mail transaccional, backups, **(i2)** servicios de push (Q-L5). |
| Art. 14 | Acceso en 10 días corridos. | `GET /cuenta/exportar`. |
| Art. 16 | Supresión en 5 días hábiles. | `DELETE /cuenta`, `DELETE /aportes/...` (P-18). |
| Art. 21 | Inscripción en el registro de la AAIP. | Q-L2. |
