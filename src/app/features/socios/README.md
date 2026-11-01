# `features/socios` — Gestión B2B de socios comerciales

- **Épica:** Web · Épica 3
- **Microservicio que lo respalda (vía API Gateway):** Servicio de gestión de socios B2B (alta, credenciales, tablero de desempeño)
- **Cliente HTTP:** `src/app/core/api/socios/`
- **Shell de navegación:** portal
- **Requiere sesión:** sí (guard de autenticación en el shell del portal; el rol se restringe por ruta)

**Estado:** `gestion/` implementado para **HU-W3.1-01** (rol operaciones; cliente `SociosApiService`): O10 `listado-socios.page.ts` (tres indicadores, tabla con credenciales, cuota diaria y consumo de hoy del gateway, estados cargando / vacío / error y el modal «Registrar socio», que deja al socio pendiente de aprobación) y O11 `detalle-socio.page.ts` («Aprobar y generar credenciales» para un socio pendiente, «Rotar credenciales» con periodo de transición para uno activo, credenciales sin el secreto, cuota y aislamiento, historial; estados cargando / no encontrado / error). Tras aprobar o rotar, `componentes/secreto-emitido` muestra el secreto **una sola vez** (no cierra con `Escape`; «Ya guardé el secreto» lo borra de memoria). La cuota es diaria (usage plans de API Gateway, decisión del equipo). «Dar de baja» (O11b, HU-W3.1-02) no se muestra y «Uso reciente (24 h)» queda como aviso hasta el tablero (HU-W3.2-01). `credenciales/`, `tablero/` y `desempeno/` siguen vacíos: sus rutas (`/socios/tablero*`, `/socios/credenciales`) redirigen al inicio.

| Archivo de `gestion/` | Qué hace |
|---|---|
| `listado-socios.page.ts` | O10. Un 503 muestra «Reintentar»; 401 y 403 los resuelve el interceptor. Registrar navega al detalle del socio creado |
| `detalle-socio.page.ts` | O11. Errores de aprobación y rotación con texto propio (`partner_not_pending`, `partner_not_active`, `rotation_in_progress`, `gateway_unavailable`) |
| `componentes/registrar-socio` | Modal del registro: validación local con las reglas del contrato y campos marcados con `validation_failed` o `partner_code_taken` |
| `componentes/rotar-credenciales` | Modal de la rotación: periodo de transición en horas (1–168, por defecto el del servicio) |
| `componentes/secreto-emitido` | Modal del secreto: copiar al portapapeles con aviso accesible, sin almacenamiento ni URL |
| `modelos/presentacion-socios.ts` | Insignias, tono de la barra de consumo, validación del registro y del periodo de transición |

## Pantallas y dónde va cada una

### `gestion/` — F3.1 · Incorporación de socios y credenciales (operaciones)

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [O10](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=40-4257) | Socios comerciales (listado) | `/socios` | Analista de operaciones | HU-W3.1-01 | S2 |
| [O11](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=40-4634), [O11b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=40-4980) | Detalle del socio y credenciales (y baja) | `/socios/:id` | Analista de operaciones | HU-W3.1-01, HU-W3.1-02 | S2 |

### `tablero/` — F3.2 · Tablero de desempeño para el socio

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [B1](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=46-5476), [B1b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=46-5785), [B1c](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=701-8636), [B1d](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=701-8824) | Tablero de integración · Resumen | `/socios/tablero` | Socio comercial | HU-W3.2-01 | S3 |
| [B2](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=47-5701), [B2b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=701-9012), [B2c](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=701-9150), [B2d](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=701-9288), [B2e](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=701-9426) | Cotizaciones y pólizas por producto | `/socios/tablero/por-producto` | Socio comercial | HU-W3.2-02 | Could (fuera de alcance) |

### `desempeno/` — F3.2 · Disponibilidad y tiempos de respuesta de la API

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [B3](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=47-5965), [B3b](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=47-6183), [B3c](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=701-9564) | Desempeño técnico de la API (y API degradada) | `/socios/tablero/desempeno` | Socio comercial | HU-W3.2-03 | S3 |

### `credenciales/` — F3.1 · Credenciales de integración vistas por el socio

| Figma | Pantalla | Ruta propuesta | Roles | Historias | Sprint |
|---|---|---|---|---|---|
| [B4](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas?node-id=46-6009) | Credenciales de integración | `/socios/credenciales` | Socio comercial | HU-W3.1-01 | S2 |

## Cómo trabajar una historia de este dominio

1. Crea la rama desde `develop` con el mismo nombre que en el backend, `feature/<ID>-<descripcion-corta-en-ingles>` (p. ej. `feature/HU-W3.1-01-<descripcion-en-ingles>`).
2. Declara la ruta en `socios.routes.ts` (archivo de rutas del dominio, cargado de forma perezosa desde `app.routes.ts`).
3. Crea la página en la subcarpeta indicada con el sufijo `.page.ts` y su prueba `.page.spec.ts` al lado.
4. Los componentes propios de la pantalla van en `componentes/`, los servicios de datos en `servicios/` y los tipos en `modelos/`, dentro de la misma subcarpeta.
5. Las llamadas HTTP salen siempre por el cliente del microservicio en `src/app/core/api/`; ninguna página llama a otro servicio directamente.
6. Textos en `public/i18n/es-CO.json` y `en-US.json`; estilos con los tokens de `src/styles/`.
7. Antes del pull request: `npm run lint`, `npm run build` y `npm test` en verde con cobertura ≥ 70 %.

Ver las convenciones completas en [`src/app/features/README.md`](../README.md) y la trazabilidad global en [`docs/pantallas.md`](../../../../docs/pantallas.md).
