# Learnity

Plataforma web de cursos en línea (tipo Udemy), organizados en módulos y lecciones. El alcance del
proyecto contempla videos cortos (MP4 ≤ 5 MB, 480p), documentos PDF y PowerPoint y evaluaciones de
opción múltiple. La entrega actual del integrante 3 implementa revisión administrativa y archivos
PDF privados de hasta 10 MiB; los demás formatos corresponden a sus siguientes entregas.

**Arquitectura:** monolito modular en capas · API REST (Node.js + Express 5 + TypeScript) · frontend Angular 21 · PostgreSQL 17.

```
learnity/
├── backend/      API REST (Express 5 + TypeScript + pg)
├── frontend/     Aplicación web (Angular 21)
└── database/     Modelo SQL y scripts de cambios (se aplican en pgAdmin)
```

---

## 1. Requisitos

- Node.js 22 o superior (`node -v`)
- PostgreSQL 17 con la base `learnity` creada según la guía `Guia_Learnity_PostgreSQL_pgAdmin.docx`
- Angular CLI: `npm install -g @angular/cli@21` (opcional; también funciona con `npx ng`)

## 2. Base de datos

Con la base `learnity` y el esquema principal preparados según la guía, aplica en pgAdmin estos
scripts, en orden y utilizando la cuenta propietaria de las tablas:

1. `database/015_sesiones_y_recuperacion.sql`: sesiones y enlaces de recuperación.
2. `database/016_limpieza_pdf.sql`: cola persistente de archivos PDF pendientes de eliminación.

Comprueba que Query Tool esté conectado a `learnity` antes de aplicarlos. Si una migración ya está
aplicada, conserva sus tablas y datos. La guía base de PostgreSQL está en
[`database/README.md`](database/README.md).

Para ejecutar las pruebas utiliza una base exclusiva llamada `learnity_test`; su preparación está
explicada en la sección 14.

## 3. Backend

Desde la raíz del proyecto, en PowerShell:

```powershell
cd backend
npm install
if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
}
```

En macOS/Linux, la copia inicial del archivo se realiza con `cp .env.example .env`.

Completa `backend/.env`: la contraseña de `learnity_app`, un `JWT_SECRET` aleatorio de 32+ caracteres
(el comando para generarlo está en `.env.example`) y `SEED_PASSWORD`.

Configura también el directorio privado de PDF:

```dotenv
PDF_DIR=uploads/pdf
```

Al ejecutar los comandos desde `backend`, esta ruta corresponde a `backend/uploads/pdf`.
El servidor crea el directorio cuando guarda el primer archivo. Después:

```bash
npm run db:seed     # crea las cuentas de prueba y las categorías (se puede repetir sin duplicar)
npm run db:probar   # comprueba que las cuentas existen y que las contraseñas coinciden
npm run dev         # API en http://localhost:3000/api
```

- Estado del servidor y conexión a la base: [http://localhost:3000/api/salud](http://localhost:3000/api/salud).
- Documentación de la API (Swagger): [http://localhost:3000/api/docs](http://localhost:3000/api/docs).
- Al arrancar, la consola indica la conexión a PostgreSQL, si falta la tabla de sesiones y qué transporte de correo se usa.
- El arranque también reintenta la limpieza de PDF pendientes. Si aparece una advertencia `[PDF]`, revisa la migración 016 y ejecuta `npm run archivos:limpiar`.

## 4. Frontend

Abre otra terminal situada en la raíz del proyecto y ejecuta:

```bash
cd frontend
npm install
npm start           # http://localhost:4200
```

En desarrollo, las llamadas a `/api` se redirigen al backend (`proxy.conf.json`). Así el navegador ve
un solo origen y las cookies de sesión funcionan sin configuración extra.

## 5. Cuentas de prueba

Las crea `npm run db:seed` con la contraseña de `SEED_PASSWORD` (`.env`).

| Rol | Correo | Clic en la foto de perfil |
|---|---|---|
| Estudiante | rosa.vera@correo.com | Mi perfil (`/perfil`, diseño de Pencil) |
| Docente (también Estudiante) | carlos.mendoza@correo.com | Ajustes y perfil en su panel (`/docente/perfil`) |
| Administrador (también Estudiante) | ana.torres@learnity.com | Ajustes y perfil en su panel (`/admin/perfil`) |

La política de contraseñas (15+ caracteres) se aplica al **crear o cambiar** una contraseña: las cuentas
sembradas antes con una contraseña más corta siguen entrando, pero al cambiarla deben cumplirla.

Al iniciar sesión, todos los roles llegan al inicio personalizado (`/`): retomar la última lección,
recomendaciones, destacados y categorías.

- **Pasar el mouse sobre la foto de perfil** muestra el menú de la cuenta: paneles (Docente / Administración),
  Mi aprendizaje, Mi perfil y Cerrar sesión. Es la única entrada a los paneles.
- **Pasar el mouse sobre Mi aprendizaje** muestra los cursos recientes con su avance.
- Si un Docente o Administrador abre `/perfil`, se le lleva a Ajustes y perfil de su panel.
- El **Panel del docente** (`/docente`) es un resumen con accesos directos y lo que requiere atención;
  la lista completa con filtro por estado está en **Mis cursos** (`/docente/cursos`).

El visitante no tiene cuenta: ve Inicio, Catálogo, Detalle del curso, Login, Registro y Recuperar contraseña.

## 6. Sesión y seguridad de la cuenta (Sprint 1)

| Tema | Cómo funciona |
|---|---|
| Contraseñas | bcrypt costo 12 (salt propio por hash). Mínimo 15 caracteres y máximo 72 bytes UTF-8, sin reglas de composición. Se rechazan las comunes, las basadas en el nombre o el correo y las expuestas en filtraciones ([Have I Been Pwned](https://haveibeenpwned.com/API/v3#PwnedPasswords) con k-anonimato: solo viajan 5 caracteres del hash SHA-1). La misma política está en Angular y en la API. |
| Inicio de sesión | Mensaje genérico ("Correo o contraseña incorrectos") para correo inexistente, contraseña errónea o cuenta bloqueada. 5 fallos seguidos bloquean la cuenta 15 minutos. Además, límite por IP en cada ruta de `/api/auth` (429 con `Retry-After`). |
| Access token | JWT de 15 minutos (`ACCESS_MINUTOS`), **solo en memoria** del navegador; nada en `localStorage`. Si la sesión se revoca, deja de valer de inmediato. |
| Refresh token | Opaco y aleatorio, en la cookie `learnity_rt` (HttpOnly, SameSite=Lax, `Path=/api/auth`, `Secure` con HTTPS). Rota en cada uso y en la base solo se guarda su hash. Si alguien presenta uno ya usado, se revoca la sesión completa. Vence tras 7 días sin uso (`REFRESH_DIAS`) o 30 días en total (`SESION_MAX_DIAS`). |
| CSRF | `/auth/refresh` y `/auth/logout` exigen `X-XSRF-TOKEN` igual a la cookie `XSRF-TOKEN`, que está firmada con HMAC y ligada a la sesión. Angular la envía solo. Todas las rutas `/auth/*` rechazan otros orígenes. |
| Recargar la página | Al iniciar, Angular llama a `/auth/refresh` con la cookie y recupera la sesión antes de la primera navegación. |
| Cerrar sesión / cambiar contraseña | Cerrar sesión revoca la sesión en el servidor. Cambiar la contraseña cierra las demás sesiones. Restablecerla con el correo las cierra todas. Se envía un aviso por correo. |
| Recuperación | Respuesta idéntica e inmediata exista o no el correo. El enlace es aleatorio, de un solo uso y vence en 20 minutos (`RECUPERACION_MINUTOS`, entre 15 y 30). Pedir uno nuevo invalida el anterior. Máximo 3 por cuenta y hora. El token va en el fragmento (`#token=`), así no llega a los logs ni al Referer. |
| Auditoría | Eventos en JSON por la salida estándar (`login_fallido`, `cuenta_bloqueada`, `refresh_reutilizado`…). Nunca registra contraseñas, tokens ni cookies; los correos van enmascarados (`r***@correo.com`). |

**Desarrollo local por HTTP:** `COOKIE_SECURE=false` permite las cookies sin HTTPS. Es una excepción
solo para `localhost`. Antes de publicar son obligatorios HTTPS, `COOKIE_SECURE=true` (el backend no
arranca en producción sin él), `TRUST_PROXY` si hay un proxy inverso y MFA para administradores
(Sprint 4).

## 7. Correo con la Gmail API

En desarrollo, `CORREO_TRANSPORTE=buzon` guarda cada correo como archivo JSON en `backend/.buzon/`
(ignorado por Git). Abre el más reciente para copiar el enlace de recuperación.

Para enviar correos reales, una persona del equipo configura una vez la **cuenta emisora** (por ejemplo,
una cuenta Gmail creada solo para Learnity). Los estudiantes no autorizan nada: solo reciben el correo.

1. En [Google Cloud Console](https://console.cloud.google.com/), crea un proyecto y habilita la **Gmail API**.
2. **Pantalla de consentimiento de OAuth**: tipo *Externo*, agrega la cuenta emisora como *usuario de prueba*
   y el alcance `https://www.googleapis.com/auth/gmail.send` (solo enviar).
3. **Credenciales → Crear ID de cliente de OAuth → App de escritorio.** Copia el *ID de cliente* y el
   *secreto* en `backend/.env` (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`) y la cuenta emisora en `GMAIL_REMITENTE`.
4. Ejecuta `npm run correo:autorizar`, abre el enlace que muestra e inicia sesión **con la cuenta emisora**.
   El script guarda `GMAIL_REFRESH_TOKEN` directamente en `.env` (no lo imprime).
   Si el backend está en un servidor o VM sin navegador, conéctate con `ssh -L 8765:127.0.0.1:8765 usuario@servidor`,
   ejecuta allí `npm run correo:autorizar -- --puerto 8765` y abre el enlace en el navegador de tu PC.
5. Cambia `CORREO_TRANSPORTE=gmail` y prueba: `npm run correo:probar -- tu-buzon-de-prueba@gmail.com`.
6. Prueba el flujo completo: registra una cuenta con el buzón de prueba, usa "¿Olvidaste tu contraseña?"
   y abre el enlace que llega.

Mientras la app de OAuth esté en modo *Prueba*, Google caduca el refresh token a los 7 días. Repite el paso 4
o publica la app. Las credenciales de Google nunca se suben a Git ni se comparten por chat.

## 8. Modo demostración

Está **desactivado**: el login, el registro, el perfil y la recuperación usan la API real y PostgreSQL.
Para presentar pantallas sin backend, pon `modoDemo: true` en `frontend/src/environments/environment*.ts`:
el login muestra accesos simulados por rol, que viven solo en memoria y se pierden al recargar.

El catálogo y el detalle público utilizan la API pública del Sprint 2. El frontend del integrante 4
incluye el editor docente y la revisión administrativa con sus llamadas a la API privada.
Los endpoints de Administración y PDF están implementados en esta entrega; el recorrido completo
de creación, edición y envío de cursos requiere las rutas privadas del integrante 2.

Otros recorridos todavía pueden utilizar los datos del prototipo
(`frontend/src/app/data/datos-demo.ts`) hasta completar sus respectivos sprints.

---

## 9. Arquitectura del backend: monolito modular en capas

Cada módulo organiza las peticiones en cuatro capas. Las colaboraciones entre módulos se realizan
mediante sus servicios, manteniendo las consultas SQL en el repositorio responsable.

```
Petición → routes → controller → service → repository → PostgreSQL
```

| Capa | Archivo | Hace | No hace |
|---|---|---|---|
| routes | `*.routes.ts` | URL, verbo, middlewares (origen, límite por IP, CSRF, sesión, rol) y validación | lógica |
| controller | `*.controller.ts` | recibe la petición, llama al service, responde (cookies y códigos HTTP) | SQL ni reglas |
| service | `*.service.ts` | reglas del negocio (límites, estados, permisos) | SQL |
| repository | `*.repository.ts` | consultas SQL parametrizadas (`$1, $2…`) | reglas |

Reglas del equipo:

- Un módulo **no** consulta las tablas de otro: llama al *service* de ese módulo.
- Lo común está en `backend/src/shared/`: configuración, conexión, errores, JWT, bcrypt, cookies y CSRF,
  límite por IP, correo, registro de eventos y comprobación de contraseñas expuestas.
- Para crear un módulo nuevo con la misma forma: `npm run crear-modulo -- nombre "descripción"`.

| Módulo | Responsabilidad | Sprint |
|---|---|---|
| `identidad` | Registro, login, sesiones, perfil, recuperar contraseña | 1 ✔ |
| `cursos` | Categorías, catálogo e interfaz de integración implementados; CRUD privado y envío a revisión a cargo del integrante 2 | 2–3 |
| `contenido` | PDF privado implementado; videos y PowerPoint previstos en el alcance del proyecto | 2 |
| `aprendizaje` | Inscripciones y progreso | 3 |
| `evaluaciones` | Preguntas, intentos y notas | 4 |
| `administracion` | Revisión de cursos implementada; usuarios, solicitudes e indicadores según sus entregas | 2–4 |

## 10. Sprint 1 · estado

Implementado con PostgreSQL real: registro (RF-01), login con bloqueo (RF-02), sesión con refresh rotatorio,
cierre de sesión, perfil y cambio de contraseña (RF-04), recuperación por correo (RF-06).
Ninguna ruta de Identidad responde 501.

La suite `backend/test/identidad.test.ts` cubre registro, política de contraseña, login y bloqueo,
límite por IP, perfil y permisos por rol,
rotación y reutilización del refresh token, CSRF y origen, cierre de sesión, cambio de contraseña,
recuperación (un solo uso, vencimiento, invalidación, límite por hora) y logs sin secretos.

Se ejecuta junto con las demás suites mediante `npm test`, usando la base exclusiva de `.env.test`.
La selección local omite una comprobación que consulta Have I Been Pwned; consulta la sección 14.

**Pendiente para cerrar el Sprint 1:** el equipo informó que Gmail API confirmó un envío real; falta
comprobar la recepción y el enlace en el buzón. El buzón local sigue disponible para pruebas.

## 11. Sprint 2 · API pública y catálogo

Están implementados `GET /api/categorias`, `GET /api/cursos` y `GET /api/cursos/:id` con PostgreSQL.
El contrato de filtros, paginación y JSON puede consultarse en la
[documentación de la API](http://localhost:3000/api/docs).
Para comprobar las pantallas mientras se desarrolla el editor, ejecuta en `backend`:

```bash
npm run db:seed-publico    # crea 3 cursos PUBLICADO y 1 BORRADOR sintéticos; se puede repetir
npm run dev
```

Después abre `http://localhost:4200/cursos`. Esos cursos llevan `[Prueba Sprint 2]` en el título y
**solo sirven para verificar el catálogo**: no fueron creados ni aprobados mediante el flujo docente/Admin.
La prueba automatizada `test/cursos-publicos.test.ts` utiliza la base separada `learnity_test`
configurada en `.env.test`. Está incluida en `npm test`. Para ejecutar únicamente esa suite,
desde `backend`:

```powershell
npx tsx --env-file=.env.test --test --test-concurrency=1 test/cursos-publicos.test.ts
```

Las responsabilidades del Sprint 2 se distribuyen así:

| Integrante | Responsabilidad y estado de esta entrega |
|---|---|
| 2 | Backend privado de cursos, módulos, lecciones y envío a revisión: pendiente de integrar |
| 3 | Backend de revisión administrativa y PDF privado: incluido en esta entrega |
| 4 | Frontend docente y administrador: implementado con las llamadas del contrato privado |

El estado de Administración, PDF y su integración con Cursos se describe en la sección 13.

## 12. Comandos útiles

| Dónde | Comando | Qué hace |
|---|---|---|
| backend | `npm run dev` | API con recarga automática |
| backend | `npm run build` / `npm start` | Compilar y ejecutar en producción |
| backend | `npm run typecheck` | Revisar tipos (código, scripts y pruebas) |
| backend | `npm test` | Pruebas locales de Identidad, catálogo, PDF y Administración/Contenido; utiliza `.env.test` |
| backend | `npm run test:pdf` | Validación de PDF, sin base de datos |
| backend | `npm run test:integrante3` | Pruebas de PDF y endpoints de Administración/Contenido con PostgreSQL |
| backend | `npm run archivos:limpiar` | Reintentar la eliminación de PDF pendientes en el entorno configurado |
| backend | `npm run db:seed-publico` | Cursos sintéticos para probar catálogo y detalle local |
| backend | `npm run correo:autorizar` | Autorizar una vez la cuenta emisora de Gmail |
| backend | `npm run correo:probar -- correo@ejemplo.com` | Enviar un correo de prueba |
| frontend | `npm start` | App en modo desarrollo |
| frontend | `npm run build` | Compilación de producción en `dist/` |
| frontend | `npm test` | Pruebas unitarias (Vitest) |

## 13. Sprint 2 · Administración y PDF privado (integrante 3)

La revisión administrativa y los PDF privados utilizan PostgreSQL y el contrato del frontend Angular.

### Endpoints y respuestas

Todas estas rutas requieren un token Bearer y una sesión vigente. Los permisos se verifican en cada
petición.

| Método | Ruta | Autorización | Respuesta correcta |
|---|---|---|---|
| GET | `/api/admin/cursos?estado=EN_REVISION` | ADMIN | 200, listado en `items` |
| GET | `/api/admin/cursos/:id` | ADMIN | 200, `CursoDetalle` |
| PUT | `/api/admin/cursos/:id/revision` | ADMIN | 200, `CursoDetalle` actualizado |
| POST | `/api/lecciones/:id/archivo` | DOCENTE propietario, curso BORRADOR/RECHAZADO y lección DOCUMENTO | 200, `CursoDetalle` actualizado |
| GET | `/api/archivos/:id` | ADMIN o DOCENTE propietario | 200, contenido binario PDF |

El listado devuelve `{ "items": [] }` cuando no hay cursos pendientes. En cada resumen, `modulos`
es una cantidad numérica. El detalle devuelve módulos y lecciones como arreglos ordenados.

Las decisiones y las subidas devuelven el curso completo directamente en la raíz, incluyendo
`validacion` recalculada. Cada lección incluye los metadatos de su PDF o `archivo: null`.
Los metadatos exponen `id`, `tipo`, `nombreOriginal` y `tamanoBytes`; la ruta física permanece privada.

La especificación de las rutas y los esquemas está disponible en
[Swagger](http://localhost:3000/api/docs).

### Aprobar o rechazar un curso

Petición de aprobación a `PUT /api/admin/cursos/:id/revision`:

```json
{
  "decision": "APROBAR"
}
```

Petición de rechazo al mismo endpoint:

```json
{
  "decision": "RECHAZAR",
  "motivo": "Amplía los ejemplos de la primera lección."
}
```

El motivo del rechazo es obligatorio después de quitar los espacios de los extremos y admite hasta
300 caracteres.

Solo puede decidirse un curso que siga en `EN_REVISION`. La aprobación vuelve a validar el contenido
guardado y sus PDF, registra el revisor, cambia el estado a `PUBLICADO` y registra la fecha de
publicación. El curso publicado queda disponible mediante el catálogo público.

El rechazo registra el revisor, guarda el motivo y cambia el estado a `RECHAZADO`.
Las comprobaciones y el cambio de estado son atómicos. Si dos administradores deciden sobre la misma
revisión, la segunda decisión recibe 409. El detalle administrativo permite consultar el estado
actual de un curso ya decidido.

### Subida, reemplazo y descarga de PDF

La subida utiliza `multipart/form-data`, con un campo llamado exactamente `archivo`.
El navegador genera el encabezado multipart y su boundary al enviar `FormData`.

- Tamaño permitido: entre 1 y 10485760 bytes, equivalente a 10 MiB como máximo.
- El servidor valida la extensión, el tamaño y la estructura real del PDF.
- Solo el DOCENTE propietario puede subir o reemplazar el archivo.
- El curso debe estar en `BORRADOR` o `RECHAZADO` y la lección debe ser `DOCUMENTO`.
- Cada lección tiene un PDF principal.
- Si falla un reemplazo antes de confirmarse, se conserva el archivo anterior.

Los archivos se guardan con nombres generados por el servidor en el directorio privado `PDF_DIR`.
Por defecto, al ejecutar desde `backend`, corresponde a `backend/uploads/pdf`.
La carpeta no se publica mediante `express.static` ni pertenece a `frontend/public`.

La descarga autorizada responde con `Content-Type: application/pdf`, como archivo adjunto y con
`Cache-Control: private, no-store`. En esta entrega descargan el ADMIN o el DOCENTE propietario;
el acceso de estudiantes inscritos corresponde al recorrido previsto para Sprint 3.

### Formato de errores

```json
{
  "error": {
    "codigo": "SOLICITUD_INVALIDA",
    "mensaje": "Revisa los datos enviados.",
    "detalles": [
      {
        "campo": "archivo",
        "mensaje": "Selecciona un archivo PDF válido."
      }
    ]
  }
}
```

`detalles` puede omitirse cuando el error sea general. Los nombres de campo `archivo` y `motivo`
permiten que Angular muestre los mensajes junto al control correspondiente.

| HTTP | Situación |
|---|---|
| 400 | Datos inválidos, multipart inválido, archivo vacío o contenido PDF inválido |
| 401 | Sesión ausente o inválida |
| 403 | Rol insuficiente o recurso perteneciente a otro docente |
| 404 | Curso, lección o archivo inexistente |
| 409 | Curso bloqueado, revisión ya decidida o contenido incompleto al aprobar |
| 413 | Archivo que supera el tamaño máximo |
| 415 | Tipo de archivo o formato de envío no admitido |
| 500 | Fallo inesperado |

Los códigos específicos de archivos son `ARCHIVO_DEMASIADO_GRANDE` y `TIPO_ARCHIVO_INVALIDO`.

### Limpieza de archivos

Las eliminaciones fallidas y las reservas de subidas se registran de forma persistente en
`archivo_borrado_pendiente`, creada por la migración 016.

La limpieza se reintenta al arrancar, después de las subidas y mediante este comando desde `backend`:

```powershell
npm run archivos:limpiar
```

Cada ejecución procesa hasta 50 pendientes elegibles. Las reservas de subidas interrumpidas son
elegibles después de una hora. Los fallos conservan el pendiente para un nuevo intento.
Al desplegar el backend, programa la ejecución periódica de este comando en el entorno de despliegue.

### Integración con el integrante 2

Cursos expone una interfaz mínima mediante `cursosService`. Administración y Contenido colaboran
con ese servicio; cada módulo conserva la responsabilidad de su repositorio.

El integrante 2 debe reutilizar esta interfaz para resolver el curso y propietario de una lección,
comprobar si admite edición y obtener `CursoDetalle` con su validación. Sus escrituras y envíos a
revisión deben bloquear la misma fila del curso y compartir la transacción cuando corresponda,
para coordinarse con las subidas y las decisiones administrativas.

El servicio de limpieza de Contenido ofrece `retirarPdfSinUso` para coordinar la eliminación de PDF
al borrar lecciones o módulos dentro de la transacción. La eliminación física se reintenta después
de confirmar los cambios.

Están pendientes de la parte del integrante 2 el listado y detalle privados del docente, el CRUD de
cursos, módulos y lecciones y el envío a revisión. Al reenviar un curso rechazado, su servicio debe
limpiar el motivo anterior.

El frontend del integrante 4 ya contempla estas operaciones. La demostración completa de crear un
curso desde el editor, subir el PDF, enviar, rechazar, corregir, reenviar y aprobar requiere completar
las rutas privadas del integrante 2.

## 14. Pruebas locales

Las pruebas crean y eliminan datos. Utiliza exclusivamente la base `learnity_test`, separada de la
base de desarrollo, y un archivo `backend/.env.test`.

### Preparar PostgreSQL

Si la base no existe, con la cuenta administradora y Query Tool conectado a `postgres`, ejecuta una vez:

```sql
CREATE DATABASE learnity_test;
```

Abre un nuevo Query Tool conectado a `learnity_test`. Para una base nueva, ejecuta completos y en orden:

1. `database/learnity_esquema.sql`.
2. `database/015_sesiones_y_recuperacion.sql`.
3. `database/016_limpieza_pdf.sql`.

Si ya están aplicados el esquema y la migración 015, aplica únicamente la migración 016 que falte.
Con la cuenta propietaria de las tablas, todavía conectado a `learnity_test`, concede los permisos:

```sql
GRANT CONNECT ON DATABASE learnity_test TO learnity_app;
GRANT USAGE ON SCHEMA public TO learnity_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO learnity_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO learnity_app;
```

### Configurar el entorno

Desde `backend`, en PowerShell:

```powershell
if (-not (Test-Path .env.test)) {
  Copy-Item .env.test.example .env.test
}
```

Ajusta `backend/.env.test` con el puerto y la contraseña de tu instalación:

```dotenv
NODE_ENV=test
DB_HOST=localhost
DB_PORT=5432
DB_NAME=learnity_test
DB_USER=learnity_app
DB_PASSWORD=TU_CLAVE_LOCAL_DE_LEARNITY_APP
DB_SSL=false
JWT_SECRET=clave-solo-para-pruebas-de-mas-de-32-caracteres
CORS_ORIGIN=http://localhost:4200
FRONTEND_URL=http://localhost:4200
COOKIE_SECURE=false
CORREO_TRANSPORTE=buzon
HIBP_ACTIVO=false
PDF_DIR=uploads/pdf-test
```

Sustituye `TU_CLAVE_LOCAL_DE_LEARNITY_APP` por tu contraseña real local. El `JWT_SECRET` del ejemplo
es exclusivo del entorno de pruebas. Conserva `.env` para el entorno de desarrollo.

Las pruebas nuevas comprueban `NODE_ENV=test` y un nombre de base terminado en `_test`.
Las pruebas heredadas de Identidad eliminan cuentas `@pruebas.test`, por lo que la base de pruebas
debe permanecer exclusiva para este uso.

### Ejecutar las comprobaciones

Desde `backend`, ejecuta en este orden:

```powershell
npm run typecheck
npm run build
npm test
```

`npm test` incluye Identidad, catálogo público, validación de PDF y Administración/Contenido.
Ejecuta los archivos de uno en uno y omite por nombre una comprobación heredada que consulta
Have I Been Pwned, para mantener la selección local independiente de ese servicio externo.

Para ejecutar solo las pruebas de PDF, sin PostgreSQL:

```powershell
npm run test:pdf
```

Para ejecutar las pruebas del integrante 3 con PostgreSQL:

```powershell
npm run test:integrante3
```

Las pruebas cubren permisos por rol y propietario, PDF válidos e inválidos, tamaños límite,
descargas, reemplazos, recuperación tras fallos y decisiones simultáneas de administradores.
Las pruebas de integración levantan su propio servidor y utilizan archivos temporales.

Una prueba provoca deliberadamente un fallo de limpieza y puede mostrar una advertencia `[PDF]`.
Comprueba que esa prueba pase y que el resumen final indique cero fallos.

Estos casos verifican el backend con datos técnicos creados mediante SQL. La prueba completa del
recorrido docente y administrativo desde Angular requiere las rutas del integrante 2 descritas
en la sección 13.

## Sprint 2 — Integrante 2: Backend de Gestión de Cursos

### Descripción
Se implementó el backend de gestión de cursos de Learnity, desarrollado con Node.js, Express, TypeScript y PostgreSQL.

Permite a los docentes autenticados crear, consultar, editar y organizar cursos mediante módulos y lecciones de tipo DOCUMENTO, así como enviarlos a revisión administrativa.

### Endpoints implementados

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/docente/cursos` | Listar cursos del docente autenticado |
| GET | `/api/docente/cursos/:id` | Consultar el detalle de un curso propio |
| POST | `/api/cursos` | Crear un curso en BORRADOR |
| PUT | `/api/cursos/:id` | Editar un curso propio |
| POST | `/api/cursos/:id/modulos` | Crear un módulo |
| PUT | `/api/modulos/:id` | Actualizar un módulo |
| DELETE | `/api/modulos/:id` | Eliminar un módulo |
| POST | `/api/modulos/:id/lecciones` | Crear una lección DOCUMENTO |
| PUT | `/api/lecciones/:id` | Actualizar una lección |
| DELETE | `/api/lecciones/:id` | Eliminar una lección |
| POST | `/api/cursos/:id/enviar-revision` | Validar y enviar un curso a revisión |

### Reglas de negocio

- Las rutas privadas requieren autenticación JWT y rol DOCENTE.
- Solo el docente propietario puede modificar sus cursos.
- Se permite editar cursos en estado BORRADOR o RECHAZADO.
- Los cursos EN_REVISION y PUBLICADO no pueden modificarse.
- Cada curso admite un máximo de 10 módulos.
- Cada módulo admite un máximo de 12 lecciones.
- Los órdenes deben ser únicos dentro de cada curso o módulo, respectivamente.
- Para enviar un curso a revisión, debe cumplir los requisitos de contenido establecidos.
- Las eliminaciones que involucren archivos PDF se coordinan con el servicio de limpieza de Contenido.
- Las modificaciones se realizan mediante transacciones PostgreSQL.

### Integración con otros módulos
El backend reutiliza los servicios de integración de Cursos y la validación de contenido y PDF existente.

El frontend Angular consume los endpoints mediante `gestion-cursos.api.ts`.

El módulo de Administración permite aprobar o rechazar cursos enviados a revisión.

### Pruebas
Se incorporaron dos archivos de pruebas:

- `backend/test/cursos-gestion.test.ts`
- `backend/test/cursos-gestion-http.test.ts`

Se ejecutaron correctamente 62 pruebas automáticas del proyecto, incluidas 16 pruebas nuevas de validación y seguridad correspondientes al integrante 2.

Comandos para verificar el backend desde la carpeta `backend`:

```powershell
npm test
npm run typecheck
npm run build
```

Las pruebas de integración utilizan una base PostgreSQL independiente, configurada mediante `.env.test`.

### Documentación API
Los 11 endpoints están documentados en:

`backend/src/shared/http/openapi-integrante2.ts`

La documentación interactiva se encuentra disponible al ejecutar el backend:

`http://localhost:3000/api/docs`

### Estado de implementación
Los 11 endpoints están implementados y se han probado los flujos de creación, edición, organización, envío, rechazo, corrección y publicación de cursos.
