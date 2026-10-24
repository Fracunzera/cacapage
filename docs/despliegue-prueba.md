# Despliegue del entorno de prueba (`caca.blucaro.site`)

Lo único que hay para desplegar hoy es la **herramienta de relevamiento**
(`/app/relevamiento`, DESIGN.md §15.6). Corre solo con `ENTORNO=prueba`.

## Lo que necesitás

- El VPS con Docker y el plugin `docker compose`.
- Un registro DNS **A** de `caca.blucaro.site` apuntando a la IP del VPS.
- Los puertos **80 y 443** libres en el VPS (Caddy saca el certificado HTTPS solo).
  Si ya tenés otro servidor web ahí (por `blucaro.site`), mirá "Si ya tenés un
  proxy" más abajo.

El GPS del navegador **solo funciona con HTTPS**: sin el certificado, la
herramienta no puede pedir la ubicación.

## Pasos

```sh
git clone https://github.com/Fracunzera/cacapage.git
cd cacapage
git checkout claude/happy-gates-9ieqx9

cp .env.example .env
# Revisá .env: ORIGEN_PUBLICO=https://caca.blucaro.site y ENTORNO=prueba.
# Los secretos de abajo todavía no se usan; pueden quedar vacíos.

docker compose --env-file .env -f infra/docker-compose.prueba.yml up -d --build
```

## Verificar

```sh
curl -sI https://caca.blucaro.site/app/relevamiento
```

Tiene que dar `HTTP/2 200` y `x-robots-tag: noindex, nofollow`.

## Antes de salir a la calle (importante)

1. Abrí `https://caca.blucaro.site/app/relevamiento` en el celular **con señal**
   y esperá a que cargue. Ahí se instala la copia para usar sin conexión.
2. Aceptá el permiso de ubicación.
3. Probá: poné el celular en modo avión y recargá la página. Tiene que abrir
   igual.
4. Opcional: "Agregar a pantalla de inicio". En iPhone es casi obligatorio:
   Safari puede borrar los datos de un sitio no instalado después de 7 días sin
   uso.

## En la calle

- Parate en la puerta del baño o del local y tocá **"Fijar ubicación acá"**
  cuando se habilite (precisión de 30 m o mejor). Si no se habilita, alejate de
  techos y paredes altas.
- Completá lo que sepas; lo que no, dejalo en "Desconocido".
- **Guardar baño.** Todo se guarda en el teléfono a medida que cargás: si se
  cierra el navegador, al volver a abrir sigue donde estaba.
- Al final del día, **Descargar todo**: baja `recorrida-AAAA-MM-DD.json` con
  todo lo acumulado. Descargarlo no borra nada del teléfono.

## Qué hacer con el archivo

Pasámelo o subilo al repo en `data/curated/recorridas/`. Ahí lo va a tomar el
comando `cargar-curado` cuando exista (DESIGN.md §13), con
`procedencia = gps_campo`.

## Actualizar

```sh
git pull
docker compose --env-file .env -f infra/docker-compose.prueba.yml up -d --build
```

El celular toma la versión nueva la próxima vez que abra la página con señal.

## Si ya tenés un proxy en el VPS

No levantes el servicio `caddy`; levantá solo la app y publicala en un puerto
local:

```sh
docker compose --env-file .env -f infra/docker-compose.prueba.yml run -d --name cacapage-web -p 127.0.0.1:3000:3000 web
```

y apuntá tu proxy a `127.0.0.1:3000`, agregando la cabecera
`X-Robots-Tag: noindex, nofollow` y **sin log de acceso** para este sitio.
