/*
 * report.js — Arma el informe imprimible de un caso, el informe de Pareto y el texto para
 * compartir (global Report). Solo LEE datos: nunca modifica un caso.
 *
 * El informe se imprime con window.print() y las reglas @media print de styles.css
 * (A4, solo se ve el informe). En el celular, "Imprimir" → "Guardar como PDF".
 */
const Report = (() => {
  const esc = Rca.esc;
  const fc = Rca.fechaCorta;
  // Un decimal con coma, como se escribe en Argentina (40,0 y no 40.0).
  const dec = n => n.toFixed(1).replace('.', ',');
  const o = v => (String(v || '').trim() ? esc(v) : '—');   // dato vacío → guion
  // Texto de varios renglones: se escapa y se respetan los saltos de línea.
  const parrafo = v => (String(v || '').trim() ? `<p class="r-texto">${esc(v).replace(/\n/g, '<br>')}</p>` : '<p class="r-empty">Sin cargar.</p>');

  function encabezado(titulo, subtitulo, meta) {
    const logo = Marca.logo();
    const marca = logo ? `<img class="r-logo" src="${esc(logo)}" alt="${esc(Marca.empresa())}">` : `<strong class="r-empresa">${esc(Marca.empresa())}</strong>`;
    const dl = meta.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('');
    return `
      <header class="r-head">
        ${marca}
        <div class="r-title"><h1>${esc(titulo)}</h1><p>${subtitulo}</p></div>
        <dl class="r-meta">${dl}</dl>
      </header>`;
  }

  function pie() {
    const cfg = Store.getConfig();
    const doc = [cfg.codigo, cfg.revision && 'Rev. ' + cfg.revision].filter(Boolean).map(esc).join(' · ');
    return `<footer class="r-foot"><span>${doc}</span><span>Emitido: ${esc(fc(Rca.hoy()))}${cfg.analista ? ' · Elaboró: ' + esc(cfg.analista) : ''}</span></footer>`;
  }

  function informe(c) {
    const hoy = Rca.hoy();
    const est = Rca.estado(c, hoy);
    let h = `<article class="report">`;
    h += encabezado('Análisis de Causa Raíz', `${esc(c.numero)} · ${o(c.titulo)}`, [
      ['Fecha', esc(fc(c.fecha))], ['Área', o(c.area)], ['Producto', o(c.producto)], ['Lote', o(c.lote)],
      ['Tipo', o(c.categoria)], ['Severidad', o(c.severidad)], ['Estado', `<span class="pill pill-${est}">${esc(Rca.ESTADOS[est])}</span>`]
    ]);

    h += `<section class="r-sec"><h2>1. Descripción del problema</h2>
      <p class="r-sub">Origen: ${o(c.origen)} · Cantidad afectada: ${o(c.afectado)}</p>${parrafo(c.descripcion)}</section>`;
    h += `<section class="r-sec"><h2>2. Contención (acción inmediata)</h2>${parrafo(c.contencion)}</section>`;
    h += `<section class="r-sec r-sec-ancha"><h2>3. Diagrama de Ishikawa (6M)</h2>
      <p class="r-sub">★ = causa marcada como causa raíz.</p><div class="r-scroll">${Graficos.ishikawa(c)}</div>
      ${listaCausas(c)}</section>`;

    const pq = c.porques.map((p, i) => ({ p, i })).filter(x => x.p.trim());
    h += `<section class="r-sec"><h2>4. Los 5 por qué</h2>` + (pq.length
      ? `<ol class="r-porques">${pq.map(x => `<li><span>¿Por qué ${x.i + 1}?</span> ${esc(x.p)}</li>`).join('')}</ol>`
      : '<p class="r-empty">Sin cargar.</p>') + `</section>`;
    h += `<section class="r-sec"><h2>5. Causa raíz</h2>` + (Rca.tieneCausaRaiz(c)
      ? `<p class="r-raiz">${esc(c.causaRaiz)}</p>` : '<p class="r-empty">Todavía no está definida.</p>') + `</section>`;

    h += `<section class="r-sec"><h2>6. Plan de acción</h2>` + tablaAcciones(c, hoy) + `</section>`;

    const ef = c.eficacia;
    h += `<section class="r-sec"><h2>7. Verificación de eficacia</h2>
      <p><span class="pill pill-ef-${ef.estado}">${esc(Rca.EFICACIA[ef.estado])}</span>${ef.fecha ? ' · ' + esc(fc(ef.fecha)) : ''}</p>
      ${ef.evidencia ? parrafo(ef.evidencia) : ''}</section>`;

    h += `<section class="r-sec"><h2>Historial del caso</h2><table class="r-table r-hist"><thead><tr><th>Fecha y hora</th><th>Cambio</th></tr></thead><tbody>` +
      c.historial.map(x => `<tr><td>${esc(fc(x.f.slice(0, 10)) + x.f.slice(10))}</td><td>${esc(x.t)}</td></tr>`).join('') +
      `</tbody></table></section>`;
    h += pie() + `</article>`;
    return h;
  }

  // Debajo del dibujo va la lista completa: en el dibujo los textos largos se recortan.
  function listaCausas(c) {
    const grupos = Rca.M6.filter(m => c.ishikawa[m.id].length);
    if (!grupos.length) return '<p class="r-empty">Sin causas cargadas.</p>';
    return `<div class="r-causas">` + grupos.map(m => `<div><h3>${esc(m.nombre)}</h3><ul>` +
      c.ishikawa[m.id].map(x => `<li${x.raiz ? ' class="r-es-raiz"' : ''}>${x.raiz ? '★ ' : ''}${esc(x.texto)}</li>`).join('') +
      `</ul></div>`).join('') + `</div>`;
  }

  function tablaAcciones(c, hoy) {
    if (!c.acciones.length) return '<p class="r-empty">Sin acciones cargadas.</p>';
    const filas = c.acciones.map(a => {
      const venc = Rca.accionVencida(a, hoy);
      const est = a.hecha ? `<span class="pill pill-cerrado">Hecha ${esc(fc(a.fechaHecha))}</span>`
        : venc ? '<span class="pill pill-no_eficaz">Vencida</span>' : '<span class="pill pill-acciones">Pendiente</span>';
      return `<tr><td>${esc(Rca.TIPOS_ACCION[a.tipo] || '')}</td><td>${esc(a.texto)}</td><td>${o(a.responsable)}</td><td>${a.plazo ? esc(fc(a.plazo)) : '—'}</td><td>${est}</td></tr>`;
    }).join('');
    return `<div class="r-scroll"><table class="r-table r-acciones"><thead><tr><th>Tipo</th><th>Acción</th><th>Responsable</th><th>Plazo</th><th>Estado</th></tr></thead><tbody>${filas}</tbody></table></div>`;
  }

  // Informe del Pareto (lo que se ve en la pestaña Pareto, listo para imprimir).
  function pareto(res, titulo, unidad, desde, hasta) {
    const periodo = `${desde ? fc(desde) : 'inicio'} al ${hasta ? fc(hasta) : 'hoy'}`;
    let h = `<article class="report">`;
    h += encabezado('Pareto de problemas', esc(titulo), [['Período', esc(periodo)], ['Total', `${res.total} ${esc(unidad)}`]]);
    if (!res.total) return h + `<p class="r-empty">No hay datos en este período.</p>` + pie() + `</article>`;
    const vitales = res.filas.filter(f => f.vital);
    const pctVital = vitales.length ? Math.round(vitales[vitales.length - 1].acum) : 0;
    h += `<section class="r-sec"><p class="r-conclusion">El <strong>${pctVital} %</strong> de ${esc(unidad)} se concentra en
      <strong>${vitales.map(f => esc(f.clave)).join(', ')}</strong>${vitales.length === 1 ? '' : ` (${vitales.length} de ${res.filas.length})`}: conviene atacarlo primero.</p>
      <div class="r-scroll">${Graficos.pareto(res)}</div></section>`;
    h += `<section class="r-sec"><table class="r-table r-num"><thead><tr><th>#</th><th>Categoría</th><th>Cant.</th><th>%</th><th>% acum.</th></tr></thead><tbody>` +
      res.filas.map((f, i) => `<tr${f.vital ? ' class="r-vital"' : ''}><td>${i + 1}</td><td>${esc(f.clave)}</td><td>${f.n}</td><td>${dec(f.pct)}</td><td>${dec(f.acum)}</td></tr>`).join('') +
      `</tbody></table></section>`;
    return h + pie() + `</article>`;
  }

  // Resumen en texto plano para mandar por WhatsApp o mail (navigator.share).
  function texto(c) {
    const hoy = Rca.hoy();
    const r = Rca.resumenAcciones(c, hoy);
    const l = [
      `${c.numero} · ${c.titulo}`,
      `Fecha: ${fc(c.fecha)}${c.area ? ' · ' + c.area : ''}${c.lote ? ' · Lote ' + c.lote : ''}`,
      `Estado: ${Rca.ESTADOS[Rca.estado(c, hoy)]}`
    ];
    if (c.contencion) l.push(`Contención: ${c.contencion}`);
    if (Rca.tieneCausaRaiz(c)) l.push(`Causa raíz: ${c.causaRaiz}`);
    if (r.total) {
      l.push(`Acciones: ${r.hechas}/${r.total} hechas${r.vencidas ? ` · ${r.vencidas} vencida(s)` : ''}`);
      c.acciones.forEach(a => l.push(`${a.hecha ? '✔' : '•'} ${a.texto}${a.responsable ? ' (' + a.responsable + ')' : ''}${a.plazo && !a.hecha ? ' — plazo ' + fc(a.plazo) : ''}`));
    }
    l.push(`Eficacia: ${Rca.EFICACIA[c.eficacia.estado]}`);
    return l.join('\n');
  }

  return { informe, pareto, texto };
})();
