// Pruebas de los casos de ejemplo (js/ejemplo.js). Correr con:  node --test tests/
// Revisan que los ejemplos muestren todos los estados y respeten las mismas reglas que un
// caso cargado a mano (si no, la demo enseñaría algo que la app no permite).
const test = require('node:test');
const assert = require('node:assert/strict');
const Rca = require('../js/rca.js');
const Ejemplo = require('../js/ejemplo.js');

const HOY = '2026-11-09';

test('los ejemplos muestran todos los estados del caso', () => {
  const estados = Ejemplo.casos(HOY).map(c => Rca.estado(c, HOY));
  ['analisis', 'acciones', 'verificacion', 'no_eficaz', 'cerrado'].forEach(e =>
    assert.ok(estados.includes(e), 'falta un ejemplo en estado ' + e));
});

test('numerados en orden, marcados como ejemplo y con fechas del año en curso', () => {
  const casos = Ejemplo.casos(HOY);
  casos.forEach((c, i) => {
    assert.equal(c.numero, 'RCA-2026-' + String(i + 1).padStart(3, '0'));
    assert.equal(c.ejemplo, true);
    assert.ok(c.fecha >= '2026-01-01' && c.fecha <= HOY, c.numero + ' fuera del año: ' + c.fecha);
    if (i) assert.ok(c.fecha >= casos[i - 1].fecha, 'las fechas van del más viejo al más nuevo');
  });
  assert.equal(Rca.siguienteNumero(casos, 2026), 'RCA-2026-' + String(casos.length + 1).padStart(3, '0'));
});

test('a principio de año las fechas no caen en el año anterior', () => {
  Ejemplo.casos('2027-01-03').forEach(c => assert.ok(c.fecha >= '2027-01-01', c.fecha));
});

test('hay exactamente una acción vencida, para mostrar el aviso', () => {
  const k = Rca.kpis(Ejemplo.casos(HOY), HOY);
  assert.equal(k.vencidas, 1);
});

test('los casos cerrados cumplen la regla de eficacia', () => {
  Ejemplo.casos(HOY).filter(c => c.eficacia.estado === 'eficaz').forEach(c =>
    assert.equal(Rca.validarEficaz(c), '', c.numero));
});

test('las causas marcadas como raíz alimentan el Pareto por 6M', () => {
  const res = Rca.pareto(Rca.clavesPareto(Ejemplo.casos(HOY), 'm6'));
  assert.ok(res.total >= 4);
});

test('el historial está ordenado y empieza con la apertura del caso', () => {
  Ejemplo.casos(HOY).forEach(c => {
    assert.equal(c.historial[0].t, 'Caso abierto');
    const fechas = c.historial.map(h => h.f);
    assert.deepEqual(fechas, fechas.slice().sort(), c.numero);
  });
});
