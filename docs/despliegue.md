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

## Relevamiento (en prueba)

Igual que antes, en `https://caca.blucaro.site/app/relevamiento`: abrila una vez
con señal antes de salir, "Fijar ubicación acá" parado en el baño, "Descargar
todo" al final del día. Los archivos van a `data/curated/recorridas/`.

## Backups

Todavía no hay backups automáticos (DESIGN.md §19, restic). Mientras tanto, uno a
mano:

```sh
docker compose --env-file .env -f infra/docker-compose.yml exec -T postgres pg_dump -U dondecague dondecague > respaldo.sql
```
