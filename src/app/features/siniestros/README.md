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
| [A7](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=25-1297) | Mis siniestros (versión mínima en HU-W2.1-01) | `/siniestros/mis-siniestros` | Asegurado | HU-W2.1-01, HU-W2.1-02 | S2, S3 |
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

## Implementado

**Radicación de siniestro con soportes (HU-W2.1-01)** — `radicacion/radicacion-siniestro.page.ts` (`RadicacionSiniestroPage`, A6 y
A6b), ruta `/siniestros/radicar`, rol asegurado (`rolGuard('asegurado')` en `siniestros.routes.ts`). Contrato:
`docs/contratos/HU-W2.1-01-api.md` del backend (servicio `claims`, `openapi.yaml` v0.3.0). Cliente: `core/api/siniestros/`.

- **Opciones del formulario (CA-1):** `GET /v1/claims/filing-options` trae solo las pólizas activas del asegurado que se radican
  (Autos y Hogar), los tipos que cubre cada una y los soportes de cada tipo. El catálogo **no** se fija en el front: se pinta desde la
  respuesta y se traduce por código con `siniestros.catalogo.*` (`modelos/catalogo-siniestros.ts`); un código desconocido muestra el
  texto del backend. Los soportes de otros tipos de la misma póliza aparecen como «No aplica», sin acción. Sin pólizas, el estado
  «sin pólizas» (no es un error).
- **Qué falta y la vigencia (CA-2, CA-3):** `radicacion/modelos/formulario-radicacion.ts` valida con los límites del contrato (lugar de 3
  a 160, descripción de 10 a 1000, hecho no futuro, de hace 5 años como máximo y dentro de `valid_from ≤ hecho < valid_to`, mínimo y
  máximo de archivos por soporte, 20 archivos por caso). «Radicar siniestro» se habilita solo sin faltantes y el aviso lateral dice
  exactamente qué falta; «Antes de radicar» comprueba la póliza y la vigencia. El `422` del backend (`validation_failed` por campo y por
  `supports.<código>`, `policy_not_eligible` por `reason`) se muestra igual, sin perder lo diligenciado.
- **Soportes (CA-5):** `radicacion/servicios/carga-soportes.service.ts` (provisto en la página) sube cada archivo en cuanto se elige, uno
  por petición y en secuencia. `SiniestrosApiService.subirSoporte` lo declara con su SHA-256 (`POST /v1/claims/supports`), lo sube directo a
  S3 con la URL firmada y lo confirma (`POST /v1/claims/supports/{id}/confirmation`): el archivo no pasa por el API Gateway. Antes de
  declararlo rechaza en el navegador lo que pasa de 10 MiB, el archivo vacío y el formato que el soporte no admite; el rechazo del servidor
  (`413`, `415`, `422`, `429`, o `415`/`422` al confirmar el contenido) afecta solo a ese archivo, igual que un fallo del `PUT` a S3.
  «Quitar» es local (el contrato no tiene `DELETE`).
- **Radicación idempotente:** `POST /v1/claims/web-filings` con una `Idempotency-Key` que se genera una vez por formulario y se reutiliza
  en cada reintento (`503`, error de red). Ante `422 idempotency_key_reused` el asegurado puede ir a «Mis siniestros» o radicar como un
  caso nuevo (otra clave).
- **Confirmación (A6b, CA-4):** estado de la misma página (`componentes/confirmacion-radicacion/`) con el radicado, la insignia
  «Radicado» (`status: active`), las etapas, los soportes y «Descargar radicado» (`GET /v1/claims/{id}/filing-receipt`). La página
  escribe `?caso=<claim_id>`: al recargar vuelve a leer el caso con `GET /v1/claims/{id}`. «Ver el estado del siniestro» (A8) no se
  muestra hasta HU-W2.1-02.
- **Fuera de alcance:** «Guardar borrador» del prototipo (no está en los CA; un archivo rechazado no borra el formulario) y el correo
  «Te avisaremos por correo y en la app».

**Mis siniestros, versión mínima (HU-W2.1-01, CA-6)** — `seguimiento/mis-siniestros.page.ts` (`MisSiniestrosPage`, A7), ruta
`/siniestros/mis-siniestros`, rol asegurado. `GET /v1/claims` lista los casos de los dos canales (los del móvil llegan sin la foto de la
póliza y se rotulan «Radicado desde la app») en `componentes/tabla-siniestros/`, con filtros de póliza (las de `filing-options`) y
«Desde», y «Cargar más» con `next_page_token` (al cambiar un filtro se empieza sin token y el filtro se conserva al paginar).
**HU-W2.1-02 completa la pantalla:** indicadores (en curso, pagados, acción pendiente), filtro de etapa, «Ver detalle» y «Corregir».

## Cómo trabajar una historia de este dominio

1. Crea la rama desde `develop` con el mismo nombre que en el backend, `feature/<ID>-<descripcion-corta-en-ingles>` (p. ej. `feature/HU-W2.1-01-<descripcion-en-ingles>`).
2. Declara la ruta en `siniestros.routes.ts` (archivo de rutas del dominio, cargado de forma perezosa desde `app.routes.ts`).
3. Crea la página en la subcarpeta indicada con el sufijo `.page.ts` y su prueba `.page.spec.ts` al lado.
4. Los componentes propios de la pantalla van en `componentes/`, los servicios de datos en `servicios/` y los tipos en `modelos/`, dentro de la misma subcarpeta.
5. Las llamadas HTTP salen siempre por el cliente del microservicio en `src/app/core/api/`; ninguna página llama a otro servicio directamente.
6. Textos en `public/i18n/es-CO.json` y `en-US.json`; estilos con los tokens de `src/styles/`.
7. Antes del pull request: `npm run lint`, `npm run build` y `npm test` en verde con cobertura ≥ 70 %.

Ver las convenciones completas en [`src/app/features/README.md`](../README.md) y la trazabilidad global en [`docs/pantallas.md`](../../../../docs/pantallas.md).
