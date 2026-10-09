# `public/i18n` — diccionarios de Transloco

Un archivo JSON por idioma, cargado en tiempo de ejecución (sin recompilar ni redesplegar por idioma):

| Archivo | Idioma | Uso |
|---|---|---|
| `es-CO.json` | Español (Colombia) | Predeterminado |
| `en-US.json` | Inglés (EE. UU.) | Alterno, seleccionable en la barra superior |

Estructura de claves: `<dominio>.<pantalla>.<texto>` en camelCase, más los bloques transversales `app`, `comun`, `menu`, `roles` y `estados`.

```json
{
  "comun": { "cerrarSesion": "Cerrar sesión" },
  "siniestros": {
    "colaTriage": { "titulo": "Cola de siniestros por prioridad" }
  }
}
```

Reglas (sistema de diseño §7 y OBJ 12):

- Ambos archivos tienen exactamente las mismas claves; una clave nueva se agrega en los dos en el mismo *pull request*.
- Moneda, fecha, hora, número y porcentaje **no** van en los diccionarios: se formatean con la API `Intl` según el idioma activo (`$ 1.250.000 COP` / `COP 1,250,000`; `16/09/2026` / `09/16/2026`).
- Ningún texto dentro de imágenes.
