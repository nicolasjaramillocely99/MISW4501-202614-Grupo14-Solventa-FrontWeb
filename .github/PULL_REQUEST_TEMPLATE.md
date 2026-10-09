## Historia

- ID: <!-- HU-W2.2-01 / HA-S01 -->
- Sprint: <!-- 1 / 2 / 3 -->
- Dominio: <!-- features/siniestros/triage -->

## Pantallas del prototipo

<!-- Enlaces a los frames de Figma tomados de docs/pantallas.md -->

## Qué cambia

<!-- Resumen funcional en dos o tres líneas -->

## Cómo probarlo

<!-- Rol con el que entrar, ruta, datos de prueba, estados que revisar -->

## Lista de verificación

- [ ] Pantalla y sus estados según el frame de Figma
- [ ] Textos en `es-CO.json` y `en-US.json`; formatos con `Intl`
- [ ] Llamadas HTTP solo por `core/api/`
- [ ] Rol restringido por *guard* en la ruta
- [ ] Pruebas unitarias nuevas; cobertura ≥ 70 % en lo que cambia
- [ ] Sin violaciones de axe-core
- [ ] `npm run lint`, `npm run build` y `npm test` en verde
- [ ] `docs/pantallas.md` actualizado si cambió la ruta o la carpeta
