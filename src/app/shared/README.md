# `src/app/shared` — reutilizable entre dominios

Código sin estado de negocio que puede usar cualquier dominio o el layout. `shared` no importa de `core` ni de `features`.

| Carpeta | Contenido |
|---|---|
| `ui/` | Componentes del sistema de diseño (página `00 · Componentes` de Figma), **una carpeta por componente**: `boton/`, `campo-texto/`, `selector/`, `casilla-interruptor/`, `tarjeta/`, `tabla/`, `insignia-estado/`, `paso-flujo/`, `aviso/`, `estado-vacio/`, `logotipo/`, `selector-idioma/` |
| `pipes/` | Formateo con `Intl` según el idioma activo: `moneda` (`$ 1.250.000 COP` / `COP 1,250,000`), `fecha` (`16/09/2026` / `09/16/2026`), `numero`, `porcentaje`. **HU-W1.2-02:** `formato-moneda.pipe.ts` (`formatoMoneda`: monto + código, p. ej. `$ 250.000.000 COP`) y `formato-fecha.pipe.ts` (`formatoFecha`: `11 de octubre de 2026` / `October 11, 2026`); se reevalúan al cambiar de idioma. **HU-W1.3-01:** `formato-fecha-hora.pipe.ts` (`formatoFechaHora`: `16/09/2026, 14:05` / `09/16/2026, 14:05`, en la zona horaria del usuario; con `'hora'`, solo `14:05`) |
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

`ui/indicador-pasos/` (HU-W1.2-02): `IndicadorPasosComponent` (`app-indicador-pasos`), pasos del flujo embebido (círculo de 32 px
completado/actual/pendiente, línea `lima/500` hacia los pasos alcanzados, `aria-current="step"` y estado anunciado con texto).
Recibe claves i18n (`pasos` y `etiqueta`). `ui/insignia-estado/`: `InsigniaEstadoComponent` (`app-insignia-estado`), badge de
estado con `tono: 'exito' | 'advertencia' | 'error' | 'informacion' | 'neutro'` y el texto como contenido.
