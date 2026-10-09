# `src/app/features` — dominios de negocio

Un dominio = un microservicio del [modelo de componentes](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Arquitectura_final#modelo-de-componentes). Cada dominio se carga de forma perezosa desde `app.routes.ts` como un *chunk* independiente, de modo que la organización del código refleja la de los servicios.

| Dominio | Microservicio que lo respalda | Épica | README |
|---|---|---|---|
| `acceso/` | Amazon Cognito (HA-S01) | Transversal | [ver](acceso/README.md) |
| `inicio/` | Agregación por rol | Transversal | [ver](inicio/README.md) |
| `embebido/` | Servicio de originación (camino crítico) | Web 1 | [ver](embebido/README.md) |
| `originacion/` | Servicio de originación | Web 1 | [ver](originacion/README.md) |
| `siniestros/` | Servicio de siniestros | Web 2 | [ver](siniestros/README.md) |
| `socios/` | Servicio de gestión de socios B2B | Web 3 | [ver](socios/README.md) |
| `auditoria/` | Servicio de auditoría y consentimientos | Web 4 | [ver](auditoria/README.md) |
| `perfil/` | Amazon Cognito | Transversal | [ver](perfil/README.md) |

## Estructura dentro de un dominio

```
features/siniestros/
├── README.md                       # Pantallas, historias, roles y rutas del dominio
├── siniestros.routes.ts            # SINIESTROS_ROUTES: rutas del dominio con sus guards de rol
├── radicacion/                     # Una subcarpeta por feature (F2.1, F2.2, …)
│   ├── radicar-siniestro.page.ts   # Componente enrutado (una pantalla del prototipo)
│   ├── radicar-siniestro.page.spec.ts
│   ├── componentes/                # Componentes propios de estas pantallas
│   ├── servicios/                  # Servicios de datos del feature (usan core/api)
│   └── modelos/                    # Tipos e interfaces del feature
├── triage/
└── …
```

- La **página** es el componente que se asocia a una ruta; una página por pantalla base del prototipo. Los estados (`b`, `c`, `d` en Figma) viven dentro de la misma página.
- Los **componentes** de un feature solo se usan dentro de ese feature. Si otro dominio lo necesita, se promueve a `src/app/shared/ui/`.
- Los **servicios** del feature orquestan datos para sus pantallas y llaman únicamente al cliente del microservicio correspondiente en `src/app/core/api/`.
- Las rutas se declaran en `<dominio>.routes.ts` y se registran una sola vez en `app.routes.ts` con `loadChildren`.
- El rol se restringe con un *guard* en la ruta; la URL no lleva el rol.

## Reglas de dependencia

- `features` puede importar de `shared` y `core`.
- Un dominio **nunca** importa a otro dominio.
- Ningún dominio llama a HTTP directamente ni a otro microservicio: siempre a través de `core/api`.

## Nombres

| Qué | Archivo | Clase | Selector |
|---|---|---|---|
| Página | `cola-triage.page.ts` | `ColaTriagePage` | `app-cola-triage-page` |
| Componente | `fila-siniestro.component.ts` | `FilaSiniestroComponent` | `app-fila-siniestro` |
| Servicio | `siniestros.service.ts` | `SiniestrosService` | — |
| Modelo | `siniestro.ts` | `Siniestro` (interfaz) | — |

La trazabilidad completa de pantallas está en [`docs/pantallas.md`](../../../docs/pantallas.md).
