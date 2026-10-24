# OPEN-QUESTIONS.md — Lo que está sin resolver o es riesgoso

Cada ítem dice qué está abierto, por qué importa y qué lo resolvería. La
gravedad es mi estimación: **🔴 bloquea el lanzamiento**, **🟠 hay que decidirlo
antes de implementar esa parte**, **🟡 se puede decidir más adelante**.

---

## Producto y arranque en frío

**Q-N1 🔴 · ¿Hay masa crítica para que lo público tenga algo?**
La simulación de DESIGN.md §7.2 dice que con 20-50 usuarios activos los
contadores solo aparecen en el centro y en un puñado de lugares, y que hacen
falta ~150 activos sostenidos para cubrir la ciudad. Sumado a P-09 (privado por
defecto) y P-17 (elegibilidad de 14 días), lo público va a tardar. El mapa de
baños no depende de eso, pero el chiste público sí.
*Lo resuelve:* decidir si se acepta que en el primer trimestre lo público sea
casi solo el mapa de baños, y medir en el piloto la fracción real de registros
publicables (el modelo supone 15 %, puede ser 5 % o 30 %).

**Q-N2 🔴 · ¿El chiste retiene, o retiene la capa útil, o ninguno?**
El precedente llegó al #1 por un viral; no está claro cuánta gente siguió
usándolo. La hipótesis de este proyecto es que la capa útil retiene, pero la
gente que busca "baño abierto el domingo" no es necesariamente la que registra.
*Lo resuelve:* definir antes del lanzamiento qué número mira el piloto (p. ej.
visitas al mapa de baños de gente sin cuenta, o registros por usuario en la
semana 4) y cuánto tiene que dar para seguir.

**Q-N3 🟠 · ¿Una marca humorística le sirve a la capa útil?**
Una madre buscando un cambiador o una persona en silla de ruedas buscando un baño
accesible puede no querer usar algo que se llama "dónde cagaste". Quizás el mapa
de baños necesite una entrada propia, más sobria, sobre los mismos datos.
*Lo resuelve:* decidir si hay dos puertas (dos rutas o dos dominios) a los mismos
datos.

**Q-N4 🟡 · Nombre definitivo y dominio.**
`cacapage` es nombre de trabajo. El nombre condiciona si los comercios aceptan
aparecer y si los medios locales lo levantan.

**Q-N5 🟠 · ¿Qué pasa cuando un comercio se queja?**
Una estación de servicio o un bar puede no querer aparecer como "baño
asqueroso". No hay texto libre (P-15), pero `limpieza = 1` es una opinión
pública sobre un negocio con nombre.
*Lo resuelve:* política escrita de qué se hace ante un reclamo (¿se oculta el
atributo? ¿se permite respuesta del comercio? ¿nada?).

**Q-N6 🟡 · ¿Reportar requiere haber estado ahí?**
Verificar presencia requiere que el servidor vea la ubicación, que es justo lo
que P-01 prohíbe. Sin verificación, alguien puede reportar desde su casa sobre
cualquier lugar.
*Lo resuelve:* aceptar que no se verifica y confiar en consenso (2 personas) +
rate limit + elegibilidad; o hacer una verificación en el cliente sabiendo que se
puede trampear.

**Q-N7 🟡 · Pseudónimos ofensivos o que identifican.**
"juanperez_barrio_x" anula el seudonimato por elección del propio usuario.
*Lo resuelve:* lista de palabras reservadas, advertencia al elegir, denuncias.

## Privacidad

**Q-P1 🟠 · El onboarding de "marcá tu casa" ¿mata la conversión?**
P-08 bloquea publicar hasta resolver la casa. Es lo más protector y lo más
friccionante del diseño, y pega justo en el primer uso.
*Lo resuelve:* prototipo y prueba con 5-10 personas reales de Río Gallegos antes
de implementar.

**Q-P2 🟠 · ¿200 m alcanza en Río Gallegos? ¿Sobra?**
En baja densidad, 200 m esconden la casa entre un par de cientos de viviendas;
en un barrio con pocas cuadras y mucho descampado pueden ser bastantes menos.
Al revés, en el centro se come lugares públicos útiles.
*Lo resuelve:* radio adaptativo según densidad de edificaciones de OSM alrededor
del punto (calculado en el cliente), con mínimo de 200 m.

**Q-P3 🟠 · El operador ve "cuenta X aportó al lugar Y en la semana Z".**
Es la limitación L3 de DESIGN.md §2. Con eso, alguien con un dump puede armar el
recorrido semanal por lugares públicos de una cuenta seudónima. No ubica la casa
(no hay aportes en casa salvo el rango mensual por macrozona), pero sí patrones
de viaje.
*Opciones:* (a) aceptarlo; (b) borrar `cuenta_id` de los aportes después de
publicarlos y guardar solo un contador por cuenta para la elegibilidad, a costa
de no poder borrar aportes viejos individualmente ni recalcular k exacto;
(c) tokens anónimos por aporte (credenciales tipo Privacy Pass), mucho más
complejo. Mi inclinación: (b) para aportes con más de 90 días.

**Q-P4 🟠 · ¿Modo amigos con día exacto y sin retraso nocturno?**
Entre amigos el chiste es "hoy", pero el día exacto le dice a un amigo (o a un
ex que todavía figura como amigo) que estás de viaje. El diseño actual: día +
franja, con el mismo envío diferido de 1-6 h, sin espera nocturna.
*Lo resuelve:* decidir el default. Alternativa: "contar a amigos" con opción
"después de volver" (se manda cuando el usuario vuelve a registrar en casa).

**Q-P5 🟡 · Las insignias no se pueden verificar.**
Como el servidor no tiene el historial, una insignia pública es lo que el
cliente dice. Cualquiera puede mostrar "Conquistador de la Ruta 3" sin haber
salido de casa.
*Lo resuelve:* aceptarlo (es un chiste) o validar contra aportes públicos (lo
que obligaría a publicar para tener insignias, contrario a P-09).

**Q-P6 🟡 · Ataques combinando superficies.**
Ranking de macrozonas + contadores por lugar + feed de amigos + insignias: cada
uno es seguro por separado; combinados, para una cuenta con amigos que la
conocen, pueden decir más. No está analizado formalmente.
*Lo resuelve:* un ejercicio de ataque concreto ("soy el ex, tengo su seudónimo,
¿qué averiguo?") antes de lanzar.

**Q-P7 🟡 · ¿Privacidad diferencial en vez de k-anonimato?**
Para los contadores de ciudad y macrozona, sumar ruido de Laplace es más sólido
que k-anonimato contra ataques de diferencia. Con números tan chicos, el ruido
puede volver inútil el ranking.
*Lo resuelve:* probarlo cuando haya datos reales; no para v1.

## Legal

**Q-L1 🔴 · ¿Esto es un "banco de datos que revela datos sensibles"? (art. 7 inc. 3, Ley 25.326)**
El art. 7 inc. 3 prohíbe formar archivos que directa o indirectamente revelen
datos sensibles, y la salud es dato sensible. Un historial de cuándo y dónde
cagás, con frecuencia, puede leerse como información de salud indirecta. El
diseño se defiende con P-02 (nada fisiológico), P-03/P-04 (el operador no puede
leer el historial ni su frecuencia) y P-22 (rangos), pero que eso alcance es una
interpretación, no un hecho.
*Lo resuelve:* consulta con un abogado de datos personales antes del
lanzamiento. Es la pregunta legal más importante del proyecto.

**Q-L2 🟠 · ¿Hay que inscribir la base en el Registro Nacional de Bases de Datos (AAIP)?**
El art. 21 exige inscripción para ciertos bancos de datos privados. No tengo
claro si un proyecto personal sin fines de lucro, con estos datos, está
alcanzado.
*Lo resuelve:* la misma consulta que Q-L1.

**Q-L3 🟠 · Edad mínima.**
P-23 pone 18+ por declaración. Excluye al público que más viraliza y no verifica
nada. Bajar a 13 o 16 implica tratar datos de ubicación de menores, con el
consentimiento de quién.
*Lo resuelve:* decisión explícita, idealmente con la consulta legal.

**Q-L4 🟡 · ¿Quién es el responsable del tratamiento?**
Una persona física operando un VPS es responsable en los términos de la ley,
con su nombre y domicilio en la política de privacidad. Eso expone al operador
(que es justamente lo que el proyecto protege para los usuarios).
*Lo resuelve:* decidir si se opera como persona, como asociación o como algo
más.

**Q-L5 🟠 · Proveedor de mail y destino de backups: transferencia internacional (art. 12).**
Un proveedor de mail transaccional con servidores en EE. UU. recibe las
direcciones de quien usa magic link. EE. UU. no figura entre los países con
protección adecuada para la AAIP, así que hace falta otra base legal
(cláusulas contractuales o consentimiento). Lo mismo para backups si van a otro
país (aunque estén cifrados).
*Lo resuelve:* elegir proveedores con cláusulas tipo, o eliminar el magic link
si las passkeys alcanzan (ver Q-T1).

**Q-L6 🟡 · ODbL: combinar datos de OSM con aportes de usuarios.**
Si el mapa público combina el catálogo de OSM con los atributos de los usuarios,
puede ser una "base de datos derivada" con obligación de compartirla bajo ODbL.
Mantenerlas como bases separadas vinculadas por id podría ser una "base de datos
colectiva". Además está la oportunidad inversa: devolver a OSM los atributos
confirmados (`toilets:wheelchair`, `fee`, `changing_table`), que requiere que los
términos de aporte sean compatibles con ODbL.
*Lo resuelve:* decidir la licencia de los aportes de usuarios desde el día uno;
cambiarla después es casi imposible.

**Q-L7 🟡 · Licencia del código.**
Código abierto ayuda con L1 (se puede auditar qué JS se sirve). AGPL obliga a
quien lo despliegue a publicar cambios; MIT no. Sin decidir.

## Técnicas

**Q-T1 🟠 · ¿Cuánta gente en Río Gallegos puede usar passkeys con PRF?**
PRF está en Chrome para Android con el gestor de contraseñas de Google y en
Safari moderno, pero el soporte depende del autenticador y de la versión.
Celulares Android viejos son comunes. Sin PRF, la bóveda depende del código de
recuperación.
*Lo resuelve:* medir en el piloto (`credenciales_passkey.soporta_prf`) y tener el
código de recuperación como camino de primera clase, no como plan B escondido.

**Q-T2 🔴 · Desalojo del almacenamiento local en iOS/Safari.**
Safari puede borrar el almacenamiento de un sitio después de 7 días sin
interacción si no está agregado a la pantalla de inicio. En Chrome existe
`navigator.storage.persist()`; en Safari el comportamiento depende de la versión
y no lo tengo verificado. Sin PRF ni código de recuperación, eso es pérdida de
historial.
*Lo resuelve:* verificar el comportamiento actual de Safari; empujar el "agregar
a inicio" en iOS; no dejar terminar el alta sin al menos una forma de
recuperación.

**Q-T3 🟠 · Precisión real del GPS del navegador en Río Gallegos.**
Toda la lógica de candidatos y zonas usa `coords.accuracy`. La precisión por
wifi depende de la cobertura de las bases de ubicación en la ciudad, que no
conozco. Adentro de un edificio, los errores pueden ser de cientos de metros.
*Lo resuelve:* una semana de pruebas de campo con dos o tres celulares en los
lugares de la whitelist.

**Q-T4 🟡 · Conflictos de sincronización entre dispositivos.**
Con páginas mensuales cifradas, dos dispositivos que editan el mismo mes chocan.
La mezcla es en el cliente (registros con id propio y `actualizado_en`), pero
borrados concurrentes necesitan lápidas.
*Lo resuelve:* diseño detallado de la mezcla antes de implementar `vault`.

**Q-T5 🟡 · Peso de MapLibre en celulares baratos.**
MapLibre es bastante más pesado que Leaflet. Si el piloto muestra que la carga es
lenta, cambiar a Leaflet + protomaps-leaflet sobre los mismos PMTiles.

**Q-T6 🟡 · Background Sync no es confiable.**
El envío diferido (P-14) depende de que el usuario vuelva a abrir la página.
Alguien que registra una vez y no vuelve nunca manda nada. Es aceptable (lo
privado igual está en el dispositivo), pero conviene saberlo.

## Datos

**Q-D1 🔴 · ¿Qué hay hoy en OSM para Río Gallegos?**
No lo medí: intenté consultar Overpass desde el entorno de trabajo y no
respondió. Hay que saber cuántos `amenity=toilets`, `toilets=yes` y lugares de
la whitelist hay, y qué tan completos están `opening_hours`, `fee` y
`wheelchair`. Mi expectativa (sin verificar) es que los baños públicos explícitos
sean muy pocos y que las estaciones de servicio estén bastante completas. Esto
define cuánto hay que sembrar a mano y el tamaño real del bundle.
*Lo resuelve:* una consulta a Overpass o un recorte del extracto de Geofabrik.
Es lo primero que hay que hacer.

**Q-D2 🟠 · Macrozonas: ¿quién las dibuja y con qué fuente?**
El ranking necesita ~8-10 zonas con nombres que la gente reconozca. Los límites
de barrios en OSM para Río Gallegos pueden no existir o estar incompletos.
*Lo resuelve:* dibujarlas a mano con alguien de la ciudad, basadas en los
barrios municipales si hay datos abiertos.

**Q-D3 🟡 · La lista de "YPF de la Ruta 3".**
¿Cuáles cuentan? ¿Todas las de la RN3 de Buenos Aires a Ushuaia (unas cuantas
decenas) o solo las de Santa Cruz? Hay estaciones cerradas, duplicadas o sin
marca en OSM.
*Lo resuelve:* lista curada en `data/curated/logros.json`, empezando por el
tramo santacruceño.

**Q-D4 🟡 · Los atributos envejecen.**
Un baño que "cobra" o "está limpio" puede cambiar en un mes. El diseño muestra
`ultima_semana` y vuelve a `sin_confirmar` después de 90 días sin reportes, pero
en una ciudad chica muchos lugares van a quedar siempre sin confirmar.

## Operación

**Q-O1 🟠 · Bus factor de uno.**
Si el operador se cansa o desaparece, ¿qué pasa con los datos? Una bóveda que
nadie más puede leer es buena para privacidad, pero la capa pública y el VPS
necesitan un plan de cierre.
*Lo resuelve:* política de cierre escrita: aviso, período de exportación,
borrado total.

**Q-O2 🟠 · Seguridad del VPS autogestionado.**
Las decisiones de privacidad suponen un servidor razonablemente mantenido. Un
Postgres sin parches o un SSH con contraseña anulan buena parte del diseño
(sobre todo L1: un atacante con el servidor puede servir JS que robe llaves).
*Lo resuelve:* checklist mínima (actualizaciones automáticas, SSH solo con llave,
firewall, Postgres sin exponer) antes de lanzar.

**Q-O3 🟡 · Moderación por una persona.**
Sin texto libre ni imágenes, lo moderable son seudónimos y reportes falsos. Si
el piloto crece, igual puede ser más de lo que una persona atiende.

**Q-O4 🟡 · Un viral de verdad.**
Si sale en un medio nacional, el VPS recibe tráfico de todo el país sobre un
mapa que solo tiene Río Gallegos. Estáticos y PMTiles aguantan bien detrás de
caché; la experiencia para alguien de Córdoba es un mapa vacío.
*Lo resuelve:* una página de "todavía no llegamos a tu ciudad" que capture
interés sin pedir datos.
