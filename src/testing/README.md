# `src/testing` — utilidades compartidas de pruebas unitarias

Ayudantes que varias pruebas `*.spec.ts` reutilizan. No forman parte de la aplicación (excluidos en `tsconfig.app.json`).

Contenido:

| Archivo | Para qué |
|---|---|
| `transloco-pruebas.ts` | `proveerTranslocoPruebas()`: `TranslocoTestingModule` con los diccionarios reales de `public/i18n/` precargados y re-renderizado al cambiar de idioma (como la app), para verificar textos externalizados; `DICCIONARIOS` para comparar las claves de ambos idiomas (HA-S01) |
| `sesion-pruebas.ts` | Sesión simulada por rol (asegurado, asesor, operaciones, socio) para probar *guards*, menú y páginas protegidas: `crearJwtPrueba` y `crearTokensPrueba` (tokens sin firma real), `crearProveedorIdentidadFalso` (espías de Vitest), `proveerSesionPrueba()` y `iniciarSesionComo(rol)` (HA-S01) |
| `fabricas/` | Fábricas de datos de prueba (póliza, siniestro, socio, consentimiento) |

Las pruebas se escriben con Vitest y Testing Library: se consulta el DOM por rol y texto accesible (`screen.getByRole`), no por clases ni selectores internos.
