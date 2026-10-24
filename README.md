# cacapage

> Nombre de trabajo. El nombre definitivo está en [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md).

Una web argentina, en castellano rioplatense, para **registrar dónde cagaste**,
juntar logros con identidad local y, de paso, armar entre todos **el mapa de
baños públicos que no existe**: cuál está abierto el domingo, cuál cobra, cuál
está limpio, cuál tiene cambiador, cuál es accesible.

El chiste es la puerta de entrada. Lo útil es lo que hace que la gente vuelva.

**Estado:** diseño. Todavía no hay código. Este repo existe para criticar el
diseño antes de escribir una sola línea.

---

## Para quién

- **Piloto:** Río Gallegos, Santa Cruz (~110 mil habitantes). Elegida porque es
  chica: se puede sembrar a mano, se nota rápido si funciona o no, y la Ruta 3
  le da un eje de identidad (estaciones de servicio, tramos sin señal, viajes
  largos).
- **Después:** el resto de la Patagonia por la Ruta 3 y, si anda, Argentina.
- **Usuario típico:** alguien que se ríe del chiste y lo comparte por WhatsApp.
  El usuario que queremos retener es el que, un domingo a la tarde, necesita
  saber qué baño está abierto. A veces es la misma persona.

## Qué lo diferencia

Existe un precedente, **Poop Map** (app iOS/Android, global, en inglés). No es
un clon. Nos separamos en tres ejes:

| Eje | Poop Map | cacapage |
|---|---|---|
| Plataforma | App de store | Web. Se comparte con un link, funciona sin instalar nada. Se puede "agregar a inicio" y anda sin señal en la ruta. |
| Identidad | Global, en inglés, genérica | Categorías y logros locales: el baño de la estación de servicio de la ruta, el baño del laburo, el baño ajeno sin papel, conquistar las YPF de la Ruta 3. |
| Privacidad | Hay críticas públicas: se puede deducir a qué hora estás dónde y hay usuarios que terminan publicando dónde viven | **El servidor nunca recibe tu ubicación exacta.** Tu historial está cifrado y solo vos lo podés leer. Lo que se publica es un lugar público (nunca un punto), con fecha borrosa y con retraso. Tu casa no puede salir al mapa ni aunque te equivoques. |

Y una cuarta, que es la que justifica el proyecto: **el mapa de baños públicos**,
sembrado con datos de OpenStreetMap y completado por la gente. Ese mapa sirve
aunque nunca registres nada.

## Cómo funciona (en una línea por capa)

- **Tu historial (privado):** cada registro con ubicación y hora exactas vive
  cifrado en tu dispositivo y se sincroniza cifrado. El servidor guarda bytes
  que no puede leer.
- **El mapa público:** lugares públicos (estaciones de servicio, terminal,
  bares, baños públicos) con lo que la gente reportó de sus baños y cuánta gente
  pasó por ahí, solo cuando pasaron suficientes personas como para que nadie sea
  identificable.
- **Tus amigos:** ven en qué lugar público estuviste, y que estuviste "en casa"
  sin decir dónde queda.
- **Los logros:** se calculan en tu dispositivo con tu historial privado. Mostrar
  una insignia es opcional y nunca muestra fechas ni lugares.

El detalle está en [DESIGN.md](DESIGN.md) y las decisiones de privacidad, con
lo que cuesta cada una, en [PRIVACY.md](PRIVACY.md).

## Qué NO es

- No es una app de salud. No se registra consistencia, duración, síntomas ni
  nada parecido. Nunca. (Ver [PRIVACY.md](PRIVACY.md), P-02.)
- No es una red social con fotos. No hay subida de imágenes en v1.
- No es un ranking público de quién caga más.

## Documentos

| Documento | Qué tiene |
|---|---|
| [DESIGN.md](DESIGN.md) | Arquitectura, stack, modelo de datos, pipeline de anonimización, umbrales, endpoints, jobs, operación. |
| [PRIVACY.md](PRIVACY.md) | Cada decisión de privacidad como decisión: qué riesgo mitiga y qué cuesta. Incluye las descartadas. |
| [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) | Lo que está sin resolver o es riesgoso. |
| [docs/adr/](docs/adr/) | Registros de decisiones de arquitectura (vacío por ahora). |
| [docs/legal/](docs/legal/) | Borradores de términos, política de privacidad y textos de consentimiento (vacío por ahora). |

## Estructura del repo

```
cacapage/
├── README.md               ← esto
├── DESIGN.md               ← diseño completo
├── PRIVACY.md              ← decisiones de privacidad
├── OPEN-QUESTIONS.md       ← pendientes y riesgos
├── apps/
│   ├── web/                ← SvelteKit: interfaz, SSR de links compartibles, API
│   └── worker/             ← jobs: publicación nocturna, agregados, import OSM
├── packages/
│   ├── core/               ← lógica compartida: franjas, semanas, validación,
│   │                         pipeline de anonimización (corre en el cliente)
│   └── vault/              ← cifrado de la capa privada (WebCrypto)
├── data/
│   ├── curated/            ← datos curados a mano: logros, macrozonas,
│   │                         categorías, feriados, overrides de lugares
│   └── build/              ← salida generada (bundles, PMTiles). No se versiona.
├── db/
│   └── migrations/         ← migraciones SQL (Postgres + PostGIS)
├── infra/
│   ├── caddy/              ← reverse proxy y TLS
│   └── backup/             ← backups cifrados y política de retención
└── docs/
    ├── adr/                ← decisiones de arquitectura
    ├── analisis/           ← análisis que respaldan decisiones (p. ej. la
    │                         simulación de umbrales de k-anonimato)
    └── legal/              ← términos, privacidad, consentimientos
```

Cada carpeta tiene un `README.md` que dice qué va a contener. Ninguna tiene
implementación todavía. Lo único ejecutable es el script de análisis en
`docs/analisis/`, que no es parte del producto.

## Licencia

A definir (ver [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md)). Los datos derivados de
OpenStreetMap están bajo ODbL y eso tiene consecuencias que también están ahí.
