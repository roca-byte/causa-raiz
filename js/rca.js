/*
 * rca.js — Reglas del análisis de causa raíz (global Rca).
 *
 * Son funciones PURAS: reciben datos y devuelven un resultado, sin tocar la pantalla ni
 * localStorage. Por eso se pueden probar solas con Node (tests/rca.test.js) y la pantalla,
 * el informe y el Pareto usan exactamente la misma regla.
 *
 * Un CASO es un objeto JSON con esta forma (ver nuevoCaso):
 *   numero      'RCA-2026-001' (correlativo por año)
 *   fecha, titulo, area, producto, lote, categoria, severidad, origen, afectado, descripcion
 *   contencion  acción inmediata para que el problema no siga saliendo
 *   ishikawa    { mano_obra: [{ texto, raiz }], metodo: [...], ... }  (las 6M)
 *   porques     5 textos: la cadena de "¿por qué?" desde el problema hasta la causa
 *   causaRaiz   la causa raíz en una frase
 *   acciones    [{ id, tipo, texto, responsable, plazo, hecha, fechaHecha }]
 *   eficacia    { estado: 'pendiente' | 'eficaz' | 'no_eficaz', fecha, evidencia }
 *   historial   [{ f: 'AAAA-MM-DD HH:MM', t: 'qué cambió' }]  (trazabilidad)
 */
const Rca = (() => {
  // Las 6M del diagrama de Ishikawa. El orden es el del dibujo: las 3 primeras van arriba.
  const M6 = [
    { id: 'metodo', nombre: 'Método' },
    { id: 'maquina', nombre: 'Máquina' },
    { id: 'mano_obra', nombre: 'Mano de obra' },
    { id: 'material', nombre: 'Material' },
    { id: 'medicion', nombre: 'Medición' },
    { id: 'medio', nombre: 'Medio ambiente' }
  ];
  const NOMBRE_M = {};
  M6.forEach(m => { NOMBRE_M[m.id] = m.nombre; });

  const ESTADOS = {
    analisis: 'En análisis',
    acciones: 'Acciones en curso',
    verificacion: 'Verificar eficacia',
    no_eficaz: 'No eficaz',
    cerrado: 'Cerrado'
  };
  const SEVERIDADES = ['Leve', 'Moderado', 'Crítico'];
  const EFICACIA = { pendiente: 'Pendiente', eficaz: 'Eficaz', no_eficaz: 'No eficaz' };
  const TIPOS_ACCION = { correctiva: 'Correctiva', preventiva: 'Preventiva' };

  // Escapa texto antes de meterlo en HTML o SVG: sin esto, un "<" escrito por el usuario
  // rompería la pantalla (o ejecutaría código).
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const dos = n => String(n).padStart(2, '0');

  // Fecha LOCAL 'AAAA-MM-DD'. Nunca toISOString(): usa UTC y a la noche da el día siguiente.
  function fechaLocal(d) { return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`; }
  function hoy() { return fechaLocal(new Date()); }
  function ahora() { const d = new Date(); return `${fechaLocal(d)} ${dos(d.getHours())}:${dos(d.getMinutes())}`; }

  // 'AAAA-MM-DD' → 'DD/MM/AAAA' (como se escribe en planta).
  function fechaCorta(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '';
    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  }

  function ishikawaVacio() {
    const out = {};
    M6.forEach(m => { out[m.id] = []; });
    return out;
  }

  function nuevoCaso(numero, fecha) {
    return {
      id: '', numero: numero || '', creado: '', modificado: '',
      fecha: fecha || '', titulo: '', area: '', producto: '', lote: '', categoria: '',
      severidad: '', origen: '', afectado: '', descripcion: '', contencion: '',
      ishikawa: ishikawaVacio(),
      porques: ['', '', '', '', ''],
      causaRaiz: '',
      acciones: [],
      eficacia: { estado: 'pendiente', fecha: '', evidencia: '' },
      historial: []
    };
  }

  // Completa un caso que viene de localStorage o de un respaldo, para que nunca falte un
  // campo (un respaldo viejo o editado a mano no rompe la app).
  function normalizar(c) {
    const base = nuevoCaso();
    const out = Object.assign(base, c || {});
    out.ishikawa = Object.assign(ishikawaVacio(), (c && c.ishikawa) || {});
    M6.forEach(m => {
      const lista = Array.isArray(out.ishikawa[m.id]) ? out.ishikawa[m.id] : [];
      out.ishikawa[m.id] = lista.filter(x => x && String(x.texto || '').trim())
        .map(x => ({ texto: String(x.texto).trim(), raiz: !!x.raiz }));
    });
    const pq = Array.isArray(out.porques) ? out.porques : [];
    out.porques = [0, 1, 2, 3, 4].map(i => String(pq[i] || ''));
    out.acciones = Array.isArray(out.acciones) ? out.acciones.filter(a => a && typeof a === 'object') : [];
    out.eficacia = Object.assign({ estado: 'pendiente', fecha: '', evidencia: '' }, out.eficacia || {});
    if (!EFICACIA[out.eficacia.estado]) out.eficacia.estado = 'pendiente';
    out.historial = Array.isArray(out.historial) ? out.historial : [];
    return out;
  }

  // Número correlativo por año: RCA-2026-001, RCA-2026-002… Se toma el más alto del año
  // (no la cantidad de casos) para que borrar uno no haga repetir un número.
  function siguienteNumero(casos, anio) {
    const pref = `RCA-${anio}-`;
    let max = 0;
    (casos || []).forEach(c => {
      if (c && typeof c.numero === 'string' && c.numero.indexOf(pref) === 0) {
        const n = parseInt(c.numero.slice(pref.length), 10);
        if (n > max) max = n;
      }
    });
    return pref + String(max + 1).padStart(3, '0');
  }

  // Una acción está vencida si no está hecha y su plazo ya pasó (el mismo día todavía no).
  function accionVencida(a, fechaHoy) { return !a.hecha && !!a.plazo && a.plazo < fechaHoy; }

  function resumenAcciones(caso, fechaHoy) {
    const acc = caso.acciones || [];
    const hechas = acc.filter(a => a.hecha).length;
    return {
      total: acc.length,
      hechas,
      pendientes: acc.length - hechas,
      vencidas: acc.filter(a => accionVencida(a, fechaHoy)).length
    };
  }

  function tieneCausaRaiz(caso) { return !!String(caso.causaRaiz || '').trim(); }

  // El estado NO se elige a mano: sale de lo que ya está cargado. Así nunca queda un caso
  // "cerrado" con acciones pendientes o sin causa raíz.
  function estado(caso, fechaHoy) {
    const ef = caso.eficacia && caso.eficacia.estado;
    if (ef === 'eficaz') return 'cerrado';
    if (!tieneCausaRaiz(caso)) return 'analisis';
    if (ef === 'no_eficaz') return 'no_eficaz';
    const r = resumenAcciones(caso, fechaHoy);
    if (r.total === 0 || r.pendientes > 0) return 'acciones';
    return 'verificacion';
  }

  // Para declarar una acción eficaz tiene que haber análisis terminado y acciones cumplidas.
  // Devuelve '' si se puede, o el motivo para mostrarle al usuario.
  function validarEficaz(caso) {
    if (!tieneCausaRaiz(caso)) return 'Primero definí la causa raíz.';
    const acc = caso.acciones || [];
    if (!acc.length) return 'Cargá al menos una acción correctiva.';
    const pend = acc.filter(a => !a.hecha).length;
    if (pend) return pend === 1 ? 'Falta cumplir 1 acción.' : `Faltan cumplir ${pend} acciones.`;
    return '';
  }

  // Avance del caso para la barra de pasos (Problema → … → Eficacia).
  function pasos(caso) {
    const total = M6.reduce((n, m) => n + caso.ishikawa[m.id].length, 0);
    const acc = caso.acciones || [];
    return [
      { id: 'problema', nombre: 'Problema', hecho: !!String(caso.titulo || '').trim() },
      { id: 'contencion', nombre: 'Contención', hecho: !!String(caso.contencion || '').trim() },
      { id: 'ishikawa', nombre: 'Ishikawa', hecho: total > 0 },
      { id: 'causa', nombre: 'Causa raíz', hecho: tieneCausaRaiz(caso) },
      { id: 'acciones', nombre: 'Acciones', hecho: acc.length > 0 && acc.every(a => a.hecha) },
      { id: 'eficacia', nombre: 'Eficacia', hecho: caso.eficacia.estado === 'eficaz' }
    ];
  }

  // Convierte el texto de un área del Ishikawa (una causa por renglón) en la lista de causas.
  // Si una causa ya existía con el mismo texto, conserva su marca de "causa raíz".
  function textoACausas(texto, anteriores) {
    const marcadas = {};
    (anteriores || []).forEach(c => { if (c.raiz) marcadas[c.texto.toLowerCase()] = true; });
    const vistas = {};
    const out = [];
    String(texto || '').split('\n').forEach(linea => {
      const t = linea.trim();
      const k = t.toLowerCase();
      if (!t || vistas[k]) return;
      vistas[k] = true;
      out.push({ texto: t, raiz: !!marcadas[k] });
    });
    return out;
  }

  // Causas marcadas como raíz en el Ishikawa, con su M.
  function causasRaiz(caso) {
    const out = [];
    M6.forEach(m => caso.ishikawa[m.id].forEach(c => { if (c.raiz) out.push({ m: m.id, texto: c.texto }); }));
    return out;
  }

  function enPeriodo(caso, desde, hasta) {
    if (desde && caso.fecha < desde) return false;
    if (hasta && caso.fecha > hasta) return false;
    return true;
  }

  // Claves que cuenta el Pareto según el modo:
  //   tipo  una por caso (su tipo de problema)
  //   area  una por caso (su área o línea)
  //   m6    una por cada M que aparece entre las causas raíz del caso (sin repetir en el caso);
  //         los casos sin causa raíz no cuentan todavía.
  function clavesPareto(casos, modo) {
    const out = [];
    casos.forEach(c => {
      if (modo === 'm6') {
        if (!tieneCausaRaiz(c)) return;
        const ms = {};
        causasRaiz(c).forEach(x => { ms[x.m] = true; });
        const lista = Object.keys(ms);
        if (!lista.length) out.push('');
        lista.forEach(id => out.push(NOMBRE_M[id]));
      } else {
        out.push(modo === 'area' ? c.area : c.categoria);
      }
    });
    return out;
  }

  // Pareto: cuenta, ordena de mayor a menor y calcula el % acumulado.
  // "vital" = las categorías que juntas llegan al 80 % (incluida la que cruza la línea):
  // son las pocas que conviene atacar primero.
  // Si hay más de `max` categorías, las chicas se juntan en "Otras" al final (como se hace
  // en un Pareto en papel), para que el gráfico se pueda leer en el celular.
  function pareto(claves, max) {
    const tope = max || 10;
    const cuenta = {};
    (claves || []).forEach(c => {
      const k = String(c || '').trim() || 'Sin clasificar';
      cuenta[k] = (cuenta[k] || 0) + 1;
    });
    let filas = Object.keys(cuenta).map(k => ({ clave: k, n: cuenta[k], otras: false }))
      .sort((a, b) => b.n - a.n || a.clave.localeCompare(b.clave, 'es'));
    if (filas.length > tope) {
      const resto = filas.slice(tope - 1);
      filas = filas.slice(0, tope - 1);
      filas.push({ clave: `Otras (${resto.length})`, n: resto.reduce((s, f) => s + f.n, 0), otras: true });
    }
    const total = filas.reduce((s, f) => s + f.n, 0);
    let acum = 0;
    filas = filas.map(f => {
      const previo = acum;
      acum += f.n;
      return Object.assign(f, {
        pct: total ? f.n / total * 100 : 0,
        acum: total ? acum / total * 100 : 0,
        vital: !f.otras && total > 0 && previo / total * 100 < 80
      });
    });
    return { filas, total };
  }

  // CSV para abrir en Excel. Separador ';' porque el Excel en español (Argentina) usa la coma
  // como decimal y espera ';' entre columnas. El BOM (﻿) le avisa que es UTF-8: sin él,
  // los acentos salen rotos.
  function csv(filas) {
    const celda = v => {
      let s = v == null ? '' : String(v);
      // Una celda que empieza con = + - @ Excel la toma como fórmula: se antepone ' para que
      // quede como texto (evita la "inyección de fórmulas" al abrir el archivo).
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return '﻿' + filas.map(f => f.map(celda).join(';')).join('\r\n');
  }

  const CABECERA_CSV = ['Número', 'Fecha', 'Título', 'Área', 'Producto', 'Lote', 'Tipo de problema',
    'Severidad', 'Origen', 'Cantidad afectada', 'Estado', 'Causa raíz', '6M de la causa raíz',
    'Acciones', 'Acciones pendientes', 'Acciones vencidas', 'Eficacia', 'Fecha de verificación'];

  function filaCsv(c, fechaHoy) {
    const r = resumenAcciones(c, fechaHoy);
    const ms = {};
    causasRaiz(c).forEach(x => { ms[NOMBRE_M[x.m]] = true; });
    return [c.numero, c.fecha, c.titulo, c.area, c.producto, c.lote, c.categoria, c.severidad,
      c.origen, c.afectado, ESTADOS[estado(c, fechaHoy)], c.causaRaiz, Object.keys(ms).join(', '),
      r.total, r.pendientes, r.vencidas, EFICACIA[c.eficacia.estado], c.eficacia.fecha];
  }

  // Indicadores de la pantalla principal.
  function kpis(casos, fechaHoy) {
    let abiertos = 0, cerrados = 0, vencidas = 0, verificados = 0, eficaces = 0;
    casos.forEach(c => {
      const e = estado(c, fechaHoy);
      if (e === 'cerrado') cerrados++; else abiertos++;
      vencidas += resumenAcciones(c, fechaHoy).vencidas;
      if (c.eficacia.estado !== 'pendiente') verificados++;
      if (c.eficacia.estado === 'eficaz') eficaces++;
    });
    return { abiertos, cerrados, vencidas, eficacia: verificados ? Math.round(eficaces / verificados * 100) : null };
  }

  return {
    M6, NOMBRE_M, ESTADOS, SEVERIDADES, EFICACIA, TIPOS_ACCION, CABECERA_CSV,
    esc, fechaLocal, hoy, ahora, fechaCorta, ishikawaVacio, nuevoCaso, normalizar, siguienteNumero,
    accionVencida, resumenAcciones, tieneCausaRaiz, estado, validarEficaz, pasos, textoACausas,
    causasRaiz, enPeriodo, clavesPareto, pareto, csv, filaCsv, kpis
  };
})();

// En el navegador Rca queda global; en Node (pruebas) se exporta.
if (typeof module !== 'undefined' && module.exports) module.exports = Rca;
