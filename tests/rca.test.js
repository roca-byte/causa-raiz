// Pruebas de las reglas (js/rca.js). Correr con:  node --test tests/
// No necesitan navegador: rca.js son funciones puras.
const test = require('node:test');
const assert = require('node:assert/strict');
const Rca = require('../js/rca.js');

function caso(cambios) { return Rca.normalizar(Object.assign({ titulo: 'Peso bajo', fecha: '2026-11-02' }, cambios)); }

test('numeración correlativa por año, sin repetir aunque se borre un caso', () => {
  const casos = [{ numero: 'RCA-2026-001' }, { numero: 'RCA-2026-003' }, { numero: 'RCA-2025-009' }];
  assert.equal(Rca.siguienteNumero(casos, 2026), 'RCA-2026-004');
  assert.equal(Rca.siguienteNumero(casos, 2027), 'RCA-2027-001');
  assert.equal(Rca.siguienteNumero([], 2026), 'RCA-2026-001');
});

test('el estado sale de lo cargado', () => {
  const hoy = '2026-11-09';
  assert.equal(Rca.estado(caso(), hoy), 'analisis');
  const conCausa = caso({ causaRaiz: 'Balanza sin calibrar' });
  assert.equal(Rca.estado(conCausa, hoy), 'acciones', 'sin acciones todavía');
  conCausa.acciones = [{ texto: 'Calibrar', hecha: false }];
  assert.equal(Rca.estado(conCausa, hoy), 'acciones');
  conCausa.acciones[0].hecha = true;
  assert.equal(Rca.estado(conCausa, hoy), 'verificacion');
  conCausa.eficacia.estado = 'no_eficaz';
  assert.equal(Rca.estado(conCausa, hoy), 'no_eficaz');
  conCausa.eficacia.estado = 'eficaz';
  assert.equal(Rca.estado(conCausa, hoy), 'cerrado');
});

test('no se puede declarar eficaz sin causa raíz ni con acciones pendientes', () => {
  assert.match(Rca.validarEficaz(caso()), /causa raíz/);
  const c = caso({ causaRaiz: 'X' });
  assert.match(Rca.validarEficaz(c), /al menos una/);
  c.acciones = [{ hecha: true }, { hecha: false }, { hecha: false }];
  assert.equal(Rca.validarEficaz(c), 'Faltan cumplir 2 acciones.');
  c.acciones.forEach(a => { a.hecha = true; });
  assert.equal(Rca.validarEficaz(c), '');
});

test('acción vencida: plazo pasado y sin hacer (el mismo día no)', () => {
  assert.equal(Rca.accionVencida({ plazo: '2026-11-08', hecha: false }, '2026-11-09'), true);
  assert.equal(Rca.accionVencida({ plazo: '2026-11-09', hecha: false }, '2026-11-09'), false);
  assert.equal(Rca.accionVencida({ plazo: '2026-11-01', hecha: true }, '2026-11-09'), false);
  assert.equal(Rca.accionVencida({ plazo: '', hecha: false }, '2026-11-09'), false);
});

test('Ishikawa: una causa por renglón, sin vacíos ni repetidas, conserva la marca de raíz', () => {
  const antes = [{ texto: 'Balanza sin calibrar', raiz: true }, { texto: 'Operario nuevo', raiz: false }];
  const out = Rca.textoACausas('  Balanza sin calibrar \n\nbalanza SIN calibrar\nPico tapado\n', antes);
  assert.deepEqual(out, [{ texto: 'Balanza sin calibrar', raiz: true }, { texto: 'Pico tapado', raiz: false }]);
});

test('Pareto: ordena, acumula y marca las vitales hasta el 80 %', () => {
  const claves = ['A', 'A', 'A', 'A', 'A', 'B', 'B', 'B', 'C', 'D'];
  const { filas, total } = Rca.pareto(claves);
  assert.equal(total, 10);
  assert.deepEqual(filas.map(f => f.clave), ['A', 'B', 'C', 'D']);
  assert.deepEqual(filas.map(f => Math.round(f.acum)), [50, 80, 90, 100]);
  // A (0 → 50) y B (50 → 80) son vitales; C empieza en 80, ya no.
  assert.deepEqual(filas.map(f => f.vital), [true, true, false, false]);
});

test('Pareto: empate ordenado por nombre, vacíos como "Sin clasificar" y agrupa en "Otras"', () => {
  const r = Rca.pareto(['b', 'a', '', '  ']);
  assert.deepEqual(r.filas.map(f => f.clave), ['Sin clasificar', 'a', 'b']);
  const muchas = Rca.pareto(['a', 'a', 'b', 'c', 'd', 'e'], 3);
  assert.deepEqual(muchas.filas.map(f => [f.clave, f.n]), [['a', 2], ['b', 1], ['Otras (3)', 3]]);
  assert.equal(muchas.filas[2].vital, false, '"Otras" nunca es vital');
  assert.equal(Rca.pareto([]).total, 0);
});

test('claves del Pareto por 6M: una por M y por caso; sin causa raíz no cuenta', () => {
  const c1 = caso({ causaRaiz: 'X', ishikawa: { maquina: [{ texto: 'a', raiz: true }, { texto: 'b', raiz: true }], metodo: [{ texto: 'c', raiz: true }] } });
  const c2 = caso({ causaRaiz: 'Y' });          // causa sin marcar en el Ishikawa
  const c3 = caso({ ishikawa: { material: [{ texto: 'd', raiz: true }] } }); // sin causa raíz escrita
  assert.deepEqual(Rca.clavesPareto([c1, c2, c3], 'm6').sort(), ['', 'Máquina', 'Método']);
  assert.deepEqual(Rca.clavesPareto([caso({ categoria: 'Peso' })], 'tipo'), ['Peso']);
});

test('CSV: separador ;, comillas, BOM y sin fórmulas', () => {
  const s = Rca.csv([['a;b', 'dijo "hola"', '=SUMA(A1)', 3]]);
  assert.equal(s, '﻿"a;b";"dijo ""hola""";\'=SUMA(A1);3');
});

test('normalizar completa un caso incompleto (respaldo viejo o editado a mano)', () => {
  const c = Rca.normalizar({ titulo: 'x', ishikawa: { metodo: [{ texto: ' ok ' }, { texto: '' }, null] }, eficacia: { estado: 'raro' } });
  assert.deepEqual(c.ishikawa.metodo, [{ texto: 'ok', raiz: false }]);
  assert.deepEqual(c.ishikawa.medio, []);
  assert.equal(c.porques.length, 5);
  assert.equal(c.eficacia.estado, 'pendiente');
  assert.deepEqual(c.acciones, []);
});

test('fecha local y formato corto', () => {
  assert.equal(Rca.fechaLocal(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(Rca.fechaCorta('2026-11-09'), '09/11/2026');
});
