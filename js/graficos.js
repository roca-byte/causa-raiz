/*
 * graficos.js — Dibuja el diagrama de Ishikawa y el Pareto como SVG (global Graficos).
 *
 * Por qué SVG a mano y no una librería de gráficos: son dos dibujos fijos, con SVG se ven
 * nítidos en pantalla y en el PDF, funcionan sin conexión y no suman dependencias.
 * Las funciones solo arman TEXTO (el SVG como string); quien las llama lo pone en la página.
 * Los colores salen de clases CSS (ver "Gráficos" en styles.css), así sirven en modo claro,
 * oscuro y en la impresión.
 */
const Graficos = (() => {
  const esc = Rca.esc;

  // Corta un texto en renglones de hasta `ancho` letras, como mucho `max` renglones.
  // Si no entra, el último termina en "…".
  function partir(texto, ancho, max) {
    const palabras = String(texto || '').trim().split(/\s+/).filter(Boolean);
    const lineas = [];
    let actual = '';
    palabras.forEach(p => {
      const largo = p.length > ancho ? p.slice(0, ancho - 1) + '…' : p;
      if (!actual) actual = largo;
      else if ((actual + ' ' + largo).length <= ancho) actual += ' ' + largo;
      else { lineas.push(actual); actual = largo; }
    });
    if (actual) lineas.push(actual);
    if (lineas.length > max) {
      const cortadas = lineas.slice(0, max);
      cortadas[max - 1] = cortadas[max - 1].slice(0, ancho - 1).replace(/…$/, '') + '…';
      return cortadas;
    }
    return lineas;
  }

  const recortar = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
  const r1 = n => Math.round(n * 10) / 10;

  // ---------------------------------------------------------------------------------------
  // ISHIKAWA (espina de pescado)
  // Lienzo de 1000 x 600. Espina horizontal en y=300; cabeza (el problema) a la derecha.
  // 3 espinas arriba (Método, Máquina, Mano de obra) y 3 abajo (Material, Medición, Medio
  // ambiente). Cada causa es una rayita horizontal que sale de su espina, con el texto encima.
  // ---------------------------------------------------------------------------------------
  const ESPINA_Y = 300;
  const PUNTAS = [320, 560, 800];   // x donde cada espina toca la espina central
  const INCLINACION = 140;          // cuánto más a la izquierda empieza cada espina
  const MAX_CAUSAS = 5;             // más que esto no entra legible: se muestra "+N más"

  function ishikawa(caso) {
    let s = `<svg class="grafico fb" viewBox="0 0 1000 600" role="img" aria-label="Diagrama de Ishikawa">`;
    s += `<line class="fb-espina" x1="20" y1="${ESPINA_Y}" x2="822" y2="${ESPINA_Y}"/>`;
    s += `<polygon class="fb-flecha" points="806,286 830,300 806,314"/>`;

    Rca.M6.forEach((m, i) => {
      const arriba = i < 3;
      const xa = PUNTAS[i % 3];
      const xt = xa - INCLINACION;
      const yt = arriba ? 48 : 552;   // donde termina la espina (debajo/encima del rótulo)
      s += `<line class="fb-hueso" x1="${xt}" y1="${yt}" x2="${xa}" y2="${ESPINA_Y}"/>`;
      s += `<rect class="fb-rotulo" x="${xt - 85}" y="${arriba ? 12 : 552}" width="170" height="36" rx="8"/>`;
      s += `<text class="fb-rotulo-t" x="${xt}" y="${arriba ? 36 : 576}" text-anchor="middle">${esc(m.nombre)}</text>`;

      const causas = caso.ishikawa[m.id];
      const visibles = causas.slice(0, causas.length > MAX_CAUSAS ? MAX_CAUSAS - 1 : MAX_CAUSAS);
      const resto = causas.length - visibles.length;
      const lugares = visibles.length + (resto ? 1 : 0);
      if (!lugares) return;
      // Las causas se reparten a lo largo de la espina, entre el rótulo y la espina central.
      const desde = arriba ? 75 : 320;
      const alto = 205 / lugares;
      const enHueso = y => xt + (arriba ? (y - yt) / (ESPINA_Y - yt) : (yt - y) / (yt - ESPINA_Y)) * (xa - xt);
      const fila = (k, contenido, clase) => {
        const y = r1(desde + (k + 0.5) * alto + (arriba ? 0 : 10));
        const xb = r1(enHueso(y));
        return `<line class="fb-causa" x1="${r1(xb - 150)}" y1="${y}" x2="${xb}" y2="${y}"/>` +
          `<text class="${clase}" x="${r1(xb - 6)}" y="${r1(y - 6)}" text-anchor="end">${contenido}</text>`;
      };
      visibles.forEach((c, k) => {
        s += fila(k, (c.raiz ? '★ ' : '') + esc(recortar(c.texto, 22)), c.raiz ? 'fb-causa-t fb-raiz' : 'fb-causa-t');
      });
      if (resto) s += fila(visibles.length, `+${resto} más`, 'fb-causa-t fb-mas');
    });

    // Cabeza: el problema, en un recuadro de color.
    const lineas = partir(caso.titulo || 'Problema', 15, 6);
    const y0 = 300 - (lineas.length - 1) * 10;
    s += `<rect class="fb-cabeza" x="832" y="210" width="160" height="180" rx="12"/>`;
    s += `<text class="fb-cabeza-t" text-anchor="middle">` +
      lineas.map((l, k) => `<tspan x="912" y="${y0 + k * 20 + 5}">${esc(l)}</tspan>`).join('') + `</text>`;
    return s + `</svg>`;
  }

  // ---------------------------------------------------------------------------------------
  // PARETO
  // Lienzo de 640 x 340. Barras de mayor a menor y la línea del % acumulado.
  // El eje izquierdo va de 0 al TOTAL, así la barra y la línea comparten escala: la altura
  // de la línea en cada punto es exactamente la suma de las barras hasta ahí. El eje derecho
  // muestra lo mismo en %. La línea punteada marca el 80 %.
  // ---------------------------------------------------------------------------------------
  function pareto(resultado) {
    const { filas, total } = resultado;
    const X0 = 46, X1 = 594, Y0 = 24, Y1 = 246;
    const ancho = X1 - X0, alto = Y1 - Y0;
    const y = pct => r1(Y1 - pct / 100 * alto);
    let s = `<svg class="grafico pr" viewBox="0 0 640 340" role="img" aria-label="Diagrama de Pareto">`;

    [0, 25, 50, 75, 100].forEach(p => {
      s += `<line class="pr-grilla" x1="${X0}" y1="${y(p)}" x2="${X1}" y2="${y(p)}"/>`;
      s += `<text class="pr-eje" x="${X1 + 6}" y="${y(p) + 4}">${p}%</text>`;
    });
    s += `<text class="pr-eje" x="${X0 - 6}" y="${y(100) + 4}" text-anchor="end">${total}</text>`;
    s += `<text class="pr-eje" x="${X0 - 6}" y="${y(0) + 4}" text-anchor="end">0</text>`;
    s += `<line class="pr-80" x1="${X0}" y1="${y(80)}" x2="${X1}" y2="${y(80)}"/>`;
    s += `<text class="pr-80-t" x="${X0 + 4}" y="${y(80) - 5}">80 %</text>`;

    const paso = ancho / filas.length;
    const barra = Math.min(70, paso * 0.64);
    const letras = Math.max(5, Math.floor(paso / 6.6));
    const puntos = [];
    filas.forEach((f, i) => {
      const cx = X0 + paso * (i + 0.5);
      const top = y(f.pct);
      s += `<rect class="${f.vital ? 'pr-barra' : 'pr-barra pr-resto'}" x="${r1(cx - barra / 2)}" y="${top}" width="${r1(barra)}" height="${r1(Y1 - top)}" rx="3"/>`;
      s += `<text class="pr-n" x="${r1(cx)}" y="${r1(top - 6)}" text-anchor="middle">${f.n}</text>`;
      const rot = partir(f.clave, letras, 2);
      s += `<text class="pr-cat" text-anchor="middle">` +
        rot.map((l, k) => `<tspan x="${r1(cx)}" y="${Y1 + 18 + k * 14}">${esc(l)}</tspan>`).join('') + `</text>`;
      puntos.push([r1(cx), y(f.acum)]);
    });
    if (puntos.length) {
      s += `<polyline class="pr-linea" points="${[[X0, Y1]].concat(puntos).map(p => p.join(',')).join(' ')}"/>`;
      puntos.forEach(p => { s += `<circle class="pr-punto" cx="${p[0]}" cy="${p[1]}" r="4.5"/>`; });
    }
    s += `<line class="pr-base" x1="${X0}" y1="${Y1}" x2="${X1}" y2="${Y1}"/>`;
    return s + `</svg>`;
  }

  return { ishikawa, pareto, partir };
})();
