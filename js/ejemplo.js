/*
 * ejemplo.js — Casos de ejemplo (global Ejemplo).
 *
 * Sirven para que alguien que abre la app por primera vez (o llega desde el CV) vea cómo
 * queda un análisis terminado sin tener que cargar nada, y para las capturas de la guía y
 * el video. TODOS LOS DATOS SON INVENTADOS: productos, lotes y personas no son de ninguna
 * empresa real.
 *
 * Es una función pura, como rca.js: recibe la fecha de hoy y devuelve los casos. Las fechas
 * se calculan "hacia atrás" desde hoy, así los ejemplos siempre se ven recientes (y una
 * acción queda vencida a propósito, para mostrar el aviso).
 *
 * Cada caso lleva `ejemplo: true`: así la app los puede borrar todos juntos sin tocar los
 * casos reales del usuario.
 */
const Ejemplo = (() => {
  const R = typeof Rca !== 'undefined' ? Rca : require('./rca.js');

  // Fecha `n` días antes (o después, si n es negativo) de `hoy` ('AAAA-MM-DD').
  // Nunca antes del 1 de enero del año de hoy: el Pareto arranca mostrando el año en curso
  // y los ejemplos tienen que aparecer ahí.
  function dias(hoy, n) {
    const d = new Date(hoy + 'T12:00:00');   // mediodía: evita saltos de día por horario de verano
    d.setDate(d.getDate() - n);
    const f = R.fechaLocal(d);
    const enero = hoy.slice(0, 4) + '-01-01';
    return f < enero ? enero : f;
  }

  // Ishikawa a partir de textos; los que empiezan con ★ son causa raíz.
  function causas(obj) {
    const out = R.ishikawaVacio();
    Object.keys(obj).forEach(m => {
      out[m] = obj[m].map(t => (t[0] === '★' ? { texto: t.slice(1).trim(), raiz: true } : { texto: t, raiz: false }));
    });
    return out;
  }

  // Los casos, del más viejo al más nuevo. `hace` = días antes de hoy en que se detectó.
  // En las acciones, `plazo` y `hecha` también van en días antes de hoy (negativo = futuro).
  const BASE = [
    {
      hace: 64, titulo: 'Botellas de 1 L con volumen bajo en Línea 2', area: 'Línea 2',
      categoria: 'Peso / volumen fuera de rango', severidad: 'Moderado', producto: 'Jugo de naranja 1 L',
      lote: 'L-0412', origen: 'Control en línea', afectado: '3.600 botellas',
      descripcion: 'En el control en línea de las 10:00 aparecen 4 botellas de 12 por debajo del mínimo (985 ml). El desvío se repite solo en el pico 3 de la llenadora.',
      contencion: 'Se retuvieron los 6 pallets del turno y se controló el volumen al 100 %. Se separaron 140 botellas bajas para reproceso.',
      ishikawa: causas({
        maquina: ['★Junta del pico 3 gastada', 'Presión de llenado irregular'],
        metodo: ['★El cambio de juntas no está en el plan de mantenimiento'],
        medicion: ['Probeta de control sin verificar'],
        mano_obra: ['Operario nuevo en el puesto']
      }),
      porques: ['El pico 3 llena menos que los demás', 'La junta del pico deja pasar aire', 'La junta está gastada',
        'Nunca se cambió desde la instalación', 'El cambio de juntas no figura en el plan de mantenimiento'],
      causaRaiz: 'El plan de mantenimiento preventivo no incluye el cambio de juntas de los picos de llenado.',
      acciones: [
        { tipo: 'correctiva', texto: 'Cambiar las juntas de los 8 picos de la llenadora', responsable: 'Mantenimiento', plazo: 60, hecha: 61 },
        { tipo: 'preventiva', texto: 'Sumar el cambio de juntas cada 3 meses al plan de mantenimiento', responsable: 'Jefe de mantenimiento', plazo: 50, hecha: 52 }
      ],
      eficacia: { estado: 'eficaz', hace: 20, evidencia: '6 semanas de control en línea sin botellas bajas en ningún pico.' }
    },
    {
      hace: 56, titulo: 'Cajas sin lote impreso en el fin de línea', area: 'Línea 1',
      categoria: 'Etiquetado / codificado', severidad: 'Moderado', producto: 'Mermelada de durazno 500 g',
      lote: 'L-0405', origen: 'Control final', afectado: '80 cajas',
      descripcion: 'En el control final aparecen cajas sin el lote impreso. Pasa de a ratos, siempre en cajas que llegan juntas.',
      contencion: 'Se revisaron las cajas del turno y se imprimió el lote a mano en las que faltaba.',
      ishikawa: causas({
        maquina: ['★Sensor de la codificadora de cajas desalineado'],
        metodo: ['Las cajas llegan pegadas, sin separación']
      }),
      porques: ['La codificadora no imprime en algunas cajas', 'El sensor no detecta la caja',
        'El sensor quedó desalineado después de una limpieza', '', ''],
      causaRaiz: 'El sensor de la codificadora se desalinea al limpiar la línea y nadie lo verifica después.',
      acciones: [
        { tipo: 'correctiva', texto: 'Fijar el soporte del sensor y marcar su posición', responsable: 'Mantenimiento', plazo: 52, hecha: 53 },
        { tipo: 'preventiva', texto: 'Verificar el sensor con una caja de prueba después de cada limpieza', responsable: 'Operador de línea', plazo: 45, hecha: 46 }
      ],
      eficacia: { estado: 'eficaz', hace: 25, evidencia: 'Un mes de control final sin cajas sin lote.' }
    },
    {
      hace: 48, titulo: 'Reclamo: tapas flojas en bidones de 5 L', area: 'Línea 3',
      categoria: 'Reclamo de cliente', severidad: 'Crítico', producto: 'Detergente 5 L',
      lote: 'L-0398', origen: 'Reclamo de cliente', afectado: '2 pallets (240 bidones)',
      descripcion: 'Un cliente informa bidones con pérdida por la tapa al recibir la mercadería. El torque medido en la devolución está por debajo de lo especificado.',
      contencion: 'Se bloqueó el stock del lote en depósito, se reapretaron las tapas al 100 % y se repuso al cliente.',
      ishikawa: causas({
        material: ['★Lote de tapas con rosca fuera de medida'],
        maquina: ['Tapadora con torque bajo'],
        medicion: ['No se mide el torque en recepción de tapas'],
        metodo: ['Sin control de rosca al recibir insumos']
      }),
      porques: ['Las tapas no cierran firme', 'La rosca de las tapas es más grande que la del envase',
        'El proveedor cambió el molde', 'En recepción no se controla la rosca', ''],
      causaRaiz: 'El lote de tapas vino con la rosca fuera de medida y en recepción no se controla esa medida.',
      acciones: [
        { tipo: 'correctiva', texto: 'Devolver el lote de tapas al proveedor y pedir informe de su molde', responsable: 'Compras', plazo: 44, hecha: 45 },
        { tipo: 'preventiva', texto: 'Agregar control de rosca con calibre en la recepción de tapas', responsable: 'Calidad', plazo: 35, hecha: 36 }
      ],
      eficacia: { estado: 'eficaz', hace: 10, evidencia: 'Tres lotes de tapas recibidos con rosca controlada y sin reclamos nuevos.' }
    },
    {
      hace: 35, titulo: 'Etiqueta corrida en frascos de 500 g', area: 'Línea 1',
      categoria: 'Etiquetado / codificado', severidad: 'Leve', producto: 'Mermelada de durazno 500 g',
      lote: 'L-0421', origen: 'Control final', afectado: '900 frascos',
      descripcion: 'En el control final se ven etiquetas torcidas o corridas hacia arriba después del cambio de formato de 1 kg a 500 g.',
      contencion: 'Se re-etiquetaron a mano los frascos observados y se ajustó la guía de la etiquetadora.',
      ishikawa: causas({
        metodo: ['★El ajuste de la guía al cambiar de formato no está escrito'],
        mano_obra: ['Cada turno ajusta distinto'],
        maquina: ['Guía de la etiquetadora con juego']
      }),
      porques: ['La etiqueta entra torcida', 'La guía quedó a la altura del frasco de 1 kg',
        'Al cambiar de formato no se ajustó la altura', 'No hay instructivo de cambio de formato', ''],
      causaRaiz: 'No hay instructivo de cambio de formato para la etiquetadora: cada turno lo ajusta de memoria.',
      acciones: [
        { tipo: 'correctiva', texto: 'Escribir el instructivo de cambio de formato con las alturas de cada frasco', responsable: 'Supervisor de producción', plazo: 25, hecha: 28 },
        { tipo: 'preventiva', texto: 'Capacitar a los tres turnos en el instructivo', responsable: 'Supervisor de producción', plazo: 15, hecha: 16 }
      ],
      eficacia: null   // acciones hechas: queda para verificar
    },
    {
      hace: 27, titulo: 'Frascos de 500 g con peso alto', area: 'Línea 1',
      categoria: 'Peso / volumen fuera de rango', severidad: 'Leve', producto: 'Mermelada de durazno 500 g',
      lote: 'L-0428', origen: 'Control en línea', afectado: '400 frascos',
      descripcion: 'El peso promedio está 12 g por encima del máximo: se regala producto.',
      contencion: 'Se ajustó la dosificadora y se controló el peso cada 15 minutos durante el turno.',
      ishikawa: causas({
        medicion: ['★La balanza de línea no se verifica con pesa patrón'],
        maquina: ['Dosificadora descalibrada']
      }),
      porques: ['Los frascos salen con peso alto', 'La dosificadora se ajustó con una balanza que marcaba de menos',
        'La balanza no se verifica con pesa patrón', '', ''],
      causaRaiz: 'La balanza de la línea no se verifica con pesa patrón, así que la dosificadora se ajusta con una medición errónea.',
      acciones: [
        { tipo: 'correctiva', texto: 'Verificar la balanza con pesa patrón al inicio de cada turno', responsable: 'Calidad', plazo: -5, hecha: null }
      ],
      eficacia: null   // acción pendiente, todavía en plazo
    },
    {
      hace: 21, titulo: 'Fecha de vencimiento ilegible en el codificado', area: 'Línea 2',
      categoria: 'Etiquetado / codificado', severidad: 'Moderado', producto: 'Jugo de naranja 1 L',
      lote: 'L-0433', origen: 'Control en línea', afectado: '1.200 botellas',
      descripcion: 'El código impreso por la codificadora sale borroso y no se lee la fecha de vencimiento.',
      contencion: 'Se frenó la línea, se limpió el cabezal y se volvieron a codificar las botellas observadas.',
      ishikawa: causas({
        maquina: ['★Cabezal de la codificadora sucio', 'Tinta vencida'],
        metodo: ['★La limpieza del cabezal no tiene frecuencia definida'],
        medio: ['Humedad alta en la zona de la codificadora']
      }),
      porques: ['El código sale borroso', 'El cabezal está sucio', 'Se limpia solo cuando falla',
        'No hay una frecuencia de limpieza definida', ''],
      causaRaiz: 'La limpieza del cabezal de la codificadora no tiene frecuencia definida: se limpia recién cuando falla.',
      acciones: [
        { tipo: 'correctiva', texto: 'Limpiar el cabezal al inicio de cada turno y registrarlo', responsable: 'Operador de línea', plazo: 14, hecha: 15 },
        { tipo: 'preventiva', texto: 'Comprar kit de limpieza y armar el registro de limpieza', responsable: 'Compras', plazo: 4, hecha: null }   // vencida
      ],
      eficacia: null
    },
    {
      hace: 12, titulo: 'Derrame en el cambio de formato de Línea 1', area: 'Línea 1',
      categoria: 'Pérdida / derrame', severidad: 'Leve', producto: 'Mermelada de durazno 500 g',
      lote: 'L-0440', origen: 'Auditoría interna', afectado: '35 kg de producto',
      descripcion: 'En cada cambio de formato se pierde producto al vaciar la dosificadora.',
      contencion: 'Se recuperó el producto en bandejas limpias para reproceso.',
      ishikawa: causas({
        mano_obra: ['Se vacía la dosificadora sin bajar el nivel antes'],
        metodo: ['★No se planifica el fin de la tanda'],
        maquina: ['La válvula de descarga gotea']
      }),
      porques: ['Queda producto en la tolva al cambiar', 'No se baja el nivel antes del cambio', 'El operario no sabe cuándo termina la tanda', '', ''],
      causaRaiz: 'El operario no sabe con anticipación cuándo termina la tanda y no baja el nivel de la tolva.',
      acciones: [
        { tipo: 'correctiva', texto: 'Avisar 30 minutos antes del fin de cada tanda', responsable: 'Supervisor de producción', plazo: 9, hecha: 9 }
      ],
      eficacia: { estado: 'no_eficaz', hace: 3, evidencia: 'En los dos cambios siguientes se volvió a perder producto: el aviso llega pero la válvula sigue goteando.' }
    },
    {
      hace: 8, titulo: 'Etiqueta con fecha de vencimiento equivocada', area: 'Línea 2',
      categoria: 'Etiquetado / codificado', severidad: 'Crítico', producto: 'Jugo de naranja 1 L',
      lote: 'L-0444', origen: 'Auditoría interna', afectado: '1 pallet',
      descripcion: 'La fecha de vencimiento impresa tiene un año de más.',
      contencion: 'Se retuvo el pallet y se re-codificó con la fecha correcta.',
      ishikawa: causas({
        metodo: ['La fecha se carga a mano en cada cambio de lote'],
        mano_obra: ['Nadie controla la fecha cargada antes de arrancar']
      }),
      porques: ['', '', '', '', ''],
      causaRaiz: '',
      acciones: [],
      eficacia: null
    },
    {
      hace: 5, titulo: 'Cajas aplastadas en pallets del depósito', area: 'Depósito',
      categoria: 'Paletizado', severidad: 'Moderado', producto: 'Detergente 5 L',
      lote: 'L-0447', origen: 'Control final', afectado: '3 pallets',
      descripcion: 'Las cajas de la base de los pallets aparecen aplastadas después de dos días en el depósito.',
      contencion: 'Se re-paletizaron los 3 pallets y se bajó la altura de estiba a 2 pallets.',
      ishikawa: causas({
        material: ['Cartón de menor gramaje', 'Cajas húmedas'],
        metodo: ['Altura de estiba no definida'],
        medio: ['Goteras en el sector B del depósito']
      }),
      porques: ['', '', '', '', ''],
      causaRaiz: '',
      acciones: [],
      eficacia: null   // recién empieza: en análisis
    },
    {
      hace: 2, titulo: 'Bidones de 5 L con peso bajo en Línea 3', area: 'Línea 3',
      categoria: 'Peso / volumen fuera de rango', severidad: 'Leve', producto: 'Detergente 5 L',
      lote: 'L-0450', origen: 'Control en línea', afectado: '60 bidones',
      descripcion: 'Dos controles seguidos con peso por debajo del mínimo.',
      contencion: 'Se re-pesaron los bidones del último pallet.',
      ishikawa: causas({}),
      porques: ['', '', '', '', ''],
      causaRaiz: '',
      acciones: [],
      eficacia: null
    }
  ];

  // Devuelve los casos listos para guardar (sin id: lo pone Store).
  function casos(hoy) {
    const anio = hoy.slice(0, 4);
    const out = [];
    BASE.forEach((b, i) => {
      const fecha = dias(hoy, b.hace);
      const c = R.nuevoCaso(`RCA-${anio}-${String(i + 1).padStart(3, '0')}`, fecha);
      Object.assign(c, {
        ejemplo: true,
        titulo: b.titulo, area: b.area, categoria: b.categoria, severidad: b.severidad,
        producto: b.producto, lote: b.lote, origen: b.origen, afectado: b.afectado,
        descripcion: b.descripcion, contencion: b.contencion, ishikawa: b.ishikawa,
        porques: b.porques.slice(), causaRaiz: b.causaRaiz
      });
      c.acciones = b.acciones.map((a, j) => ({
        id: 'ej' + i + '-' + j, tipo: a.tipo, texto: a.texto, responsable: a.responsable,
        plazo: dias(hoy, a.plazo), hecha: a.hecha != null, fechaHecha: a.hecha != null ? dias(hoy, a.hecha) : ''
      }));
      if (b.eficacia) c.eficacia = { estado: b.eficacia.estado, fecha: dias(hoy, b.eficacia.hace), evidencia: b.eficacia.evidencia };

      // Historial armado con las mismas fechas, para que la trazabilidad también se vea.
      const h = [{ f: fecha + ' 10:15', t: 'Caso abierto' }];
      if (c.contencion) h.push({ f: fecha + ' 10:40', t: 'Contención cargada' });
      const nCausas = R.M6.reduce((n, m) => n + c.ishikawa[m.id].length, 0);
      if (nCausas) h.push({ f: dias(hoy, Math.max(b.hace - 1, 0)) + ' 09:30', t: `Ishikawa actualizado (${nCausas} causas)` });
      if (c.causaRaiz) h.push({ f: dias(hoy, Math.max(b.hace - 1, 0)) + ' 11:00', t: 'Causa raíz definida: ' + c.causaRaiz });
      c.acciones.forEach(a => {
        h.push({ f: dias(hoy, Math.max(b.hace - 1, 0)) + ' 11:10', t: 'Acción agregada: ' + a.texto });
        if (a.hecha) h.push({ f: a.fechaHecha + ' 16:00', t: 'Acción cumplida: ' + a.texto });
      });
      if (b.eficacia) {
        h.push({ f: c.eficacia.fecha + ' 12:00', t: b.eficacia.estado === 'eficaz'
          ? 'Eficacia verificada: eficaz. Caso cerrado'
          : 'Eficacia verificada: no eficaz. Revisar el análisis y las acciones' });
      }
      c.historial = h.sort((x, y) => x.f.localeCompare(y.f));
      c.creado = h[0].f;
      c.modificado = h[h.length - 1].f;
      out.push(R.normalizar(c));
    });
    return out;
  }

  return { casos };
})();

// En el navegador Ejemplo queda global; en Node (pruebas) se exporta.
if (typeof module !== 'undefined') module.exports = Ejemplo;
