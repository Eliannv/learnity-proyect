# Registro de decisiones de arquitectura (ADR)

Lo mantiene `arquitecto`. Todo ADR nace **Propuesto** y pasa a **Aceptado** o **Rechazado** cuando el usuario lo decide en una puerta (la Puerta 1 para los de la Fase 1). Mientras siga *Propuesto*, nadie implementa lo que describe.

## Índice

| ADR | Título | Estado | Puerta | Cambia el contrato |
|---|---|---|---|---|
| [001](ADR-001-monolito-modular-api-publica.md) | Monolito modular en capas con API pública por módulo | Propuesto | 1 | No |
| [002](ADR-002-catalogo-modulo-lectura-vistas.md) | Catálogo como módulo de lectura sobre vistas SQL (D8 = A) | Propuesto (D8 ya decidida) | 1 | No |
| [003](ADR-003-politica-estados-curso.md) | Política de estados del curso | Propuesto | 1 | No |
| [004](ADR-004-puerto-cursos-contenido.md) | Ruptura del ciclo Cursos ⇄ Contenido mediante un puerto | Propuesto | 1 | No |
| [005](ADR-005-estrategia-correo-almacenamiento.md) | Strategy de transporte de correo e interfaz de almacenamiento | Propuesto | 1 | No |
| [006](ADR-006-validacion-uniforme-logger-correlacion.md) | Validación uniforme y logger con ID de correlación | Propuesto (2 puntos) | 1 | No (solo añade el encabezado `X-Request-Id`; lo que cambia el contrato está en el 011) |
| [007](ADR-007-features-angular-cliente-tipado.md) | *Features* en Angular y cliente HTTP tipado | Propuesto | 1 | No |
| [008](ADR-008-openapi-typescript.md) | Dependencia candidata: `openapi-typescript` (D9) | Propuesto | 1 | No |
| [009](ADR-009-playwright.md) | Dependencia candidata: `@playwright/test` (D9) | Propuesto | 1 | No |
| [010](ADR-010-pg-trgm.md) | Extensión candidata: `pg_trgm` (D9) | Propuesto | 1 | No |
| [011](ADR-011-endurecimiento-contrato.md) | Endurecimiento con impacto en el contrato | Propuesto (11 puntos que se aprueban por separado) | 1 | Sí (todos menos 11.5) |

Pendiente para la Fase 2B: el ADR del CRUD de categorías (D1), que amplía el contrato con rutas nuevas (ver `docs/arquitectura/CONTRATOS_SERVICIO.md`).

## Reglas que comparten todos los ADR

- **Refactorizar no cambia el comportamiento.** Si un ADR toca rutas, cuerpos JSON, códigos HTTP o códigos de error, lo dice en "Cambia el contrato" y necesita la aprobación explícita del usuario (`REGLAS_EQUIPO.md`, *Contrato*).
- La referencia del contrato es `docs/api/openapi.yaml`. Sus diferencias conocidas con el código están en `docs/api/COMPARACION_RUTAS.md` (`C-nn`).
- Antes de refactorizar un módulo, su caracterización (`qa-edge`) tiene que estar en verde.
- La caracterización **congela el comportamiento actual**, incluido lo inseguro (CONGELADO-INSEGURO). Cada ADR que cambie un comportamiento nombra las pruebas de caracterización que actualiza, y esas expectativas cambian en el mismo commit que aplica el ADR aprobado.
- Nada del Sprint 3/4 (video, PowerPoint, inscripciones, progreso, evaluaciones ni gestión de usuarios).
- Sin arquitectura hexagonal ni reescrituras. Polimorfismo solo donde elimine un `if/switch` por tipo o una duplicación.

## Plantilla

```markdown
# ADR-NNN: <título>

- **Estado:** Propuesto | Aceptado | Rechazado | Reemplazado por ADR-MMM
- **Fecha:** AAAA-MM-DD
- **Decisores:** el usuario (Puerta N). Propone: arquitecto
- **Cambia el contrato:** No | Sí (qué)
- **Pruebas de caracterización que actualiza:** ninguna | IDs (CAR-…, SEG-…)

## Contexto
Situación y fuerzas, con evidencia `archivo:línea`.

## Decisión propuesta
Qué se hace, en concreto.

## Opciones consideradas
### Opción A: <nombre>
| Dimensión | Valoración |
|---|---|
| Complejidad | Baja/Media/Alta |
| Riesgo de regresión | … |
| Impacto en el contrato | … |
| Familiaridad del equipo | … |
**A favor:** … **En contra:** …

## Análisis de compromisos
## Consecuencias
- Qué se vuelve más fácil / más difícil / qué hay que revisar.
## Acciones
1. [ ] Paso (dueño, fase)
## Cómo se verifica
Comando → resultado esperado.
```
