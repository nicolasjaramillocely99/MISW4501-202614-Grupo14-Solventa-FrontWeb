# `src/testing` — utilidades compartidas de pruebas unitarias

Ayudantes que varias pruebas `*.spec.ts` reutilizan. No forman parte de la aplicación (excluidos en `tsconfig.app.json`).

Contenido:

| Archivo | Para qué |
|---|---|
| `configuracion-pruebas.ts` | `CONFIGURACION_PRUEBAS` (los valores de `environment.development.ts`) y `proveerConfiguracionPruebas()`. Su exportación por defecto la registra `angular.json` (`test.options.providersFile`) para **todas** las pruebas: cualquier servicio que inyecte `CONFIGURACION_EJECUCION` la encuentra sin declararla (T5) |
| `transloco-pruebas.ts` | `proveerTranslocoPruebas()`: `TranslocoTestingModule` con los diccionarios reales de `public/i18n/` precargados y re-renderizado al cambiar de idioma (como la app), para verificar textos externalizados; `DICCIONARIOS` para comparar las claves de ambos idiomas (HA-S01) |
| `sesion-pruebas.ts` | Sesión simulada por rol (asegurado, asesor, operaciones, socio) para probar *guards*, menú y páginas protegidas: `crearJwtPrueba` y `crearTokensPrueba` (tokens sin firma real), `crearProveedorIdentidadFalso` (espías de Vitest), `proveerSesionPrueba()` y `iniciarSesionComo(rol)` (HA-S01) |
| `cobro-pruebas.ts` | `COBRO_PENDIENTE_DTO`: cobro de la prima pendiente con la forma del contrato de HA-D02, base para los demás estados en las pruebas del cliente y del paso de pago |
| `emision-monitor-pruebas.ts` | `LISTA_EMISIONES_DTO` (`GET /v1/issuances` con una emisión por estado —aceptada, en cobro, activa, notificada y dos excepciones, la del cobro sin atender y la del generador de documentos ya reintentada— y los conteos de las tarjetas), cada emisión por separado y `ACCIONES_DTO`, con la forma del contrato de HU-W1.3-04 |
| `revision-pruebas.ts` | `SOLICITUD_PENDIENTE_DTO`, `SOLICITUD_AJUSTADA_DTO` y `SOLICITUD_RECHAZADA_DTO`: solicitudes de la bandeja de decisión humana con la forma del contrato de HU-W1.1-02, para el cliente y las páginas de la bandeja |
| `revocacion-pruebas.ts` | `ESTADO_ACTIVO_DTO`, `ESTADO_EN_CURSO_DTO`, `ESTADO_REVOCADO_DTO`, `ESTADO_PARCIAL_DTO`, `ESTADO_REVOCADO_EN_APP_DTO` y `ESTADO_VENCIDO_DTO`: el estado de revocación de un consentimiento con la forma del contrato de HU-W4.2-02 (activo, en curso, revocado, parcial, desde la app y vencido) |
| `dialogo-pruebas.ts` | `simularDialogoNativo()` y `pulsarEscapeEnDialogo()`: jsdom no implementa `<dialog>.showModal()`; el doble reproduce `open`, el evento `close` y la cancelación con `Escape`. El foco atrapado y el fondo inerte los cubre la E2E en Chromium (HU-W4.2-02) |
| `fabricas/` | Fábricas de datos de prueba (póliza, siniestro, socio, consentimiento) |

Las pruebas se escriben con Vitest y Testing Library: se consulta el DOM por rol y texto accesible (`screen.getByRole`), no por clases ni selectores internos.
