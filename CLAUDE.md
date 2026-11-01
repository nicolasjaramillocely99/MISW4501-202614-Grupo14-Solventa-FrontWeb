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
E2E_NUBE=1 E2E_BASE_URL=https://… NUBE_CONTRASENA='…' npx playwright test --project=nube   # humo del portal desplegado (T5), fuera del CI
bash scripts/publicar-portal.sh staging                      # publica dist/ en S3 + CloudFront (credenciales de AWS del entorno)
```

- `npm test` usa el *builder* `@angular/build:unit-test` (Vitest + jsdom). Los umbrales de cobertura del 70 % están en `angular.json` y hacen fallar la corrida.
- El build de producción tiene presupuestos: inicial ≤ 1 MB y **estilos por componente ≤ 8 kB** (aviso a 4 kB); los estilos comunes van a `src/styles/`.
- Alias de importación (`tsconfig.json`): `@core/*`, `@shared/*`, `@layout/*`, `@features/*`, `@env/*`, `@testing/*`. Úsalos en lugar de rutas relativas entre capas.

## Arquitectura en la práctica

- **Arranque:** `main.ts` lee primero la configuración del ambiente (`cargarConfiguracion` de `core/configuracion/`: `config.json` en la nube, `environment.development.ts` en local) y la provee como `CONFIGURACION_EJECUCION`; sin configuración válida muestra el aviso fijo y bilingüe de `index.html` y no arranca. Luego `app.config.ts` registra el router, `HttpClient` con `autenticacionInterceptor`, Transloco (`proveerI18n`) y enlaza el puerto abstracto `ProveedorIdentidad` a `CognitoProveedorIdentidadService`. No hay Zone.js: el estado se expresa con Signals y los componentes usan `OnPush`.
- **Rutas (`app.routes.ts`):** `/acceso` es público y sin *shell*; `/embebido` usa su propio *shell* y es público salvo `/embebido/oferta` (HU-W1.3-01, exige un asegurado); todo lo demás cuelga de `PortalShellComponent` protegido por `autenticacionGuard` (`canActivate` y `canActivateChild`). Cada dominio se carga con `loadChildren` hacia su `<DOMINIO>_ROUTES` y restringe el rol con `rolGuard(...roles)`. Al agregar un dominio se registra como hijo del *shell*.
- **Sesión (HA-S01):** `SesionService` expone señales (`sesion`, `usuario`, `rol`, `autenticado`, `expirada`); los tokens viven en memoria y solo el de renovación en `sessionStorage`; renueva el ID token un minuto antes de vencer y lo revoca al cerrar sesión. El rol sale de los grupos de Cognito (`insured`, `advisor`, `operations`, `partner`) en `core/auth/modelos/rol.ts`. Las pantallas dependen del puerto `ProveedorIdentidad` y distinguen errores por `ErrorIdentidad.motivo`.
- **Interceptor:** adjunta `Authorization: Bearer <idToken>` solo a peticiones hacia `<apiGatewayUrl>/v1/…` (en local `apiGatewayUrl` es `http://localhost:4200`, con `proxy.conf.json` reenviando `/v1` a `:8080`; en la nube es el propio portal en CloudFront; `config.json`, los diccionarios y `/pasarela/*` nunca llevan el token); 401 → renueva el token y reintenta una vez, y si falla expira la sesión y va a `/acceso/sesion-expirada`; 403 → `/acceso/no-autorizado`.
- **Navegación por rol:** menú lateral y ruta de inicio de cada rol en `core/navegacion/menu-por-rol.ts` (`MENU_POR_ROL`, `RUTA_INICIO_POR_ROL`).
- **i18n:** `es-CO` predeterminado y respaldo, `en-US` alterno; `IdiomaService` guarda la preferencia en `localStorage` y actualiza `lang` del documento. Existe una prueba (`core/i18n/diccionarios.spec.ts`) que compara las claves de ambos diccionarios.
- **Ambientes:** la URL del API, la de la pasarela y Cognito no se compilan: en la nube el portal las lee de `config.json`, que escribe Terraform (repo backend, `infra/terraform/modules/web-portal`), y un mismo *build* sirve a staging y a production-demo. En local, `environment.development.ts` trae `configuracionLocal` y apunta Cognito al emulador Moto del backend (`cognito.endpoint`); sin ese campo se usa el endpoint regional de AWS.
- **Publicación (T5):** `scripts/publicar-portal.sh <staging|production-demo>` sube `dist/` al bucket del sitio y refresca CloudFront sin tocar `config.json`. `cd-portal.yml` lo corre solo hacia staging (rol OIDC): automático al integrar `main` y bajo demanda desde `develop` o `main`; si staging está apagado, avisa y termina sin publicar. production-demo se publica con `scripts/environment/up.sh production-demo` del backend.
- Varias carpetas (`core/api/*`, `core/errores/`, la mayoría de `features/`) aún están vacías: el `README.md` de cada capa describe lo que debe ir allí y sus convenciones.

## Pruebas

- **Unitarias:** Testing Library consultando por rol y texto accesible. `src/testing/configuracion-pruebas.ts` provee `CONFIGURACION_EJECUCION` a todas las pruebas (`providersFile` de `angular.json`). Ayudantes en `src/testing/`: `proveerTranslocoPruebas()` (diccionarios reales) y `proveerSesionPrueba()` / `iniciarSesionComo(rol)` / `crearProveedorIdentidadFalso()` para *guards*, menú y páginas protegidas.
- **E2E:** Chromium a 1440 × 900, `locale` `es-CO`, zona `America/Bogota`. Cognito se simula con `page.route` en `e2e/fixtures/sesion-por-rol.ts` (sin red); *page objects* en `e2e/paginas/`; cada flujo incluye una verificación con `e2e/accesibilidad/verificar-accesibilidad.ts`. El proyecto `local-moto` solo se registra con `E2E_MOTO=1`, y `nube` (portal desplegado, Cognito real, usuarios permanentes) solo con `E2E_NUBE=1`.
