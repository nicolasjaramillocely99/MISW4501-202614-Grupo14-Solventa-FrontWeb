# `src/app/core` — servicios transversales (singletons)

Todo lo que existe una sola vez en la aplicación y no tiene interfaz visual. Se registra en `app.config.ts` y lo consumen `features` y `layout`. `core` no importa de `features`.

| Carpeta | Responsabilidad | Vínculo con la arquitectura |
|---|---|---|
| `auth/` | Sesión del usuario, proveedor de identidad (Amazon Cognito User Pool, OIDC), modelo de roles. **HA-S01:** `sesion.service.ts` (`SesionService`: señales `sesion`, `usuario`, `rol`, `autenticado` y `expirada`; tokens en memoria y token de renovación en `sessionStorage`; renovación un minuto antes del vencimiento; `RevokeToken` al cerrar sesión), `proveedor-identidad.ts` (puerto `ProveedorIdentidad` y `ErrorIdentidad`), `cognito-proveedor-identidad.service.ts` (API JSON de Cognito: `InitiateAuth` con `USER_PASSWORD_AUTH` y `REFRESH_TOKEN_AUTH`, y `RevokeToken`; endpoint regional de AWS salvo que el ambiente defina `cognito.endpoint`, como el local con el emulador Moto; se enlaza al puerto en `app.config.ts`), `decodificar-jwt.ts` (lee claims sin verificar la firma) y `modelos/{rol,sesion}.ts` (grupos `insured`, `advisor`, `operations` y `partner` → roles) | HA-S01 · EC-S03. Los cuatro roles humanos: asegurado, asesor comercial, analista de operaciones, socio comercial |
| `auth/guards/` | `autenticacion.guard.ts` (recupera la sesión con el token de renovación; sin sesión → `/acceso/iniciar-sesion?returnUrl=…`; sesión vencida sin renovación → `/acceso/sesion-expirada`) y `rol.guard.ts` (`rolGuard(...roles)`; rol insuficiente → `/acceso/no-autorizado`) | 401 / 403 definidos en HA-S01 |
| `auth/interceptores/` | `autenticacion.interceptor.ts`: adjunta el ID token (`Authorization: Bearer`) **solo** a las peticiones a `apiGatewayUrl`; ante 401 expira la sesión y lleva a `/acceso/sesion-expirada`; ante 403 lleva a `/acceso/no-autorizado` | El *authorizer* de Cognito valida el token en el gateway |
| `api/` | Cliente HTTP base (URL del API Gateway desde `environments/`) y **un cliente por microservicio** | Conector «solicitudes del portal» → API Gateway «Facade» |
| `api/originacion/` | Cotización, emisión, cobro, endosos, renovación, cancelación | Servicio de originación |
| `api/siniestros/` | Radicación, consulta, triage, evaluación, asistencias | Servicio de siniestros |
| `api/socios/` | Alta de socios, credenciales, tablero de desempeño | Servicio de gestión de socios B2B |
| `api/auditoria/` | Consulta de trazabilidad y consentimientos | Servicio de auditoría y consentimientos |
| `i18n/` | Configuración de Transloco (carga de `public/i18n/*.json`), idioma activo y formateo de moneda, fecha y número con la API `Intl`. **HA-S01:** `transloco.config.ts` (`proveerI18n`: `es-CO` predeterminado, `en-US` alterno y respaldo en `es-CO`; al arrancar restaura el idioma elegido), `cargador-traducciones.ts` e `idioma.service.ts` (`IdiomaService`: idioma activo, cambio en caliente, atributo `lang` del documento y preferencia en `localStorage`, que se conserva al pasar de P0 al portal) | OBJ 12 · soporte multimoneda (COP, MXN, CLP, PEN) |
| `navegacion/` | Menú de la barra lateral por rol y ruta de inicio de cada rol. **HA-S01:** `menu-por-rol.ts` (`MENU_POR_ROL`, `RUTA_INICIO_POR_ROL` e `itemActivo`) | Barra lateral «los ítems cambian según el rol» |
| `errores/` | `ErrorHandler` global, identificador de correlación en las peticiones y manejo uniforme de errores HTTP | Observabilidad con trazas correlacionadas |

Interceptores sugeridos (en este orden): correlación → autenticación → errores HTTP.

El servicio de notificaciones **no** tiene cliente aquí: el cliente web no lo consume (sus eventos llegan por *push* a la app móvil).
