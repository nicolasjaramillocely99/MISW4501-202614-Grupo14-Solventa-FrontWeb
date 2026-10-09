# Flujo de trabajo del repositorio

## Ramas

| Rama | Para qué | Cómo recibe cambios |
|---|---|---|
| `main` | Lo que está desplegado en producción (demo). Protegida. | Solo desde `develop`, por *pull request*, en cada entrega |
| `develop` | Integración del sprint. Protegida. | Solo desde ramas de historia, por *pull request* |
| `<ID de la historia>` | El trabajo de una historia: `HU-W2.2-01`, `HA-S01` | Quien tomó la historia |

Reglas:

- Toda rama de trabajo se crea **desde `develop`** y vuelve a `develop` por *pull request*. Nunca desde `main`.
- El nombre de la rama es **únicamente el ID de la historia**, sin prefijos ni nombre corto: con más de cincuenta historias, el título sobra. El ID se toma del [plan por sprints](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Plan-de-trabajo-por-sprints) y la carpeta destino de [`pantallas.md`](pantallas.md).
- Nadie hace *push* directo a `develop` ni a `main`.

```bash
git switch develop
git pull
git switch -c HU-W2.2-01
```

## Commits

Conventional Commits con el dominio como alcance: `feat(siniestros): cola de siniestros por prioridad`, `fix(originacion): …`, `test(socios): …`, `docs: …`, `chore: …`. Mensajes en español, en infinitivo o sustantivo, sin punto final.

## Pull requests

1. Actualiza la rama con `develop` antes de abrirlo.
2. El *pull request* apunta a `develop`. Completa la plantilla (`.github/PULL_REQUEST_TEMPLATE.md`): historia, pantallas de Figma, cómo probarlo.
3. Revisión de al menos un compañero.
4. Pipeline `CI · Cliente web` en verde: lint, build de producción y pruebas unitarias con cobertura ≥ 70 %.
5. *Squash and merge* a `develop`; la rama de la historia se borra al integrar.
6. Al cierre de cada sprint o entrega, `develop` se integra a `main` por *pull request*; eso es lo que se despliega a producción (demo).

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
| `ci.yml` | *pull request* hacia `develop` o `main`, y *push* a esas ramas | ESLint → build de producción → Vitest con cobertura |
| `e2e-nocturno.yml` | Diario sobre `develop`, y bajo demanda sobre cualquier rama | Playwright (tres flujos críticos) + axe-core; reporte como artefacto |
| Dependabot | Semanal | Actualizaciones de npm y de las acciones de GitHub |
