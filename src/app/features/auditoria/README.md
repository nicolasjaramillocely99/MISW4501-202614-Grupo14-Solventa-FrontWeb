# `features/auditoria` — Auditoría y consentimientos (analítica, cumplimiento y trazabilidad)

- **Épica:** Web · Épica 4
- **Microservicio que lo respalda (vía API Gateway):** Servicio de auditoría y consentimientos (registro inmutable, consentimientos Open Finance)
- **Cliente HTTP:** `src/app/core/api/auditoria/`
- **Shell de navegación:** portal
- **Requiere sesión:** sí (guard de autenticación en el shell del portal; el rol se restringe por ruta)

**Estado:** `registro/` implementado (HU-W4.1-01: O12/O12b búsqueda y O13 registro de auditoría, solo lectura, rol operaciones; cliente `AuditoriaApiService.consultarRegistroDecision`). `consentimientos/` implementado en lo que pide HU-W4.2-02 (búsqueda mínima por identificador y O15/O15b/O15c: detalle, confirmación y reintento de la revocación, rol operaciones); el listado y los filtros (O14) siguen reservados a HU-W4.2-01. La exportación JSON (HU-W4.1-02) queda para su historia.

## Pantallas y dónde va cada una

### `registro/` — F4.1 · Registro de auditoría de decisiones de suscripción y pricing

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [O12](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=41-4627), [O12b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=41-5312) | Auditoría · Búsqueda por identificador (y sin resultados) | `/auditoria/registro` | Analista de operaciones | HU-W4.1-01 | S2 |
| [O13](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=41-4943) | Registro de auditoría de la suscripción | `/auditoria/registro/:id` | Analista de operaciones | HU-W4.1-01, HU-W4.1-02 | S2 |

### `consentimientos/` — F4.2 · Gestión de consentimientos de Open Finance

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [O14](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=44-4954), [O14b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=877-9304) | Consentimientos Open Finance (y sin resultados) | `/auditoria/consentimientos` | Analista de operaciones | HU-W4.2-01 | S2 |
| [O15](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=44-5400), [O15b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=45-5220), [O15c](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=45-5641) | Detalle del consentimiento, confirmación y reintento de revocación | `/auditoria/consentimientos/:id` | Analista de operaciones | HU-W4.2-02 | S2 |

#### Qué contiene hoy `consentimientos/` (HU-W4.2-02)

| Archivo o carpeta | Para qué |
|---|---|
| `busqueda-consentimiento.page.ts` | **Provisional (HU-W4.2-02 F1).** Búsqueda mínima por identificador (`consent_id`, 1 a 64 caracteres `A-Za-z0-9_-`); si existe lleva al detalle, si no muestra «sin resultados» en la misma página. HU-W4.2-01 la reemplaza por el listado O14 |
| `detalle-consentimiento.page.ts` | O15 / O15b / O15c. Se arma solo con `GET …/revocation` (F2), también en el sondeo. Estados dentro de la página: cargando, activo, en curso, revocado, parcial, vencido, no encontrado y error |
| `componentes/confirmar-revocacion/` | O15b: `<dialog>` nativo con `showModal()` (F3); motivo, referencia (3 a 64 caracteres, sin tildes) y casilla del rol; «Revocar ahora» deshabilitado con el aviso de qué falta |
| `componentes/entidades-revocacion/` | Tabla de entidades con el avance del aviso (pendiente, revocado, sin confirmación) y sus horas |
| `componentes/historial-consentimiento/` | Línea de tiempo del historial; los códigos que no están en el diccionario se muestran crudos |
| `modelos/presentacion-revocacion.ts` | Funciones puras: etiqueta de estado (de `status` + `notice_status`), entidades por estado, necesidad y límite del sondeo, validación de la referencia |
| `servicios/seguimiento-revocacion.service.ts` | Provisto por la página: estado, sondeo cada 5 s (se detiene tras 3 fallos seguidos o 30 s después del mayor plazo) y la `Idempotency-Key` del modal |
| `servicios/estado-consultado.service.ts` | Pasa el estado de la búsqueda al detalle para no leerlo dos veces |
| `pipes/traducir-codigo.pipe.ts` | Traduce un código del contrato y, si no hay clave, lo muestra crudo (F5) |

**Qué no se pinta porque el contrato no lo trae (F4):** «Descargar evidencia», «Ver acuse», el NIT, el contacto, el *hash* de la evidencia, la finalidad, la vigencia y el canal de otorgamiento, la última consulta y los datos autorizados por entidad, y el nombre del analista cuando no es quien tiene la sesión. «Comprobante al cliente» muestra el `REV-…` con «Disponible en la app del cliente»: el comprobante lo ve el titular en la app. El reintento es de **todas** las entidades que no confirmaron (no hay reintento por entidad). Lo provisional se encuentra con `grep -rn "HU-W4.2-02 F" src`.

## Cómo trabajar una historia de este dominio

1. Crea la rama desde `develop` con el mismo nombre que en el backend, `feature/<ID>-<descripcion-corta-en-ingles>` (p. ej. `feature/HU-W4.1-01-<descripcion-en-ingles>`).
2. Declara la ruta en `auditoria.routes.ts` (archivo de rutas del dominio, cargado de forma perezosa desde `app.routes.ts`).
3. Crea la página en la subcarpeta indicada con el sufijo `.page.ts` y su prueba `.page.spec.ts` al lado.
4. Los componentes propios de la pantalla van en `componentes/`, los servicios de datos en `servicios/` y los tipos en `modelos/`, dentro de la misma subcarpeta.
5. Las llamadas HTTP salen siempre por el cliente del microservicio en `src/app/core/api/`; ninguna página llama a otro servicio directamente.
6. Textos en `public/i18n/es-CO.json` y `en-US.json`; estilos con los tokens de `src/styles/`.
7. Antes del pull request: `npm run lint`, `npm run build` y `npm test` en verde con cobertura ≥ 70 %.

Ver las convenciones completas en [`src/app/features/README.md`](../README.md) y la trazabilidad global en [`docs/pantallas.md`](../../../../docs/pantallas.md).
