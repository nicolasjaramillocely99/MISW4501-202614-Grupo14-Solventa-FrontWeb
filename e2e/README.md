# `e2e` — pruebas extremo a extremo (Playwright)

Cubren los **tres flujos críticos del cliente web** definidos en la [estrategia de pruebas](https://github.com/leonelparrales22/MISW4501-202614-Grupo14-Solventa/wiki/Estrategia-de-Pruebas-v-1.2) (OBJ 06), con **mínimo tres escenarios por flujo** (camino feliz y manejo de errores), y la verificación de accesibilidad con axe-core (OBJ 13). Corren en cada *pull request* y en cada *push* a `develop` o `main` (job «E2E · Playwright + axe» de `ci.yml`), en la corrida nocturna y bajo demanda.

| Carpeta | Contenido |
|---|---|
| `flujos/cotizacion-emision/` | Canal embebido y venta asistida: consentimiento → perfil → oferta → pago → póliza emitida; oferta provisional (HA-D01); pago pendiente o rechazado (HA-D02). `consentimiento.spec.ts` (HU-W1.2-01): fuentes, datos, vigencia y finalidad visibles con el botón solo con ambas casillas, el `POST` con titular, alcance y canal y paso al perfil, «Ahora no» sin ninguna petición de consentimiento ni de perfil, contexto ausente o inválido, términos que cambian (409), datos rechazados (400) y fallas del servicio con reintento; `perfil-riesgo.spec.ts` (HU-W1.2-02); `oferta-personalizada.spec.ts` (HU-W1.2-03): del consentimiento al perfil y a «Ver mi oferta» con el `POST /v1/offers` y la sesión hasta E3 (prima, coberturas, condiciones y vigencia), `consent_required` de vuelta al paso 1, servicio caído con reintento, E3b (perfil en caché) y E3c (perfil base), E7 con renovación y sin posibilidad de renovar, y la oferta reemplazada al reingresar y al aceptar (`422 offer_expired`); `aceptacion-oferta.spec.ts` (HU-W1.3-01): aceptación hasta la emisión iniciada, solicitud en revisión, oferta vencida, aceptación conservada ante falla posterior (también tras recargar), reintento seguro del `POST`, asesor sin acceso y la decisión del asesor vista por el cliente (E6b ajustada con «Ver la nueva oferta» y E6c rechazada, HU-W1.1-02); `bandeja-decision.spec.ts` (HU-W1.1-02): bandeja del asesor con pendientes, detalle, filtro, orden y pestañas, observaciones obligatorias, ajustar, rechazar y aceptar con «Decisión registrada», decididas con su registro, 409 y asegurado sin acceso; `pago-pendiente.spec.ts` (HA-D02): pago pendiente que pasa a confirmado, «Ver mi póliza» hacia la póliza emitida, ventana vencida como excepción y acceso desde la emisión iniciada; Cognito y API Gateway simulados con `page.route` |
| `flujos/siniestros/` | Radicación con soportes, seguimiento del estado, devolución y reenvío, cola por prioridad. `radicacion-siniestro.spec.ts` (HU-W2.1-01): solo las pólizas de `filing-options` y, al elegir el tipo, sus soportes obligatorios y los «No aplica» (CA-1); sin el informe de tránsito el botón no se habilita y el aviso dice qué falta, y un `422 validation_failed` marca la fila y el campo (CA-2); el hecho fuera de la vigencia no deja radicar y el `422 policy_not_eligible` muestra su motivo (CA-3); radicación completa con el cuerpo agrupado por soporte y la `Idempotency-Key`, confirmación A6b, descarga del PDF y recarga con `?caso=` (CA-4); un archivo de 10 MiB + 1 rechazado sin subirlo y un ejecutable renombrado `.pdf` con `415`, sin perder lo diligenciado (CA-5); «Mis siniestros» con el caso nuevo, uno del móvil y el filtro conservado al cargar más (CA-6); `503` al radicar con reintento con la misma clave, core de pólizas caído, sin pólizas y el asesor sin acceso. Datos en `fixtures/siniestros.ts` (vigencias relativas a hoy); *page objects* `paginas/radicacion-siniestro.pagina.ts` (simula todo `/v1/claims…`) y `paginas/mis-siniestros.pagina.ts` |
| `flujos/socios-b2b/` | Alta de socio, generación de credenciales, tablero del socio |
| `flujos/acceso/` | Acceso al portal (HA-S01): inicio de sesión por rol con su inicio y su menú, credenciales inválidas, sesión que no se puede renovar (sesión expirada) y cierre de sesión con revocación; `idioma.spec.ts`: P0 en inglés y el idioma elegido que se conserva al entrar al portal y al recargar. Cognito se simula con `page.route` (`fixtures/sesion-por-rol.ts`), sin red |
| `paginas/` | *Page objects*: una clase por pantalla con sus localizadores y acciones (`inicio-sesion.pagina.ts`, `cola-triage.pagina.ts`, …) |
| `fixtures/` | Usuarios de prueba por rol, datos de clientes, pólizas y siniestros, *fixtures* de Playwright (sesión iniciada por rol) |
| `accesibilidad/` | Ayudante `verificar-accesibilidad.ts`, que ejecuta axe-core sobre una página y falla ante violaciones de contraste, etiquetas y navegación, y `acceso.spec.ts` (P0 en español y en inglés, con y sin errores, 403 y sesión expirada) |
| `local-moto/` | Humo del acceso contra el **Cognito local (Moto)** del backend, sin `page.route`: inicio de sesión real por rol con su inicio y su menú, cierre de sesión y contraseña equivocada. Solo existe en el proyecto `local-moto` (`E2E_MOTO=1`); **no corre en el CI** |
| `nube/` | Humo del **portal desplegado en AWS** (T5), sin `page.route`: CloudFront, `config.json`, el API en el mismo dominio, Cognito real con los usuarios permanentes y la pasarela simulada de la plataforma. Solo existe en el proyecto `nube` (`E2E_NUBE=1`); **no corre en el CI** |

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

Para reproducir el job del CI: `CI=1 npx playwright test` (con `CI` no reutiliza un `npm start` abierto, reintenta dos veces y prohíbe `test.only`).

### Humo contra el Cognito local (Moto), fuera del CI

`src/environments/environment.development.ts` apunta Cognito al emulador Moto del backend (`configuracionLocal.cognito.endpoint`,
`http://localhost:5100/`). Las pruebas de `flujos/` y `accesibilidad/` no lo necesitan: `fixtures/sesion-por-rol.ts`
intercepta tanto ese endpoint como el regional de AWS. El proyecto `local-moto` sí habla con Moto:

1. En el repo backend: levantar y sembrar Moto según `tests/security/ha-s01/local/README.md`
   (`docker compose … up -d --wait` y `seed.sh` con `MOTO_USER_PASSWORD`).
2. Aquí, con la misma contraseña en el entorno:

```bash
E2E_MOTO=1 MOTO_USER_PASSWORD='…' npx playwright test --project=local-moto
```

El proyecto solo se registra con `E2E_MOTO=1`, así que `npx playwright test` (CI y corrida nocturna) no lo ve. Limitaciones del
emulador (tokens de 1 h, `RevokeToken` no implementado): ver la tabla «Local (Moto) ↔ AWS» de ese README.

### Humo contra el portal desplegado (nube), fuera del CI

`nube/portal.spec.ts` recorre el portal **publicado en CloudFront** (T5), con axe-core en cada pantalla y sin simular nada:

| # | Escenario |
|---|---|
| 1 | El asesor inicia sesión con Cognito real, ve su inicio y abre la bandeja de decisión |
| 2 | Recargar `/originacion/bandeja-decision` devuelve la aplicación (enlaces profundos de CloudFront) |
| 3 | Oferta `demo-active-<corrida>` como asegurado → aceptar → E4 con `4111 1111 1111 1111` (tokenizada por `/pasarela/tokens`) → pago confirmado → E5 → el PDF se descarga |
| 4 | Tarjeta `4000 0000 0000 0002` → E4c, pago rechazado |
| 5 | `/embebido/perfil-riesgo/sin-consentimiento-<corrida>?consentimiento=true` → «Necesitamos tu consentimiento» con «Volver al consentimiento»: el 422 de originación tras preguntar a `audit` (CA-3 de HU-W1.2-01) |
| 6 | La misma pantalla sin que ninguna petición del navegador lleve `x-api-key`, y `config.json` solo trae `apiGatewayUrl`, `pasarelaPagosUrl` y `cognito` |
| 7 | E1 con el aliado `portal-embebido`, la solicitud `app-<corrida>` y el cliente `cliente-<corrida>` → autorizar → E2 → «Ver mi oferta» → inicio de sesión del asegurado → E3 con una oferta `off-…`. Escucha la red: `POST /v1/audit/consents` 201, `POST /v1/risk-profiles/resolve` 200 y `POST /v1/offers` 201, ninguna con `x-api-key`. Termina en E3: la suscripción de la oferta depende del puntaje del cliente de la corrida (más de 0,8 va a decisión humana), así que aceptar y pagar no es determinista |

Usuarios: los cuatro permanentes del *user pool* de `bootstrap/identity` del backend (por defecto `asegurado@`, `asesor@`,
`operaciones@` y `socio@example.com`; se cambian con `NUBE_ASEGURADO`, `NUBE_ASESOR`, `NUBE_OPERACIONES` y `NUBE_SOCIO`). La
contraseña llega de `NUBE_CONTRASENA`, que se carga de la variable de Windows `SOLVENTA_IDENTITY_SEED_PASSWORD`; nunca se escribe
en un archivo ni se imprime. `NUBE_RUN` fija el sufijo de las ofertas de demostración (por defecto uno nuevo por corrida).

```bash
E2E_NUBE=1 E2E_BASE_URL=https://<distribución>.cloudfront.net NUBE_CONTRASENA="$SOLVENTA_IDENTITY_SEED_PASSWORD" \
  npx playwright test --project=nube
# La suite del CI contra el sitio desplegado (sus pruebas simulan el API con page.route):
E2E_BASE_URL=https://<distribución>.cloudfront.net CI=1 npx playwright test --project=chromium
```

El proyecto solo se registra con `E2E_NUBE=1`; el CI y la corrida nocturna no lo ven.
