# `src/testing` — utilidades compartidas de pruebas unitarias

Ayudantes que varias pruebas `*.spec.ts` reutilizan. No forman parte de la aplicación (excluidos en `tsconfig.app.json`).

Contenido previsto:

| Archivo | Para qué |
|---|---|
| `transloco-pruebas.ts` | Proveedores de `TranslocoTestingModule` con los diccionarios reales de `public/i18n/`, para verificar textos externalizados |
| `sesion-pruebas.ts` | Sesión simulada por rol (asegurado, asesor, operaciones, socio) para probar *guards*, menú y páginas protegidas |
| `fabricas/` | Fábricas de datos de prueba (póliza, siniestro, socio, consentimiento) |

Las pruebas se escriben con Vitest y Testing Library: se consulta el DOM por rol y texto accesible (`screen.getByRole`), no por clases ni selectores internos.
