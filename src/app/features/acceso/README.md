# `features/acceso` — Acceso al portal

- **Épica:** Transversal (HA-S01)
- **Microservicio que lo respalda (vía API Gateway):** Amazon Cognito User Pool (proveedor de identidad, HA-S01) — el API Gateway valida el JWT
- **Cliente HTTP:** según los datos que necesite cada pantalla (`src/app/core/api/`)
- **Shell de navegación:** sin shell (pantalla completa)
- **Requiere sesión:** no

## Pantallas y dónde va cada una

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [P0](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=17-174) | Inicio de sesión del portal | `/acceso/iniciar-sesion` | público | HA-S01 | S1 |
| sin frame web dedicado | Acceso no autorizado (403) | `/acceso/no-autorizado` | público | HA-S01 | S1 |
| sin frame web dedicado | Sesión expirada | `/acceso/sesion-expirada` | público | HA-S01 | S1 |

## Cómo trabajar una historia de este dominio

1. Crea la rama desde `develop` con el mismo nombre que en el backend, `feature/<ID>-<descripcion-corta-en-ingles>` (p. ej. `feature/HA-S01-role-based-auth`).
2. Declara la ruta en `acceso.routes.ts` (archivo de rutas del dominio, cargado de forma perezosa desde `app.routes.ts`).
3. Crea la página en la subcarpeta indicada con el sufijo `.page.ts` y su prueba `.page.spec.ts` al lado.
4. Los componentes propios de la pantalla van en `componentes/`, los servicios de datos en `servicios/` y los tipos en `modelos/`, dentro de la misma subcarpeta.
5. Las llamadas HTTP salen siempre por el cliente del microservicio en `src/app/core/api/`; ninguna página llama a otro servicio directamente.
6. Textos en `public/i18n/es-CO.json` y `en-US.json`; estilos con los tokens de `src/styles/`.
7. Antes del pull request: `npm run lint`, `npm run build` y `npm test` en verde con cobertura ≥ 70 %.

Ver las convenciones completas en [`src/app/features/README.md`](../README.md) y la trazabilidad global en [`docs/pantallas.md`](../../../../docs/pantallas.md).
