# `features/originacion` — Originación y ciclo de vida de la póliza

- **Épica:** Web · Épica 1
- **Microservicio que lo respalda (vía API Gateway):** Servicio de originación (cotización, emisión, cobro, endosos, renovación, cancelación)
- **Cliente HTTP:** `src/app/core/api/originacion/`
- **Shell de navegación:** portal
- **Requiere sesión:** sí (guard de autenticación en el shell del portal; el rol se restringe por ruta)

## Pantallas y dónde va cada una

### `cotizacion-asistida/` — F1.1 · Cotización y venta asistida por asesor

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [S1](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=26-1509) | Cotización asistida · Datos del cliente | `/originacion/cotizaciones/nueva` | Asesor comercial | HU-W1.1-01 | S1 |
| [S2](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=26-1897), [S2b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=26-2176) | Cotización asistida · Resultado (y modo degradado) | `/originacion/cotizaciones/:id` | Asesor comercial | HU-W1.1-01 | S1 |
| [S3](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=27-1916), [S3b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=27-2233), [S3c](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=326-6972) | Formalización de la compra | `/originacion/cotizaciones/:id/formalizar` | Asesor comercial | HU-W1.1-03 | S2 |

### `bandeja-decision/` — F1.1 · Bandeja de solicitudes enrutadas a decisión humana

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [S4](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=29-2213), [S4b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=326-7087) | Bandeja de decisión humana | `/originacion/bandeja-decision` | Asesor comercial | HU-W1.1-02 | S1 |
| [S5](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=29-2522) | Detalle del caso y registro de decisión | `/originacion/bandeja-decision/:id` | Asesor comercial | HU-W1.1-02 | S1 |

### `polizas/` — F1.3 · Consulta de pólizas y su detalle (autoservicio del asegurado)

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [A1](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=17-266) | Mis pólizas | `/originacion/polizas` | Asegurado | HU-W1.5-02, HU-W1.6-02 | S2 |
| [A2](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=19-304), [A2b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=19-666) | Detalle de la póliza (y cancelada por no pago) | `/originacion/polizas/:id` | Asegurado | HU-W1.6-02 | S3 |
| [O4](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=39-4018) | Historial de endosos de la póliza | `/originacion/polizas/:id/endosos` | Analista de operaciones | HU-W1.4-03 | Could (fuera de alcance) |

### `endosos/` — F1.4 · Gestión de modificaciones y endosos

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [O2](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=34-3012) | Bandeja de endosos | `/originacion/endosos` | Analista de operaciones | HU-W1.4-02 | S3 |
| [A11](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=291-6869) | Mis solicitudes | `/originacion/solicitudes` | Asegurado | HU-W1.4-01 | S3 |
| [O3](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=34-3402), [O3b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=836-9166) | Detalle del endoso (y validación fallida) | `/originacion/endosos/:id` | Analista de operaciones | HU-W1.4-02 | S3 |
| [A3](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=20-529), [A3b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=20-866) | Solicitud de modificación (autogestión) | `/originacion/polizas/:id/modificar` | Asegurado | HU-W1.4-01 | S3 |

### `renovaciones/` — F1.5 · Renovación de pólizas

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [S6](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=30-2326) | Pólizas próximas a vencer | `/originacion/renovaciones` | Asesor comercial | HU-W1.5-01 | S3 |
| [S7](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=30-2693), [S7b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=326-7198) | Renovación asistida con recotización | `/originacion/renovaciones/:id` | Asesor comercial | HU-W1.5-03 | S3 |
| [A4](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=21-738), [A4b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=283-6783) | Renovación en línea | `/originacion/polizas/:id/renovar` | Asegurado | HU-W1.5-02 | S2 |

### `cancelaciones/` — F1.6 · Cancelaciones y reembolsos

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [A5](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=21-972), [A5b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=21-1211) | Cancelación con reembolso prorrateado | `/originacion/polizas/:id/cancelar` | Asegurado | HU-W1.6-01 | S3 |

### `emisiones/` — F1.3 · Monitoreo de emisiones y excepciones de cobro

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [O1](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=31-2707), [O1b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=31-3141) | Monitoreo de emisiones y detalle de excepción | `/originacion/emisiones` | Analista de operaciones | HU-W1.3-04, HA-D02 | S2 |

## Implementado

**Cotización asistida por asesor (HU-W1.1-01)** — `cotizacion-asistida/datos-cliente.page.ts` (`DatosClientePage`, S1) y
`cotizacion-asistida/resultado-cotizacion.page.ts` (`ResultadoCotizacionPage`, S2 / S2b), rutas `/originacion/cotizaciones/nueva` y
`/originacion/cotizaciones/:id` declaradas en `originacion.routes.ts` (`ORIGINACION_ROUTES`, `rolGuard('asesor')`; `nueva` va antes de
`:id`) y registradas en `app.routes.ts` dentro del shell del portal. Contrato: `docs/contratos/HU-W1.1-01-api.md` del backend
(servicio `origination`, `openapi.yaml` v0.6.0). Los frames de Figma no se pudieron abrir en esta sesión: las pantallas siguen la
historia y los criterios de aceptación, y quedan pendientes de revisión contra el prototipo.

- Llama a `OriginacionApiService` (`core/api/originacion/`): `buscarClientePorDocumento` (`GET /v1/customers`),
  `crearCotizacionAsistida` (`POST /v1/assisted-quotes`) y `consultarCotizacionAsistida` (`GET /v1/assisted-quotes/{id}`). Los errores
  llegan como `ErrorCotizacionAsistida` con el código estable del contrato; `validation_failed` trae **todos** los campos con error.
- **S1:** formulario reactivo (documento con «Buscar cliente», nombre, correo, fecha de nacimiento, monto asegurado, plazo y el
  consentimiento que afirma el asesor). Cada campo muestra su error específico (`required`, `invalid_format`, `out_of_range`), el que
  detecta el navegador o el que devuelve el backend, y no se cotiza mientras haya un campo inválido. Con `?documento=` precarga y busca
  al cliente (es el destino de «Generar una nueva cotización»).
- **S2 / S2b:** los estados viven en la misma página: **vigente** (prima mensual, coberturas, vigencia de 24 h y datos del cliente),
  **modo degradado** (`mode: provisional`: último perfil en caché o perfil actuarial base, con su aviso) y **vencida** (`status:
  expired`: no se puede formalizar, se informa el motivo y se ofrece generar una nueva). Textos en
  `originacion.cotizacionAsistida.*`; la web no calcula precios, vigencias ni degradación.
- Pendiente: «Formalizar la compra» (HU-W1.1-03, ruta `:id/formalizar`).
- E2E: `e2e/flujos/cotizacion-emision/cotizacion-asistida.spec.ts` (API Gateway y Cognito simulados con `page.route`, axe-core en cada estado).

**Bandeja de decisión humana (HU-W1.1-02)** — `bandeja-decision/bandeja-decision.page.ts` (`BandejaDecisionPage`, S4 / S4b) y
`bandeja-decision/detalle-solicitud.page.ts` (`DetalleSolicitudPage`, S5), rutas `/originacion/bandeja-decision` y
`/originacion/bandeja-decision/:aceptacionId` en `originacion.routes.ts` (`rolGuard('asesor')`; el menú del asesor ya enlazaba la
bandeja). Contrato: `docs/contratos/HU-W1.1-02-api.md` del backend (servicio `origination`, `openapi.yaml` v0.8.0).

- Llama a `OriginacionApiService`: `listarSolicitudesRevision`, `consultarSolicitudRevision` y `registrarDecision`. Los errores
  llegan como `ErrorRevision` con el código estable del contrato.
- **S4:** pestañas accesibles «Pendientes (n)» / «Decididas (m)» con los conteos del backend, selector de motivo (los motivos del
  dominio; uno desconocido se muestra como «Validación adicional de suscripción»), orden por llegada y la tabla
  `componentes/tabla-solicitudes/` (solicitud, solicitante, oferta, motivo, llegada y «Revisar»; en «Decididas», decisión, asesor y
  fecha). Estados de carga, vacío (también con filtro) y error con reintento. **S4b:** al volver del detalle tras registrar, la
  misma página anuncia «Decisión registrada» (`servicios/aviso-decision.service.ts`, una sola vez).
- **S5:** número, estado, solicitante, llegada, oferta implicada (prima, vigencia y modo), aviso del motivo y el bloque «Decisión»
  (`componentes/formulario-decision/`: aceptar, ajustar o rechazar; «Ajuste de prima (%)» solo al ajustar, de 0,01 a 100 con dos
  decimales; observaciones obligatorias al ajustar o rechazar, hasta 1 000 caracteres; errores con `aria-describedby` y foco en el
  primero). Un caso decidido se ve en solo lectura con el registro completo (tipo, asesor, fecha y hora, observaciones, ajuste y
  oferta nueva). 404, 409 (otro asesor se adelantó: recarga y muestra lo decidido), 400 por campo y 503 con reintento.
- Quedan fuera (ningún criterio los pide o el dominio no tiene los datos): las tarjetas de indicadores, «Exportar», el filtro de
  llegada y «Contexto del cliente» de S4/S5, y la edad, la ciudad y los ingresos del solicitante.
- El resultado para el cliente (E6b/E6c) vive en `features/embebido/aceptacion-oferta/`.
- E2E: `e2e/flujos/cotizacion-emision/bandeja-decision.spec.ts` (API Gateway y Cognito simulados con `page.route`, axe-core en
  cada estado).

## Cómo trabajar una historia de este dominio

1. Crea la rama desde `develop` con el mismo nombre que en el backend, `feature/<ID>-<descripcion-corta-en-ingles>` (p. ej. `feature/HU-W1.1-01-<descripcion-en-ingles>`).
2. Declara la ruta en `originacion.routes.ts` (archivo de rutas del dominio, cargado de forma perezosa desde `app.routes.ts`).
3. Crea la página en la subcarpeta indicada con el sufijo `.page.ts` y su prueba `.page.spec.ts` al lado.
4. Los componentes propios de la pantalla van en `componentes/`, los servicios de datos en `servicios/` y los tipos en `modelos/`, dentro de la misma subcarpeta.
5. Las llamadas HTTP salen siempre por el cliente del microservicio en `src/app/core/api/`; ninguna página llama a otro servicio directamente.
6. Textos en `public/i18n/es-CO.json` y `en-US.json`; estilos con los tokens de `src/styles/`.
7. Antes del pull request: `npm run lint`, `npm run build` y `npm test` en verde con cobertura ≥ 70 %.

Ver las convenciones completas en [`src/app/features/README.md`](../README.md) y la trazabilidad global en [`docs/pantallas.md`](../../../../docs/pantallas.md).
