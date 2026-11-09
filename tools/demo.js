/* Genera las capturas de la guía (docs/img/*.png) y el recorrido animado (docs/img/demo.gif).
 *
 * Uso:  node tools/demo.js
 * Necesita Playwright y ffmpeg. Usa los CASOS DE EJEMPLO de la app (js/ejemplo.js), que son
 * inventados: no hay datos de ninguna empresa real.
 * Volver a correrlo cada vez que cambie algo visible de la app.
 */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { servidor, RAIZ } = require('./servidor');

const SALIDA = path.join(RAIZ, 'docs', 'img');

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const srv = servidor().listen(0);
  const url = 'http://127.0.0.1:' + srv.address().port + '/';
  // --lang: los campos de fecha toman el idioma del navegador (dd/mm/aaaa).
  const browser = await chromium.launch({ args: ['--lang=es-AR'] });
  const capturas = [];

  async function contexto(opciones) {
    const ctx = await browser.newContext(Object.assign({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: 'light',
      locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires'
    }, opciones || {}));
    // Empresa de ejemplo en el encabezado de los informes (inventada, como los casos).
    await ctx.addInitScript(() => {
      if (!localStorage.getItem('causaRaiz.marca.v1')) localStorage.setItem('causaRaiz.marca.v1', JSON.stringify({ empresa: 'Planta Demo' }));
    });
    const page = await ctx.newPage();
    // Reloj fijo en el 11/11: las fechas de los ejemplos se calculan desde "hoy", así las
    // capturas salen iguales cada vez que se regeneran.
    await page.clock.setFixedTime(new Date('2026-11-11T10:30:00-03:00'));
    page.on('dialog', d => d.accept());
    page.on('pageerror', e => { throw e; });
    return { ctx, page };
  }

  // Pantalla completa o, con selector, solo ese bloque.
  async function foto(page, nombre, selector) {
    await page.waitForTimeout(350);
    const destino = path.join(SALIDA, nombre + '.png');
    if (selector) {
      // En un recorte las barras fijas (arriba y las pestañas de abajo) se superponen a lo
      // capturado: se sueltan un momento.
      const estilo = await page.addStyleTag({ content: '.topbar, .tabbar { position: static !important; }' });
      await page.locator(selector).first().screenshot({ path: destino });
      await estilo.evaluate(e => e.remove());
    } else await page.screenshot({ path: destino });
    capturas.push(nombre);
  }
  const tarjeta = sec => `section.card:has([data-sec="${sec}"])`;
  const abrirCaso = async (page, texto) => {
    await page.click('[data-tab="casos"]');
    await page.click(`.log-row:has-text("${texto}")`);
    await page.waitForSelector('.case-head');
  };

  // ── Capturas ──
  let { ctx, page } = await contexto();
  await page.goto(url);
  await page.waitForSelector('.vacio');
  await foto(page, '01-inicio');

  await page.click('[data-act="cargar-ejemplos"]');
  await page.waitForSelector('.aviso-ejemplo');
  await page.waitForTimeout(2800);   // que se vaya el aviso "Se cargaron…"
  await foto(page, '02-ejemplos');

  await page.click('[data-act="nuevo"]');
  await page.fill('[name="titulo"]', 'Bidones de 5 L con peso bajo en Línea 3');
  await page.selectOption('[name="area"]', 'Línea 3');
  await page.selectOption('[name="categoria"]', 'Peso / volumen fuera de rango');
  await page.check('input[name="severidad"][value="Moderado"]', { force: true });
  await page.fill('[name="producto"]', 'Detergente 5 L');
  await page.fill('[name="lote"]', 'L-0455');
  await page.selectOption('[name="origen"]', 'Control en línea');
  await foto(page, '03-nuevo-caso');
  await page.keyboard.press('Escape');

  await abrirCaso(page, 'volumen bajo');
  await foto(page, '04-ficha', '.case-head');
  await foto(page, '05-contencion', tarjeta('contencion'));
  await page.click('[data-sec="ishikawa"]');
  await foto(page, '06-ishikawa-form');
  await page.keyboard.press('Escape');
  // En el celular el dibujo se desliza de costado; para la guía se muestra entero (ancho tablet).
  await page.setViewportSize({ width: 820, height: 1180 });
  await foto(page, '07-ishikawa', tarjeta('ishikawa'));
  await page.setViewportSize({ width: 390, height: 844 });
  await foto(page, '08-cinco-porques', tarjeta('causa'));
  await page.click('[data-sec="causa"]');
  await page.locator('.marcar').scrollIntoViewIfNeeded();
  await foto(page, '09-marcar-raiz');
  await page.keyboard.press('Escape');

  await abrirCaso(page, 'ilegible');
  await foto(page, '10-acciones', tarjeta('accion-nueva'));
  await page.click('.acciones .log-row >> nth=1');
  await foto(page, '11-accion-form');
  await page.keyboard.press('Escape');

  await abrirCaso(page, 'volumen bajo');
  await foto(page, '12-eficacia', tarjeta('eficacia'));
  await page.click('[data-act="informe"]');
  await page.setViewportSize({ width: 794, height: 1123 });   // A4 a 96 ppp
  await page.emulateMedia({ media: 'print' });
  await foto(page, '13-informe-pdf', '.report');
  await page.emulateMedia({ media: 'screen' });
  await page.setViewportSize({ width: 390, height: 844 });

  await page.click('[data-tab="pareto"]');
  await page.waitForSelector('.report');
  await foto(page, '14-pareto');
  await page.click('[data-act="pmodo"][data-v="m6"]');
  await foto(page, '15-pareto-6m', '.report');

  await page.click('[data-tab="ajustes"]');
  await foto(page, '16-ajustes');
  await page.evaluate(() => document.querySelectorAll('.settings')[2].scrollIntoView());
  await foto(page, '17-respaldo', '.settings >> nth=2');

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.click('[data-tab="casos"]');
  await page.click('[data-tab="casos"]');
  await foto(page, '18-modo-oscuro');
  await ctx.close();

  // ── Recorrido animado: de la lista al análisis completo y el Pareto ──
  const carpetaVideo = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-gif-'));
  ({ ctx, page } = await contexto({ deviceScaleFactor: 1, recordVideo: { dir: carpetaVideo, size: { width: 390, height: 844 } } }));
  await page.goto(url);
  await page.waitForTimeout(700);
  await page.click('[data-act="cargar-ejemplos"]');
  await page.waitForTimeout(1300);
  await page.click('.log-row:has-text("volumen bajo")');
  await page.waitForTimeout(1300);
  // Bajar despacio por la ficha: pasos, Ishikawa, 5 por qué, acciones y eficacia.
  for (const sec of ['contencion', 'ishikawa', 'causa', 'accion-nueva', 'eficacia']) {
    await page.locator(tarjeta(sec)).evaluate(e => e.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    await page.waitForTimeout(1300);
  }
  await page.click('[data-tab="pareto"]');
  await page.waitForTimeout(1800);
  await page.click('[data-act="pmodo"][data-v="m6"]');
  await page.waitForTimeout(1800);
  const video = await page.video().path();
  await ctx.close();
  await browser.close();
  srv.close();

  // webm → GIF liviano (paleta propia, 6 cuadros por segundo, 320 px de ancho; solo se
  // guardan las partes que cambian de un cuadro al otro, así pesa menos de 2 MB).
  const gif = path.join(SALIDA, 'demo.gif');
  const filtro = 'fps=6,scale=320:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle';
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-vf', filtro, gif]);
  fs.rmSync(carpetaVideo, { recursive: true, force: true });

  console.log('Capturas:', capturas.join(', '));
  console.log('GIF:', path.relative(RAIZ, gif), Math.round(fs.statSync(gif).size / 1024) + ' KB');
})().catch(e => { console.error('✗', e.message); process.exit(1); });
