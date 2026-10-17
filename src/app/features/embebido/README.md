# `features/embebido` — Canal embebido (demo en el sitio del banco aliado)

- **Épica:** Web · Épica 1 (F1.2 y F1.3)
- **Microservicio que lo respalda (vía API Gateway):** Servicio de originación — camino crítico de cotización (orquestador, perfilamiento, motor de rating)
- **Cliente HTTP:** `src/app/core/api/originacion/`
- **Shell de navegación:** embebido (barra del aliado + indicador de pasos)
- **Requiere sesión:** no

## Pantallas y dónde va cada una

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [E1](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=9-169) | Paso 1 · Consentimiento | `/embebido/consentimiento` | público (canal del aliado) | HU-W1.2-01 | S1 |
| [E6](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=15-691) | Solicitud en revisión (decisión humana) · estado de la aceptación | `/embebido/oferta/:ofertaId` | Asegurado (sesión) | HU-W1.3-01, HU-W1.1-02 | S1 |
| [E3](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=12-434), [E3b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=15-478), [E3c](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=433-745) | Paso 3 · Oferta personalizada (y provisional) y aceptación | `/embebido/oferta/:ofertaId` | Asegurado (sesión) | HU-W1.2-03, HU-W1.3-01, HA-D01 | S1 |
| [E7](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=16-1002) | Oferta vencida · estado de la aceptación | `/embebido/oferta/:ofertaId` | Asegurado (sesión) | HU-W1.3-01 | S1 |
| [E4](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=14-337), [E4b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=16-578), [E4c](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=16-783) | Paso 4 · Pago de la prima (pendiente / rechazado) | `/embebido/pago/:aceptacionId` | Asegurado (sesión) | HU-W1.3-02, HA-D02 | S1 |
| [E2](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=12-231), [E2b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=643-8582) | Paso 2 · Cálculo del perfil de riesgo | `/embebido/perfil-riesgo/:clienteId` | público (canal del aliado) | HU-W1.2-02, HA-L01, HA-D01 | S1 |
| [E5](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=14-556) | Paso 5 · Póliza emitida | `/embebido/poliza-emitida/:polizaId` | Asegurado (sesión) | HU-W1.3-03 | S1 |

## Implementado

**Paso 2 · Cálculo del perfil de riesgo (HU-W1.2-02)** — `perfil-riesgo/perfil-riesgo.page.ts` (`PerfilRiesgoPage`), ruta
`/embebido/perfil-riesgo/:clienteId?consentimiento=true`, dentro de `layout/embebido/` (barra del aliado).

- Llama a `OriginacionApiService.resolverPerfilRiesgo` (`POST /v1/risk-profiles/resolve`, `core/api/originacion/`).
  `clienteId` sale de la ruta; el consentimiento lo afirma quien navega (`?consentimiento=true`, lo envía HU-W1.2-01): sin
  él el backend responde 422 y la página muestra «Necesitamos tu consentimiento» con «Volver al consentimiento».
- Estados dentro de la misma página: **calculando** (E2: fuentes y motor «En curso», barra indeterminada), **listo** (E2b:
  estado y latencia por fuente, «Ver mi oferta») y **error** (consentimiento o genérico con «Reintentar»). Variantes del
  resultado: fuentes parciales (`partial`), último perfil en caché (`last_profile_in_use`, con la fuente afectada y la fecha)
  y perfil base de cliente nuevo (`personalization_unavailable`). Los códigos del contrato se traducen a textos
  `embebido.perfilRiesgo.*`; la web no calcula latencias, caché ni cortes.
- `servicios/flujo-embebido.service.ts` (`FlujoEmbebidoService`) es el estado en memoria del flujo: HU-W1.2-01 deja la
  `solicitud` (tarjeta «Tu crédito» y número de solicitud; se oculta mientras no exista) y esta pantalla publica el `perfil`
  para HU-W1.2-03. El aliado se publica en `core/aliado` para la barra del shell.
- «Ver mi oferta» lleva a `/embebido/oferta` y «Cancelar» a `/embebido/consentimiento`; ambas rutas llegan con sus historias.
- E2E: `e2e/flujos/cotizacion-emision/perfil-riesgo.spec.ts` (API Gateway simulado con `page.route`, axe-core en cada estado).

**Paso 5 · Póliza emitida: documento y notificación (HU-W1.3-03)** — `poliza-emitida/poliza-emitida.page.ts` (`PolizaEmitidaPage`, E5),
ruta `/embebido/poliza-emitida/:polizaId`. Contrato: `docs/contratos/HU-W1.3-03-api.md` del backend (servicio `origination`,
`openapi.yaml` v0.6.0). Sigue el frame E5 del prototipo: contexto y tarjeta «Tu crédito» (si el flujo trajo la solicitud),
póliza activa, documento con «Descargar», confirmación al correo y tarjeta de la app.

- **Pide sesión de asegurado**, como la aceptación de la oferta: el backend solo deja leer la póliza a su dueño, así que la ruta lleva
  `autenticacionGuard` y `rolGuard('asegurado')` (a diferencia de lo que lista `docs/pantallas.md` como «público»).
- Llama a `OriginacionApiService` (`core/api/originacion/`): `consultarEmisionContractual` (`GET /v1/policies/{id}/issuance-status`, con
  polling cada 2 s hasta que la emisión termina) y `descargarDocumentoContractual` (`GET /v1/policies/{id}/contract-document`, blob: el
  JWT lo adjunta el interceptor, por eso no es un enlace directo). El `polizaId` hoy es `pol-` + el `acceptance_id` de la aceptación.
- Estados dentro de la misma página: **esperando** (documento en generación, descarga deshabilitada), **listo** (documento disponible
  y correo enviado; si el correo falló, aviso y el documento sigue descargable) y **error** (póliza sin emisión, de otro asegurado o
  fallo del servicio, con «Reintentar» salvo el 403). Textos en `embebido.polizaEmitida.*`.
- **Fuera del frame E5 por falta de datos o destino** (el contrato `issuance-status` solo trae documento y notificación): la cuadrícula con
  asegurado, prima, valor asegurado, vigencia, pago y beneficiario; el aviso por SMS; el QR y el enlace de «Descargar la app»; y
  «Volver a mi crédito» (no hay URL del aliado). «Ver mi póliza en el portal» lleva a `/inicio` hasta que exista «Mis pólizas».
- Se abre desde el pago confirmado con «Ver mi póliza» (HA-D02, paso 4), con el `policy_id` que devuelve el cobro.
- E2E: `e2e/flujos/cotizacion-emision/poliza-emitida.spec.ts` (Cognito y API Gateway simulados, axe-core en cada estado).

**Paso 3 · Aceptación de la oferta y disparo de la emisión (HU-W1.3-01)** — `aceptacion-oferta/aceptacion-oferta.page.ts`
(`AceptacionOfertaPage`), rutas `/embebido/oferta/:ofertaId` y `/embebido/oferta` (retoma la oferta guardada en
`sessionStorage`). Contrato: `HU-W1.3-01-api.md` del backend (servicio `origination`, `openapi.yaml` v0.4.0).

- **Pide sesión, a diferencia del resto del canal:** aceptar exige el ID token de un asegurado dueño de la oferta, así que
  `oferta` lleva `autenticacionGuard` y, en los hijos, `rolGuard('asegurado')` (los hijos corren después de recuperar la
  sesión al recargar). Sin sesión lleva al inicio de sesión y regresa con `returnUrl`.
- Llama a `OriginacionApiService` (`core/api/originacion/`): `consultarAceptacionDeOferta` al entrar (retomar el trámite;
  `acceptance_not_found` = mostrar la oferta con «Aceptar»), `aceptarOferta` (`POST` con `{"channel":"web"}`, idempotente por
  oferta; «Aceptar» se deshabilita mientras está en curso) y `consultarAceptacion` para el polling.
- Estados dentro de la misma página: **oferta** (E3, con la casilla de condiciones), **registrada / validando**,
  **aceptación conservada** (`registered` con `attempts > 0` o más de 2 minutos), **en revisión** (E6, `in_review`, motivo
  según `underwriting.reason`), **emisión iniciada** (`issuance_pending`), **oferta vencida** (E7, `422 offer_expired` con
  `expires_at`) y errores (`offer_not_found`, sin servicio, sin oferta, genérico). Los textos salen del código `error`, nunca de
  `message`; `acceptance_not_registered` muestra el aviso junto a la oferta y «Reintentar» reenvía el mismo `POST`.
- `servicios/seguimiento-aceptacion.service.ts` (`SeguimientoAceptacionService`, provisto por la página): polling del §6 del
  contrato (primera consulta a 1 s, luego cada 2 s; hasta `next_attempt_at` + 1 s si el backend reintenta más tarde, con
  tope de 61 s; cada 15 s tras 2 minutos; se detiene en `issuance_pending`, `in_review`, 400, 401 o 403; ante
  `acceptance_unavailable` o error de red conserva la última pantalla; ante `acceptance_not_found` vuelve a consultar por
  oferta). `servicios/tramite-aceptacion.service.ts` guarda `offer_id` y `acceptance_id` en `sessionStorage`.
- `aceptacion-oferta.config.ts`: `ACCIONES_ACEPTACION_OFERTA` deja configurables «Generar una nueva oferta» / «Volver a
  cotizar» (hoy `/embebido/consentimiento`, hasta que HU-W1.2-03 publique el endpoint de nuevas ofertas) y «No me interesa»
  / «Continuar con mi crédito» (`/inicio`). `DETALLE_OFERTA` entrega el contenido de la oferta.
- **Datos de prueba provisionales:** `modelos/detalle-oferta.provisional.ts` (prima 89 500 COP de las ofertas simuladas del
  backend; valor asegurado, vigencia, beneficiario y coberturas del frame E3). Se elimina cuando HU-W1.2-03 exponga el
  detalle de la oferta.
- `componentes/tarjeta-credito/` (`TarjetaCreditoComponent`): la tarjeta «Tu crédito», reutilizable por los pasos del canal.
- E2E: `e2e/flujos/cotizacion-emision/aceptacion-oferta.spec.ts` (Cognito y API Gateway simulados con `page.route`,
  axe-core en cada estado).

**Paso 4 · Pago de la prima: estado del cobro (HA-D02, frame E4b)** — `pago/pago.page.ts` (`PagoPage`), rutas
`/embebido/pago/:aceptacionId` y `/embebido/pago` (toma la aceptación guardada en `sessionStorage` por el paso 3). Contrato:
`HA-D02-api.md` del backend (servicio `origination`, `openapi.yaml` v0.7.0).

- **Pide sesión de asegurado**, como `oferta`: el cobro solo lo consulta el dueño de la aceptación (`autenticacionGuard` y,
  en los hijos, `rolGuard('asegurado')`).
- Tras aprobarse la suscripción, originación cobra la prima en segundo plano con una clave de idempotencia
  (`cobro-<aceptación>`) y, si la pasarela no responde, reintenta con esperas crecientes durante 24 horas; la página no cobra
  nada: solo consulta `OriginacionApiService.consultarCobro` (`GET /v1/acceptances/{id}/charge`).
- Estados dentro de la misma página: **procesando** (primer intento en curso), **pago pendiente** (E4b: aceptación guardada,
  clave de operación idempotente, intentos sin respuesta con la hora del último, próximo reintento, cobertura que se activa al
  confirmarse el pago y el aviso «Qué pasa después», que promete el correo de la póliza emitida de HU-W1.3-03), **pago
  confirmado** (cobertura activa, número de póliza y «Ver mi póliza» hacia la E5; sin póliza todavía, «estamos activando tu
  cobertura»), **excepción**
  (ventana vencida o pago rechazado: lo gestiona un analista de operaciones sin perder la aceptación) y errores (sin
  aceptación, sin cobro, genérico con «Reintentar»).
- `pago/servicios/seguimiento-cobro.service.ts` (`SeguimientoCobroService`): consulta al entrar, otra vez a 1 s y luego cada
  2 s, o hasta el próximo reintento del backend + 1 s (tope de 61 s); se detiene con el cobro confirmado con póliza, en
  excepción o ante 400, 401, 403 y 404; ante `charge_unavailable` o error de red conserva la última pantalla.
- `pago/pago.config.ts`: `ACCIONES_PAGO` deja configurables «Ver mi póliza» (`/embebido/poliza-emitida`, a la que se agrega
  el `policy_id` del cobro: la E5 de HU-W1.3-03), «Continuar con mi crédito» (`/inicio`) y «Ver el estado de tu aceptación»
  (`/embebido/oferta`). **Pendiente:** «Intentar con otro medio de pago» llega con E4 (HU-W1.3-02).
- Desde la vista «Suscripción aprobada» del paso 3 se llega con «Ver el estado de tu pago» (`ACCIONES_ACEPTACION_OFERTA.pago`).
- E2E: `e2e/flujos/cotizacion-emision/pago-pendiente.spec.ts` (Cognito y API Gateway simulados con `page.route`, axe-core
  en cada estado), incluido «pago confirmado → Ver mi póliza → E5».

## Cómo trabajar una historia de este dominio

1. Crea la rama desde `develop` con el mismo nombre que en el backend, `feature/<ID>-<descripcion-corta-en-ingles>` (p. ej. `feature/HU-W1.2-01-<descripcion-en-ingles>`).
2. Declara la ruta en `embebido.routes.ts` (archivo de rutas del dominio, cargado de forma perezosa desde `app.routes.ts`).
3. Crea la página en la subcarpeta indicada con el sufijo `.page.ts` y su prueba `.page.spec.ts` al lado.
4. Los componentes propios de la pantalla van en `componentes/`, los servicios de datos en `servicios/` y los tipos en `modelos/`, dentro de la misma subcarpeta.
5. Las llamadas HTTP salen siempre por el cliente del microservicio en `src/app/core/api/`; ninguna página llama a otro servicio directamente.
6. Textos en `public/i18n/es-CO.json` y `en-US.json`; estilos con los tokens de `src/styles/`.
7. Antes del pull request: `npm run lint`, `npm run build` y `npm test` en verde con cobertura ≥ 70 %.

Ver las convenciones completas en [`src/app/features/README.md`](../README.md) y la trazabilidad global en [`docs/pantallas.md`](../../../../docs/pantallas.md).
