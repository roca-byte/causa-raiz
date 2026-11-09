# CLAUDE.md — Análisis Causa Raíz

## Quién y qué
- Usuario: Maximiliano, Inspector de Calidad. Estudia Desarrollo de Software:
  **quiere entender el código**, no solo que funcione.
- App: PWA de análisis de causa raíz (RCA) para planta, parte de la suite QualityOS.
  Un caso = 6 pasos: Problema → Contención → Ishikawa 6M → 5 por qué/causa raíz →
  Plan de acción → Verificación de eficacia. Más Pareto por tipo, 6M o área.

## Mismo modelo que sus otras apps (controlLinea, mash-check)
Scripts clásicos sin módulos ni build, un objeto global por archivo, interfaz en español
rioplatense (voseo), botones de 48 px, funciona sin señal, datos en el dispositivo.
Orden de carga: `rca → ejemplo → marca → store → graficos → report → app`.

## Reglas
- Reglas de negocio solo en `js/rca.js` (funciones puras, con pruebas en `tests/rca.test.js`).
- El estado del caso se CALCULA (`Rca.estado`), no se guarda ni se elige a mano.
- Escapar todo texto del usuario con `Rca.esc()` antes de ir a innerHTML o SVG.
- Fechas locales con `Rca.hoy()`, nunca `toISOString()` para fechas de calendario.
- Cada cambio importante de un caso pasa por `Store.guardarCaso(caso, nota)` con una nota
  para el historial (trazabilidad).
- **Cada cambio en archivos de la app: subir `VERSION` en `sw.js`** y decir qué archivos
  volver a subir. Si se agrega un archivo, sumarlo a `ARCHIVOS` en `sw.js`.
- Comentarios en español explicando el porqué. Nada de features no pedidas: avisar si un
  pedido excede el MVP.

## Casos de ejemplo
- `js/ejemplo.js` (global `Ejemplo`, función pura): casos inventados con `ejemplo: true`.
  Datos SIEMPRE ficticios (nada de empresas, lotes o códigos reales). Si cambia la forma de un
  caso en `rca.js`, actualizar también los ejemplos y `tests/ejemplo.test.js`.

## Guía y demo
- `docs/GUIA.md` es la guía para usuarios, con capturas de `docs/img/`.
- Si cambia algo visible, regenerar capturas y GIF con `node tools/demo.js` y el video con
  `node tools/video.js` (usan los casos de ejemplo), y revisar que la guía siga diciendo lo
  que la app hace. Para correrlos: `NODE_PATH=$(npm root -g)` (Playwright global).

## Fuera del MVP (decidido, no implementado)
- Fotos de evidencia (pediría pasar de localStorage a IndexedDB).
- Importar desvíos desde qualityos / calidad-no-conformidades.
- Otros idiomas (todo está en español).

## Pruebas
```
node --test tests/*.test.js
node tests/e2e.js [carpeta-capturas]
node tools/demo.js     # capturas + GIF de la guía
node tools/video.js    # video MP4
```
