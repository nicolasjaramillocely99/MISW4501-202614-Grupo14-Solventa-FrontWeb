# Guía para agentes de IA — Solventa Cliente Web

Reglas operativas, de arquitectura y de calidad que **todo agente de IA** (Claude Code, OpenAI Codex, Gemini CLI, Cursor, Copilot, Windsurf, etc.) debe seguir al trabajar en este repositorio. Es la réplica, adaptada a Angular, del `AGENTS.md` del repositorio backend (`MISW4501-202614-Grupo14-Solventa`); conserva su numeración para que las dos guías se lean igual.

---

## 1. Contexto del proyecto y arquitectura

Solventa es una plataforma insurtech digital basada en Finanzas Abiertas. Este repositorio es el **cliente web** (portal de operación, siniestros, gestión B2B y cumplimiento, más la demo del canal embebido), construido en **Angular 22** (componentes *standalone*, Signals, sin Zone.js) con **TypeScript**, SCSS y Transloco.

En el [modelo de componentes](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Arquitectura_final#modelo-de-componentes) el cliente vive en la **capa 4 · Clientes** y solo habla con la **capa 3 · Gateway** (Amazon API Gateway) por HTTPS; la identidad la emite **Amazon Cognito** (OIDC, HA-S01). Nunca accede a un microservicio, a una base de datos ni a la mensajería directamente. La documentación de diseño vive en la Wiki; este repositorio documenta lo que cambia junto con el código. **Lee el `README.md` del dominio antes de modificarlo.**

### Capas del código (`src/app/`)
- `core/`: singletons sin interfaz: `auth/` (sesión Cognito, roles, *guards*, interceptores), `api/` (cliente HTTP base y **un cliente por microservicio**: `originacion`, `siniestros`, `socios`, `auditoria`), `i18n/`, `navegacion/`, `errores/`.
- `shared/`: reutilizable sin estado de negocio: `ui/` (sistema de diseño), `pipes/`, `directivas/`, `modelos/`, `utilidades/`.
- `layout/`: *shells* de navegación: `portal/` (barra superior + lateral por rol) y `embebido/` (barra del aliado + indicador de pasos).
- `features/`: **un dominio por microservicio**, cargado de forma perezosa: `acceso`, `inicio`, `embebido`, `originacion`, `siniestros`, `socios`, `auditoria`, `perfil`.

El servicio de notificaciones **no** se consume desde el cliente web (sus eventos llegan por *push* a la app móvil).

---

## 2. Reglas de arquitectura no negociables

1. **Dependencias entre capas:** `features` → `shared` y `core`; `layout` → `shared` y `core`; `shared` **no depende de nadie**; `core` solo lo importa `app.config.ts`. **Un dominio nunca importa a otro dominio**: lo que comparten se promueve a `shared/`.
2. **Una sola salida HTTP:** toda petición sale por el cliente del microservicio en `src/app/core/api/<servicio>/`. Ningún componente, página o servicio de un dominio usa `HttpClient` directamente ni conoce direcciones de microservicios, bases de datos, Redis ni SNS/SQS. El único origen es `apiGatewayUrl` de `src/environments/`.
3. **Autorización por rol en la ruta:** el rol se restringe con un *guard* (`autenticacion.guard.ts`, `rol.guard.ts`); la URL nunca lleva el rol. 401 → sesión expirada; 403 → no autorizado (HA-S01). El canal embebido es público para el usuario final (el socio autentica con credenciales de API en el gateway, no con Cognito).
4. **Una página por pantalla del prototipo:** los estados (vacío, sin resultados, error, degradado, confirmación; variantes `b`, `c`, `d` de Figma) viven dentro de la misma página, no son rutas distintas.
5. **Sistema de diseño:** los componentes visuales reutilizables viven en `shared/ui/`, usan únicamente los tokens de `src/styles/` y son accesibles por construcción (etiqueta permanente, foco visible, estado no comunicado solo con color, área mínima de clic).
6. **Aplicación de una sola página, sin SSR.**

---

## 3. Convenciones de idioma y estilo

- **Todo en español:** archivos y carpetas en `kebab-case` **sin tildes**, clases y selectores en español (`ColaTriagePage`, `app-cola-triage-page`), comentarios, mensajes de commit, títulos y descripciones de PR, y archivos como este.
- **Sufijos:** página enrutada `.page.ts` (`…Page`, selector `app-…-page`); componente no enrutado `.component.ts` (`…Component`, `app-…`); servicio `.service.ts`; rutas de un dominio en `<dominio>.routes.ts` exportando `<DOMINIO>_ROUTES`; prueba unitaria `.spec.ts` junto al archivo; prueba E2E `<flujo>.spec.ts` en `e2e/flujos/<flujo>/`.
- **Textos de interfaz externalizados:** ningún texto fijo dentro de componentes; claves `<dominio>.<pantalla>.<texto>` en camelCase, en **ambos** diccionarios `public/i18n/es-CO.json` y `en-US.json` (Transloco). Moneda, fecha y número con la API `Intl` (pipes de `shared/pipes/`), con soporte multimoneda.
- **Manejo de errores y seguridad:**
  - Los errores HTTP se manejan de forma uniforme en `core/errores/` (`ErrorHandler` global + interceptor); las páginas muestran el estado de error del prototipo, no `alert` ni `console.log`.
  - Sin `console.log` en código de producción; sin `any` salvo justificación en comentario.
  - Nunca se escriben credenciales, tokens ni secretos en el código ni en `src/environments/` (allí solo van URL públicas e identificadores de cliente de Cognito). El JWT se adjunta únicamente desde `core/auth/interceptores/`.
- **Accesibilidad:** contraste AA/AAA, foco visible, etiquetas en todos los elementos interactivos, navegación por teclado; sin violaciones de axe-core en la pantalla.

---

## 4. Contratos (API y pantallas)

1. **Contratos de API:** los clientes de `core/api/<servicio>/` se tipan según el `openapi.yaml` de cada microservicio del backend. Un cambio de contrato se coordina con el backend por PR; la web, la app móvil y los socios no deben romperse a la vez (versionado de API, riesgo R10).
2. **Contrato de pantallas:** cada página implementa el frame de Figma enlazado en `docs/pantallas.md`, incluidos sus estados. Si cambia la ruta o la carpeta de una pantalla, se actualiza su fila en `docs/pantallas.md`.
3. **Internacionalización:** toda clave nueva existe en `es-CO.json` y `en-US.json`; las pruebas unitarias cargan los diccionarios desde `src/testing/`.

---

## 5. Definición de Terminado (DoD)

Antes de dar por terminada cualquier tarea, el agente **DEBE ejecutar y verificar localmente** (con las dependencias instaladas con `npm ci`, nunca `npm install` para instalar el proyecto):

```bash
# 1. Análisis estático (debe terminar sin errores)
npm run lint

# 2. Compilación de producción
npm run build -- --configuration production

# 3. Pruebas unitarias con reporte de cobertura (cobertura ≥ 70 % en lo nuevo)
npm test -- --coverage
```

Si el flujo tiene pruebas E2E, también `npx playwright test` (incluye la verificación de accesibilidad con axe-core; la primera vez: `npx playwright install chromium`).

Si algo falla, se corrige antes de terminar. Nunca se reporta como verificado algo que no se ejecutó; se indica qué comandos no se pudieron correr y por qué. Requisitos: Node.js 24 LTS (`.nvmrc`) y npm 11.

---

## 6. Documentación viva (docs como código)

- Si se agrega, renombra o mueve una pantalla, una subcarpeta de *feature* o una ruta, se actualiza el `README.md` del dominio y la fila correspondiente en `docs/pantallas.md`.
- Si se agrega un cliente o singleton en `core/`, o un componente en `shared/ui/`, se actualiza la tabla del `README.md` de esa carpeta.
- **Las decisiones técnicas y de arquitectura las toma el equipo, no el agente.** Pregunta antes de decidir y no crees registros de decisión (ADR) por iniciativa propia. Las decisiones del sistema están en la [Wiki](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Recopilaci%C3%B3n-Decisiones-de-Arquitectura); las de este repositorio se proponen en el PR y se registran donde el equipo defina.
- El flujo de trabajo para personas está en [`docs/flujo-de-trabajo.md`](docs/flujo-de-trabajo.md) y la alineación con la arquitectura en [`docs/arquitectura.md`](docs/arquitectura.md); esta guía no los reemplaza.

---

## 7. Flujo de Git y commits

- **Nunca se hace commit ni push directo a `main` ni a `develop`.**
- Ramas de trabajo, creadas **desde `develop`**:
  - Historia de usuario o de arquitectura: **únicamente el ID**, sin prefijos ni nombre corto: `HU-W2.2-01`, `HA-S01` (con más de cincuenta historias, el título sobra; el ID se toma del [plan por sprints](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Plan-de-trabajo-por-sprints) y la carpeta destino de `docs/pantallas.md`).
  - Corrección: `fix/<ID>-<descripcion-corta>` · Tarea técnica sin historia: `chore/<descripcion-corta>`.
- **Conventional Commits en español**, con el dominio como alcance, en infinitivo o sustantivo, sin punto final:
  - `feat(siniestros): cola de siniestros por prioridad`
  - `fix(originacion): …` · `test(socios): …` · `docs: …` · `chore: …`
  - El cuerpo, con viñetas, explica qué cambia y por qué cuando el cambio lo amerita.
- Al agregar una dependencia: `npm install <paquete>` (o `--save-dev`), `package-lock.json` actualizado y la fila correspondiente en la tabla de stack del `README.md` si cambia la versión instalada.

### 7.1 Pull requests y estrategia de integración

```
<ID> · fix/* · chore/*  ──(PR, squash)──▶  develop  ──(PR, merge commit)──▶  main
```

| De → A | Estrategia | Por qué |
|---|---|---|
| `<ID>`, `fix/*`, `chore/*` → `develop` | **Squash and merge** | Un commit limpio por PR/historia, fácil de revertir; los commits intermedios («wip», «fix») nunca llegan a `develop` |
| `develop` → `main` | **Create a merge commit** (nunca squash ni rebase) | Conserva el historial de `develop` y evita que las dos ramas diverjan en cada entrega |
| Hotfix urgente | Rama desde `main` → PR a `main` con **squash**, y luego el cambio se trae a `develop` | Caso excepcional |

**Reglas**

1. Todo PR de trabajo apunta a **`develop`**. Solo los PR de entrega apuntan a `main`.
2. **Un PR = una historia o tarea.** Pequeño y revisable; no se mezclan dominios salvo que la tarea lo exija.
3. **El título del PR se convierte en el mensaje del commit** tras el squash: sigue Conventional Commits en español e incluye el ID de la historia, p. ej. `feat(acceso): inicio de sesion del portal (HA-S01)`. Los PR de entrega usan `release: <fecha o versión>`.
4. Antes de abrir el PR: ejecutar la Definición de Terminado (sección 5) y actualizar la documentación afectada (sección 6).
5. Mantener la rama al día con `develop` (`git fetch && git rebase origin/develop`). Nunca `push --force` sobre ramas compartidas.
6. Para integrar: pipeline `CI · Cliente web` en verde y al menos una aprobación de otro integrante. Nadie integra su propio PR sin revisión.
7. Tras integrar, **borrar la rama de trabajo**. Nunca borrar `develop` ni `main`.
8. Usar la plantilla de PR de `.github/PULL_REQUEST_TEMPLATE.md` (historia, pantallas de Figma, qué cambia, cómo probarlo, lista de verificación).

**Para agentes de IA:** abrir un PR solo cuando el usuario lo pida; nunca integrarlo ni hacer push directo a `main` o `develop`.

---

## 8. Guardarraíles y antipatrones prohibidos

- **Sin ampliar el alcance:** modifica solo el dominio o la carpeta asignada a tu tarea. No toques otros dominios ni `core/`/`shared/` salvo que la tarea sea explícitamente transversal.
- **Sin simulaciones en producción:** los dobles de prueba viven en `*.spec.ts` y en `src/testing/`; los datos de E2E en `e2e/fixtures/`. Nada de datos quemados ni *mocks* en `features/`, `core/` o `shared/`.
- **Sin HTTP fuera de `core/api/`, sin textos fijos fuera de los diccionarios, sin estilos fuera de los tokens, sin roles en la URL.**
- **Preservar código y contexto:** nunca borres comentarios de negocio, anotaciones ni código existente ajeno a tu cambio.
- **Mantener estas reglas vivas:** si identificas un patrón de error repetido o una alucinación frecuente, agrega la restricción correspondiente a este archivo para que no se repita en el equipo.
