# `src/styles` — tokens del sistema de diseño y estilos globales

Fuente única: [Sistema de Diseño Solventa](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Sistema-de-Dise%C3%B1o_Solventa) y la colección de variables `Solventa` de Figma. Los nombres de las variables CSS replican los de Figma: `color/azul/700` → `--color-azul-700`.

Archivos previstos (se importan desde `src/styles.scss` en este orden):

| Archivo | Contenido |
|---|---|
| `_tokens.scss` | Variables CSS en `:root`: colores primarios (`azul/900…50`), acento (`lima/500`), neutros, semánticos (`600` texto · `500` ícono/borde · `100` fondo), espaciado (4 · 8 · 12 · 16 · 24 · 32 · 48 · 64), radios (6 · 8 · 12 · 999), sombra de elevación, medidas del shell (barra superior 64, lateral 240 / 72, contenedor 1200) |
| `_base.scss` | Reinicio mínimo, fuente **Inter** (Google Fonts), estilos de texto (`titulo/h1` … `monto/medio`), foco visible (anillo `azul/500` 2 px), utilidades de accesibilidad |
| `_componentes.scss` | Clases globales sin lógica: botón (primario, secundario, terciario, peligro), campo, tabla, estructura de página |

Reglas:

- Modo único (claro); el modo oscuro está fuera del alcance.
- Ningún valor hexadecimal fuera de `_tokens.scss`.
- `lima/500` solo sobre `azul/900` o `azul/700`; nunca como texto sobre blanco.
- Números tabulares (`tnum`) en montos, fechas y tablas.
- Tamaños de texto relativos (`rem`) para respetar la escala de texto del sistema (frame U3, 130 %).
