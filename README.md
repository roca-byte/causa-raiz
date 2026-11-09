# Análisis Causa Raíz

[![QualityOS](https://img.shields.io/badge/QualityOS-calidad_en_planta-0f5c6e?style=flat-square)](https://github.com/roca-byte)

App para analizar un problema de calidad **hasta encontrar su causa raíz** y asegurarse de
que no vuelva a pasar. Se usa desde el celular o la tablet, en la planta y aunque no haya señal.

**Abrir la app:** https://roca-byte.github.io/causa-raiz/

## Para qué sirve

Cuando un desvío se repite, llega un reclamo o aparece una no conformidad, no alcanza con
corregir el producto: hay que entender **por qué pasó**. Esta app te guía en ese análisis
paso a paso y deja todo registrado, desde el problema hasta la verificación de que la
solución funcionó.

## Cómo se trabaja un caso

Cada problema es un **caso** y se resuelve en 6 pasos. La app te muestra cuáles completaste:

1. **Problema**: qué pasó, dónde, cuándo, en qué producto y lote, y cuánto afectó.
   El caso se numera solo (por ejemplo, `RCA-2026-001`).
2. **Contención**: lo que hiciste en el momento para que no siga saliendo producto con el
   problema (retener, separar, reinspeccionar).
3. **Ishikawa (espina de pescado)**: anotás las causas posibles en cada una de las 6M:
   Método, Máquina, Mano de obra, Material, Medición y Medio ambiente. La app dibuja el diagrama.
4. **5 por qué y causa raíz**: preguntás "¿por qué?" hasta llegar al origen del problema y
   marcás qué causas del Ishikawa son la raíz.
5. **Plan de acción**: qué se va a hacer, quién y para cuándo. Las acciones vencidas se
   avisan arriba de todo.
6. **Verificación de eficacia**: después de un tiempo, comprobás que el problema no volvió.
   Si la solución fue eficaz, el caso se cierra.

La app no te deja cerrar un caso sin causa raíz o con acciones pendientes, y guarda un
**historial** con fecha y hora de cada cambio importante.

## Qué más podés hacer

- **Informe del caso** listo para imprimir o guardar como PDF (hoja A4), con el diagrama,
  los 5 por qué, el plan de acción y el historial.
- **Compartir un resumen** del caso por WhatsApp o mail.
- **Pareto**: ver qué problemas se repiten más, por tipo de problema, por causa (6M) o por
  área, en el período que elijas. Muestra dónde se concentra el 80 % para saber qué atacar primero.
- **Indicadores** en la pantalla principal: casos abiertos, acciones vencidas, casos
  cerrados y porcentaje de eficacia.
- **Exportar a Excel** la lista de casos.
- **Adaptarla a tu planta**: nombre y logo de la empresa, tus áreas o líneas, tus tipos de
  problema y el código del registro que va al pie del informe (pestaña **Ajustes**).
- Se ve en **modo claro u oscuro**, según tu celular.

## Instalarla en el celular

1. Abrí el link de la app.
2. **Android (Chrome):** menú ⋮ → *Instalar app* (o *Agregar a la pantalla principal*).
   **iPhone (Safari):** botón Compartir → *Agregar a inicio*.
3. Listo: queda como una app más y, después de abrirla una vez, funciona sin señal.

## Tus datos

- Todo lo que cargás queda **solo en tu dispositivo**. No hay cuentas ni servidor: nadie más
  ve tus casos.
- Por lo mismo, si borrás los datos del navegador o cambiás de celular, se pierden. En
  **Ajustes → Descargar respaldo** guardás una copia; con **Restaurar respaldo** la recuperás.
  Hacelo cada tanto.

## Licencia

Libre para usar, copiar y modificar ([MIT](LICENSE)). © 2026 Maximiliano Roca.

---

Parte de la suite [**QualityOS**](https://github.com/roca-byte) · Información técnica para
modificarla: [DESARROLLO.md](DESARROLLO.md)
