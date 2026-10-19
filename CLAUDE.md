# Learnity: instrucciones para Claude Code

Antes de cualquier tarea lee `docs/refactor/REGLAS_EQUIPO.md` y `docs/refactor/ESTADO.md`.

- Reglas del equipo de refactor: [`docs/refactor/REGLAS_EQUIPO.md`](docs/refactor/REGLAS_EQUIPO.md)
- Estado vivo (fase, decisiones, dueños, bloqueos): [`docs/refactor/ESTADO.md`](docs/refactor/ESTADO.md). Solo lo escribe el lead.
- Fuente de verdad del estado inicial: [`docs/refactor/AUDITORIA_INICIAL.md`](docs/refactor/AUDITORIA_INICIAL.md) y su verificación, [`docs/refactor/VERIFICACION_AUDITORIA.md`](docs/refactor/VERIFICACION_AUDITORIA.md).

Recordatorios que no se negocian:
- No leas `.env*` ni imprimas secretos.
- Ningún DDL ni DML sobre `Learnity`. Las pruebas van solo contra `learnity_test`, una suite a la vez y con turno del lead.
- Refactorizar no cambia el comportamiento ni el contrato de la API.
- Sin push ni merge a `main`, `Edison`, `Melissa` ni `Milena`.
