# Configuración de Claude Code

@AGENTS.md

Las reglas del repositorio (arquitectura, idioma, Definición de Terminado, flujo de Git y pull requests) viven en `AGENTS.md`. No se duplican aquí para que los dos archivos no se desincronicen.

## Específico de Claude Code

- Cumple la Definición de Terminado de `AGENTS.md` (sección 5) antes de dar por terminada una tarea.
- **Decisiones técnicas o de arquitectura:** pregunta al usuario antes de decidir; no generes registros de decisión (ADR) por iniciativa propia.
- No hagas commit, push ni abras un PR salvo que el usuario lo pida. Sigue las secciones 7 y 7.1 de `AGENTS.md`.
- Lee el `README.md` del dominio (`src/app/features/<dominio>/`) antes de modificarlo.
