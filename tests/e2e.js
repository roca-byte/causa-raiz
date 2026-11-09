// Prueba de punta a punta en un navegador real (Chromium con Playwright).
// Recorre un caso completo como lo haría el usuario y revisa Pareto, CSV, respaldo y modo offline.
//   node tests/e2e.js [carpeta-para-capturas]
// Levanta solo un servidor local en un puerto libre; no toca nada fuera de la carpeta.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const RAIZ = path.join(__dirname, '..');
const CAPTURAS = process.argv[2];
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

// Servidor estático mínimo: sirve la app bajo /causa-raiz/ para imitar GitHub Pages (subdirectorio).
function servidor() {
  return new Promise(res => {
    const s = http.createServer((req, resp) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      if (!url.startsWith('/causa-raiz/')) { resp.writeHead(404); return resp.end(); }
      let f = path.join(RAIZ, url.slice('/causa-raiz/'.length) || 'index.html');
      if (!f.startsWith(RAIZ)) { resp.writeHead(403); return resp.end(); }
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
      if (!fs.existsSync(f)) { resp.writeHead(404); return resp.end(); }
      resp.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(resp);
    });
    s.listen(0, '127.0.0.1', () => res(s));
  });
}

let fallas = 0;
function ok(cond, msg) { console.log((cond ? '  ✔ ' : '  ✘ ') + msg); if (!cond) fallas++; }

(async () => {
  const srv = await servidor();
  const BASE = `http://127.0.0.1:${srv.address().port}/causa-raiz/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('dialog', d => d.accept());
  const foto = async nombre => { if (CAPTURAS) await page.screenshot({ path: path.join(CAPTURAS, nombre + '.png'), fullPage: true }); };
  const guardar = () => page.click('.sheet-foot .btn-primary');

  await page.goto(BASE);
  await page.waitForSelector('.vacio');
  ok(true, 'abre la app sin datos');
  await foto('01-inicio-vacio');

  // ---- Paso 1: nuevo caso (y validación) ----
  await page.click('[data-act="nuevo"]');
  ok(await page.textContent('.sheet-head small') === 'Se va a numerar como RCA-' + new Date().getFullYear() + '-001', 'muestra el número que va a tener');
  await guardar();
  ok(await page.isVisible('#formError'), 'no deja guardar sin título');
  await page.fill('[name="titulo"]', 'Bidones de 5 L con peso bajo en L2');
  await page.selectOption('[name="area"]', 'Línea 2');
  await page.selectOption('[name="categoria"]', 'Peso / volumen fuera de rango');
  await page.click('.seg-opt:has-text("Moderado")');
  await page.fill('[name="producto"]', 'Detergente 5 L');
  await page.fill('[name="lote"]', '2311');
  await page.selectOption('[name="origen"]', 'Control en línea');
  await page.fill('[name="afectado"]', '1.200 L');
  await page.fill('[name="descripcion"]', 'En la recorrida de las 10 h se encontraron 8 bidones con peso <4,95 kg & "fuera de tolerancia".');
  await foto('02-nuevo-caso');
  await guardar();
  await page.waitForSelector('.case-head');
  ok((await page.textContent('.case-head h2')).includes('peso bajo'), 'crea el caso y abre la ficha');
  ok((await page.textContent('.case-head .pill')) === 'En análisis', 'estado inicial: En análisis');
  ok((await page.textContent('.datos')).includes('<4,95') === false && (await page.textContent('.texto')).includes('<4,95 kg & "fuera'), 'el texto con < & " se escapa y se ve tal cual');

  // ---- Paso 2: contención ----
  await page.click('[data-sec="contencion"]');
  await page.fill('[name="contencion"]', 'Se retuvieron 6 pallets del lote 2311 y se re-pesaron al 100 %.');
  await guardar();

  // ---- Paso 3: Ishikawa ----
  await page.click('[data-sec="ishikawa"]');
  await page.fill('[name="maquina"]', 'Pico 3 de llenado parcialmente tapado\nVálvula con desgaste');
  await page.fill('[name="medicion"]', 'Balanza de control sin calibrar desde agosto\n\nbalanza de control SIN calibrar desde agosto');
  await page.fill('[name="mano_obra"]', 'Operario nuevo en el turno tarde');
  await page.fill('[name="metodo"]', 'El instructivo no indica cada cuánto limpiar los picos\nNo hay control de peso al arranque');
  await page.fill('[name="material"]', 'Producto más viscoso de lo normal');
  await page.fill('[name="medio"]', 'Sala a 32 °C');
  await guardar();
  await page.waitForSelector('.fb');
  ok(await page.locator('.fb .fb-causa-t').count() === 8, 'dibuja 8 causas (la repetida se descarta)');
  await foto('03-ficha-ishikawa');

  // ---- Paso 4: 5 por qué y causa raíz ----
  await page.click('[data-sec="causa"]');
  await page.fill('[name="pq0"]', 'El pico 3 dosificaba menos');
  await page.fill('[name="pq1"]', 'Estaba parcialmente tapado con producto seco');
  await page.fill('[name="pq2"]', 'No se limpió en el cambio de turno');
  await page.fill('[name="pq3"]', 'El instructivo no define la limpieza de picos en el cambio de turno');
  await page.click('[data-act="usar-ultimo"]');
  ok(await page.inputValue('[name="causaRaiz"]') === 'El instructivo no define la limpieza de picos en el cambio de turno', '"Usar el último por qué" copia la respuesta');
  await page.check('input[name="raiz"][value="metodo|0"]');
  await page.check('input[name="raiz"][value="maquina|0"]');
  await foto('04-cinco-porques');
  await guardar();
  ok((await page.textContent('.case-head .pill')) === 'Acciones en curso', 'con causa raíz pasa a Acciones en curso');
  ok(await page.locator('.fb .fb-raiz').count() === 2, 'las causas raíz se resaltan con ★ en el dibujo');

  // ---- Paso 6 antes de tiempo: no deja cerrar ----
  await page.click('[data-sec="eficacia"]');
  await page.click('.seg-opt:has-text("Eficaz") >> nth=0');
  await guardar();
  ok((await page.textContent('#formError')).includes('al menos una'), 'no deja declarar eficaz sin acciones');
  await page.click('.sheet-foot [data-act="cerrar-sheet"]');

  // ---- Paso 5: acciones (una vencida) ----
  await page.click('[data-sec="accion-nueva"]');
  await page.fill('[name="texto"]', 'Agregar la limpieza de picos al instructivo de cambio de turno');
  await page.fill('[name="responsable"]', 'Jefe de producción');
  await page.fill('[name="plazo"]', '2026-01-10');
  await guardar();
  await page.click('[data-sec="accion-nueva"]');
  await page.click('.seg-opt:has-text("Preventiva")');
  await page.fill('[name="texto"]', 'Calibrar la balanza de control de L2');
  await page.fill('[name="plazo"]', '2099-12-31');
  await guardar();
  ok(await page.locator('.acciones li').count() === 2, 'carga dos acciones');
  ok((await page.textContent('#topStatus')).includes('1 acción vencida'), 'avisa la acción vencida en la barra');
  await page.click('.acciones li:first-child .log-row');
  await page.check('#inHecha');
  await guardar();
  await page.click('.acciones li:nth-child(2) .log-row');
  await page.check('#inHecha');
  await guardar();
  ok((await page.textContent('.case-head .pill')) === 'Verificar eficacia', 'con todo hecho pasa a Verificar eficacia');
  ok((await page.textContent('#topStatus')).trim() === '', 'ya no hay vencidas');

  // ---- Paso 6: eficacia → cerrado ----
  await page.click('[data-sec="eficacia"]');
  await page.click('.seg-opt:has-text("Eficaz") >> nth=0');
  await page.fill('[name="evidencia"]', '3 semanas sin desvíos de peso en L2.');
  await guardar();
  ok((await page.textContent('.case-head .pill')) === 'Cerrado', 'eficaz cierra el caso');
  ok(await page.locator('.steps .done').count() === 6, 'los 6 pasos quedan completos');
  const hist = await page.locator('.historial li').count();
  ok(hist >= 9, `el historial registra los cambios (${hist} entradas)`);
  await foto('05-ficha-cerrada');

  // ---- Informe imprimible ----
  await page.click('[data-act="informe"]');
  await page.waitForSelector('.report .fb');
  ok((await page.textContent('.report')).includes('El instructivo no define'), 'el informe tiene la causa raíz');
  await foto('06-informe');
  await page.emulateMedia({ media: 'print' });
  ok(!(await page.isVisible('.tabbar')) && await page.isVisible('.report'), 'al imprimir solo se ve el informe');
  if (CAPTURAS) await page.pdf({ path: path.join(CAPTURAS, 'informe.pdf'), format: 'A4', printBackground: true });
  await page.emulateMedia({ media: 'screen' });

  // ---- Más casos para el Pareto (directo en localStorage, más rápido que por la UI) ----
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('causaRaiz.v1'));
    const anio = new Date().getFullYear();
    const tipos = ['Peso / volumen fuera de rango', 'Peso / volumen fuera de rango', 'Etiquetado / codificado', 'Etiquetado / codificado',
      'Etiquetado / codificado', 'Etiquetado / codificado', 'Envase dañado', 'Pérdida / derrame', 'Paletizado'];
    tipos.forEach((t, i) => d.casos.push({ id: 'x' + i, numero: `RCA-${anio}-${String(i + 2).padStart(3, '0')}`, fecha: `${anio}-0${(i % 8) + 1}-15`,
      titulo: 'Caso ' + (i + 2), categoria: t, area: i % 2 ? 'Línea 1' : 'Línea 3', causaRaiz: i < 5 ? 'x' : '',
      ishikawa: { metodo: [{ texto: 'a', raiz: i < 3 }], material: [{ texto: 'b', raiz: i >= 3 && i < 5 }] }, historial: [] }));
    localStorage.setItem('causaRaiz.v1', JSON.stringify(d));
  });
  await page.reload();
  await page.click('[data-tab="pareto"]');
  await page.waitForSelector('.pr');
  const barras = await page.locator('.pr .pr-barra').count();
  ok(barras === 5, `Pareto por tipo: 5 barras (${barras})`);
  ok((await page.textContent('.r-table tbody tr:first-child')).includes('Etiquetado'), 'la barra más alta va primero');
  ok((await page.textContent('.r-conclusion')).includes('%'), 'dice dónde se concentra el problema');
  await foto('07-pareto');
  await page.click('[data-act="pmodo"][data-v="m6"]');
  ok((await page.textContent('.r-table')).includes('Método'), 'Pareto por 6M cuenta las causas raíz');

  // ---- CSV ----
  await page.click('[data-tab="ajustes"]');
  const [csv] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="csv"]')]);
  const textoCsv = fs.readFileSync(await csv.path(), 'utf8');
  ok(textoCsv.charCodeAt(0) === 0xFEFF && textoCsv.split('\r\n').length === 11, 'CSV con BOM, cabecera y 10 casos');

  // ---- Respaldo: descargar, borrar, restaurar ----
  const [resp] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="exportar"]')]);
  const archivo = await resp.path();
  await page.evaluate(() => localStorage.removeItem('causaRaiz.v1'));
  await page.reload();
  await page.click('[data-tab="ajustes"]');
  await page.setInputFiles('#inImport', { name: 'otro.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"mash-check","datos":{}}') });
  await page.waitForTimeout(300);
  await page.setInputFiles('#inImport', archivo);
  await page.waitForSelector('.toast:not([hidden])');
  ok((await page.textContent('.toast')).includes('10 casos'), 'restaura el respaldo (y rechazó el de otra app)');
  await foto('08-ajustes');

  // ---- Casos de ejemplo: solo con la app vacía, y se borran sin tocar los reales ----
  await page.click('[data-tab="casos"]');
  ok(!(await page.isVisible('[data-act="cargar-ejemplos"]')), 'con casos propios no ofrece ejemplos');
  await page.evaluate(() => localStorage.removeItem('causaRaiz.v1'));
  await page.reload();
  await page.click('[data-act="cargar-ejemplos"]');
  await page.waitForSelector('.aviso-ejemplo');
  const nEj = await page.locator('#lista .log-row').count();
  ok(nEj === 10, 'carga 10 casos de ejemplo y avisa que son inventados (' + nEj + ')');
  await page.click('[data-act="nuevo"]');
  await page.fill('[name="titulo"]', 'Caso propio');
  await page.selectOption('[name="categoria"]', 'Contaminación');
  await guardar();
  await page.waitForSelector('.case-head');
  await page.click('[data-act="volver"]');
  await page.click('[data-act="borrar-ejemplos"]');
  await page.click('[data-act="filtro"][data-v="todos"]');
  const quedan = await page.locator('#lista .log-row').allTextContents();
  ok(quedan.length === 1 && quedan[0].includes('Caso propio') && !(await page.isVisible('.aviso-ejemplo')), 'borrar ejemplos deja solo el caso propio');
  await page.evaluate(() => localStorage.removeItem('causaRaiz.v1'));
  await page.click('[data-tab="ajustes"]');
  await page.setInputFiles('#inImport', archivo);
  await page.waitForSelector('.toast:not([hidden])');

  // ---- Modo oscuro ----
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.click('[data-tab="casos"]');
  await foto('09-lista-oscuro');
  await page.click('.log-row >> nth=0');
  await foto('10-ficha-oscuro');
  await page.emulateMedia({ colorScheme: 'light' });

  // ---- Sin conexión ----
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 10000 }).catch(() => {});
  await ctx.setOffline(true);
  await page.reload();
  ok(await page.isVisible('.case-head, .kpis'), 'abre sin conexión (service worker)');
  await ctx.setOffline(false);

  ok(errores.length === 0, 'sin errores de JavaScript' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await browser.close();
  srv.close();
  console.log(fallas ? `\n${fallas} prueba(s) fallaron` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
