# `src/app/core` — servicios transversales (singletons)

Todo lo que existe una sola vez en la aplicación y no tiene interfaz visual. Se registra en `app.config.ts` y lo consumen `features` y `layout`. `core` no importa de `features`.

| Carpeta | Responsabilidad | Vínculo con la arquitectura |
|---|---|---|
| `auth/` | Sesión del usuario, proveedor de identidad (Amazon Cognito User Pool, OIDC), modelo de roles | HA-S01 · EC-S03. Los cuatro roles humanos: asegurado, asesor comercial, analista de operaciones, socio comercial |
| `auth/guards/` | `autenticacion.guard.ts` (sin sesión → `/acceso/iniciar-sesion`) y `rol.guard.ts` (rol insuficiente → `/acceso/no-autorizado`) | 401 / 403 definidos en HA-S01 |
| `auth/interceptores/` | Adjunta el JWT (`Authorization: Bearer`) a las peticiones al API Gateway; ante 401 cierra la sesión | El *authorizer* de Cognito valida el token en el gateway |
| `api/` | Cliente HTTP base (URL del API Gateway desde `environments/`) y **un cliente por microservicio** | Conector «solicitudes del portal» → API Gateway «Facade» |
| `api/originacion/` | Cotización, emisión, cobro, endosos, renovación, cancelación | Servicio de originación |
| `api/siniestros/` | Radicación, consulta, triage, evaluación, asistencias | Servicio de siniestros |
| `api/socios/` | Alta de socios, credenciales, tablero de desempeño | Servicio de gestión de socios B2B |
| `api/auditoria/` | Consulta de trazabilidad y consentimientos | Servicio de auditoría y consentimientos |
| `i18n/` | Configuración de Transloco (carga de `public/i18n/*.json`), idioma activo y formateo de moneda, fecha y número con la API `Intl` | OBJ 12 · soporte multimoneda (COP, MXN, CLP, PEN) |
| `navegacion/` | Menú de la barra lateral por rol y ruta de inicio de cada rol | Barra lateral «los ítems cambian según el rol» |
| `errores/` | `ErrorHandler` global, identificador de correlación en las peticiones y manejo uniforme de errores HTTP | Observabilidad con trazas correlacionadas |

Interceptores sugeridos (en este orden): correlación → autenticación → errores HTTP.

El servicio de notificaciones **no** tiene cliente aquí: el cliente web no lo consume (sus eventos llegan por *push* a la app móvil).
