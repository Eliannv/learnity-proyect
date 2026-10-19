# Reglas del equipo de refactor de Learnity

Fuente de verdad del estado inicial: `docs/refactor/AUDITORIA_INICIAL.md`. Estado vivo: `docs/refactor/ESTADO.md` (solo lo escribe el lead).

## Propiedad
- Edita solo tus carpetas (tabla de propiedad en ESTADO.md). Si necesitas un cambio fuera de ellas, envía un mensaje al dueño con: archivo, cambio y motivo.
- Backend no toca `frontend/`. Frontend no toca `backend/` ni `database/`.
- Archivos compartidos con dueño único: `app.ts`/`server.ts` (be-a), `app.routes.ts` (fe-a), `package.json`/`tsconfig`/`angular.json`/`openapi*` (arquitecto), `.gitignore` y ESTADO.md (lead).

## Contrato
- No cambian rutas, cuerpos JSON, códigos HTTP ni códigos de error (`{ error: { codigo, mensaje, detalles } }`) sin un ADR aprobado por el usuario.
- Contrato de referencia: `docs/api/openapi.yaml` (lo edita solo arquitecto).

## SQL y datos
- SQL solo en `*.repository.ts`, con parámetros `$1…`. Prohibido concatenar o interpolar valores. Los fragmentos dinámicos (orden, `FOR UPDATE`) solo salen de listas cerradas del código.
- Ningún módulo importa el repositorio ni los archivos internos de otro módulo; solo su `index.ts` público.
- Transacciones con la ayuda de `shared/database`. Nunca hay lecturas de disco con filas bloqueadas.
- El actor de la auditoría se fija con `set_config('learnity.id_persona', $1, true)`.

## Base de datos
- Entorno local, sin producción. `Learnity` no se modifica directamente. Orden: migraciones `database/migraciones/0NN_*.up.sql` y `.down.sql` probadas `up → down → up` en `learnity_test` → Puerta DB → `pg_dump` rápido (fuera del repositorio) → aplicar a `Learnity` solo con aprobación del usuario. Cada integrante aplica luego las mismas migraciones en su base local.
- Las operaciones con `postgres` (crear bases, `pg_dump`, cambiar dueños) las ejecuta el usuario con los scripts que prepare `db`.
- La app usa un rol de mínimo privilegio, nunca `postgres`.

## Pruebas
- Nunca contra `Learnity`. Todo el equipo comparte una sola base, `learnity_test`. Toda suite debe importar `backend/test/ayudas/guardia-bd.ts`, que aborta si `DB_NAME` no termina en `_test`. Hasta entonces, `identidad.test.ts` y `cursos-publicos.test.ts` **no** tienen esa guarda: el lead comprueba `.env.test` antes de cada ejecución.
- **Una suite a la vez:** como la base es compartida y las pruebas crean y borran datos (por ejemplo, `identidad.test.ts` borra todas las cuentas `@pruebas.test`), pide turno al lead antes de `npm test` y avísale al terminar.
- Antes de refactorizar un módulo, su caracterización debe estar en verde. No se cambian expectativas para "hacer pasar" una prueba.
- "Hecho" exige evidencia ejecutada: comando y salida.

## Seguridad
- Secretos solo en `.env*`. No los leas, no los imprimas, no los copies a documentos ni a mensajes.
- Archivos privados fuera de git y de rutas estáticas. Nunca expongas `archivo.ruta` en respuestas ni en logs.
- Toda entrada se valida con zod. Autorización por rol **y** por propiedad en el servicio.

## Frontend
- Sin tokens en `localStorage` ni en `sessionStorage`. Sin `innerHTML` ni `bypassSecurityTrust`.
- Sin `datos-demo.ts` en recorridos reales. Los mocks solo van detrás de un flag apagado por defecto y se eliminan antes de cerrar el módulo.
- *Features* con carga diferida, separación contenedor/presentación, cliente tipado, estados de carga/vacío/error, accesibilidad AA y responsive a 390 px.

## Git
- Trabaja en tu worktree `.worktrees/<rol>` y en tu rama `refactor/<rol>`. Para traer cambios integrados usa `git merge integration/sprint-2`.
- Prohibido: force push, `reset --hard`, `git clean`, borrar ramas del Sprint 2 y hacer push sin que el usuario lo pida.
- Commits pequeños, en español, separando refactor de funcionalidad nueva.

## Alcance
- Refactorizar no es cambiar funcionalidades. No se implementa nada del Sprint 3/4 (aprendizaje, evaluaciones, video, PowerPoint, inscripciones, progreso, gestión de usuarios).
- Polimorfismo solo donde elimine `if/switch` por tipo o duplicación, y con un ADR. Nada de arquitectura hexagonal ni de reescrituras.

## Comunicación
- Una pregunta a la vez. Lo no comprobado se marca **NO VERIFICADO**.
- Informa al lead con este formato:
  - `### <rol> · <tarea>`
  - **Qué hice:** …
  - **Archivos tocados** (solo de mi propiedad): …
  - **Cómo verificarlo:** `<comando>` → resultado real pegado
  - **Riesgos / pendientes / NO VERIFICADO:** …
  - **Necesito de otro dueño:** …
- Máximo 6 teammates activos; cada uno se cierra al terminar su fase.
