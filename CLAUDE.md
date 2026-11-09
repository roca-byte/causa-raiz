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
Orden de carga: `rca → marca → store → graficos → report → app`.

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

## Fuera del MVP (decidido, no implementado)
- Fotos de evidencia (pediría pasar de localStorage a IndexedDB).
- Importar desvíos desde qualityos / calidad-no-conformidades.
- Otros idiomas (todo está en español).

## Pruebas
```
node --test tests/*.test.js
node tests/e2e.js [carpeta-capturas]
```
