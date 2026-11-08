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
| [O1](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=31-2707), [O1b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=31-3141) | Monitoreo de emisiones y detalle de excepción | `/originacion/emisiones` | Analista de operaciones | HU-W1.3-04, HA-D02 | S2 (implementada) |

## Implementado

**Cotización asistida por asesor (HU-W1.1-01)** — `cotizacion-asistida/datos-cliente.page.ts` (`DatosClientePage`, S1) y
`cotizacion-asistida/resultado-cotizacion.page.ts` (`ResultadoCotizacionPage`, S2 / S2b), rutas `/originacion/cotizaciones/nueva` y
`/originacion/cotizaciones/:id` declaradas en `originacion.routes.ts` (`ORIGINACION_ROUTES`, `rolGuard('asesor')`; `nueva` va antes de
`:id`) y registradas en `app.routes.ts` dentro del shell del portal. Contrato: `docs/contratos/HU-W1.1-01-api.md` del backend
(servicio `origination`, `openapi.yaml` v0.6.0). Las pantallas siguen la historia y los criterios de
aceptación y se contrastaron con los frames S1 y S2 del prototipo (acciones en el encabezado de S1; en S2, insignia de vigencia, bloque
destacado de la prima, coberturas y explicación del precio).

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
- **Fuera de los frames por falta de datos en el contrato o por ser de otra historia:** en S1, apellidos separados, celular, ciudad,
  producto, entidad crediticia, fecha de desembolso, el consentimiento vigente por SMS y el panel «Fuentes del motor»; en S2,
  «Guardar y enviar al cliente», «Fuentes consultadas» y «Siguientes pasos». La vigencia es de 24 h (la historia y
  el backend); el prototipo muestra 72 h y está pendiente de acordar con el equipo. La insignia de S2 toma las horas de las fechas de la
  cotización, así que sigue al backend si cambia.
- «Formalizar compra» es la pantalla siguiente (HU-W1.1-03, más abajo); en S2 es un enlace habilitado solo con `can_formalize`.
- E2E: `e2e/flujos/cotizacion-emision/cotizacion-asistida.spec.ts` (API Gateway y Cognito simulados con `page.route`, axe-core en cada estado).

**Formalización de la compra (HU-W1.1-03)** — `cotizacion-asistida/formalizar-compra.page.ts` (`FormalizarCompraPage`, S3 / S3b / S3c),
ruta `/originacion/cotizaciones/:id/formalizar` en `originacion.routes.ts` (`rolGuard('asesor')`). Contrato: `docs/contratos/HU-W1.1-03-api.md`
del backend (servicio `origination`, `openapi.yaml` v0.11.0).

- **S3 · Formalizar compra** (frame «Portal asesor · Formalización de la compra»): encabezado con la insignia «Cotización vigente» y las
  acciones «Volver a la cotización» y «Formalizar y emitir»; tarjetas «Confirmación de datos del cliente», «Condiciones ofertadas» y
  «Aceptación del cliente»; a la derecha «Qué ocurre al formalizar» (4 pasos) y «Registro». La aceptación (CA-5) pide el **medio**
  (llamada grabada, firma remota o código de confirmación), la **fecha y hora** y la **referencia**, más la casilla de confirmación. Con
  el código de confirmación el servicio se lo envía al cliente por correo y el asesor lo digita (el código nunca vuelve al asesor).
- **S3c · Compra formalizada y emisión iniciada:** «Datos confirmados del cliente», «Condiciones ofertadas», «Aceptación registrada»
  (solo lectura) y a la derecha «Próximos pasos de emisión» y «Trazabilidad de la formalización». Si la cotización ya estaba
  formalizada —por el mismo asesor en otra visita o por otro, `409 already_formalized`— se muestra ese registro.
- **Cotización vencida:** no se formaliza y se ofrece generar una nueva con el documento del cliente. No se pudo contrastar con su
  frame: el enlace de la tarjeta #63 apunta al nodo 326-7198, que es el de la renovación formalizada (S7b), no el de la vencida.
- Textos en `originacion.formalizacion.*`; la web no valida grabaciones ni firmas, solo las registra por su referencia.
- **Diferencias con el mockup, por datos que el contrato no trae:** celular, producto, consentimiento de Open Finance, beneficiario
  oneroso y medio de pago (las tarjetas de cliente y de condiciones muestran lo que el backend devuelve); el código corto `COT-…`
  (la cotización se identifica por su id); el nombre de la asesora (el token de Cognito no trae nombre: se muestra su correo); y el botón
  «Ver emisión en curso», porque el monitor de emisiones es solo de `operaciones` y el asesor no puede abrirlo. Las coberturas se
  muestran como parte de las condiciones.
- E2E: `e2e/flujos/cotizacion-emision/formalizacion.spec.ts` (API Gateway y Cognito simulados con `page.route`, axe-core en cada estado).

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

**Monitoreo de emisiones y excepciones (HU-W1.3-04)** — `emisiones/emisiones.page.ts` (`EmisionesPage`, O1) y
`emisiones/componentes/detalle-excepcion/detalle-excepcion.component.ts` (`DetalleExcepcionComponent`, O1b, un diálogo modal), ruta
`/originacion/emisiones` en `originacion.routes.ts` (`rolGuard('operaciones')`; el ítem «Emisiones» del menú de operaciones ya
existía). Cliente: `OriginacionApiService.listarEmisiones`, `listarAccionesEmision` y `reintentarEmision`, con los modelos de
`core/api/originacion/emision-monitor.modelos.ts`.

- **Distribución (O1):** encabezado con «Actualizar», cinco tarjetas (Aceptadas, En cobro, Activas hoy, Notificadas, En excepción),
  filtros (Estado, Desde, Hasta y Canal, más «Limpiar filtros» y «Actualizado hace N s») y la tabla Emisión · Cliente · Canal · Estado ·
  Último paso · Hora. Las tarjetas cuentan **todas** las emisiones, no solo las filtradas; «hoy» es el día del analista (se envía
  `day_from`).
- **Estados (CA-1, CA-2, CA-5):** Aceptada, En cobro, Activa, Notificada y En excepción, derivados por el backend. En una excepción el
  «Último paso» dice por qué: pasarela caída, pago rechazado, medio de pago no entregado, generador de documentos o canal de correo. Las
  excepciones se «Gestionan»; las demás solo se «Ven» (diálogo de solo lectura), porque no piden ninguna acción. Un resumen de «sin
  atender» marca las excepciones con 30 minutos o más sin analista, en la tarjeta y en la fila.
- **«Tiempo real»:** la lista se actualiza sola cada 30 s (`INTERVALO_SONDEO_MS`) y con «Actualizar». Una actualización que falla conserva
  la lista y lo avisa; no hay empuje desde el servidor.
- **Filtros (CA-4):** estado, canal (web o móvil) y rango de fechas de aceptación, aplicados por el backend. Las fechas son de calendario
  en la zona del usuario (de 00:00:00.000 a 23:59:59.999). Un rango al revés no consulta y se avisa. Sin resultados es una vista vacía,
  sin error.
- **Reintento (CA-3, CA-7):** en el diálogo, motivo, intentos, historial de acciones (autor, nota y fecha) y el formulario con nota
  obligatoria (1 a 500 caracteres). `POST /v1/issuances/{id}/retry` reintenta lo que falló —el cobro o, si ya se confirmó, el documento y
  el aviso— con la misma clave de idempotencia; si otro analista o el proceso automático ya lo reintentó, el backend responde 409 y el
  diálogo lo explica sin cobrar ni avisar de nuevo. El diálogo toma el foco, lo mantiene dentro, se cierra con Escape y lo devuelve al
  botón que lo abrió.
- **Cliente y canal:** el nombre del titular sale del cobro; el canal es web o móvil (la aceptación no guarda el aliado ni el asesor que
  muestra el mockup). «Emisión» muestra el identificador de la aceptación, no un número `EMI-…`.
- Quedan fuera: el empuje «en tiempo real» y una alerta real del escalamiento (solo la marca «Sin atender»), la gestión manual distinta
  de reintentar y el código que devuelve el banco. O1b se hizo desde los criterios de aceptación porque falta su mockup.
- E2E: `e2e/flujos/originacion/monitoreo-emisiones.spec.ts` (API Gateway y Cognito simulados con `page.route`, axe-core en la lista y
  con el diálogo abierto).

**Mis pólizas y renovación en línea (HU-W1.5-02)** — `polizas/mis-polizas.page.ts` (`MisPolizasPage`, A1 mínimo) y
`renovaciones/renovar-poliza.page.ts` (`RenovarPolizaPage`, A4 / A4b), rutas `/originacion/polizas` y `/originacion/polizas/:id/renovar` en
`originacion.routes.ts` (`rolGuard('asegurado')`). Contrato: `docs/contratos/HU-W1.5-02-api.md` del backend (`openapi.yaml` v0.12.0).
Cliente: `core/api/originacion/renovacion.modelos.ts` y los métodos `listarPolizas`, `consultarCondicionesRenovacion`, `renovarPoliza` y
`consultarEstadoRenovacion` de `OriginacionApiService`. La pantalla consulta primero la renovación del periodo; si no existe muestra las
condiciones **vigentes junto a las recotizadas antes de aceptar**; fuera de la ventana el botón queda deshabilitado y la lista no ofrece
renovar. «Renovar y pagar» pide la casilla de consentimiento, acepta (idempotente en el backend) y sigue el cobro cada 2 s hasta A4b. Con el pago
rechazado la solicitud se conserva y se reutiliza `FormularioMedioPagoComponent` (E4/E4c) para entregar otro medio al mismo cobro
(`POST /v1/acceptances/{id}/charge/payment-method`) hasta `retry_until`; sin respuesta o con el pago sin resolver el estado es «no renovada».
- Se contrastó con las capturas de A1, A4 y A4b del prototipo. Diferencias: **sin el botón «Hablar con un asesor»** (no hay canal de contacto en el
  sistema), **sin la fila de deducible** (el contrato no la trae), título genérico «Renovar póliza» (no hay producto) y el cobro se hace **al
  aceptar**, como pide el criterio 2 (A4b lo muestra «programado» para el fin de la vigencia). En A1 faltan el producto, el filtro por producto, la
  tarjeta de siniestros en curso, las pólizas canceladas («Cancelada», «No pago») y «Ver detalle» (A2, HU-W1.6-02), que no existen en el contrato.
- **No hay mockup** de «fuera de la ventana», «pago rechazado», «sin medio de pago» ni «no renovada» (la wiki ya lo anotaba): se diseñaron desde los
  criterios con los mismos componentes de A4.
- E2E: `e2e/flujos/cotizacion-emision/renovacion.spec.ts` (API Gateway y Cognito simulados con `page.route`, axe-core en cada estado).

**Pólizas próximas a vencer (HU-W1.5-01)** — `renovaciones/polizas-por-vencer.page.ts` (`PolizasPorVencerPage`, S6), ruta
`/originacion/renovaciones` en `originacion.routes.ts` (bloque `renovaciones` con `rolGuard('asesor')`; el ítem «Renovaciones» del menú
del asesor ya existía). Contrato: `docs/contratos/HU-W1.5-01-api.md` del backend (`openapi.yaml` v0.14.0). Cliente:
`core/api/originacion/polizas-por-vencer.modelos.ts` y `OriginacionApiService.listarPolizasPorVencer` (`GET /v1/policies/expiring`).

- **S6:** título «Renovaciones», tarjeta «Vencen en N días» (las pólizas con el periodo abierto que vencen dentro de la ventana de
  renovación, sin los filtros), filtros «Vencen desde», «Hasta» y «Estado» con etiqueta permanente, conteo «N resultados» y la tabla
  Póliza · Cliente (nombre y documento) · Producto · Vence · Prima · Estado · acción. Las fechas son días civiles de Colombia, como el
  filtro del backend.
- **Filtro en la URL** (`renovaciones/modelos/filtro-por-vencer.ts`): `?desde=&hasta=&estado=&pagina=`. Sin rango, el backend aplica la
  ventana de renovación desde hoy (`RENEWAL_WINDOW_DAYS` de HU-W1.5-02) y los campos muestran el rango aplicado; cambiar un filtro vuelve
  a la página 1, paginar lo conserva y recargar lo mantiene. «Hasta» anterior a «Vencen desde» se avisa en el campo y no se consulta.
- **Estados:** *Por vencer* (sin renovación del periodo) y *Renovación en curso* (renovación aceptada y en cobro); un estado que el cliente
  no conoce se muestra con una insignia neutra (el contrato es ampliable para HU-W1.6-02).
- **Acciones (CA-4):** *Renovar* solo cuando el backend dice `can_renew` (dentro de la ventana de renovación) y *Ver* en la renovación en
  curso; los dos llevan a `/originacion/renovaciones/:id` con el `policy_id`, la renovación asistida de HU-W1.5-03, que agrega su hijo
  `:id` al mismo bloque de rutas. Fuera de la ventana la fila dice «Renovable desde el …».
- **Sin resultados (CA-3):** la tabla conserva los encabezados y muestra «Sin pólizas por vencer en el rango» con el rango y el estado
  aplicados y «Limpiar filtros», que vuelve al rango por defecto. Error del servicio con «Reintentar»; 401 y 403 los resuelve el interceptor.
  Paginación «Anterior / Siguiente» de 20 filas, solo con más de una página.
- **Diferencias con el frame S6, por datos que no existen todavía:** sin la tarjeta y el estado «Cancelada por no pago» (los produce
  HU-W1.6-02), sin el filtro «Producto» (originación solo emite pólizas de vida: la columna dice «Vida») y el documento sin el tipo
  (la póliza no lo guarda). Las pólizas del núcleo de pólizas (Autos, Hogar, Viaje) no se listan: originación no las renueva.
- E2E: `e2e/flujos/originacion/polizas-por-vencer.spec.ts` (API Gateway y Cognito simulados con `page.route`, axe-core en cada estado) y
  el humo `e2e/nube/polizas-por-vencer.spec.ts` (proyecto `nube`).

**Renovación asistida con recotización (HU-W1.5-03)** — `renovaciones/renovacion-asistida.page.ts` (`RenovacionAsistidaPage`, S7 y S7b),
ruta `/originacion/renovaciones/:id` (el `policy_id`) en el bloque `renovaciones` de `originacion.routes.ts` (`rolGuard('asesor')`). Se
entra desde S6 por «Renovar» o «Ver». Contrato: `docs/contratos/HU-W1.5-03-api.md` del backend (`openapi.yaml` v0.15.0). Cliente:
`core/api/originacion/renovacion-asistida.modelos.ts` y los métodos `consultarRenovacionAsistida`, `recotizarRenovacion`,
`enviarCodigoRenovacion` y `formalizarRenovacion` de `OriginacionApiService`; la póliza nueva usa `consultarEmisionContractual` y
`descargarDocumentoContractual`. Todo sale del `GET`, así que la pantalla funciona al recargarse.

- **S7 · Renovación asistida:** encabezado con «← Renovaciones», el título con la póliza, «Vence el …», el titular, su documento y el
  producto; «Recotizar» (se desactiva mientras recotiza, sin doble envío) y «Formalizar renovación». Debajo, el comparativo de la
  vigencia actual con la recotizada (`componentes/comparativo-condiciones/`: prima con su variación, vigencia, valor asegurado, descuento
  por buena experiencia y coberturas, «Sin cambios» si coinciden) y la aceptación del cliente (`componentes/aceptacion-cliente/`). A la
  derecha, «Nueva prima mensual» y el panel «Recotización» (`componentes/trazabilidad-recotizacion/`): cada fuente con su estado y
  latencia, el motor de rating con su versión y sus factores, y la nota del perfil usado.
- **Aceptación del cliente (CA-2):** los tres medios de HU-W1.1-03 (llamada grabada, firma remota con su referencia, o código de
  confirmación que el servicio envía al titular por correo: «Enviar código», hasta tres envíos, y el campo de 6 dígitos), la fecha y hora
  (ni futura ni anterior a la recotización) y la casilla «El cliente aceptó las condiciones recotizadas y autorizó el cobro con su medio de
  pago registrado». «Formalizar renovación» solo se habilita con la recotización vigente y la aceptación completa; los errores por campo
  y los del código se muestran junto al campo.
- **Consentimiento (D-8 y D-13 c):** en una póliza del canal embebido, `audit` lo verifica al recotizar: sin consentimiento activo, aviso
  «El cliente revocó su autorización de Open Finance»; si `audit` no responde, «No pudimos verificar la autorización del cliente» y
  «Reintentar». En una póliza vendida por un asesor se muestra la casilla «El cliente autorizó consultar sus datos financieros para esta
  renovación» (`componentes/consentimiento-asesor/`) y «Recotizar» espera a que se marque; viaja como `consent_affirmed: true`.
- **Modo degradado (CA-5, D-7):** con el último perfil en caché, insignia «Modo degradado», aviso con la fecha del perfil y la fuente
  «No disponible»; sin un perfil reciente, el aviso del perfil actuarial base.
- **Otros estados de S7:** sin medio de pago registrado (no se formaliza; el cliente puede renovar desde su portal), recotización vencida
  (24 horas) o reemplazada por una más reciente, y «no disponible» (antes de la ventana, con la ventana cerrada o no renovada).
- **S7b · Renovación formalizada (CA-3, CA-4):** «renovada el … por <nombre del asesor>» o, si su cuenta no tiene nombre, su correo;
  «Aceptación registrada» y «Trazabilidad de la recotización» en solo lectura y el panel «Emisión de la renovación»
  (`componentes/estado-cobro-renovacion/`: cobro, certificado renovado y notificación). La pantalla sigue la renovación cada 2 s hasta
  que la póliza queda renovada (con «Ver certificado» de la póliza nueva) o el pago falla.
- **«Ver» (01·D-3 a+):** la renovación en curso con el estado del cobro; si el pago falló, la fecha del rechazo y hasta cuándo puede
  reintentar el cliente con otro medio desde su portal. Si la renovó el asegurado, solo lectura con su cobro.
- **Regreso:** «← Renovaciones» y «Volver a renovaciones» vuelven atrás para conservar el filtro del listado; si se entró directo por la
  URL, abren `/originacion/renovaciones`.
- Textos en `originacion.renovacionAsistida.*`; fechas en días civiles de Colombia (`renovaciones/modelos/presentacion-renovacion.ts`).
- **Diferencias con los frames S7 y S7b, por datos que originación no tiene:** el producto es siempre vida hipotecario (sin placa de
  autos), el motor muestra su versión `v1` y sus factores (no reglas numeradas) y el valor asegurado no cambia al recotizar.
- E2E: `e2e/flujos/cotizacion-emision/renovacion-asistida.spec.ts` (API Gateway y Cognito simulados con `page.route`, axe-core en cada
  estado; entra desde S6 por «Renovar» y «Ver») y el humo `e2e/nube/renovacion-asistida.spec.ts` (proyecto `nube`).

## Cómo trabajar una historia de este dominio

1. Crea la rama desde `develop` con el mismo nombre que en el backend, `feature/<ID>-<descripcion-corta-en-ingles>` (p. ej. `feature/HU-W1.1-01-<descripcion-en-ingles>`).
2. Declara la ruta en `originacion.routes.ts` (archivo de rutas del dominio, cargado de forma perezosa desde `app.routes.ts`).
3. Crea la página en la subcarpeta indicada con el sufijo `.page.ts` y su prueba `.page.spec.ts` al lado.
4. Los componentes propios de la pantalla van en `componentes/`, los servicios de datos en `servicios/` y los tipos en `modelos/`, dentro de la misma subcarpeta.
5. Las llamadas HTTP salen siempre por el cliente del microservicio en `src/app/core/api/`; ninguna página llama a otro servicio directamente.
6. Textos en `public/i18n/es-CO.json` y `en-US.json`; estilos con los tokens de `src/styles/`.
7. Antes del pull request: `npm run lint`, `npm run build` y `npm test` en verde con cobertura ≥ 70 %.

Ver las convenciones completas en [`src/app/features/README.md`](../README.md) y la trazabilidad global en [`docs/pantallas.md`](../../../../docs/pantallas.md).
