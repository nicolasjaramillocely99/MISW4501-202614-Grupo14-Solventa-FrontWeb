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
| [A8](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=25-1591) | Detalle y estado del siniestro (mínima en HU-W2.2-01) | `/siniestros/:id` | Asegurado | HU-W2.2-01, HU-W2.1-02, HU-W2.1-04 | S2, S3 |

### `revision/` — F2.1 · Intervención del asesor en la radicación

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [S8](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=30-2987) | Revisión de radicación de siniestro | `/siniestros/revision/:id` | Asesor comercial | HU-W2.1-03 | S3 |

### `triage/` — F2.2 · Priorización automática (triage) y cola de trabajo

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [O5](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=35-3351) | Cola de siniestros por prioridad | `/siniestros/cola` | Analista de operaciones | HU-W2.2-01, HU-W2.2-02 | S2 |
| [O6](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=35-3779) (reducida) | Prioridad del siniestro (provisional) | `/siniestros/cola/:id` | Analista de operaciones | HU-W2.2-01 | S2 |

### `evaluacion/` — F2.2 · Evaluación, aprobación y pago

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [O5](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=35-3351) | Casos en evaluación (listado de HU-W2.2-03; HU-W2.2-02 lo une a la cola por prioridad) | `/siniestros/evaluacion` | Analista de operaciones | HU-W2.2-03 | S2 |
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

**Monto estimado en la radicación (HU-W2.2-01, F4)** — `radicacion/modelos/formulario-radicacion.ts` y la página de radicación ganan el
campo opcional «Monto estimado (opcional)» (D12 del backend): pesos colombianos enteros, con separadores de miles `.`, `,` o espacio
en grupos de tres (`leerMonto`); un decimal, letras o signos son `formatoInvalido` y fuera de 1 a 100.000.000.000 pesos es `montoRango`.
Se envía en centavos (`estimated_amount_minor`) **solo si hay valor**: sin él el cuerpo es el de HU-W2.1-01. Debajo del campo, «Se
enviará como $ 4.800.000 COP»; el `422` del campo se muestra en el campo y un monto inválido entra en el aviso «qué falta». El detalle del
caso (`GET /v1/claims/{id}`) lo trae en `montoEstimadoMinor` (`null` si no se declaró).

**Prioridad automática del siniestro (HU-W2.2-01)** — contrato `docs/contratos/HU-W2.2-01-api.md` del backend (`openapi.yaml` v0.6.0).
Cliente: `core/api/siniestros/` (`consultarTriage`, `consultarTriageLote`, `consultarPoliticaTriage`; modelos en `triage.modelos.ts`). El
front **no calcula** el nivel ni fija severidades, umbrales o plazos: pinta lo que el backend calculó y lee la política de
`GET /v1/claims/triage-policy`. Los códigos (severidad, banda, causa, estado, tipo, cobertura) se traducen por código y caen al código
crudo si no hay clave, así que una causa nueva no rompe la pantalla (`modelos/presentacion-triage.ts`). Con `pending` se sondea cada 5 s
(`modelos/sondeo-triage.ts`) hasta `assessed` o `not_applicable`; a los 3 fallos seguidos o a los 90 s se detiene y ofrece «Actualizar».

- **Cola O5, provisional (`triage/cola-siniestros.page.ts`, `/siniestros/cola`, operaciones, F1):** encabezado que explica la regla con los
  umbrales de la política, indicadores por nivel con su objetivo de atención (`IndicadoresTriageComponent`) y una búsqueda de uno o varios
  `claim_id` (hasta 50; comas, espacios o saltos de línea; ids inválidos y 51 ids son error por campo, los repetidos se quitan con un aviso)
  que hace **una** llamada al lote por búsqueda y pinta una fila por caso (`TablaTriageComponent`: nivel, severidad, rango de monto,
  objetivo y fecha del cálculo). Los ids se guardan en `?casos=` para que recargar conserve la consulta; las filas `pending` se vuelven a
  pedir solas y el `not_found` se omite con un aviso. **`TablaTriageComponent` recibe cualquier lista ya leída**: cuando exista el listado
  de HU-W2.2-03 (o la cola de HU-W2.2-02), ese listado reemplaza la búsqueda y la tabla no cambia.
- **Prioridad del analista, O6 reducida (`triage/prioridad-siniestro.page.ts`, `/siniestros/cola/:id`, operaciones, F2):** se arma solo con
  `GET /v1/claims/{id}/triage` (vista `operations`, porque `operations` no puede leer `GET /v1/claims/{id}`): tarjeta «Prioridad»
  (`PrioridadTriageComponent`) e historial (`HistorialTriageComponent`: «Triage N asignado · automático», «Prioridad recalculada: Triage A
  → Triage B · causa», cada fila con fecha y hora). **HU-W2.2-03 incrusta esos dos componentes en O6** (`/siniestros/:id/evaluar`) sin
  tocar `evaluacion/`: reciben el triage ya leído.
- **A8 mínima del asegurado (`seguimiento/detalle-siniestro.page.ts`, `/siniestros/:id`, asegurado, F3):** encabezado del caso, datos
  reportados con el monto estimado y la etapa «En evaluación» con «Prioridad Triage N · Tiempo estimado de resolución: N días hábiles»
  (`PrioridadAseguradoComponent`, vista `insured`: sin severidad, banda ni historial). Las lecturas del caso y de la prioridad van en
  paralelo; si falla solo la prioridad, el caso se muestra con «Reintentar». Se llega con «Ver detalle» desde «Mis siniestros».
  **HU-W2.1-02 completa A8** (todas las etapas, acciones y devoluciones).
- **Lo que el contrato no trae se oculta (F5):** en la cola, monto, estado, tiempo de espera, asegurado y conteo por nivel (los trae el
  listado de HU-W2.2-03); en el detalle del analista, número de radicado, asegurado, soportes y las acciones de O6 (aprobar, rechazar,
  pagar: HU-W2.2-03); en A8, el resto de etapas y acciones (HU-W2.1-02).
- **Rutas (S12):** el grupo `cola` (rol operaciones) va **antes** del grupo del asegurado y `:id` después de `radicar` y `mis-siniestros`;
  si no, `:id` capturaría `cola`. Todo lo provisional está marcado: `grep -rn "HU-W2.2-01 F" src`.

**Casos en evaluación (HU-W2.2-03, CA-1)** — `evaluacion/casos-evaluacion.page.ts` (`CasosEvaluacionPage`), ruta
`/siniestros/evaluacion`, rol operaciones; es la entrada del menú «Siniestros». Pestaña «En evaluación» (`GET /v1/claims/evaluations`)
con la prioridad de cada caso (Triage 1, 2 o 3 de HU-W2.2-01; «Sin calcular» mientras el barrido no lo evalúa), el radicado, el
producto, el monto estimado, el estado y el tiempo en cola; por fila, «Ver prioridad» (la pantalla de HU-W2.2-01,
`/siniestros/cola/:id`) y «Evaluar» (O6). Pestaña «Excepciones de pago» (`GET /v1/claims/payment-exceptions`) con «Atender» (O6b).
«Cargar más» con `next_page_token`; «Buscar por id» lleva a la cola de HU-W2.2-01. El backend entrega del más antiguo al más nuevo:
**HU-W2.2-02 une este listado y la cola por id** en la cola ordenada por prioridad del prototipo (O5).

**Evaluación, aprobación y pago (HU-W2.2-03)** — `evaluacion/evaluacion-siniestro.page.ts` (`EvaluacionSiniestroPage`, O6 y O6b),
ruta `/siniestros/:id/evaluar`, rol operaciones. Contrato: `docs/contratos/HU-W2.2-03-api.md` del backend (`openapi.yaml` v0.8.0).

- **Encadenado con HU-W2.2-01:** la evaluación trae el triage en la misma vista `operations` de `GET /v1/claims/{id}/triage`; se lee con
  `mapearTriageSiniestro` y O6 lo pinta con `PrioridadTriageComponent` e `HistorialTriageComponent`, sin cambiarlos. La pantalla de
  prioridad (`/siniestros/cola/:id`) tiene «Evaluar» hacia O6 y la cola por id enlaza a los casos en evaluación.
- **CA-1:** `GET /v1/claims/{id}/evaluation`: hechos, monto estimado, prioridad, cobertura aplicable con su deducible, soportes y
  evidencia con su lectura firmada, póliza vigente, asegurado y su medio de pago **enmascarado** (`•••• 4512`), e historial del caso
  (radicado, la decisión y el pago; los cálculos del triage van en su propio historial). Si el núcleo de pólizas no respondió
  (`policy_unavailable`) el caso se ve pero no se puede decidir.
- **CA-2, bruto y neto:** `componentes/decision-siniestro/`. El analista aprueba el **costo bruto** (precargado con el monto estimado;
  no supera el valor asegurado) y ve el desglose: menos el deducible, que asume el asegurado, el **monto aprobado** neto que paga la
  aseguradora («Incluye aplicación de deducible del 5 % (… a cargo del asegurado)»). `POST …/approval` envía el bruto
  (`gross_amount_minor`); el deducible lo calcula el backend (`calcularDesglose` replica su regla solo para mostrarlo). Nota: el
  Figma de O6 muestra el bruto en «Monto aprobado»; la implementación muestra el neto, como se acordó.
- **Seguimiento del pago:** tras aprobar, la página vuelve a leer el caso cada 2 s (hasta 15 veces) mientras el pago está pendiente o
  en curso, y muestra «Indemnización pagada» o la excepción.
- **CA-3:** «Rechazar» con motivo obligatorio (hasta 1000 caracteres); el detalle muestra el motivo y cuándo se notificó.
- **CA-4, O6b:** `componentes/pago-indemnizacion/`: motivo de la pasarela (cuenta inválida, rechazo o intentos agotados), referencia
  idempotente, intentos, pasos del pago y «Contactar al asegurado» (`mailto:`). El analista corrige banco, tipo y cuenta y reintenta
  (`POST …/payout-retry`); con la cuenta vacía reintenta al mismo destino. La clave no cambia: nunca se paga dos veces.
- **CA-5 y CA-6:** la decisión muestra su analista, fecha y monto o motivo; solo operaciones entra (las rutas y el backend lo exigen).
- **Pendiente de otras historias:** el bloque «Resultado de la intervención del prestador» (HU-W2.3-02) y el bruto que recomienda.

## Cómo trabajar una historia de este dominio

1. Crea la rama desde `develop` con el mismo nombre que en el backend, `feature/<ID>-<descripcion-corta-en-ingles>` (p. ej. `feature/HU-W2.1-01-<descripcion-en-ingles>`).
2. Declara la ruta en `siniestros.routes.ts` (archivo de rutas del dominio, cargado de forma perezosa desde `app.routes.ts`).
3. Crea la página en la subcarpeta indicada con el sufijo `.page.ts` y su prueba `.page.spec.ts` al lado.
4. Los componentes propios de la pantalla van en `componentes/`, los servicios de datos en `servicios/` y los tipos en `modelos/`, dentro de la misma subcarpeta.
5. Las llamadas HTTP salen siempre por el cliente del microservicio en `src/app/core/api/`; ninguna página llama a otro servicio directamente.
6. Textos en `public/i18n/es-CO.json` y `en-US.json`; estilos con los tokens de `src/styles/`.
7. Antes del pull request: `npm run lint`, `npm run build` y `npm test` en verde con cobertura ≥ 70 %.

Ver las convenciones completas en [`src/app/features/README.md`](../README.md) y la trazabilidad global en [`docs/pantallas.md`](../../../../docs/pantallas.md).
