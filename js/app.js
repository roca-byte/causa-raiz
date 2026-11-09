/*
 * app.js — Interfaz. Pestañas: Casos, Pareto y Ajustes.
 *
 * Mismo patrón que controlLinea y mash-check: cada pantalla es una función render*() que
 * escribe HTML en #view, y los botones llevan data-act="..." que atiende UN solo listener
 * (delegación de eventos). Los formularios se abren en una "hoja" que sube desde abajo.
 *
 * Un caso se trabaja en 6 pasos, como un 8D simplificado:
 *   1 Problema → 2 Contención → 3 Ishikawa (6M) → 4 5 por qué y causa raíz →
 *   5 Plan de acción → 6 Verificación de eficacia (cierra el caso)
 */
(() => {
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = Rca.esc;
  const fc = Rca.fechaCorta;
  const view = $('#view');
  const sheet = $('#sheet');

  const ui = {
    tab: 'casos',
    casoId: null,        // caso abierto (null = lista)
    informe: false,      // dentro del caso: ver el informe imprimible
    filtro: 'abiertos',
    buscar: '',
    pModo: 'tipo',
    pDesde: Rca.hoy().slice(0, 4) + '-01-01',   // por defecto: el año en curso
    pHasta: ''
  };

  // ---------- utilidades ----------
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }
  const SIN_ESPACIO = 'No se pudo guardar: el dispositivo se quedó sin espacio. Descargá un respaldo.';
  function guardarCaso(c, nota) { if (!Store.guardarCaso(c, nota)) { toast(SIN_ESPACIO); return false; } return true; }

  const pill = est => `<span class="pill pill-${est}">${esc(Rca.ESTADOS[est])}</span>`;
  const pillSev = s => (s ? `<span class="pill pill-sev-${s === 'Crítico' ? 'critico' : s === 'Moderado' ? 'moderado' : 'leve'}">${esc(s)}</span>` : '');
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

  function descargar(nombre, contenido, tipo) {
    const blob = new Blob([contenido], { type: tipo });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // <option> de una lista de Ajustes. Si el caso tiene un valor que ya no está en la lista
  // (se borró en Ajustes), igual se muestra, para no perderlo al editar.
  function opciones(lista, actual, vacio) {
    const todas = lista.slice();
    if (actual && todas.indexOf(actual) < 0) todas.push(actual);
    return `<option value="">${esc(vacio)}</option>` +
      todas.map(v => `<option value="${esc(v)}"${v === actual ? ' selected' : ''}>${esc(v)}</option>`).join('');
  }

  function seg(nombre, legend, valores, actual, clases) {
    return `<fieldset class="seg"><legend>${esc(legend)}</legend>` + valores.map(([v, txt], i) =>
      `<label class="seg-opt ${clases ? clases[i] : ''}"><input type="radio" name="${nombre}" value="${esc(v)}"${v === actual ? ' checked' : ''}><span>${esc(txt)}</span></label>`
    ).join('') + `</fieldset>`;
  }

  // ---------- hoja (formularios) ----------
  function abrirSheet(html) {
    sheet.innerHTML = `<div class="sheet-backdrop" data-act="cerrar-sheet"></div><div class="sheet-panel" role="dialog" aria-modal="true">${html}</div>`;
    sheet.hidden = false;
    document.body.classList.add('sheet-open');
    const primero = sheet.querySelector('input:not([type=radio]):not([type=checkbox]):not([type=hidden]), textarea, select');
    if (primero && window.matchMedia('(pointer: fine)').matches) primero.focus();   // en el celular no: abriría el teclado
  }
  function cerrarSheet() {
    sheet.hidden = true; sheet.innerHTML = '';
    document.body.classList.remove('sheet-open');
  }
  function cabezaSheet(titulo, sub) {
    return `<div class="sheet-head"><div><h2>${esc(titulo)}</h2>${sub ? `<small>${sub}</small>` : ''}</div>
      <button type="button" class="icon-btn" data-act="cerrar-sheet" aria-label="Cerrar">✕</button></div>`;
  }
  const pieSheet = (extra) => `<p class="form-error" id="formError" hidden></p>
    <div class="sheet-foot">${extra || ''}<button type="button" class="btn btn-ghost" data-act="cerrar-sheet">Cancelar</button>
    <button type="submit" class="btn btn-primary">Guardar</button></div>`;
  function errorForm(msg) { const e = $('#formError'); e.textContent = msg; e.hidden = false; e.scrollIntoView({ block: 'nearest' }); }

  // ---------- render general ----------
  function topStatus() {
    const hoy = Rca.hoy();
    const v = Store.casos().reduce((n, c) => n + Rca.resumenAcciones(c, hoy).vencidas, 0);
    $('#topStatus').innerHTML = v ? `<span class="chip chip-alerta">${plural(v, 'acción vencida', 'acciones vencidas')}</span>` : '';
  }

  function render() {
    document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === ui.tab));
    topStatus();
    if (ui.tab === 'casos') {
      const c = ui.casoId && Store.caso(ui.casoId);
      if (!c) { ui.casoId = null; renderLista(); }
      else if (ui.informe) renderInforme(c);
      else renderCaso(c);
    } else if (ui.tab === 'pareto') renderPareto();
    else renderAjustes();
  }

  // ---------- Casos: lista ----------
  const FILTROS = [['abiertos', 'Abiertos'], ['vencidas', 'Con vencidas'], ['cerrados', 'Cerrados'], ['todos', 'Todos']];

  function renderLista() {
    const hoy = Rca.hoy();
    const k = Rca.kpis(Store.casos(), hoy);
    view.innerHTML = `
      <section class="kpis">
        <div class="kpi"><strong>${k.abiertos}</strong><span>Abiertos</span></div>
        <div class="kpi${k.vencidas ? ' kpi-bad' : ''}"><strong>${k.vencidas}</strong><span>Acciones vencidas</span></div>
        <div class="kpi"><strong>${k.cerrados}</strong><span>Cerrados</span></div>
        <div class="kpi"><strong>${k.eficacia == null ? '—' : k.eficacia + '%'}</strong><span>Eficacia</span></div>
      </section>
      <section><button type="button" class="btn btn-primary btn-xl" data-act="nuevo">+ Nuevo caso</button></section>
      <section class="buscador">
        <input type="search" id="inBuscar" placeholder="Buscar por número, título, lote o producto" value="${esc(ui.buscar)}" aria-label="Buscar">
        <div class="filtros" role="group" aria-label="Filtrar">${FILTROS.map(([v, t]) =>
          `<button type="button" class="filtro${ui.filtro === v ? ' on' : ''}" data-act="filtro" data-v="${v}" aria-pressed="${ui.filtro === v}">${t}</button>`).join('')}</div>
      </section>
      <section id="lista"></section>`;
    pintarLista();
  }

  // Solo repinta la lista (no toda la pantalla): así el buscador no pierde el foco al escribir.
  function pintarLista() {
    const hoy = Rca.hoy();
    const q = ui.buscar.trim().toLowerCase();
    const lista = Store.casos().filter(c => {
      const est = Rca.estado(c, hoy);
      if (ui.filtro === 'abiertos' && est === 'cerrado') return false;
      if (ui.filtro === 'cerrados' && est !== 'cerrado') return false;
      if (ui.filtro === 'vencidas' && !Rca.resumenAcciones(c, hoy).vencidas) return false;
      return !q || [c.numero, c.titulo, c.lote, c.producto, c.area, c.categoria].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    const cont = $('#lista');
    if (!Store.casos().length) {
      cont.innerHTML = `<div class="vacio"><h2>Todavía no hay casos</h2><p>Un caso es un problema que querés analizar hasta la causa raíz:
        un desvío que se repite, un reclamo o una no conformidad. Tocá <strong>+ Nuevo caso</strong> para empezar.</p>
        <p>¿Querés ver primero cómo queda un análisis terminado?</p>
        <button type="button" class="btn btn-ghost btn-block" data-act="cargar-ejemplos">Ver casos de ejemplo</button></div>`;
      return;
    }
    // Aviso fijo mientras haya ejemplos: que nadie los confunda con casos reales.
    const aviso = Store.hayEjemplos() ? `<div class="aviso-ejemplo"><p><strong>Casos de ejemplo</strong> con datos inventados.
      Probá abrirlos, editarlos o mirar el Pareto.</p>
      <button type="button" class="btn btn-ghost btn-sm" data-act="borrar-ejemplos">Borrar ejemplos</button></div>` : '';
    if (!lista.length) { cont.innerHTML = aviso + '<p class="muted centro">No hay casos con ese filtro.</p>'; return; }
    cont.innerHTML = aviso + `<ul class="log">` + lista.map(c => {
      const est = Rca.estado(c, hoy);
      const r = Rca.resumenAcciones(c, hoy);
      const info = [fc(c.fecha), c.area, c.categoria].filter(Boolean).map(esc).join(' · ');
      return `<li><button type="button" class="log-row" data-act="abrir" data-id="${esc(c.id)}">
        <span class="log-main"><strong>${esc(c.titulo || 'Sin título')}</strong><small>${esc(c.numero)} · ${info}</small></span>
        <span class="log-side">${pill(est)}${r.vencidas ? `<span class="pill pill-no_eficaz">${plural(r.vencidas, 'vencida', 'vencidas')}</span>` : ''}</span>
      </button></li>`;
    }).join('') + `</ul>`;
  }

  // ---------- Casos: ficha del caso ----------
  function tarjeta(n, titulo, sec, cuerpo, boton) {
    return `<section class="card"><div class="card-head"><h3><span class="num">${n}</span>${esc(titulo)}</h3>
      ${boton === false ? '' : `<button type="button" class="btn btn-ghost btn-sm" data-act="editar" data-sec="${sec}">${boton || 'Editar'}</button>`}</div>${cuerpo}</section>`;
  }
  const parrafo = (v, ayuda) => (String(v || '').trim() ? `<p class="texto">${esc(v).replace(/\n/g, '<br>')}</p>` : `<p class="ayuda">${ayuda}</p>`);

  function renderCaso(c) {
    const hoy = Rca.hoy();
    const est = Rca.estado(c, hoy);
    const pasos = Rca.pasos(c);
    const dato = (k, v) => `<div><dt>${k}</dt><dd>${String(v || '').trim() ? esc(v) : '—'}</dd></div>`;
    const totalCausas = Rca.M6.reduce((n, m) => n + c.ishikawa[m.id].length, 0);
    const raices = Rca.causasRaiz(c);

    let h = `<div class="back-row">
        <button type="button" class="link" data-act="volver">‹ Casos</button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="informe">Ver informe</button>
      </div>
      <section class="card case-head">
        <small>${esc(c.numero)} · ${esc(fc(c.fecha))}</small>
        <h2>${esc(c.titulo || 'Sin título')}</h2>
        <div class="case-pills">${pill(est)}${pillSev(c.severidad)}</div>
        <ol class="steps">${pasos.map(p => `<li class="${p.hecho ? 'done' : ''}"><i></i><span>${esc(p.nombre)}</span></li>`).join('')}</ol>
      </section>`;

    h += tarjeta(1, 'Problema', 'problema', `<dl class="datos">${dato('Área', c.area)}${dato('Producto', c.producto)}${dato('Lote', c.lote)}
      ${dato('Tipo', c.categoria)}${dato('Origen', c.origen)}${dato('Cantidad afectada', c.afectado)}</dl>
      ${parrafo(c.descripcion, 'Describí qué pasó, dónde, cuándo y cómo se detectó.')}`);

    h += tarjeta(2, 'Contención', 'contencion', parrafo(c.contencion,
      'La acción inmediata para que el problema no siga saliendo (segregar, retener, reinspeccionar). No es la solución de fondo.'));

    h += tarjeta(3, 'Ishikawa (6M)', 'ishikawa', totalCausas
      ? `<div class="scroll-x">${Graficos.ishikawa(c)}</div><p class="muted small">${plural(totalCausas, 'causa posible', 'causas posibles')} · ${plural(raices.length, 'marcada', 'marcadas')} como raíz (★). Deslizá el dibujo hacia los costados.</p>`
      : `<p class="ayuda">Anotá las causas POSIBLES en cada una de las 6M (Método, Máquina, Mano de obra, Material, Medición, Medio ambiente). Todavía no hace falta saber cuál es la real.</p>`,
      totalCausas ? 'Editar' : 'Cargar causas');

    const pq = c.porques.map((p, i) => ({ p, i })).filter(x => x.p.trim());
    h += tarjeta(4, '5 por qué y causa raíz', 'causa',
      (pq.length ? `<ol class="porques">${pq.map(x => `<li><span>¿Por qué ${x.i + 1}?</span>${esc(x.p)}</li>`).join('')}</ol>` : '') +
      (Rca.tieneCausaRaiz(c) ? `<div class="raiz"><span>Causa raíz</span>${esc(c.causaRaiz)}</div>`
        : `<p class="ayuda">Preguntá "¿por qué?" desde el problema hasta llegar a algo que, si se corrige, evita que vuelva a pasar. Esa es la causa raíz.</p>`),
      Rca.tieneCausaRaiz(c) ? 'Editar' : 'Analizar');

    const acciones = c.acciones.length ? `<ul class="acciones">` + c.acciones.map(a => {
      const venc = Rca.accionVencida(a, hoy);
      const est2 = a.hecha ? `<span class="pill pill-cerrado">Hecha</span>` : venc ? `<span class="pill pill-no_eficaz">Vencida</span>` : `<span class="pill pill-acciones">Pendiente</span>`;
      const info = [Rca.TIPOS_ACCION[a.tipo], a.responsable, a.plazo && 'Plazo ' + fc(a.plazo)].filter(Boolean).map(esc).join(' · ');
      return `<li><button type="button" class="log-row${a.hecha ? ' hecha' : ''}" data-act="accion" data-id="${esc(a.id)}">
        <span class="log-main"><strong>${esc(a.texto)}</strong><small>${info}</small></span>${est2}</button></li>`;
    }).join('') + `</ul>` : `<p class="ayuda">Cada acción ataca la causa raíz: qué se hace, quién y para cuándo.</p>`;
    h += tarjeta(5, 'Plan de acción', 'accion-nueva', acciones, '+ Acción');

    const ef = c.eficacia;
    h += tarjeta(6, 'Verificación de eficacia', 'eficacia',
      (ef.estado === 'pendiente'
        ? `<p class="ayuda">Cuando las acciones estén hechas, comprobá después de un tiempo que el problema no volvió a aparecer. Si es eficaz, el caso se cierra.</p>`
        : `<p><span class="pill pill-ef-${ef.estado}">${esc(Rca.EFICACIA[ef.estado])}</span>${ef.fecha ? ' · ' + esc(fc(ef.fecha)) : ''}</p>${parrafo(ef.evidencia, '')}`),
      'Verificar');

    h += `<section class="card"><details><summary>Historial del caso (${c.historial.length})</summary><ul class="historial">` +
      c.historial.slice().reverse().map(x => `<li><time>${esc(fc(x.f.slice(0, 10)) + x.f.slice(10))}</time>${esc(x.t)}</li>`).join('') +
      `</ul></details></section>
      <div class="centro"><button type="button" class="link link-danger" data-act="borrar-caso">Borrar caso</button></div>`;
    view.innerHTML = h;
  }

  function renderInforme(c) {
    view.innerHTML = `<div class="back-row no-print">
        <button type="button" class="link" data-act="cerrar-informe">‹ Volver al caso</button>
      </div>
      <div class="report-actions no-print">
        <button type="button" class="btn btn-primary" data-act="imprimir">Imprimir / PDF</button>
        <button type="button" class="btn btn-ghost" data-act="compartir">Compartir resumen</button>
      </div>
      ${Report.informe(c)}`;
  }

  // ---------- formularios del caso ----------
  function formProblema(c) {
    const cfg = Store.getConfig();
    const nuevo = !c;
    const d = c || Rca.nuevoCaso('', Rca.hoy());
    const sub = nuevo ? `Se va a numerar como <strong>${esc(Rca.siguienteNumero(Store.casos(), Rca.hoy().slice(0, 4)))}</strong>` : esc(d.numero);
    abrirSheet(`<form id="formProblema" data-nuevo="${nuevo ? '1' : ''}" novalidate>
      ${cabezaSheet(nuevo ? 'Nuevo caso' : 'Problema', sub)}
      <label>Título del problema <small>(corto: es lo que se ve en la lista)</small>
        <input name="titulo" value="${esc(d.titulo)}" maxlength="90" placeholder="Ej.: Bidones de 5 L con peso bajo en L2" required></label>
      <div class="row2">
        <label>Fecha<input type="date" name="fecha" value="${esc(d.fecha)}" required></label>
        <label>Área / línea<select name="area">${opciones(cfg.areas, d.area, 'Elegir…')}</select></label>
      </div>
      <label>Tipo de problema <small>(se usa en el Pareto)</small><select name="categoria" required>${opciones(cfg.categorias, d.categoria, 'Elegir…')}</select></label>
      ${seg('severidad', 'Severidad', Rca.SEVERIDADES.map(s => [s, s]), d.severidad, ['seg-off', 'seg-warn', 'seg-bad'])}
      <div class="row2">
        <label>Producto<input name="producto" value="${esc(d.producto)}"></label>
        <label>Lote<input name="lote" value="${esc(d.lote)}"></label>
      </div>
      <div class="row2">
        <label>Origen<select name="origen">${opciones(cfg.origenes, d.origen, 'Elegir…')}</select></label>
        <label>Cantidad afectada<input name="afectado" value="${esc(d.afectado)}" placeholder="Ej.: 1.200 L"></label>
      </div>
      <label>Descripción <small>(qué, dónde, cuándo, cómo se detectó)</small>
        <textarea name="descripcion" rows="4">${esc(d.descripcion)}</textarea></label>
      ${pieSheet()}
    </form>`);
  }

  function formContencion(c) {
    abrirSheet(`<form id="formContencion" novalidate>${cabezaSheet('Contención', esc(c.numero))}
      <label>Acción inmediata <small>(qué se hizo para que no siga saliendo producto con el problema)</small>
        <textarea name="contencion" rows="5" placeholder="Ej.: Se retuvieron 6 pallets del lote 2311 y se re-pesaron al 100 %.">${esc(c.contencion)}</textarea></label>
      ${pieSheet()}</form>`);
  }

  const EJEMPLOS_6M = {
    metodo: 'Ej.: instructivo desactualizado', maquina: 'Ej.: pico de llenado tapado',
    mano_obra: 'Ej.: operario sin capacitación', material: 'Ej.: envase de otro proveedor',
    medicion: 'Ej.: balanza sin calibrar', medio: 'Ej.: temperatura alta en la sala'
  };
  function formIshikawa(c) {
    abrirSheet(`<form id="formIshikawa" novalidate>${cabezaSheet('Ishikawa (6M)', 'Una causa por renglón')}
      ${Rca.M6.map(m => `<label>${esc(m.nombre)}<textarea name="${m.id}" rows="3" placeholder="${esc(EJEMPLOS_6M[m.id])}">${esc(c.ishikawa[m.id].map(x => x.texto).join('\n'))}</textarea></label>`).join('')}
      ${pieSheet()}</form>`);
  }

  function formCausa(c) {
    const causas = [];
    Rca.M6.forEach(m => c.ishikawa[m.id].forEach((x, i) => causas.push({ m, x, i })));
    const preguntas = ['¿Por qué pasó el problema?', '¿Y por qué pasó eso?', '¿Por qué?', '¿Por qué?', '¿Por qué?'];
    abrirSheet(`<form id="formCausa" novalidate>${cabezaSheet('5 por qué y causa raíz', esc(c.numero))}
      <p class="ayuda">No hace falta llegar a 5: cortá cuando la respuesta sea algo que se puede corregir.</p>
      ${c.porques.map((p, i) => `<label>${i + 1}. ${preguntas[i]}<input name="pq${i}" value="${esc(p)}"></label>`).join('')}
      <fieldset class="marcar"><legend>¿Qué causas del Ishikawa son causa raíz?</legend>
        ${causas.length ? causas.map(({ m, x, i }) => `<label class="check"><input type="checkbox" name="raiz" value="${m.id}|${i}"${x.raiz ? ' checked' : ''}>
          <span>${esc(x.texto)} <small class="muted">· ${esc(m.nombre)}</small></span></label>`).join('')
        : '<p class="ayuda">Todavía no cargaste causas en el Ishikawa. Podés hacerlo después: sirve para el Pareto por 6M.</p>'}
      </fieldset>
      <label>Causa raíz <small>(en una frase)</small><textarea name="causaRaiz" rows="3">${esc(c.causaRaiz)}</textarea></label>
      <button type="button" class="link" data-act="usar-ultimo">Usar la respuesta del último "por qué"</button>
      ${pieSheet()}</form>`);
  }

  function formAccion(c, a) {
    const nueva = !a;
    const d = a || Store.nuevaAccion();
    abrirSheet(`<form id="formAccion" data-id="${esc(d.id)}" data-nueva="${nueva ? '1' : ''}" novalidate>
      ${cabezaSheet(nueva ? 'Nueva acción' : 'Acción', esc(c.numero))}
      ${seg('tipo', 'Tipo', [['correctiva', 'Correctiva'], ['preventiva', 'Preventiva']], d.tipo)}
      <label>Qué se va a hacer<textarea name="texto" rows="3" placeholder="Ej.: Calibrar la balanza de L2 y sumarla al plan de calibración mensual">${esc(d.texto)}</textarea></label>
      <div class="row2">
        <label>Responsable<input name="responsable" value="${esc(d.responsable)}"></label>
        <label>Plazo<input type="date" name="plazo" value="${esc(d.plazo)}"></label>
      </div>
      <label class="check"><input type="checkbox" name="hecha" id="inHecha"${d.hecha ? ' checked' : ''}><span>Ya está hecha</span></label>
      <label id="lblFechaHecha"${d.hecha ? '' : ' hidden'}>Fecha en que se hizo<input type="date" name="fechaHecha" value="${esc(d.fechaHecha || Rca.hoy())}"></label>
      ${pieSheet(nueva ? '' : '<button type="button" class="link link-danger" data-act="borrar-accion">Borrar</button>')}
    </form>`);
  }

  function formEficacia(c) {
    const ef = c.eficacia;
    const aviso = Rca.validarEficaz(c);
    abrirSheet(`<form id="formEficacia" novalidate>${cabezaSheet('Verificación de eficacia', esc(c.numero))}
      ${aviso ? `<p class="aviso">Para marcarla como eficaz: ${esc(aviso)}</p>` : ''}
      ${seg('estado', '¿La acción fue eficaz?', [['pendiente', 'Pendiente'], ['eficaz', 'Eficaz'], ['no_eficaz', 'No eficaz']], ef.estado, ['seg-off', 'seg-ok', 'seg-bad'])}
      <label>Fecha de verificación<input type="date" name="fecha" value="${esc(ef.fecha || Rca.hoy())}"></label>
      <label>Evidencia <small>(cómo comprobaste que no volvió a pasar)</small>
        <textarea name="evidencia" rows="4" placeholder="Ej.: 3 semanas sin desvíos de peso en L2 (registros de control en línea).">${esc(ef.evidencia)}</textarea></label>
      ${pieSheet()}</form>`);
  }

  // ---------- guardar formularios ----------
  const val = (f, n) => (f.elements[n] ? String(f.elements[n].value || '').trim() : '');
  const radio = (f, n) => { const r = f.querySelector(`input[name="${n}"]:checked`); return r ? r.value : ''; };

  const GUARDAR = {
    formProblema(f) {
      const datos = {
        titulo: val(f, 'titulo'), fecha: val(f, 'fecha'), area: val(f, 'area'), categoria: val(f, 'categoria'),
        severidad: radio(f, 'severidad'), producto: val(f, 'producto'), lote: val(f, 'lote'),
        origen: val(f, 'origen'), afectado: val(f, 'afectado'), descripcion: val(f, 'descripcion')
      };
      if (!datos.titulo) return errorForm('Poné un título al problema.');
      if (!datos.fecha) return errorForm('Elegí la fecha.');
      if (!datos.categoria) return errorForm('Elegí el tipo de problema: lo necesita el Pareto.');
      if (f.dataset.nuevo) {
        const c = Store.crearCaso(datos);
        if (!c) return errorForm(SIN_ESPACIO);
        ui.casoId = c.id; ui.informe = false;
        cerrarSheet(); render(); toast(`Caso ${c.numero} creado`);
        return;
      }
      const c = Store.caso(ui.casoId);
      Object.assign(c, datos);
      if (guardarCaso(c, 'Datos del problema editados')) { cerrarSheet(); render(); toast('Guardado'); }
    },

    formContencion(f) {
      const c = Store.caso(ui.casoId);
      const antes = c.contencion;
      c.contencion = val(f, 'contencion');
      if (c.contencion === antes) { cerrarSheet(); return; }
      if (guardarCaso(c, antes ? 'Contención editada' : 'Contención cargada')) { cerrarSheet(); render(); toast('Guardado'); }
    },

    formIshikawa(f) {
      const c = Store.caso(ui.casoId);
      Rca.M6.forEach(m => { c.ishikawa[m.id] = Rca.textoACausas(f.elements[m.id].value, c.ishikawa[m.id]); });
      const n = Rca.M6.reduce((s, m) => s + c.ishikawa[m.id].length, 0);
      if (guardarCaso(c, `Ishikawa actualizado (${plural(n, 'causa', 'causas')})`)) { cerrarSheet(); render(); toast('Guardado'); }
    },

    formCausa(f) {
      const c = Store.caso(ui.casoId);
      c.porques = [0, 1, 2, 3, 4].map(i => val(f, 'pq' + i));
      const marcadas = {};
      f.querySelectorAll('input[name="raiz"]:checked').forEach(x => { marcadas[x.value] = true; });
      Rca.M6.forEach(m => c.ishikawa[m.id].forEach((x, i) => { x.raiz = !!marcadas[m.id + '|' + i]; }));
      const antes = c.causaRaiz;
      c.causaRaiz = val(f, 'causaRaiz');
      const nota = c.causaRaiz !== antes ? (c.causaRaiz ? 'Causa raíz definida: ' + c.causaRaiz : 'Causa raíz borrada') : 'Análisis de los 5 por qué editado';
      if (guardarCaso(c, nota)) { cerrarSheet(); render(); toast('Guardado'); }
    },

    formAccion(f) {
      const c = Store.caso(ui.casoId);
      const texto = val(f, 'texto');
      if (!texto) return errorForm('Escribí qué se va a hacer.');
      let a = c.acciones.find(x => x.id === f.dataset.id);
      const nueva = !a;
      if (nueva) { a = Store.nuevaAccion(); a.id = f.dataset.id; c.acciones.push(a); }
      const estabaHecha = a.hecha;
      Object.assign(a, {
        tipo: radio(f, 'tipo') || 'correctiva', texto, responsable: val(f, 'responsable'), plazo: val(f, 'plazo'),
        hecha: f.elements.hecha.checked
      });
      a.fechaHecha = a.hecha ? (val(f, 'fechaHecha') || Rca.hoy()) : '';
      const nota = nueva ? 'Acción agregada: ' + texto
        : (a.hecha && !estabaHecha) ? 'Acción cumplida: ' + texto
        : (!a.hecha && estabaHecha) ? 'Acción reabierta: ' + texto : 'Acción editada: ' + texto;
      if (guardarCaso(c, nota)) { cerrarSheet(); render(); toast('Guardado'); }
    },

    formEficacia(f) {
      const c = Store.caso(ui.casoId);
      const estado = radio(f, 'estado') || 'pendiente';
      if (estado === 'eficaz') { const err = Rca.validarEficaz(c); if (err) return errorForm(err); }
      const antes = c.eficacia.estado;
      c.eficacia = { estado, fecha: estado === 'pendiente' ? '' : val(f, 'fecha'), evidencia: val(f, 'evidencia') };
      const nota = estado === antes ? 'Verificación de eficacia editada'
        : estado === 'eficaz' ? 'Eficacia verificada: eficaz. Caso cerrado'
        : estado === 'no_eficaz' ? 'Eficacia verificada: no eficaz. Revisar el análisis y las acciones'
        : 'Verificación de eficacia vuelta a pendiente';
      if (guardarCaso(c, nota)) { cerrarSheet(); render(); toast(estado === 'eficaz' ? 'Caso cerrado' : 'Guardado'); }
    },

    formAjustes(f) {
      const lista = n => val(f, n).split('\n').map(x => x.trim()).filter(Boolean);
      const categorias = lista('categorias');
      if (!categorias.length) { toast('Dejá al menos un tipo de problema.'); return; }
      const ok = Store.setConfig({
        analista: val(f, 'analista'), areas: lista('areas'), categorias, origenes: lista('origenes'),
        codigo: val(f, 'codigo'), revision: val(f, 'revision')
      });
      toast(ok ? 'Ajustes guardados' : SIN_ESPACIO);
    }
  };

  // ---------- Pareto ----------
  const MODOS = {
    tipo: { boton: 'Tipo de problema', titulo: 'Por tipo de problema', unidad: 'casos' },
    m6: { boton: 'Causa raíz (6M)', titulo: 'Por causa raíz (6M)', unidad: 'causas raíz' },
    area: { boton: 'Área / línea', titulo: 'Por área / línea', unidad: 'casos' }
  };

  function renderPareto() {
    const modo = MODOS[ui.pModo];
    const casos = Store.casos().filter(c => Rca.enPeriodo(c, ui.pDesde, ui.pHasta));
    const res = Rca.pareto(Rca.clavesPareto(casos, ui.pModo));
    view.innerHTML = `<section class="no-print pareto-tools">
        <div class="filtros" role="group" aria-label="Agrupar por">${Object.keys(MODOS).map(k =>
          `<button type="button" class="filtro${ui.pModo === k ? ' on' : ''}" data-act="pmodo" data-v="${k}" aria-pressed="${ui.pModo === k}">${MODOS[k].boton}</button>`).join('')}</div>
        <div class="row2">
          <label>Desde<input type="date" id="inDesde" value="${esc(ui.pDesde)}"></label>
          <label>Hasta<input type="date" id="inHasta" value="${esc(ui.pHasta)}"></label>
        </div>
        ${ui.pModo === 'm6' ? '<p class="ayuda">Cuenta las M de las causas marcadas como raíz (★) en cada caso. Los casos que todavía no tienen causa raíz no entran.</p>' : ''}
        <div class="report-actions"><button type="button" class="btn btn-primary" data-act="imprimir"${res.total ? '' : ' disabled'}>Imprimir / PDF</button></div>
      </section>
      ${Report.pareto(res, modo.titulo, modo.unidad, ui.pDesde, ui.pHasta)}`;
  }

  // ---------- Ajustes ----------
  function renderAjustes() {
    const cfg = Store.getConfig();
    const logo = Marca.logo();
    const lineas = l => esc(l.join('\n'));
    view.innerHTML = `
      <section class="settings" id="secMarca">
        <h2>Empresa</h2>
        <p class="muted small">Se usa en el encabezado de los informes. Queda guardado solo en este dispositivo.</p>
        <label>Nombre de la empresa<input name="empresa" value="${esc(Marca.datos.empresa || '')}" placeholder="Empresa S.A."></label>
        <div class="logo-row">
          <img src="${esc(logo)}" alt="Logo"${logo ? '' : ' hidden'}>
          <label class="btn btn-ghost file-btn">${logo ? 'Cambiar logo' : 'Cargar logo'}<input type="file" id="inLogo" accept="image/*" hidden></label>
          ${logo ? '<button type="button" class="link link-danger" data-act="quitar-logo">Quitar logo</button>' : ''}
        </div>
      </section>
      <form class="settings" id="formAjustes">
        <h2>Listas</h2>
        <label>Tu nombre <small>(aparece como "Elaboró" y como responsable por defecto)</small><input name="analista" value="${esc(cfg.analista)}"></label>
        <label>Áreas / líneas <small>(una por renglón)</small><textarea name="areas" rows="4">${lineas(cfg.areas)}</textarea></label>
        <label>Tipos de problema <small>(una por renglón; son las barras del Pareto)</small><textarea name="categorias" rows="6">${lineas(cfg.categorias)}</textarea></label>
        <label>Orígenes <small>(cómo se detectó; uno por renglón)</small><textarea name="origenes" rows="4">${lineas(cfg.origenes)}</textarea></label>
        <div class="row2">
          <label>Código del registro<input name="codigo" value="${esc(cfg.codigo)}"></label>
          <label>Revisión<input name="revision" value="${esc(cfg.revision)}"></label>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Guardar ajustes</button>
      </form>
      <section class="settings">
        <h2>Respaldo y exportación</h2>
        <p class="muted small">Los casos viven solo en este dispositivo: si se borran los datos del navegador, se pierden. Descargá un respaldo cada tanto.</p>
        <button type="button" class="btn btn-ghost btn-block" data-act="exportar">Descargar respaldo (.json)</button>
        <label class="btn btn-ghost btn-block file-btn">Restaurar respaldo<input type="file" id="inImport" accept=".json,application/json" hidden></label>
        <button type="button" class="btn btn-ghost btn-block" data-act="csv">Exportar casos a Excel (.csv)</button>
      </section>
      <p class="muted small centro" id="version"></p>`;
    // La versión instalada sale del nombre de la caché del service worker (como en mash-check).
    if ('caches' in window) {
      caches.keys().then(ks => {
        const v = ks.find(k => k.indexOf('causa-raiz-v') === 0);
        const el = $('#version');
        if (v && el) el.textContent = 'Versión ' + v.replace('causa-raiz-', '');
      }).catch(() => {});
    }
  }

  // ---------- eventos ----------
  document.addEventListener('click', e => {
    const tab = e.target.closest('.tabbar button');
    if (tab) {
      // Volver a tocar "Casos" estando en un caso vuelve a la lista.
      if (tab.dataset.tab === ui.tab && ui.tab === 'casos') { ui.casoId = null; ui.informe = false; }
      ui.tab = tab.dataset.tab; render(); window.scrollTo(0, 0); return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const c = ui.casoId ? Store.caso(ui.casoId) : null;
    switch (b.dataset.act) {
      case 'nuevo': formProblema(null); break;
      case 'abrir': ui.casoId = b.dataset.id; ui.informe = false; render(); window.scrollTo(0, 0); break;
      case 'volver': ui.casoId = null; render(); break;
      case 'filtro': ui.filtro = b.dataset.v; render(); break;
      case 'informe': ui.informe = true; render(); window.scrollTo(0, 0); break;
      case 'cerrar-informe': ui.informe = false; render(); break;
      case 'editar': {
        const s = b.dataset.sec;
        if (s === 'problema') formProblema(c);
        else if (s === 'contencion') formContencion(c);
        else if (s === 'ishikawa') formIshikawa(c);
        else if (s === 'causa') formCausa(c);
        else if (s === 'accion-nueva') formAccion(c, null);
        else if (s === 'eficacia') formEficacia(c);
        break;
      }
      case 'accion': formAccion(c, c.acciones.find(a => a.id === b.dataset.id)); break;
      case 'usar-ultimo': {
        const f = $('#formCausa');
        const ultimo = [4, 3, 2, 1, 0].map(i => val(f, 'pq' + i)).find(Boolean);
        if (ultimo) f.elements.causaRaiz.value = ultimo; else toast('Todavía no respondiste ningún "por qué".');
        break;
      }
      case 'borrar-accion': {
        const f = $('#formAccion');
        const a = c.acciones.find(x => x.id === f.dataset.id);
        if (a && confirm('¿Borrar esta acción?')) {
          c.acciones = c.acciones.filter(x => x !== a);
          if (guardarCaso(c, 'Acción borrada: ' + a.texto)) { cerrarSheet(); render(); toast('Acción borrada'); }
        }
        break;
      }
      case 'borrar-caso':
        if (confirm(`Se borra el caso ${c.numero} con todo su análisis. No se puede deshacer. ¿Borrar?`)) {
          if (Store.borrarCaso(c.id)) { ui.casoId = null; render(); toast('Caso borrado'); } else toast(SIN_ESPACIO);
        }
        break;
      case 'cargar-ejemplos':
        if (Store.cargarEjemplos()) { ui.filtro = 'todos'; render(); toast('Se cargaron casos de ejemplo'); } else toast(SIN_ESPACIO);
        break;
      case 'borrar-ejemplos':
        if (confirm('Se borran los casos de ejemplo. Tus casos (si cargaste alguno) quedan. ¿Borrar?')) {
          if (Store.borrarEjemplos()) { ui.filtro = 'abiertos'; render(); toast('Ejemplos borrados'); } else toast(SIN_ESPACIO);
        }
        break;
      case 'cerrar-sheet': cerrarSheet(); break;
      case 'pmodo': ui.pModo = b.dataset.v; render(); break;
      case 'imprimir': window.print(); break;
      case 'compartir': {
        const texto = Report.texto(c);
        if (navigator.share) navigator.share({ title: c.numero, text: texto }).catch(() => {});
        else if (navigator.clipboard) navigator.clipboard.writeText(texto).then(() => toast('Resumen copiado'), () => toast('No se pudo copiar'));
        break;
      }
      case 'quitar-logo':
        Marca.datos.logo = null;
        if (Marca.guardar()) { render(); toast('Logo quitado'); }
        break;
      case 'exportar':
        descargar(`causa-raiz-respaldo-${Rca.hoy()}.json`, Store.exportar(), 'application/json');
        break;
      case 'csv': {
        const hoy = Rca.hoy();
        const filas = [Rca.CABECERA_CSV].concat(Store.casos().map(x => Rca.filaCsv(x, hoy)));
        descargar(`casos-rca-${hoy}.csv`, Rca.csv(filas), 'text/csv;charset=utf-8');
        break;
      }
    }
  });

  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'inBuscar') { ui.buscar = t.value; pintarLista(); }
    else if (t.name === 'empresa' && t.closest('#secMarca')) {
      Marca.datos.empresa = t.value;
      if (!Marca.guardar()) toast(SIN_ESPACIO);
    }
  });

  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'inHecha') { $('#lblFechaHecha').hidden = !t.checked; }
    else if (t.id === 'inDesde') { ui.pDesde = t.value; render(); }
    else if (t.id === 'inHasta') { ui.pHasta = t.value; render(); }
    else if (t.id === 'inLogo' && t.files[0]) {
      Marca.leerLogo(t.files[0], logo => {
        if (!logo) { toast('No se pudo leer esa imagen.'); return; }
        Marca.datos.logo = logo;
        if (Marca.guardar()) { render(); toast('Logo guardado'); }
        else { Marca.datos.logo = null; toast('No hay espacio para el logo. Probá con uno más chico.'); }
      });
      t.value = '';
    } else if (t.id === 'inImport' && t.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          Store.revisarRespaldo(reader.result);   // primero se revisa: si no sirve, ni se pregunta
          if (!confirm('Restaurar REEMPLAZA todos los casos actuales por los del respaldo. ¿Continuar?')) return;
          const n = Store.importar(reader.result);
          ui.casoId = null; render(); toast(`Respaldo restaurado: ${plural(n, 'caso', 'casos')}`);
        } catch (err) { alert(err.message || 'No se pudo leer el archivo.'); }
      };
      reader.readAsText(t.files[0]);
      t.value = '';
    }
  });

  document.addEventListener('submit', e => {
    const fn = GUARDAR[e.target.id];
    if (!fn) return;
    e.preventDefault();
    fn(e.target);
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) cerrarSheet(); });

  // ---------- inicio ----------
  render();
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
