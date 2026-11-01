# Flujo de trabajo del repositorio

## Ramas

| Rama | Para qué | Cómo recibe cambios |
|---|---|---|
| `main` | Lo que está desplegado en producción (demo): se publica desde `main` (ver «Corridas automáticas»). Protegida. | Solo desde `develop`, por *pull request*, en cada entrega |
| `develop` | Integración del sprint y **rama por defecto del repositorio** (la que GitHub muestra al abrir el repo y la base preseleccionada de un *pull request* nuevo). Protegida. | Solo desde ramas de historia, por *pull request* |
| `feature/<ID>-<descripcion-en-ingles>` | El trabajo de una historia: `feature/HA-S01-role-based-auth`, `feature/HA-L01-parallel-quoting` | Quien tomó la historia |
| `fix/<ID>-<descripcion>` · `chore/<descripcion>` | Una corrección o una tarea técnica sin historia | Quien la toma |

Reglas:

- Toda rama de trabajo se crea **desde `develop`** y vuelve a `develop` por *pull request*. Nunca desde `main`.
- El nombre de la rama es **el mismo en los tres repositorios** (backend, cliente web y móvil) y sigue la convención del [`AGENTS.md` del backend](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/blob/develop/AGENTS.md): `feature/<ID>-<descripcion-corta-en-ingles>`. Así una historia que toca varios repositorios se reconoce igual en todos (p. ej. `feature/HA-S01-role-based-auth` en el backend y aquí). Si la rama ya existe en otro repositorio, se usa exactamente el mismo nombre. El ID se toma del [plan por sprints](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Plan-de-trabajo-por-sprints) y la carpeta destino de [`pantallas.md`](pantallas.md).
- Nadie hace *push* directo a `develop` ni a `main`.

```bash
git switch develop
git pull
git switch -c feature/HA-S01-role-based-auth
```

## Commits

Conventional Commits con el dominio como alcance: `feat(siniestros): cola de siniestros por prioridad`, `fix(originacion): …`, `test(socios): …`, `docs: …`, `chore: …`. Mensajes en español, en infinitivo o sustantivo, sin punto final.

## Pull requests

1. Actualiza la rama con `develop` antes de abrirlo.
2. El *pull request* apunta a `develop`. Completa la plantilla (`.github/PULL_REQUEST_TEMPLATE.md`): historia, pantallas de Figma, cómo probarlo.
3. Revisión de al menos un compañero.
4. Pipeline `CI · Cliente web` en verde: lint, build de producción y pruebas unitarias con cobertura ≥ 70 % (job «Lint · Build · Unitarias») y todas las pruebas E2E con axe-core (job «E2E · Playwright + axe»); los dos son checks obligatorios de `develop` y de `main`.
5. *Squash and merge* a `develop`; la rama de la historia se borra al integrar.
6. Al cierre de cada sprint o entrega, `develop` se integra a `main` por *pull request*; eso es lo que se despliega a producción (demo). Ese despliegue lo hace, al encender el ambiente, `scripts/environment/up.sh production-demo` del backend con `scripts/publicar-portal.sh` (T5); `cd-portal.yml` no publica producción: al integrar `main` publica en staging.

## Definition of Done de una historia (cliente web)

- [ ] Pantalla construida según el frame de Figma enlazado en `docs/pantallas.md`, incluidos sus estados (vacío, error, degradado, confirmación).
- [ ] Textos en `es-CO.json` y `en-US.json`; formatos de moneda, fecha y número con `Intl`.
- [ ] Llamadas HTTP solo por el cliente del microservicio en `core/api/`.
- [ ] Rol restringido por *guard* en la ruta.
- [ ] Pruebas unitarias de la página, componentes y servicios; cobertura ≥ 70 % en lo nuevo.
- [ ] Sin violaciones de axe-core en la pantalla (si el flujo tiene E2E, la verificación está en la prueba).
- [ ] `npm run lint`, `npm run build` y `npm test` en verde.
- [ ] Fila de `docs/pantallas.md` actualizada si cambió la ruta o la carpeta.

## Corridas automáticas

| Workflow | Disparo | Qué corre |
|---|---|---|
| `ci.yml` | *pull request* hacia `develop` o `main`, y *push* a esas ramas | Dos jobs en paralelo: «Lint · Build · Unitarias» (ESLint → build de producción → Vitest con cobertura) y «E2E · Playwright + axe» (Playwright + axe-core contra el servidor local; reporte como artefacto) |
| `e2e-nocturno.yml` | Diario sobre `develop` a las 01:23 de Bogotá (GitHub puede retrasarlo), y bajo demanda sobre cualquier rama | Tres jobs en paralelo: lint, build y unitarias con cobertura; Playwright + axe-core; `npm audit` (falla con vulnerabilidades altas o críticas) |
| `cd-portal.yml` | *Push* a `main` (automático, al integrar) y bajo demanda desde `develop` o `main` (*Actions* → *Run workflow*, o `gh workflow run cd-portal.yml --ref develop -f ambiente=staging`, que es lo que hace `scripts/environment/up.sh staging` del backend) | Publica el portal en **staging**, igual que `backend-cd`: asume el rol OIDC `solventa-github-actions-web-stg` (sin llaves en GitHub) → build de producción → `scripts/publicar-portal.sh staging` (S3 + invalidación de CloudFront). Conserva el `config.json` que escribe Terraform. Si staging está apagado (el rol no existe) avisa y termina en verde sin compilar. No publica production-demo |
| Dependabot | Semanal, contra `develop` | Actualizaciones de versión de npm y de las acciones de GitHub, y actualizaciones de seguridad. Las alertas de vulnerabilidades se ven en la pestaña *Security* |

GitHub lee los workflows programados y la configuración de Dependabot de la rama por defecto (`develop`): un cambio en `e2e-nocturno.yml` o en `dependabot.yml` rige al integrarse en `develop`. Para probar el nocturno antes, se lanza a mano sobre la rama (*Actions* → *Run workflow*). Lo mismo vale para `cd-portal.yml`: el despacho (`workflow_dispatch`) solo existe cuando el archivo está en `develop`.
