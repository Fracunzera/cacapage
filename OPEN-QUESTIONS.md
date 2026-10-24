# OPEN-QUESTIONS.md — Lo que está sin resolver o es riesgoso

Cada ítem dice qué está abierto, por qué importa y qué lo resolvería.
Gravedad estimada: **🔴 bloquea el lanzamiento**, **🟠 hay que decidirlo antes de
implementar esa parte**, **🟡 se puede decidir más adelante**, **⏳ pendiente con
fecha o con dueño**. **(i2)**/**(i3)** marcan lo nuevo o modificado en cada
iteración; **✅** lo resuelto.

---

## Pendientes con dueño (i3)

Decisiones o datos que **no** salen del diseño, sino del responsable del
producto:

| Pregunta | Qué falta | Dueño |
|---|---|---|
| **Q-O7** | Confirmar si hay recorrida cada 4 meses, según disponibilidad real. El diseño asume que no (DESIGN.md §10). | Responsable del producto |
| **Q-D5** | Preguntar en la Municipalidad si hay baños públicos municipales (ubicación, horario, si cobran). Llevar la propuesta de "Baño amigo". | Responsable del producto |
| **Q-N4** | Registrar el dominio definitivo (~10 días). | Responsable del producto |
| **Q-L1, Q-L6** | Consulta con un abogado: Ley 25.326 art. 7 y licencia de la base (ADR 0002). | Responsable del producto |

## Producto y arranque en frío

**Q-N1 🔴 (i2) · ¿Hay masa crítica para que la capa de baños se mueva sola?**
Sin agregados de eventos, el arranque en frío ya no es "el heatmap está vacío";
es "¿alguien además del equipo confirma probables y corrige horarios?". Con 20
usuarios y ~4 registros publicables cada tres meses por persona, el puente
generaría del orden de 80 observaciones por trimestre para ~60 baños.
*Lo resuelve:* medir en el piloto la tasa real de respuesta del puente y cuántos
probables se confirman por mes. Definir de antemano qué número justifica seguir.

**Q-N2 🔴 · ¿El chiste retiene, retiene la capa útil, o ninguno?**
Sin cambios. La crítica de la iteración 1 sostiene que el vecino de Río Gallegos
ya sabe dónde hay baño y que la capa útil sirve sobre todo a quien está de paso,
que no aporta.
*Lo resuelve:* el mismo número de Q-N1, más las visitas sin cuenta a fichas de
baños que llegan desde buscadores.

**Q-N3 🟠 (i2) · Una sola marca para el chiste y para el dato útil.**
Decidido: una sola web con toggle. Riesgo que queda: quien busca un cambiador o
un baño accesible llega por Google a una ficha de un sitio llamado "dónde
cagaste". Mitigación posible: las fichas `/b/{slug}` con tono sobrio y el chiste
solo en la capa de registros.
*Lo resuelve:* decidir el tono de las fichas públicas antes de diseñarlas.

**Q-N4 ⏳ (i3) · Nombre y dominio definitivos, antes de la primera passkey.**
Bajó de bloqueante a pendiente con fecha: el dominio definitivo se registra en
unos 10 días (estimado: principios de noviembre de 2026). Mientras tanto se usa
`caca.blucaro.site` como entorno de prueba sin passkeys (DESIGN.md §15). Lo único
que sigue dependiendo del dominio definitivo es la primera passkey, y por eso la
app nativa (Digital Asset Links, Universal Links). Nada más se bloquea.

**Q-N5 🟠 · ¿Qué pasa cuando un comercio se queja?**
**(i3)** "Baño amigo" (Q-N11) y la regla asimétrica (P-32) son respuestas
parciales.
**(i2)** Ahora con más superficie: "evitalo" en el estado reciente de un baño con
nombre de comercio, indexado por Google. El dueño puede además editar el wiki de
su propio local (Q-W2).
*Lo resuelve:* política escrita antes del lanzamiento.

**Q-N6 🟡 · ¿Reportar requiere haber estado ahí?**
**(i2)** El puente sí exige un registro, pero el registro se confirma en el
cliente y se puede trampear. Las ediciones del wiki no exigen nada.
*Lo resuelve:* aceptar que no se verifica; confiar en las 2 cuentas elegibles,
el rate limit y la reversión.

**Q-N7 🟡 · Seudónimos ofensivos o que identifican.**
Sin cambios.

**Q-N8 🟠 (i2) · ¿Se puede registrar sin cuenta?**
El diseño dice que registrar requiere login para sincronizar, pero el pipeline
funciona offline sin cuenta. Dejar registrar sin cuenta baja muchísimo la
fricción del primer uso (llegaste por un chiste, registrás ya), con el costo de
que ese historial se pierde si se borra el navegador y de que el puente necesita
cuenta.
*Lo resuelve:* decidir si el primer registro puede ser anónimo y local, con la
cuenta pedida al segundo o tercero.

**Q-N9 🟠 (i2) · Ligas entre amigos.**
La crítica de la iteración 1 señaló que lo que sostuvo a Poop Map después del
viral fueron las ligas y los rankings entre amigos, y que este diseño no los
tiene. Son compatibles con toda la arquitectura de privacidad si son privadas
al grupo, con conteos calculados... en algún lado: el servidor no tiene los
registros. O cada cliente le publica a sus amigos un contador semanal en rangos,
o la liga es solo de logros.
*Lo resuelve:* decidir si entra en v1. Es probablemente lo que más retención
compra por unidad de trabajo.

**Q-N10 🟡 (i2) · ¿Qué capa muestra el toggle por defecto?**
El diseño propone "Baños públicos" sin sesión y "Mis registros" con sesión. Con
60 baños mayoritariamente "sin confirmar", la primera impresión de quien llega
sin cuenta es un mapa de promesas.

## Wiki de baños

**Q-W1 🟠 (i2) · ¿"Sin login" quería decir también editar sin login?**
El pedido decía "Público, sin login, indexable por Google" y "lo editan muchos
usuarios". El diseño lo interpretó como **leer** sin login y **editar** con
cuenta (P-25, D-11). Si la intención era editar sin cuenta: no estoy de acuerdo,
porque sin cuenta la única defensa contra vandalismo es guardar IPs.
*Lo resuelve:* confirmar la interpretación.

**Q-W2 🟠 (i2) · El dueño del comercio edita su propio baño.**
Va a pasar: el encargado de la estación pone "accesible: sí, cambiador: sí" sin
que sea cierto, o borra lo que no le gusta. Un wiki sin moderación activa no lo
detecta.
*Lo resuelve:* un rol de "responsable del lugar" verificado, o ninguno y
confiar en la confirmación por dos personas.

**Q-W3 🟡 (i2) · Indicaciones en texto libre.**
"Pedir la llave en caja", "entrar por el costado" son datos útiles que no entran
en un enum. P-15 dice sin texto libre público.
*Lo resuelve:* una lista cerrada de indicaciones frecuentes, ampliable a mano.

**Q-W4 🟡 (i2) · Vandalismo con una sola persona moderando.**
Revertir es fácil (historial); detectarlo, no. Con ~60 baños, la revisión
semanal del historial es viable. Con 600, no.

## Privacidad

**Q-P1 🟠 · El onboarding de "marcá tu casa" ¿mata la conversión?**
Sin cambios; Q-N8 lo agrava o lo alivia según qué se decida.

**Q-P2 🟠 · ¿200 m alcanza en Río Gallegos?**
**(i2)** Con la precisión mínima de 50 m, el radio efectivo es ~250 m.

**Q-P3 🟡 (i2) · El operador ve "cuenta X observó el baño Y en la semana Z".**
Bajó de gravedad: las observaciones pierden el autor a los 90 días (P-24) y ya
no hay tabla de visitas. Queda: las ediciones del wiki conservan `cuenta_id`
para siempre (para revertir vandalismo) y los ítems del feed de amigos durante
30 días.
*Opción a evaluar:* borrar `cuenta_id` de las ediciones del wiki después de un
año.

**Q-P4 ✅ (i2) · Modo amigos con día exacto.**
Resuelto en P-10: los viajes llegan a los amigos recién a la vuelta, por
default. Queda abierto si el default es demasiado conservador para el chiste.

**Q-P5 🟡 · Las insignias no se pueden verificar.**
Sin cambios.

**Q-P6 🟡 · Ataques combinando superficies.**
**(i2)** Hecho una vez en la crítica de la iteración 1 (caminos A-D); las
correcciones están en PRIVACY.md. Hay que repetirlo con este diseño antes del
lanzamiento, en particular sobre P-25 (historial del wiki) y Q-P8.

**Q-P7 🟡 · ¿Privacidad diferencial?**
Sin agregados de eventos en v1, no aplica todavía.

**Q-P8 🟠 (i2) · Las ediciones del wiki se aplican en el momento.**
El puente espera 24 h; las ediciones del wiki no (un wiki con demora es
frustrante). Si Lu le cuenta a un amigo "le corregí el horario a la YPF de la
ruta", y el amigo mira el historial, sabe que Lu estuvo por ahí, aunque el
historial muestre solo el mes. Y la ficha cambia en el momento: quien la mira
seguido ve cuándo cambió.
*Opciones:* aplicar las ediciones también en el lote nocturno; o aceptar que una
edición del wiki es un acto público y decirlo en la interfaz.

**Q-P9 ✅ (i3) · Estado reciente con una sola observación.**
Resuelto por atribución (P-17): "1 persona, esta semana: limpio". Lo que sigue
abierto es solo la privacidad de quien aportó, ya inventariada en el invariante
de superficies. Texto original:
Mostrar "1 reporte esta semana: evitalo" dice que alguien usó ese baño esa
semana. Sin autor y con demora es poco, pero para un comercio chico con pocos
clientes puede apuntar a alguien (A8). Con un mínimo de 2, en el arranque casi
ningún baño mostraría estado.

## Legal

**Q-L1 🔴 · ¿Es un banco de datos que revela datos sensibles? (art. 7 inc. 3)**
Sin cambios. Sigue siendo la pregunta legal más importante.

**Q-L2 🟠 · Inscripción en el registro de la AAIP (art. 21).**
Sin cambios.

**Q-L3 🟠 · Edad mínima.**
Sin cambios. **(i2)** Google Play pide declarar el público objetivo; si incluye
menores, aplica la política de familias.

**Q-L4 🟡 · ¿Quién es el responsable del tratamiento?**
**(i2)** Pesa también para Google Play: una cuenta de organización evita el
requisito de 12 testers, pero exige una entidad registrada.

**Q-L5 🟠 · Transferencia internacional (art. 12).**
**(i2)** Se suman los servicios de push (FCM en Android): el endpoint de cada
suscripción es un identificador del dispositivo ante Google.

**Q-L6 🔴 (i3) · ODbL: ¿derivada o colectiva?**
Pasó a [ADR 0002](docs/adr/0002-licencia-base-derivada-vs-colectiva.md), con tres
arquitecturas y siete preguntas concretas para un abogado. Mientras tanto, el
esquema preserva las tres opciones. Bloquea el lanzamiento porque define bajo qué
licencia se publica `banios-propio.json` desde el primer día. Texto de la
iteración 2:

**(i2) ODbL: la importación de una vía no evita el share-alike.**
Subió de gravedad. Que no escribamos en OSM resuelve "no ensuciar OSM", pero
mezclar datos de OSM con correcciones de usuarios en la misma tabla de baños y
mostrarla en público la convierte muy probablemente en una base de datos
derivada, que hay que ofrecer bajo ODbL. La salida que propone el diseño
(DESIGN.md §10.7): los aportes al wiki se licencian bajo ODbL en los términos
de uso. Además está la regla inversa: si se devuelve algo a OSM, tiene que
cumplir con las guías de ediciones organizadas de OSM.
*Lo resuelve:* confirmarlo con la guía de bases de datos colectivas y derivadas
de la OSMF, y fijar la licencia de los aportes antes del primer usuario.

**Q-L7 🟡 · Licencia del código.**
Sin cambios.

**Q-L8 🟠 (i2) · Formulario de seguridad de datos de Google Play.**
Al publicar la app nativa hay que declarar qué datos se recolectan. Ubicación
precisa: sí (aunque no salga del dispositivo, la app la usa; hay que ver cómo
se declara el procesamiento solo local). ¿Salud? Google tiene categorías de
"salud y fitness"; un registro de cuándo vas al baño puede caer ahí según cómo se
lea.
*Lo resuelve:* leer las definiciones actuales del formulario antes de armar la
prueba cerrada.

## Técnicas

**Q-T1 🟠 · Soporte de passkeys con PRF en la población real.**
Sin cambios.

**Q-T2 🔴 · Desalojo del almacenamiento en iOS/Safari.**
**(i2)** La PWA instalada en la pantalla de inicio y, más adelante, la app nativa
lo mitigan. Sigue bloqueando el lanzamiento mientras no se verifique el
comportamiento actual y no se exija al menos una forma de recuperación.

**Q-T3 🟠 · Precisión real del GPS del navegador en Río Gallegos.**
**(i2)** Con la precisión mínima de 50 m (P-07) el riesgo de seguridad baja; el
de usabilidad (candidatos equivocados) sigue.

**Q-T4 🟡 · Conflictos de sincronización.** Sin cambios.

**Q-T5 🟡 · Peso de MapLibre.** Sin cambios.

**Q-T6 🟡 · Background Sync no es confiable.**
**(i2)** Por R5 la cola la maneja la app, no el service worker: la dependencia de
Background Sync baja.

**Q-T7 🟠 (i2) · Passkeys con PRF dentro del WebView de Capacitor.**
El WebView de Android soporta Credential Manager desde `androidx.webkit` 1.12
con configuración y Digital Asset Links, y hay plugins de Capacitor que hacen de
puente. Hay reportes de que sin esa configuración `PublicKeyCredential` no
existe. **No encontré confirmación de que la extensión PRF pase por ese camino.**
Si no pasa, en la app nativa la bóveda depende del código de recuperación o de
guardar la llave en el Keystore/Keychain (que es razonable en nativo).
*Lo resuelve:* un prototipo de una tarde con Capacitor + plugin de passkeys +
PRF, antes de prometer "empaquetar sin rehacer".

**Q-T8 🟡 (i2) · Fiabilidad de Overpass.**
En la medición de SEEDING.md, de cuatro servidores públicos solo respondió uno, y
con 504 en la mitad de los intentos. Para producción, el diseño usa extractos de
Geofabrik (§10.1). Overpass queda para exploración.

**Q-T9 🟡 (i2) · Push en iOS.**
Solo funciona con la PWA instalada. En Argentina iOS es minoría, pero no cero, y
sin push el usuario de iPhone no tiene recordatorios ni avisos de amigos.

## Datos

**Q-D1 ✅ (i2) · ¿Qué hay hoy en OSM para Río Gallegos?**
Medido (SEEDING.md): 5 `amenity=toilets`, todos en estaciones de servicio, sin
ningún atributo útil; 0 objetos con `toilets=*`; 73 candidatos en categorías
probables, 7 % con horario.

**Q-D2 🟡 (i2) · Macrozonas.** Sin ranking en v1; queda para después.

**Q-D3 🟡 · La lista de "YPF de la Ruta 3".**
**(i2)** En el bbox de Río Gallegos hay 8 YPF mapeadas; no todas están sobre la
RN3.

**Q-D4 🟡 · Los atributos envejecen.**
**(i2)** Resuelto para limpieza y papel (son observaciones que vencen, P-27).
Sigue abierto para horario y "cobra": un horario de 2026 puede ser falso en 2028.

**Q-D5 ⏳ (i3) · ¿Existen baños públicos municipales en Río Gallegos?**
**Lo averigua el responsable del producto en la Municipalidad.** Si no hay
ninguno, la capa útil pasa a ser "comercios que te dejan pasar al baño": cambia
el texto de la web, no el modelo de datos. Llevar a esa reunión la propuesta de
"Baño amigo" con respaldo municipal (DESIGN.md §18.6). Texto de la iteración 2:
OSM no tiene ninguno. Si no existen, el producto es un mapa de "baños de lugares
públicos" (estaciones, bares, supermercados), con todo lo que eso implica:
dependen de la buena voluntad del comercio y de si consumís. Si existen y nadie
los mapeó, son el dato más valioso que se puede sembrar.
*Lo resuelve:* recorrida y consulta a la Municipalidad.

**Q-D6 🟠 (i2) · OSM está muy incompleto en gastronomía.**
30 locales gastronómicos para una ciudad de 110 mil es una fracción chica de lo
real. El sembrado desde OSM refleja lo que alguien mapeó, no lo que existe.
*Lo resuelve:* aceptar que la base crece por propuestas de usuarios (P-28) y por
la recorrida; no intentar completar el rubro antes del lanzamiento.

**Q-D7 🟡 (i2) · ¿El horario de la estación es el horario del baño?**
**(i3)** La contradicción detectada en el cliente (DESIGN.md §7.3, caso 1) lo
corrige solo cuando alguien está ahí a una hora que el horario dice cerrada.
El diseño toma el horario de la estación para su baño. Una YPF 24 h puede cerrar
el baño de noche o pedir la llave en caja.

## Operación

**Q-O1 🟠 · Bus factor de uno.** Sin cambios.

**Q-O2 🟠 · Seguridad del VPS.** Sin cambios.

**Q-O3 🟡 · Moderación por una persona.** **(i2)** Ver Q-W4.

**Q-O4 🟡 · Un viral de verdad.** Sin cambios.

**Q-O5 🟠 (i2) · La recorrida de sembrado es el cuello de botella real.**
Dos o tres días para 30 baños en Río Gallegos (SEEDING.md §5). Cada ciudad nueva
repite el trabajo. El modelo no escala por código sino por gente dispuesta a
caminar.
*Lo resuelve:* aceptar que la expansión es ciudad por ciudad con alguien local, o
encontrar socios (la Municipalidad, una ONG de accesibilidad) que aporten la
recorrida.

**Q-O6 🟡 (i2) · Conseguir 15-20 testers para Google Play.**
Hacen falta 12 inscriptos durante 14 días seguidos, y si uno se da de baja el
reloj puede reiniciarse. Con 20 usuarios activos en la PWA, eso es casi todos.

## Iteración 3: nuevas

**Q-O7 ⏳ (i3) · ¿Hay recorrida periódica cada 4 meses?**
Pendiente del responsable del producto, según su disponibilidad real. El diseño
asume que **no** la hay (DESIGN.md §10): degrada solo, y si se confirma, suma
(§10.7).

**Q-L9 🟠 (i3) · Usar la lista de OSM como hoja de ruta de la recorrida.**
Aunque cada dato se levante con GPS en la calle, elegir qué lugares visitar a
partir de OSM puede leerse como derivación (ADR 0002, arquitectura C', pregunta
4). Mitigación: la recorrida también releva lugares que no están en OSM y datos
que OSM no tiene.

**Q-L10 🟡 (i3) · ¿Qué protege de verdad a la base frente a una copia?**
Con cualquier arquitectura, los hechos (un horario, si cobra) se pueden copiar
leyendo las fichas públicas. En Argentina no hay un derecho específico sobre
bases de datos como el europeo. La protección real son los términos de uso y
medidas técnicas (ADR 0002, pregunta 7).

**Q-N11 🟠 (i3) · "Baño amigo": ¿se adopta?**
Evaluado en DESIGN.md §18, sin adoptar. Precedentes: los que funcionan
(Alemania, Reino Unido) están pagados por el municipio; uno sin incentivo
(Brighton) llegó a 19 comercios. Necesita submarca sobria (Q-N3), verificación
de comercios y renovación anual. Decisión ligada a Q-D5.

**Q-N12 ✅ (i3) · Regla asimétrica de exposición de comercios (P-32).**
Adoptada para v1. Queda abierto medir cuánto valor útil se pierde: cuántos
comercios no adheridos tienen reportes de "me dejaron pasar sin consumir" que no
se muestran.

**Q-N13 🟡 (i3) · Medallas: ritmo.**
✅ Resuelto lo de la primera recompensa: el primer registro da el logro
"Bautismo de Porcelana" (DESIGN.md §17.2).
Sigue abierto: una medalla cada 5 registros, sin fin, puede inflarse. Con un
registro por día son ~73 por año, y después de la 40 (200 registros) los nombres
pasan a ser "Inmortalidad Sanitaria, nivel N". *Opción:* espaciarlas después de
las 40 con nombre (cada 10 o cada 25). Medir en el piloto si alguien llega a 200.

**Q-P10 🟡 (i3) · La tercera pregunta en contradicción de horario revela tipo de día y franja.**
Es la única respuesta pública que dice "alguien estuvo acá un domingo a la
noche de la semana X" (P-13). Si en el piloto aporta poco, se saca.

**Q-W5 🟡 (i3) · Calidad de "Sigue igual" y de la tercera pregunta.**
Tocar "Sí" sin saber es fácil. "No sé" tiene el mismo peso visual que las otras
opciones para reducirlo, pero no hay forma de medir cuánto pasa salvo por
contradicciones posteriores.

**Q-T10 ⏳ (i3) · Verificar el dato de OSM contra los servidores oficiales.**
Pendiente: `overpass-api.de` y `overpass.kumi.systems` no respondieron desde el
entorno de trabajo en ninguno de los intentos del 24/10/2026 (SEEDING.md §1.1).
Si al reintentar el resultado no es 5 baños con los mismos ids, se avisa antes
de seguir. Alternativa más rápida: correr la consulta desde otra máquina.

**Q-D8 🟡 (i3) · La antigüedad de los datos de OSM.**
La frescura de un dato de OSM se calcula con `check_date` o, si no hay, con la
última modificación del objeto. Esa fecha dice cuándo alguien tocó el objeto,
no cuándo verificó el horario: puede sobreestimar la frescura.

**Q-N14 🟡 (i3) · ¿Compartir una anécdota?**
Las anécdotas de la caja "¿Alguna anécdota?" son privadas (P-34). Si la gente las
quiere compartir, la opción que no aloja nada en el servidor es un botón
"Compartir" que abre el menú nativo del celular (WhatsApp, etc.) con el texto y
un link al sitio: lo comparte el usuario, desde su teléfono, y nada queda
publicado en nuestro servidor, así que no hay nada que moderar. Lo que **no**
conviene es un muro público de anécdotas en el sitio (texto libre público,
P-15). Sin decidir: no está en v1.
