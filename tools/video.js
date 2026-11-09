/* Graba el video de demostración: docs/video/causa-raiz-demo.mp4
 *
 * Uso:  node tools/video.js
 * Necesita Playwright y ffmpeg. Recorre la app como la vería un visitante: carga los casos
 * de ejemplo (inventados), crea un caso nuevo y lo lleva por los 6 pasos hasta cerrarlo,
 * con carteles que explican cada paso, un círculo en cada toque y placas de apertura y
 * cierre. Volver a correrlo cada vez que cambie algo visible de la app.
 */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { servidor, RAIZ } = require('./servidor');

const SALIDA = path.join(RAIZ, 'docs', 'video');
const ANCHO = 390, ALTO = 844;

// Se inyecta en la página: carteles, placas y marca de toques. Vive fuera de <main>,
// así sobrevive a los redibujos de la app. El cartel va ARRIBA (debajo de la barra): abajo
// taparía las pestañas y el botón Guardar de las hojas, que es justo lo que se toca.
function preparar() {
  const css = document.createElement('style');
  css.textContent = `
    #v-cartel { position: fixed; left: 12px; right: 12px; top: 72px; z-index: 99; padding: 12px 16px; pointer-events: none;
      background: rgba(10, 70, 84, .94); color: #fff; border-radius: 14px; font: 600 17px/1.35 "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 6px 24px rgba(0,0,0,.25); transition: opacity .35s, transform .35s; }
    #v-cartel.oculto { opacity: 0; transform: translateY(-14px); }
    #v-cartel small { display: block; font-weight: 400; font-size: 14px; opacity: .85; margin-top: 2px; }
    #v-placa { position: fixed; inset: 0; z-index: 100; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 14px; text-align: center; padding: 24px; background: #0f5c6e; color: #fff;
      font-family: "Segoe UI", Roboto, sans-serif; transition: opacity .6s; }
    #v-placa.oculto { opacity: 0; pointer-events: none; }
    #v-placa img { width: 112px; height: 112px; }
    #v-placa h1 { margin: 0; font-size: 34px; } #v-placa h1 span { color: #00c896; }
    #v-placa p { margin: 0; font-size: 18px; opacity: .9; max-width: 300px; line-height: 1.4; }
    #v-placa b { color: #00c896; }
    .v-toque { position: fixed; z-index: 98; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
      background: rgba(0, 200, 150, .35); border: 3px solid #00c896; pointer-events: none; animation: v-toque .6s ease-out forwards; }
    @keyframes v-toque { from { transform: scale(.4); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }`;
  document.head.appendChild(css);
  const cartel = document.createElement('div');
  cartel.id = 'v-cartel'; cartel.className = 'oculto';
  document.body.appendChild(cartel);
  const placa = document.createElement('div');
  placa.id = 'v-placa'; placa.className = 'oculto';
  document.body.appendChild(placa);
  document.addEventListener('pointerdown', e => {
    const t = document.createElement('div');
    t.className = 'v-toque'; t.style.left = e.clientX + 'px'; t.style.top = e.clientY + 'px';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 700);
  }, true);
  window.vCartel = (titulo, detalle) => {
    cartel.innerHTML = titulo ? titulo + (detalle ? '<small>' + detalle + '</small>' : '') : '';
    cartel.className = titulo ? '' : 'oculto';
  };
  window.vPlaca = html => {
    if (html) placa.innerHTML = html;
    placa.className = html ? '' : 'oculto';
  };
}

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const srv = servidor().listen(0);
  const url = 'http://127.0.0.1:' + srv.address().port + '/';
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-video-'));
  const browser = await chromium.launch({ args: ['--lang=es-AR'] });
  const ctx = await browser.newContext({
    viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: 2, serviceWorkers: 'block',
    locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires', colorScheme: 'light'
  });
  // Empresa de ejemplo en el encabezado del informe (inventada, como los casos).
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('causaRaiz.marca.v1')) localStorage.setItem('causaRaiz.marca.v1', JSON.stringify({ empresa: 'Planta Demo' }));
  });
  const page = await ctx.newPage();

  // Grabación: capturas de pantalla seguidas a resolución doble, cada una con su hora.
  // (La grabación propia de Playwright da cuadros de 390 px, que en un celular moderno se
  // ven borrosos.) Después se arma el video respetando cuánto estuvo cada cuadro en pantalla.
  const cuadros = [];
  let grabando = false;
  async function grabar() {
    while (grabando) {
      const t = Date.now() / 1000;
      const archivo = path.join(carpeta, 'c' + String(cuadros.length).padStart(5, '0') + '.jpg');
      try {
        await page.screenshot({ path: archivo, type: 'jpeg', quality: 88, animations: 'allow', caret: 'initial' });
        cuadros.push({ archivo, t });
      } catch (e) { /* la página se está redibujando: se saltea el cuadro */ }
    }
  }
  // Reloj en el 11/11: las fechas de los ejemplos salen de "hoy" y ese día se lee igual en
  // dd/mm y en mm/dd.
  await page.clock.setFixedTime(new Date('2026-11-11T10:30:00-03:00'));
  page.on('dialog', d => d.accept());
  // Si algo no aparece, que falle enseguida y avise (si no, el video queda con la pantalla
  // quieta medio minuto sin que nadie se entere).
  page.setDefaultTimeout(5000);
  page.on('pageerror', e => { throw e; });

  const espera = ms => page.waitForTimeout(ms);
  const cartel = async (t, d, ms) => { await page.evaluate(([a, b]) => window.vCartel(a, b), [t, d || '']); await espera(ms || 3000); };
  const placa = async (html, ms) => { await page.evaluate(h => window.vPlaca(h), html); await espera(ms); };
  // Lleva el elemento al centro de la pantalla (despacio, para que se vea) y lo toca.
  const ver = async sel => {
    await page.locator(sel).first().evaluate(e => e.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await espera(800);
  };
  const tocar = async (sel, ms) => { await ver(sel); await page.locator(sel).first().click(); await espera(ms || 1000); };
  // Las opciones de botones (severidad, tipo, eficacia) son radios tapados por su etiqueta.
  const opcion = async (nombre, valor, ms) => {
    const sel = `input[name="${nombre}"][value="${valor}"]`;
    await ver(sel); await page.locator(sel).click({ force: true }); await espera(ms || 700);
  };
  const tipear = async (sel, txt) => { await ver(sel); await page.locator(sel).first().click(); await page.keyboard.type(txt, { delay: 70 }); await espera(400); };
  const elegir = async (sel, valor) => { await ver(sel); await page.selectOption(sel, valor); await espera(600); };
  const guardar = ms => tocar('.sheet-foot .btn-primary', ms || 1300);
  const tarjeta = sec => `section.card:has([data-sec="${sec}"])`;

  await page.goto(url);
  await page.evaluate(preparar);
  grabando = true;
  const grabacion = grabar();
  await espera(300);
  const logo = await page.evaluate(() => new URL('icons/qualityos.svg', location.href).href);

  // ── Apertura ──
  await placa('<img src="' + logo + '" alt=""><h1>Análisis <span>Causa Raíz</span></h1>' +
    '<p>Del problema a la acción correctiva verificada.</p><p><b>Ishikawa, 5 por qué y Pareto desde el celular.</b></p>', 5000);
  await placa('', 900);

  // ── Ejemplos ──
  await cartel('Para conocerla, hay casos de ejemplo', 'Datos inventados: se borran con un toque', 2200);
  await tocar('[data-act="cargar-ejemplos"]', 1200);
  await cartel('Casos abiertos, acciones vencidas y eficacia', 'Arriba avisa si hay acciones vencidas', 3200);

  // ── 1 · Problema ──
  await cartel('1 · Cargá el problema', 'Se numera solo: RCA-2026-011', 800);
  await tocar('[data-act="nuevo"]', 700);
  await tipear('[name="titulo"]', 'Sachets de 200 ml con sellado abierto');
  await elegir('[name="area"]', 'Línea 3');
  await elegir('[name="categoria"]', 'Envase dañado');
  await opcion('severidad', 'Crítico');
  await tipear('[name="producto"]', 'Suavizante 200 ml');
  await tipear('[name="lote"]', 'L-0456');
  await elegir('[name="origen"]', 'Control en línea');
  await guardar(1500);
  await cartel('El estado del caso se calcula solo', 'La barra muestra los 6 pasos del análisis', 3000);

  // ── 2 · Contención ──
  await cartel('2 · Contención', 'Que no siga saliendo producto con el problema', 800);
  await tocar('[data-sec="contencion"]', 600);
  await tipear('[name="contencion"]', 'Se retuvo el pallet y se revisaron los sachets al 100 %.');
  await guardar();

  // ── 3 · Ishikawa ──
  await cartel('3 · Ishikawa: causas posibles por cada M', 'Método, Máquina, Mano de obra, Material, Medición, Medio', 800);
  await tocar('[data-sec="ishikawa"]', 600);
  await tipear('[name="metodo"]', 'Se arranca sin esperar el precalentamiento');
  await tipear('[name="maquina"]', 'Mordaza con temperatura baja\nTeflón de la mordaza gastado');
  await tipear('[name="mano_obra"]', 'Operario de reemplazo');
  await guardar(900);
  await ver(tarjeta('ishikawa'));
  await cartel('La espina de pescado se dibuja sola', '', 1800);
  await page.locator(tarjeta('ishikawa') + ' .scroll-x').evaluate(e => e.scrollTo({ left: e.scrollWidth, behavior: 'smooth' }));
  await espera(1600);

  // ── 4 · 5 por qué ──
  await cartel('4 · Los 5 por qué hasta la causa raíz', 'Se corta cuando la respuesta se puede corregir', 800);
  await tocar('[data-sec="causa"]', 600);
  await tipear('[name="pq0"]', 'El sello no cierra');
  await tipear('[name="pq1"]', 'La mordaza no llega a temperatura');
  await tipear('[name="pq2"]', 'Se arranca sin esperar el precalentamiento');
  await cartel('Marcás qué causas del Ishikawa son raíz', 'Eso alimenta el Pareto por 6M', 800);
  await tocar('input[name="raiz"][value="metodo|0"]', 800);
  await tocar('[data-act="usar-ultimo"]', 1200);
  await guardar();
  await ver(tarjeta('causa'));
  await espera(1500);

  // ── 5 · Plan de acción ──
  await cartel('5 · Plan de acción', 'Qué se hace, quién y para cuándo', 800);
  await tocar('[data-sec="accion-nueva"]', 600);
  await tipear('[name="texto"]', 'Sumar el control de temperatura al checklist de arranque');
  await page.fill('[name="responsable"]', '');
  await tipear('[name="responsable"]', 'Supervisor de producción');
  await tocar('#inHecha', 700);
  await guardar();

  // ── 6 · Eficacia ──
  await cartel('6 · ¿Fue eficaz?', 'Solo se puede cerrar con causa raíz y acciones hechas', 800);
  await tocar('[data-sec="eficacia"]', 600);
  await opcion('estado', 'eficaz');
  await tipear('[name="evidencia"]', 'Dos semanas sin sachets abiertos.');
  await guardar(1200);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await cartel('Caso cerrado, con todo en el historial', 'Quién cambió qué y cuándo: trazabilidad', 3000);

  // ── Informe ──
  await tocar('[data-act="informe"]', 800);
  await cartel('Informe A4 listo para imprimir o PDF', 'O un resumen para mandar por WhatsApp', 2400);
  for (const y of [700, 1400, 2100]) { await page.evaluate(t => window.scrollTo({ top: t, behavior: 'smooth' }), y); await espera(1300); }

  // ── Pareto ──
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await tocar('.tabbar [data-tab="pareto"]', 900);
  await cartel('Pareto: dónde se concentran los problemas', 'Por tipo de problema, por 6M o por área', 3200);
  await tocar('[data-act="pmodo"][data-v="m6"]', 900);
  await ver('.report table');
  await espera(1800);

  // ── Sin señal ──
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await tocar('.tabbar [data-tab="casos"]', 600);
  await ctx.setOffline(true);
  await cartel('¿Sin señal en planta? Funciona igual', 'Los casos quedan en el celular; hay respaldo y Excel', 3200);
  await ctx.setOffline(false);
  await cartel('', '', 300);

  // ── Cierre ──
  await placa('<img src="' + logo + '" alt=""><h1>Análisis <span>Causa Raíz</span></h1>' +
    '<p>Probala gratis en</p><p><b>roca-byte.github.io/causa-raiz</b></p><p>→ “Ver casos de ejemplo”</p>', 4200);

  grabando = false;
  await grabacion;
  const fin = Date.now() / 1000;
  await ctx.close();
  await browser.close();
  srv.close();

  // Lista de cuadros con cuánto dura cada uno en pantalla (hasta que llega el siguiente).
  const lista = path.join(carpeta, 'lista.txt');
  fs.writeFileSync(lista, cuadros.map((c, i) => {
    const hasta = i + 1 < cuadros.length ? cuadros[i + 1].t : fin;
    return "file '" + c.archivo + "'\nduration " + Math.max(0.04, hasta - c.t).toFixed(3);
  }).join('\n') + "\nfile '" + cuadros[cuadros.length - 1].archivo + "'\n");

  // Cuadros → MP4 (H.264) a 25 cuadros por segundo: se reproduce en celulares, WhatsApp,
  // LinkedIn y YouTube. El ancho y el alto tienen que ser pares para H.264.
  const mp4 = path.join(SALIDA, 'causa-raiz-demo.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lista,
    '-vf', 'fps=25,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23',
    '-movflags', '+faststart', '-an', mp4]);
  fs.rmSync(carpeta, { recursive: true, force: true });
  const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString().trim();
  console.log('Cuadros:', cuadros.length, '≈', (cuadros.length / (fin - cuadros[0].t)).toFixed(1), 'por segundo');
  console.log('Video:', path.relative(RAIZ, mp4), Math.round(fs.statSync(mp4).size / 1024) + ' KB,', Math.round(dur) + ' s');
})().catch(e => { console.error('✗', e.message); process.exit(1); });
