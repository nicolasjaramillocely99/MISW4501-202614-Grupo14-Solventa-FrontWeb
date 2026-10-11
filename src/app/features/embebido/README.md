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
| [E6](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=15-691) | Solicitud en revisión (decisión humana) | `/embebido/en-revision` | público (canal del aliado) | HU-W1.3-01, HU-W1.1-02 | S1 |
| [E3](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=12-434), [E3b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=15-478), [E3c](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=433-745) | Paso 3 · Oferta personalizada (y provisional) | `/embebido/oferta` | público (canal del aliado) | HU-W1.2-03, HU-W1.3-01, HA-D01 | S1 |
| [E7](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=16-1002) | Oferta vencida | `/embebido/oferta-vencida` | público (canal del aliado) | HU-W1.3-01 | S1 |
| [E4](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=14-337), [E4b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=16-578), [E4c](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=16-783) | Paso 4 · Pago de la prima (pendiente / rechazado) | `/embebido/pago` | público (canal del aliado) | HU-W1.3-02, HA-D02 | S1 |
| [E2](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=12-231), [E2b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=643-8582) | Paso 2 · Cálculo del perfil de riesgo | `/embebido/perfil-riesgo` | público (canal del aliado) | HU-W1.2-02, HA-L01, HA-D01 | S1 |
| [E5](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=14-556) | Paso 5 · Póliza emitida | `/embebido/poliza-emitida` | público (canal del aliado) | HU-W1.3-03 | S1 |

## Cómo trabajar una historia de este dominio

1. Crea la rama desde `develop` con el mismo nombre que en el backend, `feature/<ID>-<descripcion-corta-en-ingles>` (p. ej. `feature/HU-W1.2-01-<descripcion-en-ingles>`).
2. Declara la ruta en `embebido.routes.ts` (archivo de rutas del dominio, cargado de forma perezosa desde `app.routes.ts`).
3. Crea la página en la subcarpeta indicada con el sufijo `.page.ts` y su prueba `.page.spec.ts` al lado.
4. Los componentes propios de la pantalla van en `componentes/`, los servicios de datos en `servicios/` y los tipos en `modelos/`, dentro de la misma subcarpeta.
5. Las llamadas HTTP salen siempre por el cliente del microservicio en `src/app/core/api/`; ninguna página llama a otro servicio directamente.
6. Textos en `public/i18n/es-CO.json` y `en-US.json`; estilos con los tokens de `src/styles/`.
7. Antes del pull request: `npm run lint`, `npm run build` y `npm test` en verde con cobertura ≥ 70 %.

Ver las convenciones completas en [`src/app/features/README.md`](../README.md) y la trazabilidad global en [`docs/pantallas.md`](../../../../docs/pantallas.md).
