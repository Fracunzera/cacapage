# Despliegue en el VPS

Un solo `docker compose` levanta todo:

| Servicio | Dominio | Qué es |
|---|---|---|
| `web` | `ORIGEN_PUBLICO` (`https://dondecague.com.ar`) | El sitio real (`ENTORNO=produccion`): cuentas con passkey, sin relevamiento. |
| `web-prueba` | `ORIGEN_PRUEBA` (`https://caca.blucaro.site`) | Prueba (`ENTORNO=prueba`): relevamiento, sin passkeys, cuentas descartables, no indexado. |
| `postgres` | — | Una base para cada sitio (`dondecague` y `dondecague_prueba`), separadas. |
| `caddy` | — | HTTPS automático para los dos dominios. Sin log de accesos. |

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

## El mail

Con `MAIL_MODO=desactivado` (lo que trae `.env.example`), el sitio real funciona
**solo con passkeys**. Para habilitar el link por mail hace falta un proveedor
de envío (Brevo, Mailgun, Postmark, Amazon SES, etc.):

1. Crear la cuenta en el proveedor y verificar el dominio (registros SPF y DKIM
   que te indica el proveedor).
2. En `.env`: `MAIL_MODO=smtp` y `SMTP_URL=smtps://usuario:clave@servidor:465`.
3. Volver a levantar: `docker compose --env-file .env -f infra/docker-compose.yml up -d`.

El proveedor ve las direcciones de mail a las que manda links: hay que
nombrarlo en la política de privacidad (OPEN-QUESTIONS.md Q-L5).

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
