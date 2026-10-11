# `features/perfil` — Perfil del usuario

- **Épica:** Transversal (HA-S01)
- **Microservicio que lo respalda (vía API Gateway):** Amazon Cognito User Pool (atributos del usuario autenticado)
- **Cliente HTTP:** según los datos que necesite cada pantalla (`src/app/core/api/`)
- **Shell de navegación:** portal
- **Requiere sesión:** sí (guard de autenticación en el shell del portal; el rol se restringe por ruta)

## Pantallas y dónde va cada una

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [A10](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=80-6341) | Mi perfil | `/perfil` | Asegurado, Asesor comercial, Analista de operaciones, Socio comercial | HA-S01 | S1 |

## Estado

Pendiente: HA-S01 recortó *Mi perfil* (A10) y no creó la pantalla. Mientras no exista, el ítem *Mi perfil* del menú del asegurado lleva a `/inicio` (las rutas que aún no existen redirigen al inicio del rol). Cuando se construya, los datos del usuario (nombre, correo, rol y socio) están en `SesionService.usuario()` de `src/app/core/auth/`.

## Cómo trabajar una historia de este dominio

1. Crea la rama desde `develop` con el mismo nombre que en el backend, `feature/<ID>-<descripcion-corta-en-ingles>` (p. ej. `feature/HA-S01-role-based-auth`).
2. Declara la ruta en `perfil.routes.ts` (archivo de rutas del dominio, cargado de forma perezosa desde `app.routes.ts`).
3. Crea la página en la subcarpeta indicada con el sufijo `.page.ts` y su prueba `.page.spec.ts` al lado.
4. Los componentes propios de la pantalla van en `componentes/`, los servicios de datos en `servicios/` y los tipos en `modelos/`, dentro de la misma subcarpeta.
5. Las llamadas HTTP salen siempre por el cliente del microservicio en `src/app/core/api/`; ninguna página llama a otro servicio directamente.
6. Textos en `public/i18n/es-CO.json` y `en-US.json`; estilos con los tokens de `src/styles/`.
7. Antes del pull request: `npm run lint`, `npm run build` y `npm test` en verde con cobertura ≥ 70 %.

Ver las convenciones completas en [`src/app/features/README.md`](../README.md) y la trazabilidad global en [`docs/pantallas.md`](../../../../docs/pantallas.md).
