# Learnity

Plataforma web de cursos en línea, organizados en módulos y lecciones. El alcance del proyecto contempla videos cortos, documentos PDF y PowerPoint y evaluaciones de opción múltiple.

La entrega actual integra la gestión privada de cursos del integrante 2, la revisión administrativa y los PDF privados del integrante 3 y el frontend docente y administrativo del integrante 4 para ese recorrido.

La solicitud para convertirse en docente y su aprobación o rechazo por el administrador también funcionan con PostgreSQL.

La gestión administrativa de usuarios continúa como prototipo con datos de ejemplo. Su integración con el backend está pendiente.

**Arquitectura:** monolito modular en capas · API REST con Node.js, Express 5 y TypeScript · frontend Angular 21 · PostgreSQL 17.

| Carpeta     | Contenido                                                        |
| ----------- | ---------------------------------------------------------------- |
| `backend/`  | API REST con Express, TypeScript y conexión directa a PostgreSQL |
| `frontend/` | Aplicación web Angular                                           |
| `database/` | Modelo SQL y scripts de cambios que se aplican mediante pgAdmin  |

## 1. Requisitos

- Node.js 22 o superior. Comprueba la versión con `node -v`.
- PostgreSQL 17 con la base `learnity` preparada según la guía `Guia_Learnity_PostgreSQL_pgAdmin.docx`.
- Angular CLI 21 es opcional; también se puede utilizar el CLI local del proyecto mediante sus scripts de npm.

Para instalar Angular CLI globalmente:

```powershell
npm install -g @angular/cli@21
```

## 2. Base de datos

Con la base `learnity` y el esquema principal preparados, aplica estos scripts en orden mediante pgAdmin, utilizando la cuenta propietaria de las tablas:

1. `database/015_sesiones_y_recuperacion.sql`: sesiones y enlaces de recuperación.
2. `database/016_limpieza_pdf.sql`: cola persistente de archivos PDF pendientes de eliminación.

Comprueba que Query Tool esté conectado a `learnity` antes de ejecutarlos. Si el esquema o una migración ya están aplicados, conserva sus tablas y datos y aplica únicamente los cambios que falten.

La documentación de la base está en [`database/README.md`](database/README.md). Allí está también el procedimiento de las migraciones numeradas del refactor (`database/migraciones/`): qué hace cada script, cómo aplicarlo con `psql` o con los `.ps1`, el respaldo previo con `pg_dump` y cómo lo aplica cada integrante en su base local. Este README no lo repite.

Las pruebas automáticas utilizan una base exclusiva llamada `learnity_test`. Su preparación está explicada en la sección 14.

## 3. Backend

Desde la raíz del proyecto, en PowerShell:

```powershell
cd backend
npm install

if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
}
```

En macOS o Linux, la copia inicial se realiza con:

```bash
cp .env.example .env
```

Completa `backend/.env` con:

- La conexión a PostgreSQL y la contraseña de `learnity_app`.
- Un `JWT_SECRET` aleatorio de al menos 32 caracteres. El comando para generarlo está en `.env.example`.
- `SEED_PASSWORD`, utilizada para crear las cuentas de prueba.

Configura también el directorio privado de PDF:

```dotenv
PDF_DIR=uploads/pdf
```

Al ejecutar los comandos desde `backend`, esa ruta corresponde a `backend/uploads/pdf`. El servidor crea el directorio cuando guarda el primer archivo.

Después ejecuta:

```powershell
npm run db:seed
npm run db:probar
npm run dev
```

Estos comandos:

- Crean las cuentas de prueba y las categorías.
- Comprueban que las cuentas existen y que sus contraseñas coinciden.
- Inician la API en `http://localhost:3000/api`.

Enlaces del backend:

- Estado del servidor y conexión a PostgreSQL: [http://localhost:3000/api/salud](http://localhost:3000/api/salud).
- Documentación interactiva de la API: [http://localhost:3000/api/docs](http://localhost:3000/api/docs). Solo existe con `NODE_ENV=development` (el valor por defecto); en `test` y `production` responde 404. El contrato publicado es [`docs/api/openapi.yaml`](docs/api/openapi.yaml).

Al arrancar, la consola informa la conexión a PostgreSQL, si falta la tabla de sesiones y qué transporte de correo se utiliza.

El arranque también reintenta la limpieza de PDF pendientes. Si aparece una advertencia `[PDF]`, revisa la migración 016 y ejecuta:

```powershell
npm run archivos:limpiar
```

## 4. Frontend

Abre otra terminal situada en la raíz del proyecto:

```powershell
cd frontend
npm install
npm start
```

La aplicación estará disponible en:

[http://localhost:4200](http://localhost:4200)

En desarrollo, las llamadas a `/api` se redirigen al backend mediante `proxy.conf.json`. Así el navegador utiliza un solo origen y las cookies de sesión funcionan mediante ese proxy.

Mantén abiertas las terminales del frontend y del backend mientras utilizas la aplicación.

## 5. Cuentas de prueba

Las cuentas se crean mediante `npm run db:seed`, utilizando la contraseña configurada en `SEED_PASSWORD` dentro de `.env`.

| Rol                               | Correo                      | Acceso al perfil                    |
| --------------------------------- | --------------------------- | ----------------------------------- |
| Estudiante                        | `rosa.vera@correo.com`      | Mi perfil: `/perfil`                |
| Docente, también Estudiante       | `carlos.mendoza@correo.com` | Ajustes y perfil: `/docente/perfil` |
| Administrador, también Estudiante | `ana.torres@learnity.com`   | Ajustes y perfil: `/admin/perfil`   |

La política de contraseñas de al menos 15 caracteres se aplica al crear o cambiar una contraseña. Las cuentas sembradas previamente con una contraseña más corta pueden iniciar sesión, pero al cambiarla deben cumplir la política actual.

Al iniciar sesión, todos los roles llegan al inicio personalizado, en `/`.

Accesos de navegación:

- Al pasar el mouse sobre la foto de perfil aparece el menú con los paneles disponibles, Mi aprendizaje, Mi perfil y Cerrar sesión.
- Al pasar el mouse sobre Mi aprendizaje se muestran los cursos recientes del prototipo.
- Si un Docente o Administrador abre `/perfil`, se le dirige al perfil de su panel.
- La gestión de cursos está en **Mis cursos**, en `/docente/cursos`; `/docente` redirige ahí.
- La revisión administrativa de cursos está en `/admin/revision`; `/admin` redirige ahí.

El visitante puede acceder al inicio, catálogo, detalle público, login, registro y recuperación de contraseña.

## 6. Sesión y seguridad de la cuenta — Sprint 1

| Tema                         | Funcionamiento                                                                                                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contraseñas                  | bcrypt con costo 12 y salt propio por hash. Mínimo 15 caracteres y máximo 72 bytes UTF-8, sin reglas de composición. Se rechazan contraseñas comunes, basadas en el nombre o correo y expuestas en filtraciones. |
| Comprobación de filtraciones | Integración con [Have I Been Pwned](https://haveibeenpwned.com/API/v3#PwnedPasswords) mediante k-anonimato: se envían únicamente los primeros cinco caracteres del hash SHA-1.                                   |
| Inicio de sesión             | Mensaje genérico para correo inexistente, contraseña incorrecta o cuenta bloqueada. Cinco fallos consecutivos bloquean la cuenta durante 15 minutos.                                                             |
| Límite por IP                | Las rutas de autenticación aplican límites de peticiones. Al superarlos responden 429 con `Retry-After`.                                                                                                         |
| Access token                 | JWT de 15 minutos, configurable mediante `ACCESS_MINUTOS`. Permanece en memoria del navegador. Una sesión revocada deja de autorizar peticiones.                                                                 |
| Refresh token                | Token opaco y aleatorio en la cookie `learnity_rt`, con HttpOnly, SameSite=Lax y `Path=/api/auth`. Utiliza Secure cuando se configura HTTPS. Se guarda únicamente su hash en la base.                            |
| Rotación de refresh          | El refresh token rota en cada uso. Reutilizar un token anterior revoca la sesión.                                                                                                                                |
| Duración de sesión           | Siete días sin uso mediante `REFRESH_DIAS` y un máximo total de 30 días mediante `SESION_MAX_DIAS`.                                                                                                              |
| CSRF                         | Refresh y logout exigen que `X-XSRF-TOKEN` coincida con la cookie `XSRF-TOKEN`, firmada y vinculada a la sesión.                                                                                                 |
| Origen                       | Las rutas de autenticación verifican el origen de las peticiones.                                                                                                                                                |
| Recarga de página            | Angular intenta recuperar la sesión mediante `/api/auth/refresh` antes de la primera navegación.                                                                                                                 |
| Cerrar sesión                | Revoca la sesión en el servidor.                                                                                                                                                                                 |
| Cambiar contraseña           | Cierra las demás sesiones de la cuenta.                                                                                                                                                                          |
| Restablecer contraseña       | Cierra todas las sesiones y envía una notificación por correo.                                                                                                                                                   |
| Recuperación                 | Respuesta idéntica para correos existentes e inexistentes. Enlaces aleatorios, de un solo uso y con vencimiento configurable.                                                                                    |
| Límites de recuperación      | Un enlace nuevo invalida el anterior. Máximo tres solicitudes por cuenta y hora.                                                                                                                                 |
| Token de recuperación        | Viaja en el fragmento de la URL mediante `#token=`, evitando su envío como parte de la petición HTTP.                                                                                                            |
| Auditoría                    | Eventos de seguridad en JSON por la salida estándar. Los registros omiten contraseñas, tokens y cookies y enmascaran los correos.                                                                                |

La duración del enlace de recuperación se configura mediante `RECUPERACION_MINUTOS`, con un valor permitido entre 15 y 30 minutos y un valor habitual de 20 minutos.

Para desarrollo local por HTTP:

```dotenv
COOKIE_SECURE=false
```

Antes de desplegar se requiere HTTPS, `COOKIE_SECURE=true` y la configuración de `TRUST_PROXY` cuando exista un proxy inverso. MFA para administradores corresponde al alcance previsto para Sprint 4.

## 7. Correo con la Gmail API

En desarrollo:

```dotenv
CORREO_TRANSPORTE=buzon
```

Los correos se guardan como archivos JSON dentro de `backend/.buzon/`, carpeta ignorada por Git. Abre el archivo más reciente para consultar el enlace de recuperación.

Para utilizar Gmail, una persona del equipo configura la cuenta emisora. Los estudiantes únicamente reciben los mensajes.

Procedimiento:

1. En [Google Cloud Console](https://console.cloud.google.com/), crea un proyecto y habilita Gmail API.
2. Configura la pantalla de consentimiento OAuth de tipo externo.
3. Agrega la cuenta emisora como usuario de prueba y el alcance:

   ```text
   https://www.googleapis.com/auth/gmail.send
   ```

4. Crea un cliente OAuth de tipo aplicación de escritorio.
5. Configura en `backend/.env`:

   ```dotenv
   GMAIL_CLIENT_ID=TU_ID_DE_CLIENTE
   GMAIL_CLIENT_SECRET=TU_SECRETO_DE_CLIENTE
   GMAIL_REMITENTE=TU_CUENTA_EMISORA
   ```

6. Ejecuta:

   ```powershell
   npm run correo:autorizar
   ```

7. Abre el enlace mostrado e inicia sesión con la cuenta emisora. El script guarda `GMAIL_REFRESH_TOKEN` directamente en `.env`.
8. Cambia el transporte:

   ```dotenv
   CORREO_TRANSPORTE=gmail
   ```

9. Comprueba el envío:

   ```powershell
   npm run correo:probar -- tu-buzon-de-prueba@gmail.com
   ```

10. Comprueba la recuperación de contraseña y el enlace recibido.

Si el backend está en un servidor sin navegador, puede utilizarse un túnel:

```bash
ssh -L 8765:127.0.0.1:8765 usuario@servidor
```

Después ejecuta en el servidor:

```powershell
npm run correo:autorizar -- --puerto 8765
```

En modo de prueba de OAuth, el refresh token puede caducar a los siete días y requerir una nueva autorización.

Las credenciales se conservan en las variables de entorno y quedan excluidas del repositorio.

## 8. Modo demostración y pantallas de prototipo

El modo demostración está desactivado en la configuración actual:

```typescript
modoDemo: false;
```

Los archivos de configuración son:

- `frontend/src/environments/environment.ts`
- `frontend/src/environments/environment.development.ts`

Con esta configuración utilizan la API real:

- Registro e inicio de sesión.
- Sesiones, perfil y recuperación de contraseña.
- Catálogo y detalle público de cursos.
- Gestión privada de cursos, módulos y lecciones.
- Subida y descarga privada de PDF.
- Envío y revisión administrativa de cursos.

Para presentar el acceso simulado por rol puede activarse `modoDemo: true`. Las sesiones simuladas viven en memoria y se pierden al recargar.

Algunas pantallas continúan utilizando `frontend/src/app/data/datos-demo.ts`, incluso con el modo demostración desactivado. Es el caso de la gestión administrativa de usuarios.

El estado de estas funciones está detallado en la sección 16.

## 9. Arquitectura del backend: monolito modular en capas

Las peticiones se organizan mediante:

`routes → controller → service → repository → PostgreSQL`

Las colaboraciones entre módulos se realizan mediante sus servicios.

| Capa       | Archivo           | Responsabilidad                                                                 |
| ---------- | ----------------- | ------------------------------------------------------------------------------- |
| Routes     | `*.routes.ts`     | Rutas, verbos HTTP y middlewares de autenticación, autorización y validación    |
| Controller | `*.controller.ts` | Recibir y validar la petición, llamar al servicio y construir la respuesta HTTP |
| Service    | `*.service.ts`    | Reglas de negocio, permisos, estados, límites y coordinación de transacciones   |
| Repository | `*.repository.ts` | Consultas SQL parametrizadas y acceso a los datos del módulo                    |

Reglas del equipo:

- Cada módulo consulta sus tablas mediante su repositorio.
- Las operaciones entre módulos utilizan sus servicios.
- El SQL permanece en los repositorios.
- Las consultas utilizan parámetros.
- Las operaciones de una misma escritura comparten el cliente de transacción cuando corresponde.
- Los recursos compartidos están en `backend/src/shared/`.

Para crear la estructura de un módulo:

```powershell
npm run crear-modulo -- nombre "descripción"
```

| Módulo           | Responsabilidad y estado                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| `identidad`      | Registro, login, sesiones, perfil y recuperación implementados                                          |
| `cursos`         | Categorías públicas, catálogo, gestión privada, envío a revisión e integración implementados            |
| `contenido`      | PDF privado implementado; otros formatos previstos para siguientes entregas                             |
| `aprendizaje`    | Inscripciones y progreso previstos para Sprint 3                                                        |
| `evaluaciones`   | Preguntas, intentos y notas previstos para Sprint 4                                                     |
| `administracion` | Revisión de cursos y solicitudes de docente implementadas; gestión de usuarios pendiente de integración |

## 10. Sprint 1: estado

Implementado con PostgreSQL real:

- Registro.
- Inicio de sesión y bloqueo temporal.
- Sesiones con refresh rotatorio.
- Cierre de sesión.
- Consulta y actualización de perfil.
- Cambio de contraseña.
- Recuperación de contraseña por correo.

Las rutas implementadas de Identidad responden mediante sus servicios y repositorios.

La suite `backend/test/identidad.test.ts` cubre:

- Registro y política de contraseñas.
- Login y bloqueo.
- Límites por IP.
- Perfil y permisos por rol.
- Rotación y reutilización del refresh token.
- CSRF y verificación de origen.
- Cierre de sesión.
- Cambio de contraseña.
- Recuperación con enlaces de un solo uso y vencimiento.
- Invalidación de enlaces anteriores y límites por hora.
- Registros de auditoría sin secretos.

Estas pruebas se incluyen en `npm test`, utilizando `.env.test`.

La selección local omite por nombre una prueba que consulta Have I Been Pwned.

**Comprobación de correo pendiente:** el equipo informó que Gmail API confirmó un envío real; sigue pendiente confirmar la recepción y el funcionamiento del enlace en el buzón. El transporte local `buzon` permanece disponible para pruebas.

## 11. Sprint 2: API pública y catálogo

Endpoints implementados:

| Método | Ruta              | Función                       |
| ------ | ----------------- | ----------------------------- |
| GET    | `/api/categorias` | Consultar categorías públicas |
| GET    | `/api/cursos`     | Consultar el catálogo         |
| GET    | `/api/cursos/:id` | Consultar el detalle público  |

El contrato de filtros, paginación y respuestas está disponible en:

[http://localhost:3000/api/docs](http://localhost:3000/api/docs)

Para preparar cursos sintéticos del catálogo, desde `backend`:

```powershell
npm run db:seed-publico
npm run dev
```

Después abre:

[http://localhost:4200/cursos](http://localhost:4200/cursos)

El script crea tres cursos publicados y un borrador con la marca `[Prueba Sprint 2]`.

Esos datos sirven para comprobar el catálogo. El recorrido docente y administrativo se comprueba creando un curso desde el editor y llevándolo hasta su publicación.

La suite del catálogo utiliza la base exclusiva `learnity_test`. Para ejecutarla por separado:

```powershell
npx tsx --env-file=.env.test --test --test-concurrency=1 test/cursos-publicos.test.ts
```

Distribución de responsabilidades de esta entrega:

| Integrante | Responsabilidad                                                  | Estado                   |
| ---------- | ---------------------------------------------------------------- | ------------------------ |
| 2          | Backend privado de cursos, módulos, lecciones y envío a revisión | Implementado e integrado |
| 3          | Revisión administrativa de cursos y PDF privado                  | Implementado e integrado |
| 4          | Editor docente y revisión administrativa desde Angular           | Implementado e integrado |

El recorrido de creación, edición, PDF, envío, rechazo, corrección, reenvío y publicación se comprobó por HTTP y manualmente desde Angular.

## 12. Comandos útiles

| Carpeta    | Comando                                       | Función                                            |
| ---------- | --------------------------------------------- | -------------------------------------------------- |
| `backend`  | `npm run dev`                                 | Iniciar la API con recarga automática              |
| `backend`  | `npm run typecheck`                           | Comprobar tipos del código, scripts y pruebas      |
| `backend`  | `npm run build`                               | Compilar el backend                                |
| `backend`  | `npm start`                                   | Ejecutar el backend compilado                      |
| `backend`  | `npm test`                                    | Ejecutar la suite local utilizando `.env.test`     |
| `backend`  | `npm run test:pdf`                            | Comprobar la validación de PDF sin PostgreSQL      |
| `backend`  | `npm run test:integrante3`                    | Ejecutar pruebas de PDF y Administración/Contenido |
| `backend`  | `npm run archivos:limpiar`                    | Reintentar la eliminación de PDF pendientes        |
| `backend`  | `npm run db:seed`                             | Crear cuentas y categorías de prueba               |
| `backend`  | `npm run db:probar`                           | Comprobar las cuentas sembradas                    |
| `backend`  | `npm run db:seed-publico`                     | Crear cursos sintéticos para el catálogo           |
| `backend`  | `npm run correo:autorizar`                    | Autorizar la cuenta emisora de Gmail               |
| `backend`  | `npm run correo:probar -- correo@ejemplo.com` | Enviar un correo de prueba                         |
| `frontend` | `npm start`                                   | Iniciar Angular en desarrollo                      |
| `frontend` | `npm run build`                               | Compilar el frontend                               |
| `frontend` | `npm test`                                    | Ejecutar las pruebas unitarias                     |

## 13. Sprint 2: Administración y PDF privado — integrante 3

La revisión administrativa y los PDF privados utilizan PostgreSQL y el contrato consumido por Angular.

### Endpoints y respuestas

Todas estas rutas requieren autenticación Bearer y una sesión vigente.

| Método | Ruta                                   | Autorización                                            | Respuesta correcta              |
| ------ | -------------------------------------- | ------------------------------------------------------- | ------------------------------- |
| GET    | `/api/admin/cursos?estado=EN_REVISION` | ADMIN                                                   | 200, listado en `items`         |
| GET    | `/api/admin/cursos/:id`                | ADMIN                                                   | 200, `CursoDetalle`             |
| PUT    | `/api/admin/cursos/:id/revision`       | ADMIN                                                   | 200, `CursoDetalle` actualizado |
| POST   | `/api/lecciones/:id/archivo`           | DOCENTE propietario, curso editable y lección DOCUMENTO | 200, `CursoDetalle` actualizado |
| GET    | `/api/archivos/:id`                    | ADMIN o DOCENTE propietario                             | 200, contenido binario PDF      |

Cuando no hay cursos pendientes, el listado responde:

```json
{
  "items": []
}
```

En los resúmenes, `modulos` representa una cantidad numérica. En el detalle, módulos y lecciones son arreglos ordenados.

Las decisiones administrativas y las subidas devuelven el curso completo directamente en la raíz de la respuesta, incluyendo su validación recalculada.

Cada lección contiene los metadatos de su PDF o `archivo: null`.

Los metadatos incluyen:

- `id`
- `tipo`
- `nombreOriginal`
- `tamanoBytes`

La ruta física del archivo permanece privada.

### Aprobar o rechazar un curso

Para aprobar:

```http
PUT /api/admin/cursos/:id/revision
```

```json
{
  "decision": "APROBAR"
}
```

Para rechazar:

```json
{
  "decision": "RECHAZAR",
  "motivo": "Amplía los ejemplos de la primera lección."
}
```

El motivo es obligatorio después de quitar espacios de los extremos y admite hasta 300 caracteres.

La revisión exige que el curso siga en `EN_REVISION`.

Al aprobar:

- Se vuelve a validar el contenido y sus PDF.
- Se registra el administrador revisor.
- El estado cambia a `PUBLICADO`.
- Se registra la fecha de publicación.
- El curso queda disponible en el catálogo público.

Al rechazar:

- Se registra el administrador revisor.
- Se guarda el motivo.
- El estado cambia a `RECHAZADO`.
- El docente puede corregir y reenviar el curso.

La comprobación y la decisión son atómicas. Si dos administradores intentan decidir sobre la misma revisión, la segunda decisión responde 409.

El detalle administrativo permite consultar el estado vigente de un curso ya revisado.

### Subida, reemplazo y descarga de PDF

La subida utiliza `multipart/form-data` y el campo debe llamarse:

```text
archivo
```

El navegador genera el encabezado multipart y su boundary al enviar `FormData`.

Reglas:

- Tamaño entre 1 y 10485760 bytes.
- Máximo de 10 MiB.
- Validación de extensión, tamaño y estructura real del PDF.
- Subida permitida al DOCENTE propietario.
- Curso en `BORRADOR` o `RECHAZADO`.
- Lección de tipo `DOCUMENTO`.
- Un PDF principal por lección.

Si un reemplazo falla antes de confirmarse, se conserva el archivo anterior.

Los archivos se guardan con nombres generados por el servidor dentro de `PDF_DIR`. Por defecto corresponde a `backend/uploads/pdf` al ejecutar desde `backend`.

El almacenamiento es privado y queda fuera de `frontend/public` y de las rutas estáticas.

La descarga autorizada responde con:

```http
Content-Type: application/pdf
Cache-Control: private, no-store
```

La respuesta se entrega como archivo adjunto.

En esta entrega pueden descargar el ADMIN y el DOCENTE propietario. El acceso del estudiante inscrito corresponde al recorrido previsto para Sprint 3.

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

`detalles` puede omitirse cuando el error sea general.

Los campos `archivo` y `motivo` permiten que Angular coloque los mensajes junto al control correspondiente.

| HTTP | Situación                                                               |
| ---- | ----------------------------------------------------------------------- |
| 400  | Datos inválidos, multipart inválido, archivo vacío o PDF inválido       |
| 401  | Sesión ausente o inválida                                               |
| 403  | Rol insuficiente o recurso perteneciente a otro docente                 |
| 404  | Curso, lección o archivo inexistente                                    |
| 409  | Curso bloqueado, revisión ya decidida o contenido incompleto al aprobar |
| 413  | Archivo que supera el tamaño máximo                                     |
| 415  | Tipo de archivo o formato de envío no admitido                          |
| 500  | Fallo inesperado                                                        |

Códigos específicos de archivos:

- `ARCHIVO_DEMASIADO_GRANDE`
- `TIPO_ARCHIVO_INVALIDO`

### Limpieza de archivos

Las eliminaciones pendientes y las reservas de subidas se registran en:

```text
archivo_borrado_pendiente
```

La tabla se crea mediante la migración 016.

La limpieza se reintenta al arrancar, después de las subidas y mediante:

```powershell
npm run archivos:limpiar
```

Cada ejecución procesa hasta 50 pendientes elegibles.

Las reservas de subidas interrumpidas son elegibles después de una hora. Los fallos conservan el pendiente para reintentos posteriores.

Al desplegar el backend debe programarse la ejecución periódica del comando en el entorno de despliegue.

### Integración entre Cursos, Administración y Contenido

Cursos expone las operaciones compartidas mediante `cursosService`.

Administración y Contenido utilizan ese servicio, manteniendo cada módulo la responsabilidad de su repositorio.

La integración permite:

- Resolver el curso, propietario y estado de una lección.
- Comprobar si el curso admite edición.
- Obtener `CursoDetalle` con su validación.
- Asociar un PDF a una lección.
- Aplicar una decisión administrativa de forma atómica.

Las escrituras y los envíos a revisión bloquean la misma fila de curso y comparten el cliente de transacción cuando corresponde.

El servicio de limpieza de Contenido ofrece `retirarPdfSinUso` para coordinar la eliminación de PDF al borrar módulos o lecciones. La eliminación física se reintenta después de confirmar los cambios.

Los once endpoints privados del integrante 2 están implementados. Al reenviar un curso rechazado se limpia el motivo anterior.

El recorrido completo se comprobó por HTTP con PostgreSQL y manualmente desde Angular en la instalación local del equipo.

## 14. Pruebas locales

Las pruebas crean y eliminan datos. Utiliza exclusivamente la base `learnity_test`, separada de la base de desarrollo.

Para aplicar a `learnity_test` las migraciones del refactor (`database/migraciones/`), sigue el procedimiento de [`database/README.md`](database/README.md).

La configuración se encuentra en:

```text
backend/.env.test
```

### Preparar PostgreSQL

Si la base todavía no existe, abre Query Tool conectado a `postgres` con la cuenta administradora y ejecuta una vez:

```sql
CREATE DATABASE learnity_test;
```

Después abre Query Tool conectado a `learnity_test`.

Para una base nueva, ejecuta completos y en orden:

1. `database/learnity_esquema.sql`
2. `database/015_sesiones_y_recuperacion.sql`
3. `database/016_limpieza_pdf.sql`

Si el esquema y algunas migraciones ya están aplicados, conserva las tablas y aplica únicamente los cambios que falten.

Con la cuenta propietaria de las tablas y conectado a `learnity_test`, concede los permisos:

```sql
GRANT CONNECT ON DATABASE learnity_test TO learnity_app;

GRANT USAGE ON SCHEMA public TO learnity_app;

GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO learnity_app;

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA public
TO learnity_app;
```

### Configurar el entorno

Desde `backend`, en PowerShell:

```powershell
if (-not (Test-Path .env.test)) {
  Copy-Item .env.test.example .env.test
}
```

Ajusta `backend/.env.test` con la contraseña y el puerto de tu instalación:

```dotenv
NODE_ENV=test

DB_HOST=localhost
DB_PORT=5432
DB_NAME=learnity_test
DB_USER=learnity_app
DB_PASSWORD="TU_CLAVE_LOCAL_DE_LEARNITY_APP"
DB_SSL=false

JWT_SECRET=clave-solo-para-pruebas-de-mas-de-32-caracteres

CORS_ORIGIN=http://localhost:4200
FRONTEND_URL=http://localhost:4200
COOKIE_SECURE=false

CORREO_TRANSPORTE=buzon
HIBP_ACTIVO=false

PDF_DIR=uploads/pdf-test
```

Sustituye `TU_CLAVE_LOCAL_DE_LEARNITY_APP` por tu contraseña local.

El `JWT_SECRET` del ejemplo es exclusivo de pruebas. El archivo `.env` conserva la configuración de desarrollo.

Las pruebas nuevas comprueban `NODE_ENV=test` y un nombre de base terminado en `_test`.

Las pruebas heredadas de Identidad eliminan cuentas del dominio `@pruebas.test`, por lo que esta base debe permanecer exclusiva para las pruebas.

### Ejecutar las comprobaciones

Desde `backend`, ejecuta en este orden:

```powershell
npm run typecheck
npm run build
npm test
```

`npm test` incluye:

- Identidad.
- Catálogo público.
- Validación de PDF.
- Administración y Contenido.
- Validaciones de gestión de cursos.
- Seguridad HTTP y pruebas de regresión de cursos, módulos y lecciones.

El script ejecuta los archivos secuencialmente y omite por nombre una comprobación que consulta Have I Been Pwned.

Para ejecutar únicamente las pruebas de PDF sin PostgreSQL:

```powershell
npm run test:pdf
```

Para ejecutar las pruebas del integrante 3:

```powershell
npm run test:integrante3
```

Para ejecutar las pruebas HTTP de gestión privada de cursos:

```powershell
npx tsx --env-file=.env.test --test --test-concurrency=1 test/cursos-gestion-http.test.ts
```

Las pruebas HTTP levantan su propio servidor y utilizan PostgreSQL. Algunas suites utilizan directorios temporales para los archivos.

Una prueba provoca deliberadamente un fallo de limpieza y puede mostrar una advertencia `[PDF]`. Comprueba el resultado de esa prueba y el resumen final.

### Resultado de la validación actual

La suite del backend terminó con:

```text
tests 67
pass 67
fail 0
```

Las comprobaciones incluyen:

- Permisos por rol y propietario.
- Estados que bloquean la edición.
- Validación y descarga de PDF.
- Reemplazo de archivos y recuperación ante fallos.
- Decisiones administrativas simultáneas.
- Identificadores fuera del rango INTEGER.
- Órdenes ocupados durante la creación y edición.
- Edición de un módulo eliminado concurrentemente.

También se completó manualmente desde Angular el recorrido de creación, edición, PDF, envío, rechazo, corrección, reenvío, aprobación y consulta pública del curso.

## 15. Sprint 2: gestión privada de cursos — integrante 2

### Descripción

El backend permite a los docentes autenticados crear, consultar, editar y organizar sus cursos mediante módulos y lecciones de tipo `DOCUMENTO`, así como enviarlos a revisión administrativa.

### Endpoints implementados

Todas estas rutas requieren sesión vigente y rol DOCENTE.

| Método | Ruta                              | Función                                   |
| ------ | --------------------------------- | ----------------------------------------- |
| GET    | `/api/docente/cursos`             | Listar los cursos del docente autenticado |
| GET    | `/api/docente/cursos/:id`         | Consultar el detalle de un curso propio   |
| POST   | `/api/cursos`                     | Crear un curso en BORRADOR                |
| PUT    | `/api/cursos/:id`                 | Editar un curso propio                    |
| POST   | `/api/cursos/:id/modulos`         | Crear un módulo                           |
| PUT    | `/api/modulos/:id`                | Actualizar un módulo                      |
| DELETE | `/api/modulos/:id`                | Eliminar un módulo                        |
| POST   | `/api/modulos/:id/lecciones`      | Crear una lección DOCUMENTO               |
| PUT    | `/api/lecciones/:id`              | Actualizar una lección                    |
| DELETE | `/api/lecciones/:id`              | Eliminar una lección                      |
| POST   | `/api/cursos/:id/enviar-revision` | Validar y enviar un curso a revisión      |

Las operaciones sobre recursos existentes comprueban el propietario real mediante los datos guardados.

Las escrituras devuelven `CursoDetalle` completo directamente en la raíz de la respuesta.

### Reglas de negocio

- El propietario se obtiene de la sesión y de la relación con el docente.
- Se permite editar cursos en `BORRADOR` o `RECHAZADO`.
- `EN_REVISION`, `PUBLICADO` y `ARCHIVADO` bloquean la edición.
- Máximo de diez módulos por curso.
- Máximo de doce lecciones por módulo.
- El orden de los módulos es único dentro del curso.
- El orden de las lecciones es único dentro del módulo.
- Se puede conservar el orden propio al editar.
- El envío exige que la validación de contenido esté completa.
- El reenvío de un curso rechazado limpia el motivo anterior.
- Las eliminaciones coordinan la limpieza de PDF con Contenido.
- Las escrituras utilizan transacciones y bloquean el curso.
- Los IDs de cursos, módulos y lecciones se validan entre `1` y `2147483647`.

### Correcciones de integración

Se corrigieron los siguientes puntos:

- La edición de módulos vuelve a comprobar su existencia después de bloquear el curso.
- El repositorio verifica que el UPDATE haya modificado exactamente una fila.
- Una edición cuyo módulo desapareció responde 404.
- Los identificadores que exceden INTEGER se rechazan con 400 antes de consultar PostgreSQL.
- Las consultas de órdenes se ejecutan desde el repositorio.
- `PUT /lecciones/:id` tiene una sola declaración.
- La documentación refleja el estado integrado de los integrantes 2, 3 y 4.

### Integración con otros módulos

El backend reutiliza:

- Las operaciones compartidas de `cursosService`.
- La validación de contenido y PDF existente.
- La limpieza de archivos de Contenido.
- La revisión administrativa de cursos.

Angular consume los endpoints mediante `gestion-cursos.api.ts`.

### Pruebas

Archivos de gestión privada:

- `backend/test/cursos-gestion.test.ts`
- `backend/test/cursos-gestion-http.test.ts`

Estos archivos reúnen 21 pruebas de validación, seguridad y regresión, incluidas dentro de las 67 pruebas aprobadas del backend.

Cinco pruebas de regresión comprueban:

1. IDs inválidos de cursos, módulos y lecciones.
2. El límite válido de INTEGER.
3. Órdenes al editar módulos.
4. Órdenes al editar lecciones.
5. La edición concurrente de un módulo eliminado.

### Documentación de la API

Los once endpoints están documentados en:

```text
backend/src/shared/http/openapi-integrante2.ts
```

La documentación interactiva está disponible con el backend iniciado:

[http://localhost:3000/api/docs](http://localhost:3000/api/docs)

### Estado de implementación

Los once endpoints están implementados e integrados con Angular, Administración y Contenido.

Se verificó por HTTP con PostgreSQL el flujo de creación, edición, organización, envío, rechazo, corrección, reenvío y publicación, incluyendo la subida y descarga de PDF.

El equipo también completó la comprobación manual de ese recorrido desde Angular en su instalación local.

## 16. Funcionalidades pendientes y alcance del prototipo

El estado actual de las cuentas y las pantallas administrativas es:

| Funcionalidad                                        | Estado actual                                                                                      |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Registro de estudiantes                              | Implementado mediante la API y PostgreSQL                                                          |
| Inicio de sesión, perfil y recuperación              | Implementados mediante la API                                                                      |
| Solicitud del estudiante para convertirse en docente | Implementada mediante la API y PostgreSQL                                                          |
| Revisión administrativa de solicitudes de docente    | Implementada mediante la API y PostgreSQL                                                          |
| Gestión administrativa de usuarios                   | Utiliza usuarios de ejemplo; pendiente de consultar y modificar las cuentas reales mediante la API |
| Revisión administrativa de cursos                    | Implementada e integrada con PostgreSQL                                                            |

El registro de una cuenta nueva guarda al estudiante en PostgreSQL. Sin embargo, esa cuenta todavía no aparece en la pantalla administrativa de usuarios porque la pantalla utiliza los datos de ejemplo de `datos-demo.ts`.

### Solicitudes para ser docente

1. El estudiante abre **Mi perfil → Solicitar ser docente** (o el enlace "Enseña en Learnity"), escribe su especialidad y su motivación (50 caracteres o más) y la envía (`POST /api/solicitudes-docente`). Su perfil muestra el estado: *En revisión*, *No fue aprobada* (con la observación del administrador) o el acceso a su panel.
2. El administrador la ve en **Panel de administración → Solicitudes de docente**, en la pestaña *Pendientes* (`GET /api/admin/solicitudes`).
3. Al **aprobar** (`PUT /api/admin/solicitudes/:id`), la cuenta recibe el rol Docente, conserva el de Estudiante y se crea su perfil docente. Al **rechazar**, la observación es obligatoria y el estudiante puede enviar una nueva solicitud.
4. El estudiante ve su panel de docente al recargar la página o en la siguiente renovación automática de la sesión (máximo 15 minutos), sin volver a iniciar sesión.

Reglas: una sola solicitud pendiente por cuenta, una cuenta que ya es docente no puede solicitar, un administrador no decide su propia solicitud y dos administradores no pueden decidir la misma a la vez. Límite: 10 envíos por hora por IP. Pruebas: `backend/test/solicitudes-docente.test.ts`.

Las decisiones de la pantalla de usuarios del prototipo no modifican las cuentas reales en PostgreSQL. La validación completada en esta entrega corresponde a la gestión y revisión de cursos y PDF y a las solicitudes de docente.

También permanecen previstos para siguientes entregas los demás formatos de contenido, el aprendizaje del estudiante, las evaluaciones y los certificados según el alcance del proyecto.
