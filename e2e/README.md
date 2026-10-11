# `e2e` — pruebas extremo a extremo (Playwright)

Cubren los **tres flujos críticos del cliente web** definidos en la [estrategia de pruebas](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Estrategia-de-Pruebas-v-1.2) (OBJ 06), con **mínimo tres escenarios por flujo** (camino feliz y manejo de errores), y la verificación de accesibilidad con axe-core (OBJ 13). Corren en la corrida nocturna de GitHub Actions y bajo demanda.

| Carpeta | Contenido |
|---|---|
| `flujos/cotizacion-emision/` | Canal embebido y venta asistida: consentimiento → perfil → oferta → pago → póliza emitida; oferta provisional (HA-D01); pago pendiente o rechazado (HA-D02) |
| `flujos/siniestros/` | Radicación con soportes, seguimiento del estado, devolución y reenvío, cola por prioridad |
| `flujos/socios-b2b/` | Alta de socio, generación de credenciales, tablero del socio |
| `flujos/acceso/` | Acceso al portal (HA-S01): inicio de sesión por rol con su inicio y su menú, credenciales inválidas, sesión que no se puede renovar (sesión expirada) y cierre de sesión con revocación. Cognito se simula con `page.route` (`fixtures/sesion-por-rol.ts`), sin red |
| `paginas/` | *Page objects*: una clase por pantalla con sus localizadores y acciones (`inicio-sesion.pagina.ts`, `cola-triage.pagina.ts`, …) |
| `fixtures/` | Usuarios de prueba por rol, datos de clientes, pólizas y siniestros, *fixtures* de Playwright (sesión iniciada por rol) |
| `accesibilidad/` | Ayudante `verificar-accesibilidad.ts`, que ejecuta axe-core sobre una página y falla ante violaciones de contraste, etiquetas y navegación, y `acceso.spec.ts` (P0 con y sin errores, 403 y sesión expirada) |

Convenciones:

- Archivos `<flujo>.spec.ts`; títulos de prueba en español describiendo el escenario (`'radica un siniestro con todos los soportes obligatorios'`).
- Navegador de referencia: Chromium (Chrome), *viewport* 1440 × 900, `locale` `es-CO`, zona horaria `America/Bogota` (ver `playwright.config.ts`).
- Las pruebas localizan elementos por rol y texto accesible (`getByRole`, `getByLabel`), nunca por clases CSS.
- Cada flujo incluye al menos una comprobación de accesibilidad con el ayudante de `accesibilidad/`.

Comandos:

```bash
npx playwright install chromium
```

```bash
npm run e2e
```

Contra un ambiente desplegado: `E2E_BASE_URL=https://… npm run e2e`.
