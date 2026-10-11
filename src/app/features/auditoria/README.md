# `features/auditoria` — Auditoría y consentimientos (analítica, cumplimiento y trazabilidad)

- **Épica:** Web · Épica 4
- **Microservicio que lo respalda (vía API Gateway):** Servicio de auditoría y consentimientos (registro inmutable, consentimientos Open Finance)
- **Cliente HTTP:** `src/app/core/api/auditoria/`
- **Shell de navegación:** portal
- **Requiere sesión:** sí (guard de autenticación en el shell del portal; el rol se restringe por ruta)

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

## Cómo trabajar una historia de este dominio

1. Crea la rama desde `develop` con el mismo nombre que en el backend, `feature/<ID>-<descripcion-corta-en-ingles>` (p. ej. `feature/HU-W4.1-01-<descripcion-en-ingles>`).
2. Declara la ruta en `auditoria.routes.ts` (archivo de rutas del dominio, cargado de forma perezosa desde `app.routes.ts`).
3. Crea la página en la subcarpeta indicada con el sufijo `.page.ts` y su prueba `.page.spec.ts` al lado.
4. Los componentes propios de la pantalla van en `componentes/`, los servicios de datos en `servicios/` y los tipos en `modelos/`, dentro de la misma subcarpeta.
5. Las llamadas HTTP salen siempre por el cliente del microservicio en `src/app/core/api/`; ninguna página llama a otro servicio directamente.
6. Textos en `public/i18n/es-CO.json` y `en-US.json`; estilos con los tokens de `src/styles/`.
7. Antes del pull request: `npm run lint`, `npm run build` y `npm test` en verde con cobertura ≥ 70 %.

Ver las convenciones completas en [`src/app/features/README.md`](../README.md) y la trazabilidad global en [`docs/pantallas.md`](../../../../docs/pantallas.md).
