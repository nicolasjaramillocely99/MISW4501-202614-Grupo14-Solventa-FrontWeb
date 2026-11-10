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

### `correccion/` — F2.1 · Edición de la radicación devuelta

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [A9](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=24-1340) | Edición de la radicación devuelta | `/siniestros/:id/corregir` | Asegurado | HU-W2.1-04 | S3 |

### `revision/` — F2.1 · Intervención del asesor en la radicación

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| — (sin mockup) | Radicaciones por revisar | `/siniestros/revision` | Asesor comercial | HU-W2.1-03 | S3 |
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
| — (sin mockup) | Administración de prestadores (mínima) | `/siniestros/prestadores` | Analista de operaciones | HU-W2.3-01 | S3 |
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
- **Desde HU-W2.3-01** el encabezado de O6 tiene «Asignar prestador» (`/siniestros/:id/asignar-prestador`) con el caso en evaluación, aprobado o pagado.
- **Desde HU-W2.1-03** operaciones solo decide casos `in_evaluation`: una radicación `active` espera la revisión del asesor.

**Cola de trabajo por prioridad (HU-W2.2-02)** — O5 en `evaluacion/casos-evaluacion.page.ts`, pestaña «En evaluación» de
`/siniestros/evaluacion`, rol operaciones. Contrato: `docs/contratos/HU-W2.2-02-api.md` del backend (`openapi.yaml` v0.11.0).

- **CA-1 y CA-2:** `SiniestrosApiService.listarColaPrioridad` (`GET /v1/claims/evaluations`) trae la cola ya ordenada:
  Triage 1, 2 y 3, luego lo que no tiene nivel, y en cada nivel el que más espera. La tabla agrega la columna «Asegurado»
  (nombre y documento, o «No disponible» si el núcleo no respondió).
- **Indicadores (O5):** `IndicadoresTriageComponent` recibe ahora `conteos` (toda la cola por nivel) y `tiempoMedioDias`
  (tarjeta «Tiempo medio de resolución · últimos 30 días»). Las dos entradas son opcionales, así que la cola por id
  (`/siniestros/cola`) no cambia. Los objetivos siguen saliendo de `GET /v1/claims/triage-policy`.
- **Filtros:** prioridad, estado y producto, que se envían al backend (`level`, `status`, `line`). Al lado, «N casos en
  cola · actualizado hace X s» (el reloj avanza cada 5 s).
- **CA-3 y CA-4:** «Actualizar» trae el orden vigente; con la cola vacía, ceros y «Sin casos decididos». **CA-5:** la ruta
  es solo de operaciones.
- El título pasa a «Cola de siniestros», como en el prototipo; «Excepciones de pago» sigue igual.

**Revisión de la radicación por el asesor (HU-W2.1-03)** — `revision/radicaciones-revision.page.ts` (bandeja, `/siniestros/revision`)
y `revision/revision-radicacion.page.ts` (S8, `/siniestros/revision/:id`), rol asesor. Contrato: `docs/contratos/HU-W2.1-03-api.md`
del backend (`openapi.yaml` v0.10.0).

- **Bandeja (sin mockup):** `GET /v1/claims/reviews`, las radicaciones `active` de la más antigua a la más nueva, con la tabla de
  «Casos en evaluación»: radicado, producto, canal, monto estimado, fecha, tiempo en espera y «Revisar». Es el destino del ítem
  «Siniestros» del menú del asesor.
- **CA-1:** `GET /v1/claims/{id}/review`: la lectura de la evaluación sin prioridad, más el `checklist` de soportes del tipo de
  siniestro, los siniestros previos de la póliza y las revisiones anteriores. `componentes/soportes-revision/` pinta una fila por
  soporte: adjunto → «Válido» o «Ilegible» (con nota corta); requerido sin adjuntar → «Falta» fijo; opcional sin adjuntar →
  «Solicitar al cliente». En una radicación del móvil, la evidencia es la fila «Fotos del vehículo».
- **CA-2:** «Aprobar y enviar a evaluación» (`POST …/review-approval`, sin cuerpo) solo se habilita si todo lo adjunto es válido y no
  falta nada; el caso pasa a «En evaluación» y el triage lo prioriza.
- **CA-3:** «Devolución al cliente»: motivo de la lista, datos a corregir (opcionales) y mensaje para el cliente (hasta 1000
  caracteres). `POST …/review-return` envía solo los soportes que no sirven (ilegibles con su nota y opcionales pedidos); lo demás lo
  completa el backend. El caso queda `returned` («Devuelto al cliente»), que A9 (HU-W2.1-04) consume.
- **Solo lectura:** una radicación que ya no está `active` (otro asesor se adelantó, `409 claim_not_reviewable`) se muestra con el
  veredicto registrado y quién la revisó.

**Asignación del prestador más cercano (HU-W2.3-01)** — `asistencias/asignacion-prestador.page.ts` (`AsignacionPrestadorPage`, O7 y
O7b), ruta `/siniestros/:id/asignar-prestador`, rol operaciones; se entra desde O6. Contrato: `docs/contratos/HU-W2.3-01-api.md` del
backend (`openapi.yaml` v0.11.0). Cliente: `core/api/siniestros/` (modelos en `asignacion.modelos.ts`). El front **no calcula**
distancias ni elegibilidad: pinta lo que devuelve el backend con la política `assignment-policy-v1`, que lee de
`GET /v1/claims/assignment-policy` (radios, especialidad por tipo, frecuencia del reintento). Una sola página con los estados del
contrato (`ready`, `proposed`, `pending_assignment`, `assigned`, `location_missing`, `not_required`, `not_applicable`).

- **Mapa (decisión F1):** Leaflet 1.9 con teselas de OpenStreetMap, cargado de forma perezosa desde su versión ESM
  (`asistencias/modelos/mapa.ts`, `CARGAR_LEAFLET`; las pruebas lo sustituyen con `src/testing/leaflet-pruebas.ts`). Muestra el
  incidente, el círculo del radio y los candidatos con su distancia (sus coordenadas salen de `GET /v1/claims/providers`; si esa
  lectura falla, el mapa queda solo con el incidente). Los marcadores no son interactivos: la tabla es la alternativa accesible. Los
  textos de Leaflet (zoom, atribución) están en los diccionarios. **Sin geocodificador:** la dirección no sale a terceros.
- **CA-1:** con coordenadas de la app, «Capturadas desde la app · precisión 8 m». Sin ellas (`location_missing`),
  `componentes/ubicacion-incidente/` pide la dirección y el pin: un clic en el mapa lo pone, arrastrarlo lo mueve y los campos de
  latitud y longitud lo siguen (y lo mueven: alternativa por teclado). `POST …/incident-location`. La ubicación del analista se puede
  corregir antes de asignar.
- **CA-2 y CA-3:** «Buscar prestador» (sin cuerpo) y `componentes/tabla-candidatos/`: los de la especialidad, del más cercano al más
  lejano, con el sugerido resaltado **y** rotulado. «Asignar» solo para los `eligible`: «Disponible mañana» y «Fuera del radio» no se
  asignan (P8 y P9 del backend; el mockup los muestra habilitados).
- **CA-4:** «Ampliar radio de búsqueda» envía el radio siguiente de la política (`from_radius_km`); en el máximo se deshabilita con su
  motivo. `componentes/registro-intentos/` lista cada radio intentado con su hora y sus elegibles.
- **CA-5:** «Asignar» (el sugerido o cualquier elegible) pide confirmación en un `<dialog>` (`componentes/confirmar-asignacion/`) y
  envía el `search_seq` que el analista ve. `componentes/asignacion-confirmada/` muestra el prestador, su contacto, la distancia, quién y
  cuándo asignó, la ubicación compartida y el correo al prestador, que la página vuelve a leer cada 5 s (hasta 12 veces) mientras está
  pendiente. Los `409` (`provider_unavailable`, `search_outdated`, `assignment_exists`, `claim_not_assignable`) avisan y releen el caso.
- **CA-6 (O7b):** «Pendiente de asignación» con el motivo, los radios intentados y «la búsqueda se repetirá automáticamente cada 5
  minutos». La página no sondea (el reintento del backend es cada 5 min): «Actualizar estado» la vuelve a leer y «Reintentar
  búsqueda» busca desde el radio inicial.
- **Lo que el contrato no trae se oculta (F5):** la calificación y el número de casos del prestador, la ciudad del subtítulo, el
  selector de radio del mockup (se reemplaza por el texto y «Ampliar radio») y «el asegurado ve la fecha de la visita» (HU-W2.3-02).
- **Para HU-W2.3-03 (F8):** si O9b («Detalle de la asistencia con mapa») reutiliza `MapaAsignacionComponent`, se promueve a
  `shared/ui/`.

**Administración de prestadores (HU-W2.3-01, F2; sin mockup)** — `asistencias/prestadores.page.ts` (`PrestadoresPage`), ruta
`/siniestros/prestadores`, rol operaciones; se llega desde «Administrar prestadores» de O7. El registro por nombre con filtros de
especialidad y disponibilidad (en `?especialidad=&disponibilidad=`) y el cambio de disponibilidad
(`componentes/disponibilidad-prestador/`: «Disponible» o «No disponible» con «Hasta» opcional). «Liberar» marca disponible a un
prestador ocupado en un caso (D13); lo hará solo HU-W2.3-02 al cerrar la intervención. **Pendiente:** el alta y la edición del perfil
(la API existe; `grep -rn "HU-W2.3-01 F" src`).

**Edición de la radicación devuelta (HU-W2.1-04)** — `correccion/correccion-radicacion.page.ts` (A9), ruta
`/siniestros/:id/corregir`, rol asegurado (va antes de `:id` en `siniestros.routes.ts`). El detalle (A8) de un caso `returned`
muestra «Corregir y reenviar». Contrato: `docs/contratos/HU-W2.1-04-api.md` del backend (`openapi.yaml` v0.13.0). Cliente:
`SiniestrosApiService.consultarHistorial` y `reenviarRadicacion` (`core/api/siniestros/reenvio.modelos.ts`).

- **Qué ve (CA-1):** lee en paralelo el caso (`GET /v1/claims/{id}`) y su historial (`GET /v1/claims/{id}/history`).
  - `last_return` trae el motivo, el mensaje, el asesor, el veredicto por soporte y los datos a corregir.
  - `requirements` trae las reglas de cada soporte (mínimo, máximo y formatos), aunque la póliza ya no esté vigente.
  - Póliza y tipo se muestran, pero no se editan. Los datos que pidió el asesor llevan «Pedido por el asesor».
- **Soportes (CA-2):** `correccion/modelos/correccion-radicacion.ts` decide la acción de cada fila.
  - **Reemplazar:** si es ilegible o está lleno.
  - **Subir:** si no tiene archivos.
  - **Agregar:** si tiene archivos y espacio.
  - Los archivos nuevos se suben con el mismo `CargaSoportesService` de la radicación.
  - Por cada soporte con archivos nuevos se envía el conjunto completo que queda: al agregar, los de antes más los nuevos; al
    reemplazar, solo los nuevos. Lo que no se toca se conserva.
  - En un caso del móvil, las fotos de la app cuentan como «Fotos del vehículo», y las que se suben las reemplazan.
- **Qué falta (CA-3):**
  - «N pendientes» cuenta los ilegibles sin archivo nuevo, los faltantes (pedidos u obligatorios) y los que quedan bajo el mínimo.
  - Los datos se validan con las reglas de la radicación, y además la fecha no puede ser posterior a la radicación.
  - «Reenviar radicación» con algo pendiente muestra la lista y no llama al backend.
  - El `422` del backend (`not_replaced`, `missing`…) se pinta en su soporte o en su campo.
- **Reenvío (CA-4 y CA-5):** se envían solo los datos que cambiaron, con `review_seq`.
  - Al reenviar, el aviso dice que el caso conserva su número y volvió a estado Activo.
  - `stale_return` (el asesor la revisó otra vez) ofrece recargar.
  - El historial de la radicación lista la radicación, las revisiones y los reenvíos.

## Cómo trabajar una historia de este dominio

1. Crea la rama desde `develop` con el mismo nombre que en el backend, `feature/<ID>-<descripcion-corta-en-ingles>` (p. ej. `feature/HU-W2.1-01-<descripcion-en-ingles>`).
2. Declara la ruta en `siniestros.routes.ts` (archivo de rutas del dominio, cargado de forma perezosa desde `app.routes.ts`).
3. Crea la página en la subcarpeta indicada con el sufijo `.page.ts` y su prueba `.page.spec.ts` al lado.
4. Los componentes propios de la pantalla van en `componentes/`, los servicios de datos en `servicios/` y los tipos en `modelos/`, dentro de la misma subcarpeta.
5. Las llamadas HTTP salen siempre por el cliente del microservicio en `src/app/core/api/`; ninguna página llama a otro servicio directamente.
6. Textos en `public/i18n/es-CO.json` y `en-US.json`; estilos con los tokens de `src/styles/`.
7. Antes del pull request: `npm run lint`, `npm run build` y `npm test` en verde con cobertura ≥ 70 %.

Ver las convenciones completas en [`src/app/features/README.md`](../README.md) y la trazabilidad global en [`docs/pantallas.md`](../../../../docs/pantallas.md).
