# `features/siniestros` — Atención y resolución de siniestros

- **Épica:** Web · Épica 2
- **Microservicio que lo respalda (vía API Gateway):** Servicio de siniestros (radicación, consulta, triage, evaluación y pago, asistencias)
- **Cliente HTTP:** `src/app/core/api/siniestros/`
- **Shell de navegación:** portal
- **Requiere sesión:** sí (guard de autenticación en el shell del portal; el rol se restringe por ruta)

## Pantallas y dónde va cada una

### `radicacion/` — F2.1 · Radicación de siniestros con soportes

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [A6](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=24-988), [A6b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=279-6690) | Radicación de siniestro con soportes | `/siniestros/radicar` | Asegurado | HU-W2.1-01 | S2 |
| [A9](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=24-1340) | Edición de la radicación devuelta | `/siniestros/:id/editar` | Asegurado | HU-W2.1-04 | S3 |

### `seguimiento/` — F2.1 · Seguimiento del siniestro por el asegurado

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [A7](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=25-1297) | Mis siniestros | `/siniestros/mis-siniestros` | Asegurado | HU-W2.1-02 | S3 |
| [A8](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=25-1591) | Detalle y estado del siniestro | `/siniestros/:id` | Asegurado | HU-W2.1-02, HU-W2.1-04 | S3 |

### `revision/` — F2.1 · Intervención del asesor en la radicación

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [S8](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=30-2987) | Revisión de radicación de siniestro | `/siniestros/revision/:id` | Asesor comercial | HU-W2.1-03 | S3 |

### `triage/` — F2.2 · Priorización automática (triage) y cola de trabajo

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [O5](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=35-3351) | Cola de siniestros por prioridad | `/siniestros/cola` | Analista de operaciones | HU-W2.2-01, HU-W2.2-02 | S2 |

### `evaluacion/` — F2.2 · Evaluación, aprobación y pago

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [O6](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=35-3779), [O6b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=35-4168) | Evaluación, aprobación y pago (y pago fallido) | `/siniestros/:id/evaluar` | Analista de operaciones | HU-W2.2-03 | S2 |

### `asistencias/` — F2.3 · Asignación y seguimiento de prestadores y asistencias

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [O9](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=39-4301) | Solicitudes de asistencia entrantes | `/siniestros/asistencias` | Analista de operaciones | HU-W2.3-03 | S3 |
| [O7](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=36-3746), [O7b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=1088-9443) | Asignación de prestador más cercano | `/siniestros/:id/asignar-prestador` | Analista de operaciones | HU-W2.3-01 | S3 |
| [O8](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=36-4127) | Seguimiento de la intervención y cierre del caso | `/siniestros/:id/seguimiento` | Analista de operaciones | HU-W2.3-02 | S3 |
| [O9b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=39-4662) | Detalle de la asistencia con mapa | `/siniestros/asistencias/:id` | Analista de operaciones | HU-W2.3-03 | S3 |

## Cómo trabajar una historia de este dominio

1. Crea la rama desde `develop` con el mismo nombre que en el backend, `feature/<ID>-<descripcion-corta-en-ingles>` (p. ej. `feature/HU-W2.1-01-<descripcion-en-ingles>`).
2. Declara la ruta en `siniestros.routes.ts` (archivo de rutas del dominio, cargado de forma perezosa desde `app.routes.ts`).
3. Crea la página en la subcarpeta indicada con el sufijo `.page.ts` y su prueba `.page.spec.ts` al lado.
4. Los componentes propios de la pantalla van en `componentes/`, los servicios de datos en `servicios/` y los tipos en `modelos/`, dentro de la misma subcarpeta.
5. Las llamadas HTTP salen siempre por el cliente del microservicio en `src/app/core/api/`; ninguna página llama a otro servicio directamente.
6. Textos en `public/i18n/es-CO.json` y `en-US.json`; estilos con los tokens de `src/styles/`.
7. Antes del pull request: `npm run lint`, `npm run build` y `npm test` en verde con cobertura ≥ 70 %.

Ver las convenciones completas en [`src/app/features/README.md`](../README.md) y la trazabilidad global en [`docs/pantallas.md`](../../../../docs/pantallas.md).
