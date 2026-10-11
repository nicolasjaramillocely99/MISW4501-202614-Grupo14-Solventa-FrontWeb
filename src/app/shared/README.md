# `src/app/shared` — reutilizable entre dominios

Código sin estado de negocio que puede usar cualquier dominio o el layout. `shared` no importa de `core` ni de `features`.

| Carpeta | Contenido |
|---|---|
| `ui/` | Componentes del sistema de diseño (página `00 · Componentes` de Figma), **una carpeta por componente**: `boton/`, `campo-texto/`, `selector/`, `casilla-interruptor/`, `tarjeta/`, `tabla/`, `insignia-estado/`, `paso-flujo/`, `aviso/`, `estado-vacio/`, `logotipo/`, `selector-idioma/` |
| `pipes/` | Formateo con `Intl` según el idioma activo: `moneda` (`$ 1.250.000 COP` / `COP 1,250,000`), `fecha` (`16/09/2026` / `09/16/2026`), `numero`, `porcentaje` |
| `directivas/` | Comportamientos reutilizables (foco inicial, cierre al hacer clic fuera, etc.) |
| `modelos/` | Tipos transversales: paginación, respuesta de error del gateway, estados (`Activa`, `Por vencer`, …) |
| `utilidades/` | Funciones puras (validadores de documento, fechas, etc.) |

Reglas del sistema de diseño que todo componente de `ui/` cumple:

- Usa únicamente los tokens de `src/styles/` (colores, tipografía, espaciado, radios).
- Variantes y estados del componente como *inputs* tipados (p. ej. `tono: 'exito' | 'advertencia' | 'error' | 'informacion' | 'neutro'`).
- Accesible por construcción: etiqueta permanente, foco visible, estado no comunicado solo con color, área mínima de clic.
- Textos externalizados con Transloco; ningún texto fijo en español dentro del componente.

Cada componente se nombra `nombre.component.ts` (`NombreComponent`, selector `app-nombre`) y lleva su prueba `nombre.component.spec.ts`.

**Implementados:** `ui/selector-idioma/` (HA-S01): `SelectorIdiomaComponent` (`app-selector-idioma`), globo + código del idioma
activo (`ES`/`EN`) + chevron sobre un `<select>` nativo con etiqueta permanente («Idioma»/«Language») y cada opción anunciada con
su nombre completo. Es presentacional (entradas `idioma` e `idiomas`, salida `cambio`); P0 y el shell del portal lo conectan a
`core/i18n/idioma.service.ts`.
