# MISW4501-202614-Grupo14-Solventa-FrontWeb

Cliente web de **Solventa** (portal de operación, siniestros, gestión B2B y cumplimiento, más la demo del canal embebido), construido en **Angular**. Proyecto Final MISW4501 · Grupo 14 · Universidad de los Andes.

Este repositorio es uno de los cuatro componentes de la solución:

| Componente | Repositorio | Tecnología |
|---|---|---|
| **Cliente web (este)** | `MISW4501-202614-Grupo14-Solventa-FrontWeb` | Angular + TypeScript |
| Cliente móvil | `MISW4501-202614-Grupo14-Solventa-Mobile` | Kotlin + Jetpack Compose |
| Microservicios de negocio | `…-Backend` | Go sobre ECS Fargate |
| Infraestructura | `…-Infra` | Terraform sobre AWS |

En el [modelo de componentes](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Arquitectura_final#modelo-de-componentes) este cliente vive en **LAYER 4 · Clientes** y solo habla con **LAYER 3 · Gateway** (Amazon API Gateway) por HTTPS; la identidad la emite **Amazon Cognito** (OIDC). Nunca accede a un microservicio, a una base de datos ni a la mensajería directamente. Ver [`docs/arquitectura.md`](docs/arquitectura.md).

---

## 1. Stack definido por el equipo

Tomado de [Definición de frameworks y ambientes](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/frameworks) y del [sistema de diseño](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Sistema-de-Dise%C3%B1o_Solventa).

| Necesidad | Herramienta | Versión instalada |
|---|---|---|
| Framework web | Angular (componentes *standalone*, Signals, sin Zone.js) | 22.2 |
| Lenguaje | TypeScript | 6.0 |
| Estilos | SCSS con los tokens del sistema de diseño | — |
| Internacionalización | Transloco (diccionarios JSON cargados en tiempo de ejecución) + API `Intl` del navegador | 8.4 |
| Iconografía | Lucide (`@lucide/angular`) | 1.53 |
| Pruebas unitarias y de componente | Vitest + Testing Library (`@testing-library/angular`, `jest-dom`, `user-event`) | 4 / 19.5 |
| Pruebas extremo a extremo | Playwright (Chrome de referencia) | 1.64 |
| Accesibilidad | axe-core sobre Playwright | 4.13 |
| Análisis estático | ESLint + angular-eslint | 10 / 22.5 |
| Integración continua | GitHub Actions (por *pull request* y corrida nocturna) | — |
| Dependencias vulnerables | Dependabot | — |

Navegadores soportados: las dos versiones más recientes de Chrome, Edge, Firefox y Safari en escritorio. Resolución de referencia 1440 × 900; ancho mínimo del *back-office* 1280 px. No hay versión web para teléfonos: el asegurado usa la app móvil nativa.

---

## 2. Puesta en marcha

Requisitos: **Node.js 24 LTS** (archivo [`.nvmrc`](.nvmrc); Angular 22 exige 24.15 o superior) y **npm 11**, que viene incluido con Node 24.

```bash
npm ci
```

`npm ci` instala exactamente lo que fija `package-lock.json`; no uses `npm install` para instalar el proyecto, solo para agregar una dependencia nueva.

```bash
npm start
```

El portal queda en `http://localhost:4200` usando `src/environments/environment.development.ts` (ambiente **local**). El servicio de originación no responde CORS, así que en local el navegador llama al mismo origen y el proxy de desarrollo ([`proxy.conf.json`](proxy.conf.json)) reenvía `/v1` a `http://localhost:8080`.

| Comando | Qué hace |
|---|---|
| `npm start` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Compilación de producción en `dist/` |
| `npm run build -- --configuration staging` | Compilación para el ambiente de experimentos |
| `npm test` | Pruebas unitarias con Vitest |
| `npm test -- --coverage` | Pruebas unitarias con reporte de cobertura (umbral del proyecto: ≥ 70 %) |
| `npm run lint` | ESLint sobre TypeScript y plantillas |
| `npm run e2e` | Pruebas E2E con Playwright (levanta `npm start` si no hay servidor) |
| `npm run e2e:ui` | Playwright en modo interactivo |

Antes de la primera corrida E2E: `npx playwright install chromium`.

---

## 3. Estructura del repositorio

```
.
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                  # PR a develop/main: lint → build → unitarias con cobertura
│   │   └── e2e-nocturno.yml        # Corrida nocturna: Playwright + axe-core
│   ├── dependabot.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/
│   ├── arquitectura.md             # Cómo este cliente respeta los modelos de arquitectura
│   ├── pantallas.md                # Trazabilidad Figma ↔ carpeta ↔ ruta ↔ HU ↔ rol ↔ microservicio
│   └── flujo-de-trabajo.md         # Ramas, commits, pull requests y Definition of Done
├── e2e/                            # Pruebas extremo a extremo (Playwright)
│   ├── flujos/
│   │   ├── cotizacion-emision/     # Flujo crítico 1 (OBJ 06)
│   │   ├── siniestros/             # Flujo crítico 2
│   │   └── socios-b2b/             # Flujo crítico 3
│   ├── paginas/                    # Page objects
│   ├── fixtures/                   # Usuarios de prueba por rol y datos
│   └── accesibilidad/              # Verificación con axe-core (OBJ 13)
├── public/
│   ├── favicon.ico
│   └── i18n/                       # Diccionarios Transloco: es-CO (predeterminado) y en-US
├── src/
│   ├── app/
│   │   ├── core/                   # Singletons: auth (Cognito), api (un cliente por microservicio), i18n, navegación, errores
│   │   ├── shared/                 # Sistema de diseño (ui), pipes, directivas, modelos y utilidades reutilizables
│   │   ├── layout/                 # Shells de navegación: portal (barra superior + lateral por rol) y canal embebido
│   │   ├── features/               # Un dominio por microservicio de negocio
│   │   │   ├── acceso/             # P0 inicio de sesión, sesión expirada, no autorizado
│   │   │   ├── inicio/             # Inicio por rol (A0, S0, O0)
│   │   │   ├── embebido/           # Canal embebido E1–E7 (camino crítico de cotización)
│   │   │   ├── originacion/        # Épica web 1 → Servicio de originación
│   │   │   ├── siniestros/         # Épica web 2 → Servicio de siniestros
│   │   │   ├── socios/             # Épica web 3 → Servicio de socios B2B
│   │   │   ├── auditoria/          # Épica web 4 → Servicio de auditoría y consentimientos
│   │   │   └── perfil/             # A10 Mi perfil
│   │   ├── app.config.ts           # Proveedores globales (router, HTTP, i18n, auth)
│   │   ├── app.routes.ts           # Rutas raíz: carga perezosa de cada dominio
│   │   └── app.ts                  # Componente raíz
│   ├── environments/               # local · staging · producción (demo)
│   ├── styles/                     # Tokens del sistema de diseño y estilos globales
│   ├── testing/                    # Utilidades compartidas de pruebas unitarias
│   ├── index.html
│   ├── main.ts
│   └── styles.scss
├── angular.json · package.json · tsconfig*.json · eslint.config.js · playwright.config.ts
└── .nvmrc · .editorconfig · .prettierrc · .gitignore
```

Cada carpeta principal tiene un `README.md` que explica qué va en ella y cómo se nombra. Las carpetas vacías llevan un `.gitkeep` hasta que entre el primer archivo.

---

## 4. Tomé una historia de usuario: ¿a qué carpeta voy?

1. Abre [`docs/pantallas.md`](docs/pantallas.md) y busca el ID de la historia (`HU-W2.2-01`, `HA-S01`, …). La tabla indica la **carpeta**, la **ruta** propuesta, el **rol** que la usa, el **frame de Figma** exacto y el **sprint**.
2. Crea la rama desde `develop` con el mismo nombre que tiene (o tendrá) en el backend: `feature/<ID>-<descripcion-corta-en-ingles>`, p. ej. `feature/HA-S01-role-based-auth`.
3. Trabaja dentro de `src/app/features/<dominio>/<subcarpeta>/`. El `README.md` del dominio lista sus pantallas y sus historias.
4. Las llamadas HTTP salen siempre por el cliente del microservicio en `src/app/core/api/<servicio>/`. Si la historia necesita un componente visual reutilizable (botón, insignia, tabla…), va en `src/app/shared/ui/`.
5. Los textos van en `public/i18n/es-CO.json` y `en-US.json`; los estilos usan los tokens de `src/styles/`.
6. Antes del *pull request*: `npm run lint`, `npm run build` y `npm test -- --coverage` en verde, con cobertura ≥ 70 % en lo que tocaste.

Correspondencia dominio ↔ microservicio ↔ épica:

| Carpeta en `features/` | Microservicio (modelo de componentes) | Épica | Roles |
|---|---|---|---|
| `embebido/`, `originacion/` | Servicio de originación (orquestador de cotización, perfilamiento, motor de rating) | Web 1 · Originación y ciclo de vida | Socio embebido, asesor, asegurado, operaciones |
| `siniestros/` | Servicio de siniestros | Web 2 · Siniestros | Asegurado, asesor, operaciones |
| `socios/` | Servicio de gestión de socios B2B | Web 3 · Gestión B2B | Operaciones, socio comercial |
| `auditoria/` | Servicio de auditoría y consentimientos | Web 4 · Analítica, cumplimiento y trazabilidad | Operaciones |
| `acceso/`, `inicio/`, `perfil/` | Amazon Cognito (HA-S01) + agregación por rol | Transversal | Todos |

El servicio de notificaciones no se consume desde el cliente web: sus eventos llegan por *push* a la app móvil.

---

## 5. Convenciones

| Elemento | Convención | Ejemplo |
|---|---|---|
| Archivos y carpetas | `kebab-case`, en español, sin tildes | `cola-triage.page.ts` |
| Página (componente enrutado) | sufijo `.page.ts`, clase `…Page`, selector `app-…-page` | `ColaTriagePage` |
| Componente no enrutado | sufijo `.component.ts`, clase `…Component` | `InsigniaEstadoComponent` |
| Servicio | sufijo `.service.ts`, clase `…Service` | `SiniestrosService` |
| Rutas de un dominio | `<dominio>.routes.ts` en la raíz del dominio, exportando `<DOMINIO>_ROUTES` | `SINIESTROS_ROUTES` |
| Prueba unitaria | mismo nombre con `.spec.ts`, junto al archivo | `cola-triage.page.spec.ts` |
| Prueba E2E | `<flujo>.spec.ts` dentro de `e2e/flujos/<flujo>/` | `radicacion-siniestro.spec.ts` |
| Claves i18n | `<dominio>.<pantalla>.<texto>` en camelCase | `siniestros.colaTriage.titulo` |
| Rutas (URL) | `/<dominio>/<recurso>`, con el rol restringido por *guard*, no por la URL | `/siniestros/cola` |
| Ramas | `feature/<ID>-<descripcion-corta-en-ingles>`, creada desde `develop`; el mismo nombre en los tres repositorios | `feature/HA-S01-role-based-auth`, `feature/HA-L01-parallel-quoting` |
| Commits | Conventional Commits con el dominio como alcance | `feat(siniestros): cola por prioridad` |

Reglas de dependencia entre capas del código: `features` → `shared` y `core`; `layout` → `shared` y `core`; `shared` no depende de nadie; `core` solo lo importa `app.config.ts`. Un dominio nunca importa a otro dominio: lo que comparten va a `shared`.

Toda pantalla implementa los **estados** que define el prototipo (vacío, sin resultados, error, degradado, confirmación) dentro del mismo componente; las variantes `b`, `c`, `d` de Figma no son rutas distintas.

---

## 6. Ambientes

Definidos en [frameworks y ambientes](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/frameworks#d-ambiente-cloud-para-backend--herramientas-para-test):

| Ambiente | Archivo de configuración | Uso |
|---|---|---|
| Local | `src/environments/environment.development.ts` | Desarrollo diario contra el Docker Compose del backend (PostgreSQL, Redis, LocalStack, stubs) |
| Test / CI | — (sin despliegue) | Lint, build y unitarias en cada *pull request*; E2E nocturnas |
| Staging | `src/environments/environment.staging.ts` | Experimentos de arquitectura; se enciende solo en su ventana |
| Producción (demo) | `src/environments/environment.ts` | Entrega evaluable, desplegada por CI/CD |

Los valores marcados `PENDIENTE` (URL del API Gateway, user pool y cliente de Cognito) se completan cuando el repositorio de infraestructura los publique.

---

## 7. Pruebas

Según la [estrategia de pruebas v1.2](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Estrategia-de-Pruebas-v-1.2):

| Nivel | Herramienta | Dónde | Cuándo corre |
|---|---|---|---|
| Unitarias y de componente (OBJ 02, ≥ 70 %) | Vitest + Testing Library | `*.spec.ts` junto al código | Cada *pull request* |
| Extremo a extremo (OBJ 06): cotización y emisión, radicación y seguimiento de siniestro, incorporación de socio B2B; mínimo tres escenarios por flujo | Playwright | `e2e/flujos/` | Corrida nocturna y bajo demanda |
| Accesibilidad (OBJ 13) | axe-core sobre Playwright | `e2e/accesibilidad/` | Con las E2E |
| Internacionalización (OBJ 12) | Revisión de `public/i18n/` y casos manuales | — | Por sprint |
| Usabilidad (OBJ 11) | Sesión moderada | — | Una por sprint |

Regla de integración: ningún cambio entra a `develop` ni a `main` con pruebas fallidas.

---

## 8. Referencias

- [Wiki del proyecto](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki)
- [Modelos de arquitectura y patrones (componentes, despliegue, concurrencia, información)](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Arquitectura_final)
- [Decisiones de arquitectura](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Recopilaci%C3%B3n-Decisiones-de-Arquitectura)
- [Definición de frameworks y ambientes](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/frameworks)
- [Estrategia de pruebas v1.2](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Estrategia-de-Pruebas-v-1.2)
- [Sistema de diseño](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Sistema-de-Dise%C3%B1o_Solventa) y [prototipo en Figma](https://www.figma.com/design/ZBPl5l9oXTPlfiOHrzCM2M/Solventa-%25E2%2580%2594-Prototipo-S7-%25E2%2580%2594-Pantallas)
- [Refinamiento de historias · Sprint 1](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Refinamiento-HUs-y-HAs) · [Sprints 2 y 3](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Refinamiento-HUs-y-HAs-Sprint-2-y-3)
- [Plan de trabajo por sprints](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Plan-de-trabajo-por-sprints)
- [Documentación técnica del prototipo](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Documentaci%C3%B3n-T%C3%A9cnica-prototipo)

## Equipo

| Nombre | GitHub |
|---|---|
| Carlos A. Ríos P. | CarlosARios |
| Cristhian S. Contreras B. | criscont17 |
| Leonel A. Parrales M. | leonelparrales22 |
| Maycol S. A. Niño | maycolan |
| Nicolás J. Jaramillo C. | nicolasjaramillocely99 |
