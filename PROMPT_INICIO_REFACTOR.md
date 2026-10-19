# Inicio del refactor de Learnity: verificar la auditoría y arrancar el agent team

Eres el **lead** del refactor de Learnity: un ingeniero senior de refactorización. Trabajas en este repositorio, en la rama `Edison` (último commit `ce5e83c`). La sesión tiene tres pasos, en este orden: (1) cargar el contexto, (2) verificar la auditoría, (3) seguir el prompt de agent teams hasta crear el equipo y empezar el refactor. Cada paso termina en una puerta: no la cruces sin mi aprobación explícita.

## Paso 1. Contexto

**Lee completos, antes de hacer nada más:**
- `docs/refactor/AUDITORIA_INICIAL.md`: la fuente de verdad. Contiene el estado del Sprint 2 (26 requisitos: 21 hechos, 3 parciales, 2 faltantes), las ramas, los hallazgos de SQL (S1–S10), de arquitectura (A1–A12) y de frontend (F1–F6), el catálogo de la BD, los lotes A/B, los riesgos (R1–R7), las decisiones (D1–D10) y lo NO VERIFICADO.
- `docs/refactor/PROMPT_CLAUDE_CODE_AGENT_TEAMS.md`: tu guion. Contiene el rol, las reglas, la arquitectura objetivo, el equipo con la propiedad de carpetas, las fases (0B → 1 → 2A → 2B → 3) con sus puertas, la definición de hecho, el Anexo A (texto de `REGLAS_EQUIPO.md`) y el Anexo B (prompts de cada teammate).
- Como apoyo: `README.md` y los documentos del Sprint 2 sin versionar de la raíz (`SPRINT_2_LEARNITY.md`, `CONTRATO_API_PUBLICA_SPRINT_2.md` e `INTEGRANTE_*.md`).

**El proyecto:**
- Monolito modular. Backend: Express 5 + TypeScript (tsx), `pg` sin ORM y `zod`, con capas routes → controller → service → repository en `backend/src/modules/*` y `backend/src/shared/*`.
- Frontend: Angular 21 standalone, con signals y `loadComponent`.
- Base de datos: PostgreSQL 17 local, base `Learnity` (con L mayúscula). La app se conecta como `learnity_app`, y las tablas son de `postgres`.

**Objetivo del refactor:**
- Dos parejas (backend y frontend), cada una con un lote de unos 4 módulos.
- Frontend y backend totalmente separados, sin que ningún módulo dependa de las partes internas de otro.
- Escalable y sin vulnerabilidades.
- Al terminar, nada de SQL directo ni concatenado.
- Polimorfismo donde aporte (política de estados del curso, estrategia de correo, interfaz de almacenamiento).
- Sin arquitectura hexagonal, pero aplicando sus principios (puertos donde rompen ciclos, dependencias hacia dentro).
- **Refactorizar no cambia el comportamiento ni el contrato de la API.**

**Decisiones ya tomadas (18-10-2026):**
- **D1:** lo que falta del Sprint 2 se completa *dentro* del refactor, en la Fase 2B, después de caracterizar cada módulo, en tareas y commits separados marcados como funcionalidad nueva. Esto cubre el CRUD de categorías (lote A3, con un ADR previo del `arquitecto` porque amplía el contrato) y los datos reales en el inicio y el encabezado (lote A2).
- **D2:** resuelto con D1.
- **Alcance de la BD:** el entorno es solo local (cada integrante tiene su `Learnity`). Hay una única base de pruebas, `learnity_test`, compartida. D7 solo decide quién la crea.

**Decisiones pendientes:** D3 a D10. Están en la §9 de la auditoría, con mi recomendación en cada una. Las preguntas en el momento que indica el Paso 3, **una a la vez**, y registras cada respuesta en `docs/refactor/ESTADO.md`.

## Paso 2. Verificar la auditoría (solo lectura)

En este paso no editas código de la aplicación, no escribes en ninguna base de datos, no lees `.env*` y no ejecutas la suite del backend si apunta a `Learnity` o a una base que no existe. Puedes usar subagentes de solo lectura (`Explore`) para repartir la revisión; no son el agent team.

1. **Git:**
   - `git log -1 origin/Edison` debe dar `ce5e83c`.
   - `origin/Melissa`, `origin/Milena` y `origin/main` deben ser ancestros de `origin/Edison` (`git merge-base --is-ancestor`).
   - `git status` debe mostrar solo `backend/src/shared/auth/contrasena.ts` modificado y los documentos sin versionar.
2. **Evidencia:** en cada hallazgo (S1–S10, A1–A12, F1–F6 y R1–R7) y en cada fila de la tabla del Sprint 2, abre el `archivo:línea` citado y confirma que sigue diciendo lo que afirma la auditoría. Empieza por los de mayor severidad.
3. **Compilación y pruebas:**
   - `backend`: `npm run build` y `npm run typecheck`.
   - `frontend`: `npx ng build` y `npx ng test --watch=false` (se esperan 20/20).
   - Confirma que `backend/.env.test` todavía apunta a una base inexistente; para eso basta con `pg_isready` y la lista de bases. No leas el archivo.
4. **Base de datos (sin leer `.env`):** escribe un script de solo lectura **fuera del repositorio** (en tu directorio temporal) que haga lo siguiente:
   - cargue `backend/.env` internamente sin imprimir ningún valor;
   - ejecute todo dentro de `BEGIN READ ONLY … ROLLBACK`;
   - solo use `SELECT` sobre `information_schema`, `pg_catalog` y conteos.

   Muéstrame el script y pídeme que lo ejecute yo con `! node <ruta>`. Debe confirmar estos datos: 22 tablas; sin vistas, funciones ni triggers; 13 FK sin índice; 3 cursos `PUBLICADO` sin revisor; 3 lecciones `DOCUMENTO` sin PDF en cursos publicados; `learnity_app` con DML completo en todas las tablas; los scripts 015 y 016 aplicados; y tantas filas en `archivo` como ficheros en el directorio de PDF.
5. **Coherencia entre la auditoría y el prompt:**
   - Cada archivo de `backend/src` y `frontend/src` tiene **exactamente un dueño** según la §6 del prompt. Lista los que no tienen dueño y los que tienen dos.
   - Las rutas que citan las fases existen.
   - Cada decisión pendiente tiene un momento para preguntarse. El prompt no programa D8 ni D9: confírmalo y usa el calendario del Paso 3.

**Entregable:** `docs/refactor/VERIFICACION_AUDITORIA.md`, con una tabla `ID | afirmación | resultado (Confirmado / Cambió / No verificable) | evidencia` y una sección *Impacto en el plan*.
- No reescribas la auditoría. Si algo cambió, agrega al final de `AUDITORIA_INICIAL.md` una sección *Correcciones tras la verificación*.
- Toca `PROMPT_CLAUDE_CODE_AGENT_TEAMS.md` solo si el cambio afecta al plan, y dime qué líneas tocaste.

**Puerta V:** preséntame cuántas afirmaciones se confirmaron, las discrepancias y su impacto. Espera mi aprobación.

## Paso 3. Arrancar el refactor con el agent team

Con la Puerta V aprobada, sigue `PROMPT_CLAUDE_CODE_AGENT_TEAMS.md` **al pie de la letra** desde su §2, punto 2 (el punto 1 ya quedó cubierto por el Paso 2):

1. Crea `docs/refactor/REGLAS_EQUIPO.md` (el Anexo A tal cual), `CLAUDE.md` y `docs/refactor/ESTADO.md`. En ESTADO.md registra D1 y D2 como ya decididas, junto con el resultado de la verificación.
2. Pregúntame **D10, D5, D7 y D6**, una a una. Luego ejecuta la Fase 0B y detente en la **Puerta 0B**.
3. Con la Puerta 0B aprobada, pregúntame **D8** (el ADR-002 depende de ella) y **D9** (dependencias nuevas). Después **crea el agent team**:
   - Activa solo los teammates de la Fase 1 (`arquitecto`, `db` y `qa-edge`), con el modelo Opus 5.5 (`claude-opus-5-5`).
   - Dale a cada uno su prompt **completo** del Anexo B y exige aprobación de plan antes de que modifique archivos.
4. Avanza fase por fase, respetando cada puerta. En la **Puerta 1** pregúntame **D3** (paneles huérfanos) y **D4** (flag para las pantallas del Sprint 3/4), porque afectan a la Fase 2A y la 2B.
5. Cierra a cada teammate cuando termine su fase. Nunca tengas más de 6 activos.

## Reglas que no se negocian (el detalle está en el prompt y en REGLAS_EQUIPO.md)

**Git**
- No hagas `push` ni merge a `main`, `Edison`, `Melissa` ni `Milena`.
- Los commits van solo en `integration/sprint-2` y en `refactor/<rol>`, dentro de sus worktrees.
- `main` se actualiza solo según D6 y con mi aprobación explícita.

**Secretos**
- No leas `.env*`.
- No pongas secretos (contraseñas, tokens de Gmail u OAuth) en documentos, commits ni en el chat.
- Si hace falta una credencial o una configuración externa, explícame qué configurar y dónde, sin pedirme el valor.

**Base de datos**
- Todo es local, no hay producción. Ningún DDL ni DML sobre `Learnity`.
- Hay **una sola** base de pruebas, `learnity_test`, compartida por todo el equipo. No hay clon `learnity_refactor` ni bases por desarrollador.
- Como las pruebas crean y borran datos, se ejecuta **una suite a la vez**: el teammate te pide turno y avisa al terminar.
- Las migraciones se prueban `up → down → up` en `learnity_test`. Se aplican a `Learnity` únicamente con mi aprobación, tras un `pg_dump` rápido.
- Las operaciones que requieren `postgres` las ejecuto yo.

**Forma de trabajo**
- Una pregunta a la vez.
- Toda afirmación lleva evidencia; lo que no puedas comprobar se marca **NO VERIFICADO**.
- Los reportes siguen el formato de la §8 del prompt.

## Tu primera respuesta

En 5 líneas como máximo: la rama y el commit actuales, la confirmación de que leíste los dos documentos y tu plan para el Paso 2. Después empieza el Paso 2 sin esperar.
