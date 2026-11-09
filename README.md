# Análisis Causa Raíz

[![QualityOS](https://img.shields.io/badge/QualityOS-calidad_en_planta-0f5c6e?style=flat-square)](https://github.com/roca-byte)

PWA para hacer el **análisis de causa raíz (RCA)** de un problema de planta desde el celular:
del desvío a la acción correctiva verificada, con **diagrama de Ishikawa**, **5 por qué**,
**plan de acción**, **verificación de eficacia** y **Pareto** de los problemas.
Pensada para usarse en planta: botones grandes, pocos campos por pantalla y funcionamiento
**sin conexión**.

## Cómo se trabaja un caso

Cada caso sigue 6 pasos (un 8D simplificado). La app marca el avance y calcula el estado sola:

1. **Problema**: título, área/línea, tipo de problema, severidad, producto, lote, origen,
   cantidad afectada y descripción. Se numera solo: `RCA-2026-001`, `RCA-2026-002`…
2. **Contención**: la acción inmediata para que no siga saliendo producto con el problema.
3. **Ishikawa (6M)**: causas posibles por Método, Máquina, Mano de obra, Material, Medición y
   Medio ambiente (una por renglón). Se dibuja la espina de pescado.
4. **5 por qué y causa raíz**: la cadena de "¿por qué?" y la causa raíz en una frase. Se
   marcan qué causas del Ishikawa son raíz (★): eso alimenta el Pareto por 6M.
5. **Plan de acción**: acciones correctivas o preventivas con responsable y plazo. Las
   vencidas se avisan en la barra superior.
6. **Verificación de eficacia**: solo se puede declarar **eficaz** con causa raíz y todas las
   acciones hechas. Eficaz cierra el caso; "No eficaz" lo deja para revisar.

Estados: *En análisis* → *Acciones en curso* → *Verificar eficacia* → *Cerrado* (o *No eficaz*).
Cada cambio importante queda en el **historial del caso** con fecha y hora (trazabilidad).

## Características

- **Informe del caso** imprimible en A4 (Imprimir → Guardar como PDF) y **resumen para compartir**
  por WhatsApp o mail.
- **Pareto** por tipo de problema, por causa raíz (6M) o por área, en un período: barras,
  % acumulado, línea del 80 % y tabla. También se imprime.
- **Indicadores**: casos abiertos, acciones vencidas, cerrados y % de eficacia.
- **Exportar a Excel** (`.csv` con `;` y acentos correctos) y **respaldo JSON** (descargar y restaurar).
- **Empresa y logo configurables**, listas propias (áreas, tipos de problema, orígenes) y
  código/revisión del registro para el pie del informe.
- **Instalable, offline** y con **modo claro/oscuro** según el sistema.

## Tecnologías

HTML + CSS + JavaScript puro, **sin frameworks, sin npm y sin paso de build**. Scripts clásicos
(sin módulos), un objeto global por archivo. Gráficos en SVG hechos a mano (sin librerías).
Datos en `localStorage` (clave `causaRaiz.v1`). Sin login ni backend.

## Estructura

```
├── index.html          # Barra superior, <main id="view"> y pestañas (Casos, Pareto, Ajustes)
├── manifest.json       # Datos de instalación PWA
├── sw.js               # Service worker (red primero, caché sin señal). VERSION = 'causa-raiz-vN'
├── css/styles.css      # Estilos QualityOS, gráficos e impresión A4
├── js/
│   ├── rca.js          # Reglas puras: estado, eficacia, Pareto, CSV, numeración (Rca)
│   ├── marca.js        # Empresa y logo (Marca)
│   ├── store.js        # Datos en localStorage y respaldo (Store)
│   ├── graficos.js     # SVG del Ishikawa y del Pareto (Graficos)
│   ├── report.js       # Informe del caso, informe del Pareto y texto para compartir (Report)
│   └── app.js          # Pantallas, formularios y eventos
├── icons/              # Íconos de la suite
└── tests/
    ├── rca.test.js     # Pruebas de las reglas (Node)
    └── e2e.js          # Recorrido completo en Chromium (Playwright)
```

Orden de carga: `rca` → `marca` → `store` → `graficos` → `report` → `app`.

## Uso local

```bash
python3 -m http.server 8000      # con file:// el service worker no anda
```

Abrir `http://localhost:8000`.

## Pruebas

```bash
node --test tests/*.test.js      # reglas
node tests/e2e.js [carpeta]      # navegador real; carpeta opcional para capturas y PDF
```

## Publicar en GitHub Pages

1. Crear el repo y subir todos los archivos de esta carpeta.
2. Settings → Pages → Deploy from branch → `main` / `(root)`.
3. Abrir la URL en Chrome del celular → menú → *Instalar app*.

Todas las rutas son relativas, así que funciona en un subdirectorio.
**Cada cambio: subir `VERSION` en `sw.js`**, si no los celulares siguen con la versión vieja.

## Licencia

MIT © 2026 Maximiliano Roca.
