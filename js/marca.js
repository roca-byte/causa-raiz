/*
 * marca.js — Empresa y logo configurables por el usuario (global Marca).
 *
 * Mismo patrón que mash-check y controlLinea: se guardan solo en este dispositivo
 * (localStorage) y se usan en el encabezado del informe. Si hay logo, el informe muestra
 * el logo; si no, el nombre de la empresa.
 */
const Marca = (() => {
  const KEY = 'causaRaiz.marca.v1';
  const BASE = { empresa: 'Empresa S.A.' };

  const datos = { empresa: '', logo: null };
  try { Object.assign(datos, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}

  function guardar() {
    try { localStorage.setItem(KEY, JSON.stringify(datos)); return true; }
    catch (e) { return false; }   // sin espacio (logo muy pesado): quien llama avisa
  }

  function empresa() { return (datos.empresa || '').trim() || BASE.empresa; }
  function logo() { return (datos.logo && datos.logo.d) || ''; }

  // Reduce el logo (máx. 800x300 px) y lo guarda como PNG para conservar la transparencia.
  // Achicarlo importa: localStorage tiene ~5 MB y una foto del celular pesa más que eso.
  function leerLogo(file, cb) {
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, 800 / im.width, 300 / im.height);
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * k);
        c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        cb({ d: c.toDataURL('image/png'), w: c.width, h: c.height });
      };
      im.onerror = () => cb(null);
      im.src = r.result;
    };
    r.readAsDataURL(file);
  }

  return { datos, guardar, empresa, logo, leerLogo };
})();
