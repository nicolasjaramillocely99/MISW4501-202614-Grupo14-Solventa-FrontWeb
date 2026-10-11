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

## Cómo trabajar una historia de este dominio

1. Crea la rama desde `develop` con el mismo nombre que en el backend, `feature/<ID>-<descripcion-corta-en-ingles>` (p. ej. `feature/HU-W1.1-01-<descripcion-en-ingles>`).
2. Declara la ruta en `originacion.routes.ts` (archivo de rutas del dominio, cargado de forma perezosa desde `app.routes.ts`).
3. Crea la página en la subcarpeta indicada con el sufijo `.page.ts` y su prueba `.page.spec.ts` al lado.
4. Los componentes propios de la pantalla van en `componentes/`, los servicios de datos en `servicios/` y los tipos en `modelos/`, dentro de la misma subcarpeta.
5. Las llamadas HTTP salen siempre por el cliente del microservicio en `src/app/core/api/`; ninguna página llama a otro servicio directamente.
6. Textos en `public/i18n/es-CO.json` y `en-US.json`; estilos con los tokens de `src/styles/`.
7. Antes del pull request: `npm run lint`, `npm run build` y `npm test` en verde con cobertura ≥ 70 %.

Ver las convenciones completas en [`src/app/features/README.md`](../README.md) y la trazabilidad global en [`docs/pantallas.md`](../../../../docs/pantallas.md).
