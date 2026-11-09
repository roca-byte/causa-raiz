# Desarrollo — Análisis Causa Raíz

Información técnica para quien quiera modificar o publicar la app. Para usarla, ver el
[README](README.md).

## Tecnologías

HTML + CSS + JavaScript puro, **sin frameworks, sin npm y sin paso de build**. Scripts
clásicos (sin módulos), un objeto global por archivo. Gráficos (Ishikawa y Pareto) en SVG
hechos a mano, sin librerías. Datos en `localStorage` (clave `causaRaiz.v1`). Sin login ni backend.

## Estructura

```
├── index.html          # Barra superior, <main id="view"> y pestañas (Casos, Pareto, Ajustes)
├── manifest.json       # Datos de instalación PWA
├── sw.js               # Service worker (red primero, caché sin señal). VERSION = 'causa-raiz-vN'
├── css/styles.css      # Estilos QualityOS, gráficos e impresión A4
├── js/
│   ├── rca.js          # Reglas puras: estado, eficacia, Pareto, CSV, numeración (Rca)
│   ├── ejemplo.js      # Casos de ejemplo inventados, calculados desde la fecha de hoy (Ejemplo)
│   ├── marca.js        # Empresa y logo (Marca)
│   ├── store.js        # Datos en localStorage y respaldo (Store)
│   ├── graficos.js     # SVG del Ishikawa y del Pareto (Graficos)
│   ├── report.js       # Informe del caso, informe del Pareto y texto para compartir (Report)
│   └── app.js          # Pantallas, formularios y eventos
├── icons/              # Íconos de la suite
├── docs/
│   ├── GUIA.md         # Guía de uso para usuarios, con capturas
│   ├── img/            # Capturas de la guía y demo.gif (las genera tools/demo.js)
│   └── video/          # causa-raiz-demo.mp4 (lo genera tools/video.js)
├── tools/
│   ├── servidor.js     # Servidor local para los dos scripts de abajo
│   ├── demo.js         # Genera las capturas y el GIF de la guía
│   └── video.js        # Graba el video de demostración (MP4)
└── tests/
    ├── rca.test.js     # Pruebas de las reglas (Node)
    ├── ejemplo.test.js # Pruebas de los casos de ejemplo (Node)
    └── e2e.js          # Recorrido completo en Chromium (Playwright)
```

Orden de carga de los scripts: `rca` → `ejemplo` → `marca` → `store` → `graficos` → `report` → `app`.

## Cómo funciona por dentro

- El **estado del caso** no se guarda: lo calcula `Rca.estado()` a partir de lo cargado
  (*En análisis* → *Acciones en curso* → *Verificar eficacia* → *Cerrado*, o *No eficaz*).
- Solo se puede marcar **eficaz** con causa raíz y todas las acciones hechas (`Rca.validarEficaz`).
- Cada cambio importante pasa por `Store.guardarCaso(caso, nota)`, que agrega la nota al historial.
- El **Pareto por 6M** cuenta, por caso, las M de las causas marcadas como raíz (★); los casos
  sin causa raíz no entran. Si hay más de 10 categorías, las chicas se juntan en "Otras".
- El **CSV** usa `;` como separador y BOM UTF-8 (lo que espera el Excel en español) y
  neutraliza celdas que empiezan con `= + - @` para que Excel no las tome como fórmulas.
- Los **casos de ejemplo** (`Ejemplo.casos(hoy)`) llevan `ejemplo: true`. Solo se ofrecen con
  la app vacía (para que su numeración no choque con casos reales) y **Borrar ejemplos**
  borra solo esos. Sus fechas se calculan hacia atrás desde hoy, sin salir del año en curso.
- El **respaldo** es un JSON `{ app: 'causa-raiz', version: 1, config, casos }`. Restaurar
  reemplaza todo y guarda lo anterior en `causaRaiz.v1.anterior`; un archivo de otra app se rechaza.

## Probar en la compu

```bash
python3 -m http.server 8000      # con file:// el service worker no anda
```

Abrir `http://localhost:8000`.

## Pruebas

```bash
node --test tests/*.test.js      # reglas
node tests/e2e.js [carpeta]      # navegador real; carpeta opcional para capturas y PDF
```

Playwright no está en el repo (no hay `package.json`): se instala aparte, por ejemplo
`npm i -g playwright && npx playwright install chromium`, y se corre con
`NODE_PATH=$(npm root -g)`.

## Guía, GIF y video

Las capturas de la guía y el GIF se regeneran con `node tools/demo.js`, y el video con
`node tools/video.js` (Playwright y ffmpeg). Usan los casos de ejemplo, con datos inventados,
y el reloj fijo en el 11/11/2026 para que salgan iguales cada vez. Conviene correrlos cada
vez que cambia algo visible de la app y revisar que `docs/GUIA.md` siga diciendo lo que la
app hace.

## Publicar en GitHub Pages

1. Subir todos los archivos al repo.
2. Settings → Pages → Deploy from branch → `main` / `(root)`.

Todas las rutas son relativas, así que funciona en un subdirectorio.

## Mantenimiento

- **Cada cambio en un archivo de la app: subir `VERSION` en `sw.js`.** Si no, los celulares
  siguen con la versión vieja. Si se agrega un archivo, sumarlo a `ARCHIVOS` en `sw.js`.
- Fechas locales con `Rca.hoy()`, nunca `toISOString()` (usa UTC y a la noche da el día siguiente).
- Todo texto del usuario pasa por `Rca.esc()` antes de ir al HTML o al SVG.
