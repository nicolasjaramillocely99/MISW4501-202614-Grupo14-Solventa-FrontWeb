# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Las reglas del repositorio (arquitectura, idioma, Definición de Terminado, flujo de Git y pull requests) viven en `AGENTS.md`. No se duplican aquí para que los dos archivos no se desincronicen.

## Específico de Claude Code

- Cumple la Definición de Terminado de `AGENTS.md` (sección 5) antes de dar por terminada una tarea.
- **Decisiones técnicas o de arquitectura:** pregunta al usuario antes de decidir; no generes registros de decisión (ADR) por iniciativa propia.
- No hagas commit, push ni abras un PR salvo que el usuario lo pida. Sigue las secciones 7 y 7.1 de `AGENTS.md`.
- Lee el `README.md` del dominio (`src/app/features/<dominio>/`) antes de modificarlo.

## Comandos que no están en `AGENTS.md`

```bash
npm start                                                    # http://localhost:4200 con environment.development.ts
npm test -- --include src/app/core/auth/sesion.service.spec.ts --watch=false   # una sola prueba unitaria
npx playwright test e2e/flujos/acceso                        # un flujo E2E (levanta npm start si no hay servidor)
npx playwright test -g "texto del título"                    # E2E por título
E2E_BASE_URL=https://… npm run e2e                           # E2E contra un ambiente desplegado
E2E_MOTO=1 MOTO_USER_PASSWORD='…' npx playwright test --project=local-moto   # humo contra el Cognito local (Moto), fuera del CI
```

- `npm test` usa el *builder* `@angular/build:unit-test` (Vitest + jsdom). Los umbrales de cobertura del 70 % están en `angular.json` y hacen fallar la corrida.
- El build de producción tiene presupuestos: inicial ≤ 1 MB y **estilos por componente ≤ 8 kB** (aviso a 4 kB); los estilos comunes van a `src/styles/`.
- Alias de importación (`tsconfig.json`): `@core/*`, `@shared/*`, `@layout/*`, `@features/*`, `@env/*`, `@testing/*`. Úsalos en lugar de rutas relativas entre capas.

## Arquitectura en la práctica

- **Arranque:** `app.config.ts` registra el router, `HttpClient` con `autenticacionInterceptor`, Transloco (`proveerI18n`) y enlaza el puerto abstracto `ProveedorIdentidad` a `CognitoProveedorIdentidadService`. No hay Zone.js: el estado se expresa con Signals y los componentes usan `OnPush`.
- **Rutas (`app.routes.ts`):** `/acceso` es público y sin *shell*; `/embebido` usa su propio *shell* y es público salvo `/embebido/oferta` (HU-W1.3-01, exige un asegurado); todo lo demás cuelga de `PortalShellComponent` protegido por `autenticacionGuard` (`canActivate` y `canActivateChild`). Cada dominio se carga con `loadChildren` hacia su `<DOMINIO>_ROUTES` y restringe el rol con `rolGuard(...roles)`. Al agregar un dominio se registra como hijo del *shell*.
- **Sesión (HA-S01):** `SesionService` expone señales (`sesion`, `usuario`, `rol`, `autenticado`, `expirada`); los tokens viven en memoria y solo el de renovación en `sessionStorage`; renueva el ID token un minuto antes de vencer y lo revoca al cerrar sesión. El rol sale de los grupos de Cognito (`insured`, `advisor`, `operations`, `partner`) en `core/auth/modelos/rol.ts`. Las pantallas dependen del puerto `ProveedorIdentidad` y distinguen errores por `ErrorIdentidad.motivo`.
- **Interceptor:** adjunta `Authorization: Bearer <idToken>` solo a peticiones hacia `apiGatewayUrl` (por eso en local es `http://localhost:4200`, con `proxy.conf.json` reenviando `/v1` a `:8080`); 401 → renueva el token y reintenta una vez, y si falla expira la sesión y va a `/acceso/sesion-expirada`; 403 → `/acceso/no-autorizado`.
- **Navegación por rol:** menú lateral y ruta de inicio de cada rol en `core/navegacion/menu-por-rol.ts` (`MENU_POR_ROL`, `RUTA_INICIO_POR_ROL`).
- **i18n:** `es-CO` predeterminado y respaldo, `en-US` alterno; `IdiomaService` guarda la preferencia en `localStorage` y actualiza `lang` del documento. Existe una prueba (`core/i18n/diccionarios.spec.ts`) que compara las claves de ambos diccionarios.
- **Ambientes:** `environment.development.ts` apunta Cognito al emulador Moto del backend (`cognito.endpoint`); sin ese campo se usa el endpoint regional de AWS. Los valores `PENDIENTE` llegan desde el repositorio de infraestructura.
- Varias carpetas (`core/api/*`, `core/errores/`, la mayoría de `features/`) aún están vacías: el `README.md` de cada capa describe lo que debe ir allí y sus convenciones.

## Pruebas

- **Unitarias:** Testing Library consultando por rol y texto accesible. Ayudantes en `src/testing/`: `proveerTranslocoPruebas()` (diccionarios reales) y `proveerSesionPrueba()` / `iniciarSesionComo(rol)` / `crearProveedorIdentidadFalso()` para *guards*, menú y páginas protegidas.
- **E2E:** Chromium a 1440 × 900, `locale` `es-CO`, zona `America/Bogota`. Cognito se simula con `page.route` en `e2e/fixtures/sesion-por-rol.ts` (sin red); *page objects* en `e2e/paginas/`; cada flujo incluye una verificación con `e2e/accesibilidad/verificar-accesibilidad.ts`. El proyecto `local-moto` solo se registra con `E2E_MOTO=1`.
