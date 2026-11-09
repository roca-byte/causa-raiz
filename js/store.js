/*
 * store.js — Capa de datos (global Store). Todo vive en este dispositivo, en localStorage
 * con la clave 'causaRaiz.v1'. Sin login ni servidor.
 *
 * Por qué localStorage y no IndexedDB: los casos son texto (sin fotos) y entran de sobra en
 * los ~5 MB que da el navegador; así el código es mucho más simple de leer. Si más adelante
 * se agregan fotos de evidencia, ahí sí conviene pasar a IndexedDB.
 *
 * Forma de lo guardado: { app: 'causa-raiz', version: 1, config: {...}, casos: [ caso, ... ] }
 * (la forma de un caso está explicada en rca.js).
 */
const Store = (() => {
  const KEY = 'causaRaiz.v1';
  const KEY_ANTERIOR = 'causaRaiz.v1.anterior';

  // Valores de arranque: se pueden cambiar en Ajustes.
  const CONFIG_BASE = {
    analista: '',
    areas: ['Línea 1', 'Línea 2', 'Línea 3', 'Depósito', 'Laboratorio'],
    categorias: ['Peso / volumen fuera de rango', 'Etiquetado / codificado', 'Envase dañado',
      'Pérdida / derrame', 'Contaminación', 'Paletizado', 'Documentación', 'Reclamo de cliente'],
    origenes: ['Control en línea', 'Control final', 'Reclamo de cliente', 'Auditoría interna', 'No conformidad'],
    codigo: 'REG-RCA-01',
    revision: '01'
  };

  const copia = o => JSON.parse(JSON.stringify(o));
  const vacio = () => ({ app: 'causa-raiz', version: 1, config: copia(CONFIG_BASE), casos: [] });

  // Arma el estado desde un objeto leído (localStorage o respaldo), completando lo que falte.
  function desde(d) {
    const out = vacio();
    out.config = Object.assign(copia(CONFIG_BASE), d.config || {});
    out.casos = (d.casos || []).map(Rca.normalizar);
    return out;
  }

  function cargar() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && Array.isArray(d.casos)) return desde(d);
    } catch (e) { /* dato corrupto: se arranca vacío (el respaldo JSON sirve para esto) */ }
    return vacio();
  }

  let state = cargar();

  // Devuelve false si no se pudo guardar (por ejemplo, el navegador se quedó sin espacio).
  function guardar() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { return false; }
  }

  function uid() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ---------- configuración ----------
  function getConfig() { return state.config; }
  function setConfig(parcial) { Object.assign(state.config, parcial); return guardar(); }

  // ---------- casos ----------
  // Más nuevos primero (por fecha del problema y, a igual fecha, por número).
  function casos() {
    return state.casos.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || b.numero.localeCompare(a.numero));
  }
  function caso(id) { return state.casos.find(c => c.id === id) || null; }

  function crearCaso(datos) {
    const fecha = datos.fecha || Rca.hoy();
    const c = Object.assign(Rca.nuevoCaso(Rca.siguienteNumero(state.casos, fecha.slice(0, 4)), fecha), datos);
    c.id = uid();
    c.creado = c.modificado = Rca.ahora();
    c.historial = [{ f: c.creado, t: 'Caso abierto' + (state.config.analista ? ' por ' + state.config.analista : '') }];
    state.casos.push(c);
    if (guardar()) return c;
    state.casos.pop();   // no entró: que no quede un caso "fantasma" solo en memoria
    return null;
  }

  // Guarda el caso ya modificado. `nota` (opcional) queda en el historial: es la
  // trazabilidad de quién/cuándo cambió algo importante del caso.
  function guardarCaso(c, nota) {
    c.modificado = Rca.ahora();
    if (nota) c.historial.push({ f: c.modificado, t: nota });
    return guardar();
  }

  function borrarCaso(id) {
    state.casos = state.casos.filter(c => c.id !== id);
    return guardar();
  }

  // ---------- casos de ejemplo ----------
  // Solo se cargan con la app vacía: si ya hay casos reales, los números de los ejemplos
  // (RCA-AAAA-001…) chocarían con los del usuario.
  function cargarEjemplos() {
    if (state.casos.length) return false;
    state.casos = Ejemplo.casos(Rca.hoy()).map(c => Object.assign(c, { id: uid() }));
    if (guardar()) return true;
    state.casos = [];
    return false;
  }
  function hayEjemplos() { return state.casos.some(c => c.ejemplo); }
  // Borra SOLO los ejemplos: si el usuario ya cargó casos propios, esos quedan.
  function borrarEjemplos() {
    state.casos = state.casos.filter(c => !c.ejemplo);
    return guardar();
  }

  function nuevaAccion() {
    return { id: uid(), tipo: 'correctiva', texto: '', responsable: state.config.analista || '', plazo: '', hecha: false, fechaHecha: '' };
  }

  // ---------- respaldo ----------
  function exportar() { return JSON.stringify(state, null, 2); }

  // Revisa el archivo ANTES de tocar nada: si no es de esta app, se rechaza con un mensaje claro.
  function revisarRespaldo(texto) {
    let d;
    try { d = JSON.parse(texto); } catch (e) { throw new Error('El archivo no es un respaldo válido (no es JSON).'); }
    if (!d || d.app !== 'causa-raiz' || !Array.isArray(d.casos)) {
      throw new Error('Este archivo no es un respaldo de Análisis Causa Raíz.');
    }
    return d;
  }

  // Restaurar REEMPLAZA todo. Lo anterior queda guardado aparte por si fue un error.
  function importar(texto) {
    const d = revisarRespaldo(texto);
    try { localStorage.setItem(KEY_ANTERIOR, JSON.stringify(state)); } catch (e) {}
    state = desde(d);
    if (!guardar()) throw new Error('No hay espacio en el dispositivo para restaurar el respaldo.');
    return state.casos.length;
  }

  return { getConfig, setConfig, casos, caso, crearCaso, guardarCaso, borrarCaso, cargarEjemplos, hayEjemplos, borrarEjemplos, nuevaAccion, exportar, revisarRespaldo, importar };
})();
