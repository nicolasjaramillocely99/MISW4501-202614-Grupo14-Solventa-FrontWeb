# Cómo este repositorio respeta la arquitectura de Solventa

Resumen de lo que los [modelos de arquitectura](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Arquitectura_final) y las [decisiones registradas](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Recopilaci%C3%B3n-Decisiones-de-Arquitectura) fijan para el cliente web, y cómo se materializa en la estructura del código.

## 1. Lugar del cliente web en el modelo de componentes

| Elemento del modelo | Valor | En este repositorio |
|---|---|---|
| Capa | **LAYER 4 · Clientes** (`Cliente web (Angular)`) | Toda la aplicación |
| Conector de salida | `Cliente web → API Gateway`: «solicitudes del portal» (operación de negocio, siniestros, gestión B2B y analítica) | `src/app/core/api/` — único punto de salida HTTP |
| Capa que puede usar | Solo **LAYER 3 · Gateway** (API Gateway «Facade»). Cada capa usa la inmediatamente inferior y nunca al revés | Ningún código conoce direcciones de microservicios, bases de datos, Redis ni SNS/SQS |
| Servicios detrás del gateway que el portal consume | Originación (cotización, emisión, cobro) · Siniestros (radicación y consulta) · Socios B2B (gestión de socios) · Auditoría (consulta de trazabilidad) | Un cliente por servicio en `core/api/` y un dominio por servicio en `features/` |
| Servicio que **no** consume | Notificaciones (sus eventos llegan por *push* a la app móvil) | Sin cliente ni dominio |

## 2. Lugar del cliente web en el modelo de despliegue

| Elemento | Valor | Consecuencia en el código |
|---|---|---|
| Nodo de ejecución | «executionEnvironment» Navegador web en el «device» PC del usuario; una instancia por sesión | Aplicación de una sola página; sin SSR |
| Acceso de clientes | HTTPS/TLS → Amazon API Gateway (tipo REST) | `apiGatewayUrl` en `src/environments/` |
| Identidad (HA-S01) | HTTPS/TLS (OIDC) → Amazon Cognito User Pool; un *user pool* con grupos por rol; el *authorizer* del gateway valida el JWT sin salto de red | `core/auth/` emite y refresca tokens solo al iniciar sesión; el JWT viaja en cada petición (`core/auth/interceptores/`) |
| Roles humanos | asegurado · asesor comercial · analista de operaciones · socio comercial | Tipo `Rol` en `core/auth/`, *guards* por ruta, menú por rol en `core/navegacion/` |
| Socios embebidos | Autentican con API keys y *usage plans* del gateway, **no** con Cognito | El canal embebido (`features/embebido/`) es público para el usuario final; la credencial del socio la maneja el sitio del aliado |
| Timeout de integración del gateway | 5 s en las rutas de cotización (ADR-02) | Las pantallas de cotización muestran estado de carga y degradación antes de ese límite |

## 3. Atributos de calidad que el cliente web debe evidenciar

| Historia de arquitectura | Qué muestra el portal | Dónde |
|---|---|---|
| HA-L01 · Cotización embebida rápida | Cálculo del perfil con el estado de cada fuente y su tiempo | `features/embebido/` (E2) |
| HA-D01 · Oferta continua ante caída de la fuente externa | Oferta **provisional** con perfil en caché o perfil base, fecha del perfil y condiciones de recotización | `features/embebido/` (E3b, E3c) · `features/originacion/cotizacion-asistida/` (S2b) |
| HA-D02 · Cobro sin pérdida ante caída de la pasarela | Pago pendiente con reintentos; monitoreo de emisiones y excepciones | `features/embebido/` (E4b) · `features/originacion/emisiones/` (O1) |
| HA-S01 · Autenticación y autorización por roles | 401 → sesión expirada; 403 → no autorizado; menús e inicios propios por rol | `core/auth/`, `features/acceso/`, `layout/portal/` |
| RN-02 · Revocación efectiva ≤ 5 min | Revocación desde el portal de cumplimiento con reintento | `features/auditoria/consentimientos/` (O15) |
| OBJ 12 · Internacionalización | Español e inglés en caliente; moneda, fecha y número con `Intl` | `core/i18n/`, `public/i18n/` |
| OBJ 13 · Accesibilidad | Contraste AA/AAA, foco visible, estados no solo por color | `src/styles/`, `shared/ui/`, `e2e/accesibilidad/` |

## 4. Estilos arquitectónicos y su reflejo en el front

| Estilo (wiki) | Reflejo aquí |
|---|---|
| **Layer-N** | `features` → `shared`/`core` → API Gateway. Nunca al revés |
| **Microservicios acotados** | Un dominio por servicio, cargado como *chunk* perezoso independiente; cambiar un dominio no recompila a los demás |
| **Publicador/suscriptor** | No aplica al cliente web: no consume eventos; el estado se consulta por API |
| **API Gateway «Facade»** | Un solo origen (`apiGatewayUrl`); los prefijos por servicio se concentran en `core/api/` |

## 5. Ambientes

Los cuatro ambientes de [frameworks y ambientes](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/frameworks): local (Docker Compose del backend), test/CI (efímero por *pull request*), staging (experimentos, encendido por ventana) y producción demo (CI/CD). En este repositorio se corresponden con `environment.development.ts`, el pipeline de `.github/workflows/`, `environment.staging.ts` y `environment.ts`.
