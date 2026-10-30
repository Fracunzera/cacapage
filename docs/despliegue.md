# Despliegue en el VPS

Un solo `docker compose` levanta todo:

| Servicio | Dominio | Qué es |
|---|---|---|
| `web` | `ORIGEN_PUBLICO` (`https://dondecague.com.ar`) | El sitio real (`ENTORNO=produccion`): cuentas con passkey, sin relevamiento. |
| `web-prueba` | `ORIGEN_PRUEBA` (`https://caca.blucaro.site`) | Prueba (`ENTORNO=prueba`): relevamiento, sin passkeys, cuentas descartables, no indexado. |
| `postgres` | — | Una base para cada sitio (`dondecague` y `dondecague_prueba`), separadas. |
| `caddy` | — | Opcional (`--profile caddy`): HTTPS automático, solo si no hay otro servidor web en 80/443. |

Las apps escuchan solo en la máquina: `127.0.0.1:3101` (real) y
`127.0.0.1:3102` (prueba). El HTTPS lo pone un proxy adelante: **el nginx que
ya tenga el VPS** (lo habitual) o el Caddy del compose.

## Lo que necesitás

- Docker con el plugin `docker compose`.
- Los puertos **80 y 443** libres.
- DNS:
  - `dondecague.com.ar` → registro **A** con la IP del VPS. En NIC Argentina, el
    dominio tiene que estar delegado a servidores DNS donde puedas crear ese
    registro (los de tu proveedor del VPS, o Cloudflare **sin** el proxy
    naranja: con el proxy, Cloudflare vería todo el tráfico).
  - `caca.blucaro.site` → como ya está.

## Primera vez

```sh
cd cacapage
git pull

# Si estaba corriendo la versión anterior (solo prueba), bajarla primero:
docker compose -p cacapage-prueba down

cp .env.example .env
# Completar .env: generar cada secreto con `openssl rand -hex 32`
# (POSTGRES_PASSWORD, PIMIENTA_MAIL, PIMIENTA_MAIL_PRUEBA).

docker compose --env-file .env -f infra/docker-compose.yml up -d --build
```

**Guardá una copia de `.env` fuera del VPS.** Si se pierde `PIMIENTA_MAIL`,
nadie puede volver a entrar con su mail.

## Verificar

```sh
curl -s https://dondecague.com.ar/api/v1/config
# {"entorno":"produccion","passkeys":true,"mail":false}
curl -sI https://caca.blucaro.site/app/relevamiento | grep -i robots
# x-robots-tag: noindex, nofollow
```

Después, desde el celular: crear tu propia cuenta en `dondecague.com.ar` con
passkey, salir y volver a entrar.

## Con el nginx del VPS

Para cada dominio, desde la carpeta del repo (en Debian/Ubuntu, con
`sites-available`/`sites-enabled` y certbot):

```sh
# Sitio real
sed -e 's/__DOMINIO__/dondecague.com.ar/' -e 's/__PUERTO__/3101/' \
    -e 's#__CABECERAS__#add_header Strict-Transport-Security "max-age=31536000" always;#' \
    infra/nginx/sitio.conf.plantilla > /etc/nginx/sites-available/dondecague.conf
ln -s /etc/nginx/sites-available/dondecague.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d dondecague.com.ar
```

Para el de prueba, lo mismo con `caca.blucaro.site`, puerto `3102` y
`add_header X-Robots-Tag "noindex, nofollow" always;`.

Sin log de acceso (`access_log off;`): está en la plantilla (PRIVACY.md P-19).

## El mail

Con `MAIL_MODO=desactivado` (lo que trae `.env.example`), el sitio real funciona
con passkey y contraseña. Para habilitar el link por mail, el proveedor es
**Brevo** (nombrado en `/privacidad`):

1. En Brevo, **autenticar el dominio** `dondecague.com.ar` (registros SPF, DKIM y
   DMARC que te indica Brevo). Los mails salen de `no-responder@dondecague.com.ar`.
2. **Desactivar el seguimiento de aperturas y de clics** para los mails
   transaccionales. Con el seguimiento de clics, Brevo reescribe los links para
   pasar por sus servidores, y el link de entrada lleva el token: Brevo vería
   llaves de entrada a cuentas. El de aperturas agrega un píxel espía.
3. En `.env`, con las credenciales SMTP de Brevo (el usuario tiene `@`: va como `%40`):
   ```
   MAIL_MODO=smtp
   SMTP_URL=smtp://USUARIO%40smtp-brevo.com:CLAVE_SMTP@smtp-relay.brevo.com:587
   ```
4. Volver a levantar: `docker compose --env-file .env -f infra/docker-compose.yml up -d`.
5. Probar: en `dondecague.com.ar/app/entrar`, "Ya tengo cuenta" → "Mail" con un
   mail tuyo que no tenga cuenta: tiene que llegar el aviso de "no hay ninguna
   cuenta con este mail".

Si un envío falla, el usuario ve "No pudimos mandar el mail" y el log del
servidor registra solo el código de error, nunca la dirección.

El sitio de prueba sigue con `MAIL_MODO_PRUEBA=consola`: su dominio
(`caca.blucaro.site`) no está autenticado en Brevo.

En prueba, `MAIL_MODO_PRUEBA=consola` imprime los links en el log:

```sh
docker compose --env-file .env -f infra/docker-compose.yml logs web-prueba | grep "\[mail:"
```

## Actualizar

```sh
git pull
docker compose --env-file .env -f infra/docker-compose.yml up -d --build
```

Las migraciones de la base se aplican solas al arrancar.

## Mapa de baños

Dos partes, y la primera es automática:

1. **Los baños.** Cada sitio (el real y el de prueba) los trae solo de
   OpenStreetMap: 10 segundos después de arrancar, y después una vez por semana.
   Es solo lectura (ADR 0001): nada vuelve a OSM. Para ver cómo fue:

   ```sh
   docker compose --env-file .env -f infra/docker-compose.yml logs web | grep OSM
   # OSM: 10325 baños importados desde maps.mail.ru
   ```

   Si los tres servidores de Overpass fallan, queda registrado y se reintenta
   a las 6 horas. Mientras tanto se sigue mostrando la importación anterior.

2. **El mapa base**: dos archivos en `teselas/`, en la carpeta del repo. Se
   sirven en `/tiles/argentina.pmtiles` y `/tiles/mundo.pmtiles`.
   - `argentina.pmtiles`: la Argentina hasta zoom 14 (cada cuadra), 1,1 GB.
   - `mundo.pmtiles`: todo el mundo hasta zoom 8 (países, ciudades, rutas y
     ríos), 560 MB.

   El mapa usa el mundo de fondo y, desde el zoom 9, encima el detalle de la
   Argentina. Si falta uno, funciona con el otro; si faltan los dos, muestra
   los baños sobre un fondo liso.

   **Siempre a un `.tmp` y después `mv`:** `pmtiles extract` tarda varios
   minutos y la app lee el archivo mientras tanto; `mv` lo reemplaza de una
   sola vez. Para bajarlos (la primera vez) o renovarlos (cada algunos meses):

   ```sh
   cd ~/cacapage
   mkdir -p teselas ~/bin
   # Una sola vez: el programa pmtiles (si `uname -m` dice aarch64, cambiá x86_64 por arm64)
   curl -L https://github.com/protomaps/go-pmtiles/releases/download/v1.28.0/go-pmtiles_1.28.0_Linux_x86_64.tar.gz | tar xz -C ~/bin pmtiles

   FECHA=$(date -d yesterday +%Y%m%d)   # los builds diarios de Protomaps se llaman AAAAMMDD
   ~/bin/pmtiles extract https://build.protomaps.com/$FECHA.pmtiles teselas/argentina.pmtiles.tmp \
       --bbox=-73.6,-55.1,-53.6,-21.7 --maxzoom=14 && mv teselas/argentina.pmtiles.tmp teselas/argentina.pmtiles
   ~/bin/pmtiles extract https://build.protomaps.com/$FECHA.pmtiles teselas/mundo.pmtiles.tmp \
       --maxzoom=8 && mv teselas/mundo.pmtiles.tmp teselas/mundo.pmtiles

   # Que el contenedor (usuario node) los pueda leer
   chmod 644 teselas/*.pmtiles
   ```

   No hace falta reiniciar ni tocar nginx: la app lee los archivos en cada
   pedido, por rangos. Si un archivo no se puede leer (por ejemplo, quedó con
   permisos `600` de root), `/tiles/…` responde 500 y el log dice
   `Teselas: no se puede abrir … (EACCES)`: es el `chmod 644` de arriba.

Para probar: `https://dondecague.com.ar/mapa`, "Cerca mío". La ubicación se usa
solo en el celular (PRIVACY.md P-36).

## Entrar con Google

Opcional: sin estas dos variables, el botón no aparece. Un solo cliente de
Google sirve para el sitio real y el de prueba.

1. Entrá a <https://console.cloud.google.com/> con la cuenta de Google que va a
   ser dueña del proyecto (por ejemplo, `dondecague@gmail.com`).
2. Arriba, en el selector de proyectos: **Proyecto nuevo** → nombre
   `Donde Cague` → **Crear**. Elegilo en el selector.
3. Menú ☰ → **APIs y servicios** → **Pantalla de consentimiento de OAuth**
   (en la consola nueva se llama **Google Auth Platform** → **Comenzar**):
   - Nombre de la app: `Dónde Cagué`. Correo de asistencia: `dondecague@gmail.com`.
   - Público: **Externo**.
   - Información de contacto: `dondecague@gmail.com`. Aceptar y **Crear**.
4. En **Desarrollo de la marca** (o "Información de la app"):
   - Página principal: `https://dondecague.com.ar`
   - Política de privacidad: `https://dondecague.com.ar/privacidad`
   - Condiciones del servicio: `https://dondecague.com.ar/terminos`
   - Dominios autorizados: `dondecague.com.ar` y `blucaro.site`.
5. En **Acceso a los datos** (o "Permisos"): no agregues nada. Usamos solo
   `openid`, que no necesita verificación de Google.
6. En **Público**: tocá **Publicar app** para pasarla a "En producción". Si
   queda "En prueba", solo pueden entrar las cuentas que agregues como testers.
7. **Clientes** (o "Credenciales" → **Crear credenciales** → **ID de cliente de
   OAuth**):
   - Tipo de aplicación: **Aplicación web**. Nombre: `Dónde Cagué`.
   - Orígenes autorizados de JavaScript: no hace falta ninguno.
   - **URI de redireccionamiento autorizados**, exactamente estos dos:
     - `https://dondecague.com.ar/api/v1/auth/google/vuelta`
     - `https://caca.blucaro.site/api/v1/auth/google/vuelta`
   - **Crear**. Copiá el **ID de cliente** (termina en
     `.apps.googleusercontent.com`) y el **Secreto del cliente**.
8. En el VPS, en `~/cacapage/.env` (nunca en el repo):

   ```sh
   GOOGLE_CLIENT_ID=123456789-abc....apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-...
   ```

   y reiniciar: `docker compose --env-file .env -f infra/docker-compose.yml up -d`.
9. Probar: `https://dondecague.com.ar/app/entrar` → "Ya tengo cuenta" →
   **Google**. Si Google muestra `redirect_uri_mismatch`, la URI del paso 7 no
   coincide letra por letra (ojo con `https`, la barra final o `www`).

Si el secreto se filtra: en la consola, en el cliente, **Restablecer secreto**,
y actualizar el `.env`.

## Reportes de baños

Con 15 reportes de cuentas elegibles (7 días o más y que registraron algo), un
baño queda **en revisión**: sigue en el mapa, con un aviso en la ficha. **Nada se
oculta solo.** Revisarlo y decidir es a mano, con `psql`:

```sh
cd ~/cacapage
alias psql-dc='docker compose --env-file .env -f infra/docker-compose.yml exec -T postgres psql -U dondecague dondecague'

# Qué hay en revisión, con los motivos y el nombre del baño
psql-dc -c "select r.banio_id, c.nombre, c.categoria, r.reportes, r.desde::date,
  (select string_agg(motivo || ':' || n, ', ') from (select motivo, count(*) n from banio_reportes
     where banio_id = r.banio_id group by motivo) m) as motivos
  from banios_en_revision r left join osm.candidatos c on c.id = r.banio_id order by r.desde"
```

El `banio_id` (`n123`, `w456`) es el objeto de OSM: se puede mirar en
`https://www.openstreetmap.org/node/123` (o `/way/456`).

```sh
# Ocultarlo (no vuelve aunque OSM lo siga trayendo)
psql-dc -c "begin;
  insert into banios_ocultos (banio_id, motivo) values ('n123', 'cerró, revisado') on conflict do nothing;
  delete from banios_en_revision where banio_id = 'n123';
commit;"

# Descartar los reportes (el baño está bien): sale de revisión y el conteo vuelve a cero
psql-dc -c "begin;
  delete from banio_reportes where banio_id = 'n123';
  delete from banios_en_revision where banio_id = 'n123';
commit;"

# Des-ocultar uno que se ocultó
psql-dc -c "delete from banios_ocultos where banio_id = 'n123'"

# Ver los ocultos
psql-dc -c "select o.banio_id, c.nombre, o.ocultado_en::date, o.motivo
  from banios_ocultos o left join osm.candidatos c on c.id = o.banio_id"
```

Los cambios se ven en el mapa en el momento para quien lo abre de nuevo (el
navegador puede tener el catálogo guardado hasta una hora). En el sitio de
prueba es lo mismo con la base `dondecague_prueba`. Si el baño está mal en OSM,
corregirlo en OSM es a mano y lo hace una persona (ADR 0001).

## Comentarios públicos

Con 3 reportes de cuentas elegibles, la anécdota de una caca pública se oculta
(el punto sigue). Revisarla y decidir es a mano (alias `psql-dc` de la sección
anterior):

```sh
# Comentarios ocultos o reportados, con cuántos reportes
psql-dc -c "select p.id, c.seudonimo, p.comentario, p.comentario_oculto,
  (select count(*) from comentario_reportes r where r.publicacion_id = p.id) as reportes
  from publicaciones p join cuentas c on c.id = p.cuenta_id
  where p.comentario is not null and exists (select 1 from comentario_reportes r where r.publicacion_id = p.id)
  order by p.comentario_oculto desc, reportes desc"

# Está bien: volver a mostrarlo y descartar los reportes
psql-dc -c "begin;
  update publicaciones set comentario_oculto = false where id = 'UUID';
  delete from comentario_reportes where publicacion_id = 'UUID';
commit;"

# Está mal: borrar el texto (el punto queda)
psql-dc -c "update publicaciones set comentario = null, comentario_oculto = false where id = 'UUID'"
```

## Relevamiento (en prueba)

Igual que antes, en `https://caca.blucaro.site/app/relevamiento`: abrila una vez
con señal antes de salir, "Fijar ubicación acá" parado en el baño, "Descargar
todo" al final del día. Los archivos van a `data/curated/recorridas/`.

## Backups

> **`PIMIENTA_MAIL` (y `PIMIENTA_MAIL_PRUEBA`) son la llave de los historiales.**
> Sin ellas no se puede abrir ningún historial ni entrar por mail o Google.
> Guardá una copia del `.env` en un lugar seguro, **aparte** del backup de la
> base: si alguien tiene las dos cosas, puede leer los historiales (PRIVACY.md
> P-40). Nunca la cambies una vez en producción.


Todavía no hay backups automáticos (DESIGN.md §19, restic). Mientras tanto, uno a
mano:

```sh
docker compose --env-file .env -f infra/docker-compose.yml exec -T postgres pg_dump -U dondecague dondecague > respaldo.sql
```
