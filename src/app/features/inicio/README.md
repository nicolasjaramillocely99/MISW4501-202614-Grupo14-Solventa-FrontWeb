# `features/inicio` — Inicio por rol

- **Épica:** Transversal (HA-S01)
- **Microservicio que lo respalda (vía API Gateway):** Agrega datos de los servicios que usa cada rol (originación, siniestros, socios, auditoría)
- **Cliente HTTP:** según los datos que necesite cada pantalla (`src/app/core/api/`)
- **Shell de navegación:** portal
- **Requiere sesión:** sí (guard de autenticación en el shell del portal; el rol se restringe por ruta)

## Pantallas y dónde va cada una

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [A0](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=69-5915) | Inicio del asegurado | `/inicio` | Asegurado | HA-S01 | S1 |
| [S0](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=69-6320) | Inicio del asesor comercial | `/inicio` | Asesor comercial | HA-S01 | S1 |
| [O0](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=69-6735) | Centro de operaciones | `/inicio` | Analista de operaciones | HA-S01 | S1 |

## Implementación (HA-S01)

Una sola ruta, `/inicio`, protegida por el shell del portal (`autenticacionGuard`) y por `rolGuard` con los cuatro roles humanos. La página muestra el inicio del rol de la sesión. En HA-S01 los inicios son **estructurales**: encabezado, saludo y accesos rápidos al menú del rol, sin datos de negocio; los datos los traen las historias dueñas de esos datos (ver `docs/pantallas.md`).

| Archivo | Qué contiene |
|---|---|
| `inicio.routes.ts` | `INICIO_ROUTES`: `''` → `InicioPage` con `rolGuard('asegurado', 'asesor', 'operaciones', 'socio')` |
| `inicio.page.ts` (`InicioPage`) | Elige el inicio según el rol. El socio comercial ve un inicio genérico hasta que exista su tablero B1 (HU-W3.2-01) |
| `componentes/inicio-asegurado.component.ts` | A0: saludo y accesos del asegurado |
| `componentes/inicio-asesor.component.ts` | S0: saludo y accesos del asesor comercial |
| `componentes/centro-operaciones.component.ts` | O0: título «Centro de operaciones» y accesos del analista |
| `componentes/accesos-rapidos.component.ts` | Tarjeta «Accesos rápidos» con el menú del rol (sin el propio inicio), común a los cuatro inicios |
| `componentes/encabezado-inicio.scss` | Estilos del encabezado de los inicios |

## Cómo trabajar una historia de este dominio

1. Crea la rama desde `develop` con el mismo nombre que en el backend, `feature/<ID>-<descripcion-corta-en-ingles>` (p. ej. `feature/HA-S01-role-based-auth`).
2. Declara la ruta en `inicio.routes.ts` (archivo de rutas del dominio, cargado de forma perezosa desde `app.routes.ts`).
3. Crea la página en la subcarpeta indicada con el sufijo `.page.ts` y su prueba `.page.spec.ts` al lado.
4. Los componentes propios de la pantalla van en `componentes/`, los servicios de datos en `servicios/` y los tipos en `modelos/`, dentro de la misma subcarpeta.
5. Las llamadas HTTP salen siempre por el cliente del microservicio en `src/app/core/api/`; ninguna página llama a otro servicio directamente.
6. Textos en `public/i18n/es-CO.json` y `en-US.json`; estilos con los tokens de `src/styles/`.
7. Antes del pull request: `npm run lint`, `npm run build` y `npm test` en verde con cobertura ≥ 70 %.

Ver las convenciones completas en [`src/app/features/README.md`](../README.md) y la trazabilidad global en [`docs/pantallas.md`](../../../../docs/pantallas.md).
