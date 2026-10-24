# PRIVACY.md — Decisiones de privacidad

Cada decisión está escrita como decisión: qué se hace, qué riesgo mitiga (con
el actor del modelo de amenazas de [DESIGN.md §2](DESIGN.md#2-modelo-de-amenazas))
y qué cuesta en experiencia de usuario. Si una decisión no cuesta nada, no
debería estar en esta lista.

Al final están las decisiones **descartadas** de la propuesta original, con el
motivo, y una tabla de correspondencia con la Ley 25.326.

Actores: **A1** público · **A2** conocido con contexto · **A3** dump/backup ·
**A4** operador curioso · **A5** pedido judicial · **A6** terceros de red ·
**A7** Sybil/spam.

---

## Principios

1. **Lo que no se guarda no se filtra.** Antes de proteger un dato, preguntar si
   hace falta tenerlo.
2. **Fallar del lado privado.** Ante la duda (GPS impreciso, lugar dudoso,
   sugerencia sin responder) el registro queda privado.
3. **La publicación es un acto del usuario, nunca una inferencia del sistema.**
4. **El servidor solo ve lo que ya está generalizado.**

---

## Decisiones adoptadas

### P-01 · El servidor nunca recibe coordenadas de usuarios

**Decisión.** Toda la lógica que necesita la coordenada exacta (zonas privadas,
candidatos de lugar, detección de domicilio) corre en el navegador. Lo que viaja
al servidor es `lugar_id` + tiempo generalizado, o bytes cifrados.

**Mitiga.** A3, A4, A5: no hay coordenadas para filtrar, mirar ni entregar.
Además saca al operador del supuesto de "banco de datos que revela datos
sensibles" para la parte más delicada (ver tabla legal).

**Cuesta.** El cliente baja el catálogo entero de lugares de la ciudad (decenas
a cientos de KB, a medir). La lógica es más difícil de corregir: un bug en el
pipeline se arregla con un deploy, pero los registros mal clasificados ya están
en los dispositivos. No hay "búsqueda de lugares cerca mío" del lado servidor.
Escalar a muchas ciudades obliga a partir el catálogo por región, y pedir la
región revela la región (aceptable).

### P-02 · No se registra nada sobre el cuerpo

**Decisión.** No hay campos de consistencia (escala de Bristol), color, duración,
dolor, síntomas, medicación ni nada fisiológico. Ni privados. Es una regla de
producto, no un default.

**Mitiga.** Que el sistema se convierta en un registro de salud (Ley 25.326,
arts. 2 y 7). A3/A5: un dump no revela condiciones médicas. También el riesgo
reputacional de que alguien "descubra" un diagnóstico de otro.

**Cuesta.** Se pierde un tipo de humor (el escatológico detallado) y una
posible capa "útil" de autocuidado que algunos usuarios van a pedir. La
frecuencia igual se puede deducir de los timestamps privados; eso queda
cubierto por P-03.

### P-03 · La capa privada está cifrada de punta a punta

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

### P-04 · La bóveda no revela cuántos registros hay ni cuándo

**Decisión.** Páginas mensuales con identificador opaco, padding a múltiplos de
4 KB, sin timestamps en las filas (solo número de secuencia).

**Mitiga.** A3/A4: sin esto, el cifrado es casi decorativo, porque la cantidad y
el momento de las filas cifradas **son** la frecuencia intestinal.

**Cuesta.** Más bytes transferidos y guardados por sincronización (se reescribe
la página del mes entera). Mezclar cambios hechos en dos dispositivos es más
complejo.

### P-05 · El snap a un lugar es una sugerencia; publicar requiere confirmación

**Decisión.** El sistema propone lugares cercanos; el usuario elige. Ningún
registro se publica porque "había un lugar cerca". Preselección solo con lugar
a < 40 m y precisión GPS ≤ 30 m, y aun así preselecciona el lugar, no la
publicación.

**Mitiga.** A1/A2: la casa al lado de un comercio publicada como si fuera el
comercio. También los errores de GPS en interiores (20-150 m) que enganchan el
lugar equivocado.

**Cuesta.** Un toque más por registro. Menos aportes públicos que con snap
automático: el mapa crece más lento.

### P-06 · Solo se publica en categorías de lugar con baño de uso público

**Decisión.** Whitelist de categorías (estaciones de servicio, baños públicos,
terminal, aeropuerto, gastronomía, supermercados grandes, hospitales, etc.;
lista completa en DESIGN.md §5.4). Kioscos, almacenes, comercios chicos de
barrio y todo lo residencial quedan afuera.

**Mitiga.** A1/A2: la vivienda pegada a un negocio; además es lo que hace útil
la capa pública (no sirve saber que alguien cagó en una verdulería que no tiene
baño para clientes).

**Cuesta.** Lugares legítimos que quedan afuera (el bar chiquito del barrio que
sí tiene baño, si está mal categorizado en OSM). Se arregla con overrides
curados, que es trabajo manual.

### P-07 · Las zonas privadas viven solo en el dispositivo

**Decisión.** Casa, laburo y las que el usuario quiera, con radio default
200 m (100-1000). Se guardan dentro de la bóveda cifrada. El chequeo es
`distancia ≤ radio + precisión GPS`. Lo que cae adentro no se puede publicar
nunca, ni al mapa ni a amigos (a amigos sale "en casa", sin lugar).

**Mitiga.** A3/A4: la tabla de zonas sería la lista de domicilios de los
usuarios. A1/A2: publicar desde la casa por error.

**Cuesta.** Si vivís a 150 m de la YPF, nunca vas a poder publicar en esa YPF
(se le muestra al usuario por qué). En una ciudad de baja densidad como Río
Gallegos, 200 m de radio son unas 12,5 hectáreas: suficiente para esconder la
casa entre un par de cientos de viviendas, pero se come lugares públicos
cercanos.

### P-08 · No se publica nada hasta resolver "dónde vivís"

**Decisión.** En el onboarding, el usuario marca su casa o elige "no quiero
marcarla" (con advertencia). Hasta entonces, publicar está deshabilitado.
Además, el cliente detecta repeticiones nocturnas (3 noches) y en días hábiles
de día (3 días) en un mismo lugar y propone marcarlas, con "sí" preseleccionado.
Mientras la sugerencia está sin responder, ese grupo de registros no se puede
publicar. La detección no mira si hay un lugar público cerca.

**Mitiga.** A1/A2: el caso documentado del precedente (gente que termina
publicando dónde vive). A3/A4: la detección no corre en el servidor, así que el
servidor nunca tiene un "modelo de domicilio" de nadie.

**Cuesta.** Fricción en el primer uso, justo cuando el usuario llegó por un
chiste y quiere registrar ya. Mitigación: se puede **registrar** sin haber
marcado la casa; solo se bloquea **publicar**. Falsos positivos (la casa de la
novia, la de la vieja) que hay que descartar a mano.

### P-09 · Privado por defecto, consentimiento explícito y recordable

**Decisión.** Todo registro es privado. Publicar al mapa, contar a amigos y
sumarse al ranking de macrozonas son tres consentimientos separados, cada uno
con su texto versionado (tabla `consentimientos`). Dentro del consentimiento
general, cada registro tiene sus toggles apagados por defecto; el usuario puede
fijar reglas ("ofrecer siempre en estaciones de servicio") que se pueden revocar.

**Mitiga.** Cumplimiento del art. 5 (consentimiento libre, expreso e informado,
con prueba). A1/A2 por publicación accidental.

**Cuesta.** Menos datos públicos. El mapa útil crece más lento que con
"público por defecto". Es la decisión que más directamente compite con el
arranque en frío (DESIGN.md §7).

### P-10 · Modo amigos sin jitter y sin ubicación de casa

**Decisión.** Los amigos ven `lugar_id` (solo si es publicable y no está en zona
privada), día y franja. Todo lo demás se muestra como etiqueta sin ubicación:
"en casa", "en lo de alguien", "en el laburo", "en la ruta". Amistad mutua, por
link de invitación.

**Mitiga.** A2: el jitter constante se revierte con un punto conocido; el jitter
aleatorio se promedia; el jitter en anillo achica la búsqueda. Sin coordenadas
no hay nada que revertir.

**Cuesta.** El modo amigos no tiene un mapa con "todos mis pines" de un amigo;
tiene un feed y pines solo en lugares públicos. Es menos visual. El día exacto
sigue revelando a los amigos cuándo estás de viaje (ver Q-P4).

### P-11 · Passkeys como método de login principal

**Decisión.** WebAuthn con passkeys descubribles. Al alta solo se pide un
seudónimo. Se pide la extensión PRF para la bóveda.

**Mitiga.** A3/A4/A5: no hay mail, teléfono ni nombre que vincule el seudónimo
con una persona. A6: no hay proveedor de identidad que se entere.

**Cuesta.** Mucha gente no sabe qué es una passkey y desconfía de "entrar con la
huella" en una web. Celulares viejos o navegadores raros pueden no tenerlas.
Sin PRF, la bóveda depende del código de recuperación. Perder el celular sin
passkey sincronizada (Google Password Manager / iCloud) es perder la cuenta.

### P-12 · Mail solo como HMAC, y sin Google OAuth

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

### P-13 · Tiempo generalizado en todo lo que sale del dispositivo

**Decisión.** Público: semana ISO + franja (madrugada, mañana, mediodía, tarde,
noche) + tipo de día (hábil, sábado, domingo/feriado). Amigos: día + franja.
Ranking: mes.

**Mitiga.** A1/A2: reconstruir rutinas ("todos los martes a las 8:10 está en
tal lugar"). A3/A4: el servidor no tiene horarios exactos de nadie.

**Cuesta.** No se puede mostrar "abierto ahora" a partir de visitas; solo
"suelen encontrarlo abierto los domingos a la tarde". El dato útil queda menos
fino.

### P-14 · Envío diferido y publicación nocturna

**Decisión.** El cliente manda los aportes con un retraso aleatorio de 1 a 6
horas, en lote junto con la bóveda. El servidor publica una vez por noche lo que
llegó hasta el día anterior: todo aporte espera entre 24 y 48 h para ser
visible.

**Mitiga.** A2: "acaba de aparecer en la YPF de Piedra Buena" = su casa está
vacía. A3/A4: el momento del pedido HTTP no es el momento del registro (L2).
Ataques de diferencia sobre agregados en tiempo real.

**Cuesta.** Cero gratificación instantánea: registrás y no lo ves en el mapa.
Se compensa mostrando el aporte en tu propia vista con "se publica mañana". El
modo amigos tampoco es en vivo.

### P-15 · Sin texto libre público ni imágenes en v1

**Decisión.** Lo público son atributos estructurados (8 casilleros). Los
comentarios son privados. No hay subida de imágenes.

**Mitiga.** Moderación (una persona no puede moderar texto libre), difamación
de comercios o personas con nombre y apellido, doxxing ("en lo de Pérez de la
calle tal"), metadatos EXIF con ubicación.

**Cuesta.** Lo más divertido de una reseña es el texto. Sin texto, lo público es
seco; el humor queda en lo privado, el modo amigos y las tarjetas de logros.

### P-16 · Cero terceros en el navegador

**Decisión.** Tiles, fuentes, scripts y estilos servidos desde el propio
dominio. Sin analytics de terceros, sin CDN, sin píxeles. CSP
`default-src 'self'`.

**Mitiga.** A6: el proveedor de tiles es el más grave, porque en el momento de
registrar el mapa está centrado en el usuario, así que el pedido de tiles revela
su ubicación a un tercero junto con su IP. También reduce la superficie de L1.

**Cuesta.** Hay que generar y servir PMTiles propios (trabajo de pipeline y
ancho de banda del VPS). Sin analytics no sabés bien cómo se usa el producto.

### P-17 · k-anonimato por personas elegibles, en rangos

**Decisión.** Los contadores por lugar se muestran con ≥ 3 personas distintas;
el ranking de macrozonas, con ≥ 5; el contador de ciudad, con ≥ 10. Solo cuentan
cuentas con ≥ 14 días y aportes en ≥ 5 días distintos. Los valores se muestran
en rangos (3-9, 10-49, 50+). No hay condición sobre cantidad de registros
(DESIGN.md §7).

**Mitiga.** A1/A2 identificando a una persona en un lugar poco concurrido. A7:
cuentas falsas que bajan el k real a 1. Ataques de diferencia.

**Cuesta.** Los contadores tardan semanas en aparecer en una ciudad chica.
Lugares poco concurridos nunca muestran contadores. Los primeros usuarios no
"cuentan" durante dos semanas.

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

### P-19 · Sin logs que vinculen personas con momentos

**Decisión.** Sin log de acceso en `/api/*` y `/tiles/*`. En el resto, IP
truncada y 7 días. Sesiones sin IP ni user agent. Rate limit en memoria. Fechas
en las tablas con precisión de día salvo donde hace falta más (vencimientos).

**Mitiga.** A3/A4/A5: el log de acceso es donde los sistemas "anónimos" suelen
dejar todo lo que dicen no guardar.

**Cuesta.** Depurar incidentes es más difícil. Un abuso se investiga con menos
datos. El rate limit se reinicia si se reinicia el proceso.

### P-20 · Insignias públicas opt-in, sin fechas, y las de ruta solo completas

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

### P-22 · Rangos en el ranking de macrozonas

**Decisión.** El cliente manda la cantidad de registros del mes en rangos
(1-10, 11-20, 21-31, 31+), no el número exacto, y solo si dio el consentimiento
`publicar_zona`.

**Mitiga.** A3/A4: la frecuencia exacta por persona es lo más cercano a un dato
de salud que tendría el servidor.

**Cuesta.** El ranking es menos preciso (diferencias entre macrozonas
probablemente dentro del ruido). Para un ranking humorístico alcanza.

### P-23 · Mayoría de edad declarada (provisoria)

**Decisión.** v1 solo para mayores de 18, por declaración en el alta.

**Mitiga.** Tratamiento de datos de menores con ubicación, que es el escenario
legal y reputacional más feo posible para un proyecto así.

**Cuesta.** El público adolescente es probablemente el que más viraliza. Una
declaración no verifica nada. Está en discusión (Q-L3).

---

## Decisiones descartadas de la propuesta original

| Id | Propuesta | Por qué se descarta | Reemplazo |
|---|---|---|---|
| D-01 | Capa privada en claro en el servidor ("solo la ve el dueño"). | Protege en la interfaz, no en la base: A3, A4, A5 la ven entera. | P-01, P-03, P-04. |
| D-02 | Snap automático a POI < 40 m, publicación si hay POI. | Falla abierto con la casa pegada a un comercio y con GPS de interiores. | P-05, P-06. |
| D-03 | Jitter determinístico por usuario de 60-80 m. | Un desplazamiento constante se revierte con un solo punto conocido; el anillo de 60-80 m le dice al atacante dónde **no** buscar. | P-10. |
| D-04 | Heatmap H3 res 8 / geohash 6-7 con 5 registros de 3 usuarios. | Mide lo equivocado (§7.3 de DESIGN.md); la condición de registros no protege y apaga la mitad del mapa; geohash 7 es demasiado fino. | P-17 con unidades lugar / macrozona / ciudad. |
| D-05 | Zonas de exclusión y detección de domicilio en el servidor. | La tabla de zonas es la lista de domicilios; la detección es un modelo de domicilio por usuario. | P-07, P-08 en el cliente. |
| D-06 | Google OAuth. | Le da a Google la señal de uso; trae nombre y mail; no da nada que una passkey no dé. | P-11, P-12. |
| D-07 | Tiles de `tile.openstreetmap.org`. | Política de uso incompatible con un viral; filtra la ubicación del usuario a un tercero. | P-16. |
| D-08 | Franja horaria como único borroneo temporal. | Con fecha exacta y publicación en vivo sigue revelando presencia y ausencia. | P-13, P-14. |

---

## Correspondencia con la Ley 25.326

No es asesoramiento legal; es cómo el diseño intenta respetar la ley. Necesita
revisión de un abogado (Q-L1).

| Artículo | Qué exige | Cómo se atiende |
|---|---|---|
| Art. 2 | Define datos sensibles (incluye "información referente a la salud") y dato disociado. | P-02 (no se recolectan datos del cuerpo). Lo público se diseña para ser dato disociado (P-13, P-17). |
| Art. 4 | Datos adecuados, pertinentes y no excesivos; destruirlos cuando dejan de ser necesarios. | P-01, P-12, P-19, P-21, P-22. |
| Art. 5 | Consentimiento libre, expreso e informado, por escrito o medio equiparable. | P-09: consentimientos separados, versionados, con registro de fecha. |
| Art. 6 | Informar finalidad, destinatarios, derechos, responsable. | Política de privacidad en `docs/legal/` y textos de consentimiento en el momento de cada acción. |
| Art. 7 | Nadie puede ser obligado a dar datos sensibles; inc. 3 prohíbe formar bancos que directa o indirectamente revelen datos sensibles (con excepciones que no nos aplican). | El punto legal más delicado (Q-L1). Defensa: el operador no puede leer el historial (P-03, P-04), no hay datos fisiológicos (P-02), lo público es disociado. |
| Art. 9 | Medidas de seguridad. | DESIGN.md §11; P-03, P-19. |
| Art. 12 | Transferencia internacional solo a países con protección adecuada o con garantías. | Relevante para el proveedor de mail y el destino de backups (Q-L5). Los backups no contienen datos legibles de ubicación. |
| Art. 14 | Derecho de acceso, respuesta en 10 días corridos. | `GET /cuenta/exportar`, inmediato. |
| Art. 16 | Rectificación y supresión, en 5 días hábiles. | `DELETE /cuenta` y `DELETE /aportes/...`, inmediatos (P-18). |
| Art. 21 | Inscripción de bases de datos en el registro de la autoridad (AAIP). | A consultar (Q-L2). |
