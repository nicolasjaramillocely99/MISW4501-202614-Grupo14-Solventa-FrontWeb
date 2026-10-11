# `src/app/layout` — shells de navegación

Contenedores que envuelven a las páginas de `features` y aportan la navegación común. Se usan desde `app.routes.ts` como rutas padre con `<router-outlet>`.

| Carpeta | Shell | Qué contiene (sistema de diseño §5) |
|---|---|---|
| `portal/` | Portal por rol (asegurado, asesor comercial, operaciones, socio comercial) | **Barra superior** de 64 px: logotipo, nombre del módulo, selector de idioma, avatar con rol. **Barra lateral** de 240 px (72 colapsada) con los ítems de `core/navegacion` según el rol y *Cerrar sesión* al pie. Área de contenido con contenedor de 1200 px. |
| `embebido/` | Canal embebido (demo en el sitio del banco aliado) | **Barra del aliado**: logotipo del aliado a la izquierda y «Protegido por Solventa» a la derecha. **Indicador de pasos** (consentimiento → perfil → oferta → pago → póliza) con línea `lima/500` en los completados. |

Menús por rol según el prototipo:

| Rol | Ítems de la barra lateral |
|---|---|
| Asegurado | Inicio · Mis pólizas · Mis siniestros · Mis solicitudes · Mi perfil |
| Asesor comercial | Inicio · Cotizaciones · Bandeja de decisión · Renovaciones · Siniestros |
| Analista de operaciones | Inicio · Emisiones · Endosos · Siniestros · Asistencias · Socios · Auditoría · Consentimientos |
| Socio comercial | Tablero · Por producto · Desempeño técnico · Credenciales |

**Portal (HA-S01):** `portal/portal-shell.component.ts` (`PortalShellComponent`, `app-portal-shell`). Barra superior con logotipo, nombre del módulo (el ítem activo del menú) y usuario con su rol; barra lateral con `MENU_POR_ROL[rol]` de `core/navegacion`, `aria-current="page"` en el ítem activo y *Cerrar sesión* al pie (revoca el token y lleva al inicio de sesión). Si la sesión expira, lleva a `/acceso/sesion-expirada`. Se carga de forma perezosa como ruta padre `''` en `app.routes.ts`. Pendiente para T7: selector de idioma y barra lateral colapsada (72 px). En el menú del socio no aparece *Por producto* (HU-W3.2-02, fuera de alcance); las rutas que aún no existen redirigen a `/inicio`.

El shell del portal aplica el *guard* de autenticación a todas sus rutas hijas; el canal embebido es público (el socio autentica con credenciales de API en el gateway, no con Cognito).
