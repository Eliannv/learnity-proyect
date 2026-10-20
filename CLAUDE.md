# Learnity: instrucciones vigentes para asistentes de codigo

## Semana de Sprint 3

El trabajo nuevo se hace en una rama personal `sprint3/<integrante>` creada desde el `main` actualizado. Cada integrante recibe del coordinador su tarea concreta y la propiedad de sus carpetas antes de editar. No mezcles entregas de distintas personas en una rama ni integres a `main` por tu cuenta.

Lee `README.md`, `docs/api/openapi.yaml`, `database/README.md` y la asignacion de esta semana. Los documentos `docs/refactor/**`, `PROMPT_INICIO_REFACTOR.md` y los briefs del Sprint 2 conservan el historial; sus prohibiciones de implementar Sprint 3 o publicar `main` ya no describen esta fase. El contrato actual de la API esta en `docs/api/openapi.yaml`.

- Arquitectura: monolito modular en capas. SQL de negocio solo en `*.repository.ts`, siempre parametrizado. Entre modulos, usar `index.ts` o puertos publicos; no importar repositorios de otro modulo.
- Frontend solo edita `frontend/**`; backend solo edita `backend/**` y las migraciones `database/**` que le asigne el coordinador. Los archivos compartidos y el contrato OpenAPI tienen un unico responsable designado.
- Cada maquina tiene sus propias bases locales. El backend usa `learnity_app`; `postgres` se reserva para preparacion de bases. Las pruebas van exclusivamente contra una base terminada en `_test`; nunca contra `Learnity`.
- No leas, imprimas ni confirmes `.env*`, contrasenas o tokens. Los archivos privados van fuera de Git y de rutas estaticas.
- Preserva los cambios ajenos. No uses `reset --hard`, `clean` ni `push --force`. Antes de declarar una tarea terminada, ejecuta build, pruebas relevantes y reporta comandos, resultados y riesgos.

Preparacion local guiada, desde la raiz del repositorio en Windows:

```powershell
powershell -ExecutionPolicy Bypass -File database\scripts\preparar-entorno-sprint3.ps1
```

Este comando pide las claves localmente, no las muestra, conserva `Learnity`, configura `backend/.env*` ignorados por Git y solicita confirmacion exacta antes de recrear cualquier base `learnity_s3_dev` o `learnity_test` preexistente.
