# Pantallas del portal web — trazabilidad

Inventario de las pantallas del prototipo Figma [Solventa — Prototipo S7 — Pantallas](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas)
(página `01 · Web portal`) con su carpeta en este repositorio, la ruta propuesta, los roles,
las historias de usuario que la construyen, el sprint planificado y el microservicio que la respalda.

Cómo usar esta tabla cuando tomas una historia:

1. Busca el ID de la historia (`HU-W…` o `HA-…`) en la columna **Historias**.
2. La columna **Carpeta** indica dónde va el código de la pantalla; la **Ruta** es la URL propuesta.
3. Los enlaces de la columna **Figma** abren el frame exacto del prototipo.
4. Crea la rama desde `develop` con el mismo nombre que en el backend: `feature/<ID>-<descripcion-corta-en-ingles>` (p. ej. `feature/HA-S01-role-based-auth`).

Convenciones del prototipo: `P` acceso al portal · `A` asegurado · `S` asesor comercial ·
`O` operaciones y cumplimiento · `B` socio comercial · `E` canal embebido.
Las variantes `b`, `c`, `d`… son **estados** de la misma pantalla (vacío, degradado,
error, confirmación, modal): se implementan dentro del mismo componente, no como rutas aparte.

Los sprints corresponden al [plan de trabajo por sprints](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Plan-de-trabajo-por-sprints).
Las historias detalladas están en el refinamiento del [Sprint 1](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Refinamiento-HUs-y-HAs)
y de los [Sprints 2 y 3](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Refinamiento-HUs-y-HAs-Sprint-2-y-3).

## Acceso al portal — `src/app/features/acceso/`

- Épica: Transversal (HA-S01)
- Servicio de respaldo (vía API Gateway): Amazon Cognito User Pool (proveedor de identidad, HA-S01) — el API Gateway valida el JWT
- Shell de navegación: sin shell (pantalla completa)

| Figma | Pantalla | Carpeta | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|---|
| [P0](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=17-174) | Inicio de sesión del portal | `src/app/features/acceso/` | `/acceso/iniciar-sesion` | público | HA-S01 | S1 |
| sin frame web dedicado | Acceso no autorizado (403) | `src/app/features/acceso/` | `/acceso/no-autorizado` | público | HA-S01 | S1 |
| sin frame web dedicado | Sesión expirada | `src/app/features/acceso/` | `/acceso/sesion-expirada` | público | HA-S01 | S1 |

## Inicio por rol — `src/app/features/inicio/`

- Épica: Transversal (HA-S01)
- Servicio de respaldo (vía API Gateway): Agrega datos de los servicios que usa cada rol (originación, siniestros, socios, auditoría)
- Shell de navegación: portal

| Figma | Pantalla | Carpeta | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|---|
| [A0](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=69-5915) | Inicio del asegurado | `src/app/features/inicio/` | `/inicio` | Asegurado | HA-S01 | S1 |
| [S0](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=69-6320) | Inicio del asesor comercial | `src/app/features/inicio/` | `/inicio` | Asesor comercial | HA-S01 | S1 |
| [O0](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=69-6735) | Centro de operaciones | `src/app/features/inicio/` | `/inicio` | Analista de operaciones | HA-S01 | S1 |

## Canal embebido (demo en el sitio del banco aliado) — `src/app/features/embebido/`

- Épica: Web · Épica 1 (F1.2 y F1.3)
- Servicio de respaldo (vía API Gateway): Servicio de originación — camino crítico de cotización (orquestador, perfilamiento, motor de rating)
- Shell de navegación: embebido (barra del aliado + indicador de pasos)

| Figma | Pantalla | Carpeta | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|---|
| [E1](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=9-169) | Paso 1 · Consentimiento | `src/app/features/embebido/consentimiento/` | `/embebido/consentimiento` | público (canal del aliado) | HU-W1.2-01 | S1 |
| [E6](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=15-691), [E6b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=1361-9594), [E6c](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=1361-9736) | Solicitud en revisión (decisión humana) · estado de la aceptación; E6b solicitud ajustada por el asesor (nueva oferta) y E6c rechazada (HU-W1.1-02) | `src/app/features/embebido/aceptacion-oferta/` | `/embebido/oferta/:ofertaId` | Asegurado (sesión) | HU-W1.3-01, HU-W1.1-02 | S1 |
| [E3](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=12-434), [E3b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=15-478), [E3c](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=433-745) | Paso 3 · Oferta personalizada (y provisional) y aceptación | `src/app/features/embebido/aceptacion-oferta/` | `/embebido/oferta/:ofertaId` | Asegurado (sesión) | HU-W1.2-03, HU-W1.3-01, HA-D01 | S1 |
| [E7](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=16-1002) | Oferta vencida · estado de la aceptación | `src/app/features/embebido/aceptacion-oferta/` | `/embebido/oferta/:ofertaId` | Asegurado (sesión) | HU-W1.3-01 | S1 |
| [E4](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=14-337), [E4b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=16-578), [E4c](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=16-783) | Paso 4 · Pago de la prima (pendiente / rechazado) | `src/app/features/embebido/pago/` | `/embebido/pago/:aceptacionId` | Asegurado (sesión) | HU-W1.3-02, HA-D02 | S1 |
| [E2](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=12-231), [E2b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=643-8582) | Paso 2 · Cálculo del perfil de riesgo | `src/app/features/embebido/perfil-riesgo/` | `/embebido/perfil-riesgo/:clienteId` | público (canal del aliado) | HU-W1.2-02, HA-L01, HA-D01 | S1 |
| [E5](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=14-556) | Paso 5 · Póliza emitida | `src/app/features/embebido/poliza-emitida/` | `/embebido/poliza-emitida/:polizaId` | Asegurado (sesión) | HU-W1.3-03 | S1 |

## Originación y ciclo de vida de la póliza — `src/app/features/originacion/`

- Épica: Web · Épica 1
- Servicio de respaldo (vía API Gateway): Servicio de originación (cotización, emisión, cobro, endosos, renovación, cancelación)
- Shell de navegación: portal

| Figma | Pantalla | Carpeta | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|---|
| [S4](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=29-2213), [S4b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=326-7087) | Bandeja de decisión humana | `src/app/features/originacion/bandeja-decision/` | `/originacion/bandeja-decision` | Asesor comercial | HU-W1.1-02 | S1 |
| [O1](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=31-2707), [O1b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=31-3141) | Monitoreo de emisiones y detalle de excepción | `src/app/features/originacion/emisiones/` | `/originacion/emisiones` | Analista de operaciones | HU-W1.3-04, HA-D02 | S2 |
| [O2](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=34-3012) | Bandeja de endosos | `src/app/features/originacion/endosos/` | `/originacion/endosos` | Analista de operaciones | HU-W1.4-02 | S3 |
| [A1](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=17-266) | Mis pólizas | `src/app/features/originacion/polizas/` | `/originacion/polizas` | Asegurado | HU-W1.5-02, HU-W1.6-02 | S2 |
| [S6](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=30-2326) | Pólizas próximas a vencer | `src/app/features/originacion/renovaciones/` | `/originacion/renovaciones` | Asesor comercial | HU-W1.5-01 | S3 |
| [A11](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=291-6869) | Mis solicitudes | `src/app/features/originacion/endosos/` | `/originacion/solicitudes` | Asegurado | HU-W1.4-01 | S3 |
| [S1](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=26-1509) | Cotización asistida · Datos del cliente | `src/app/features/originacion/cotizacion-asistida/` | `/originacion/cotizaciones/nueva` | Asesor comercial | HU-W1.1-01 | S1 |
| [S5](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=29-2522) | Detalle del caso y registro de decisión | `src/app/features/originacion/bandeja-decision/` | `/originacion/bandeja-decision/:aceptacionId` | Asesor comercial | HU-W1.1-02 | S1 |
| [S2](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=26-1897), [S2b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=26-2176) | Cotización asistida · Resultado (y modo degradado) | `src/app/features/originacion/cotizacion-asistida/` | `/originacion/cotizaciones/:id` | Asesor comercial | HU-W1.1-01 | S1 |
| [O3](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=34-3402), [O3b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=836-9166) | Detalle del endoso (y validación fallida) | `src/app/features/originacion/endosos/` | `/originacion/endosos/:id` | Analista de operaciones | HU-W1.4-02 | S3 |
| [A2](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=19-304), [A2b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=19-666) | Detalle de la póliza (y cancelada por no pago) | `src/app/features/originacion/polizas/` | `/originacion/polizas/:id` | Asegurado | HU-W1.6-02 | S3 |
| [S7](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=30-2693), [S7b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=326-7198) | Renovación asistida con recotización | `src/app/features/originacion/renovaciones/` | `/originacion/renovaciones/:id` | Asesor comercial | HU-W1.5-03 | S3 |
| [S3](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=27-1916), [S3b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=27-2233), [S3c](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=326-6972) | Formalización de la compra | `src/app/features/originacion/cotizacion-asistida/` | `/originacion/cotizaciones/:id/formalizar` | Asesor comercial | HU-W1.1-03 | S2 |
| [A5](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=21-972), [A5b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=21-1211) | Cancelación con reembolso prorrateado | `src/app/features/originacion/cancelaciones/` | `/originacion/polizas/:id/cancelar` | Asegurado | HU-W1.6-01 | S3 |
| [O4](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=39-4018) | Historial de endosos de la póliza | `src/app/features/originacion/polizas/` | `/originacion/polizas/:id/endosos` | Analista de operaciones | HU-W1.4-03 | Could (fuera de alcance) |
| [A3](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=20-529), [A3b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=20-866) | Solicitud de modificación (autogestión) | `src/app/features/originacion/endosos/` | `/originacion/polizas/:id/modificar` | Asegurado | HU-W1.4-01 | S3 |
| [A4](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=21-738), [A4b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=283-6783) | Renovación en línea | `src/app/features/originacion/renovaciones/` | `/originacion/polizas/:id/renovar` | Asegurado | HU-W1.5-02 | S2 |

## Atención y resolución de siniestros — `src/app/features/siniestros/`

- Épica: Web · Épica 2
- Servicio de respaldo (vía API Gateway): Servicio de siniestros (radicación, consulta, triage, evaluación y pago, asistencias)
- Shell de navegación: portal

| Figma | Pantalla | Carpeta | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|---|
| [O9](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=39-4301) | Solicitudes de asistencia entrantes | `src/app/features/siniestros/asistencias/` | `/siniestros/asistencias` | Analista de operaciones | HU-W2.3-03 | S3 |
| [O5](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=35-3351) | Cola de siniestros por prioridad | `src/app/features/siniestros/triage/` | `/siniestros/cola` | Analista de operaciones | HU-W2.2-01, HU-W2.2-02 | S2 |
| [A7](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=25-1297) | Mis siniestros | `src/app/features/siniestros/seguimiento/` | `/siniestros/mis-siniestros` | Asegurado | HU-W2.1-02 | S3 |
| [A6](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=24-988), [A6b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=279-6690) | Radicación de siniestro con soportes | `src/app/features/siniestros/radicacion/` | `/siniestros/radicar` | Asegurado | HU-W2.1-01 | S2 |
| [A8](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=25-1591) | Detalle y estado del siniestro | `src/app/features/siniestros/seguimiento/` | `/siniestros/:id` | Asegurado | HU-W2.1-02, HU-W2.1-04 | S3 |
| [O7](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=36-3746), [O7b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=1088-9443) | Asignación de prestador más cercano | `src/app/features/siniestros/asistencias/` | `/siniestros/:id/asignar-prestador` | Analista de operaciones | HU-W2.3-01 | S3 |
| [A9](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=24-1340) | Edición de la radicación devuelta | `src/app/features/siniestros/radicacion/` | `/siniestros/:id/editar` | Asegurado | HU-W2.1-04 | S3 |
| [O6](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=35-3779), [O6b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=35-4168) | Evaluación, aprobación y pago (y pago fallido) | `src/app/features/siniestros/evaluacion/` | `/siniestros/:id/evaluar` | Analista de operaciones | HU-W2.2-03 | S2 |
| [O8](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=36-4127) | Seguimiento de la intervención y cierre del caso | `src/app/features/siniestros/asistencias/` | `/siniestros/:id/seguimiento` | Analista de operaciones | HU-W2.3-02 | S3 |
| [O9b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=39-4662) | Detalle de la asistencia con mapa | `src/app/features/siniestros/asistencias/` | `/siniestros/asistencias/:id` | Analista de operaciones | HU-W2.3-03 | S3 |
| [S8](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=30-2987) | Revisión de radicación de siniestro | `src/app/features/siniestros/revision/` | `/siniestros/revision/:id` | Asesor comercial | HU-W2.1-03 | S3 |

## Gestión B2B de socios comerciales — `src/app/features/socios/`

- Épica: Web · Épica 3
- Servicio de respaldo (vía API Gateway): Servicio de gestión de socios B2B (alta, credenciales, tablero de desempeño)
- Shell de navegación: portal

| Figma | Pantalla | Carpeta | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|---|
| [O10](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=40-4257) | Socios comerciales (listado) | `src/app/features/socios/gestion/` | `/socios` | Analista de operaciones | HU-W3.1-01 | S2 |
| [B4](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=46-6009) | Credenciales de integración | `src/app/features/socios/credenciales/` | `/socios/credenciales` | Socio comercial | HU-W3.1-01 | S2 |
| [B1](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=46-5476), [B1b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=46-5785), [B1c](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=701-8636), [B1d](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=701-8824) | Tablero de integración · Resumen | `src/app/features/socios/tablero/` | `/socios/tablero` | Socio comercial | HU-W3.2-01 | S3 |
| [B3](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=47-5965), [B3b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=47-6183), [B3c](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=701-9564) | Desempeño técnico de la API (y API degradada) | `src/app/features/socios/desempeno/` | `/socios/tablero/desempeno` | Socio comercial | HU-W3.2-03 | S3 |
| [B2](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=47-5701), [B2b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=701-9012), [B2c](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=701-9150), [B2d](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=701-9288), [B2e](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=701-9426) | Cotizaciones y pólizas por producto | `src/app/features/socios/tablero/` | `/socios/tablero/por-producto` | Socio comercial | HU-W3.2-02 | Could (fuera de alcance) |
| [O11](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=40-4634), [O11b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=40-4980) | Detalle del socio y credenciales (y baja) | `src/app/features/socios/gestion/` | `/socios/:id` | Analista de operaciones | HU-W3.1-01, HU-W3.1-02 | S2 |

## Auditoría y consentimientos (analítica, cumplimiento y trazabilidad) — `src/app/features/auditoria/`

- Épica: Web · Épica 4
- Servicio de respaldo (vía API Gateway): Servicio de auditoría y consentimientos (registro inmutable, consentimientos Open Finance)
- Shell de navegación: portal

| Figma | Pantalla | Carpeta | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|---|
| [O14](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=44-4954), [O14b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=877-9304) | Consentimientos Open Finance (y sin resultados) | `src/app/features/auditoria/consentimientos/` | `/auditoria/consentimientos` | Analista de operaciones | HU-W4.2-01 | S2 |
| [O12](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=41-4627), [O12b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=41-5312) | Auditoría · Búsqueda por identificador (y sin resultados) | `src/app/features/auditoria/registro/` | `/auditoria/registro` | Analista de operaciones | HU-W4.1-01 | S2 |
| [O15](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=44-5400), [O15b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=45-5220), [O15c](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=45-5641) | Detalle del consentimiento, confirmación y reintento de revocación | `src/app/features/auditoria/consentimientos/` | `/auditoria/consentimientos/:id` | Analista de operaciones | HU-W4.2-02 | S2 |
| [O13](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=41-4943) | Registro de auditoría de la suscripción | `src/app/features/auditoria/registro/` | `/auditoria/registro/:id` | Analista de operaciones | HU-W4.1-01, HU-W4.1-02 | S2 |

## Perfil del usuario — `src/app/features/perfil/`

- Épica: Transversal (HA-S01)
- Servicio de respaldo (vía API Gateway): Amazon Cognito User Pool (atributos del usuario autenticado)
- Shell de navegación: portal

| Figma | Pantalla | Carpeta | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|---|
| [A10](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=80-6341) | Mi perfil | `src/app/features/perfil/` | `/perfil` | Asegurado, Asesor comercial, Analista de operaciones, Socio comercial | HA-S01 | S1 |

## Pantallas del prototipo que no son rutas propias

| Figma | Pantalla | Dónde se resuelve |
|---|---|---|
| U1, U2, U3 (página `03 · Usabilidad`) | Espejos en inglés y escala de texto al 130 % | Selector de idioma con Transloco (`src/app/core/i18n/`) y tipografía relativa en `src/styles/` |
| Barra superior y barra lateral por rol | Presentes en todas las pantallas del portal | `src/app/layout/portal/` con el menú definido en `src/app/core/navegacion/` |
| Barra del aliado e indicador de pasos | Presentes en todo el canal embebido | `src/app/layout/embebido/` |
| Botón, campo, insignia, aviso, tarjeta, tabla, stepper, estado vacío | Biblioteca `00 · Componentes` | `src/app/shared/ui/` (uno por carpeta) |
