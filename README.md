# Learnity

Plataforma web de cursos en línea (tipo Udemy): cursos organizados en módulos y lecciones con videos
cortos (MP4 ≤ 5 MB, 480p), documentos PDF y PowerPoint (≤ 10 MB) y evaluaciones de opción múltiple.

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

Además del esquema de la guía, aplica en pgAdmin el script del Sprint 1 con la cuenta dueña de las tablas:
**`database/015_sesiones_y_recuperacion.sql`** (sesiones y enlaces de recuperación). Los pasos están en
[`database/README.md`](database/README.md).

## 3. Backend

```bash
cd backend
npm install
copy .env.example .env      # en macOS/Linux: cp .env.example .env
```

Completa `backend/.env`: la contraseña de `learnity_app`, un `JWT_SECRET` aleatorio de 32+ caracteres
(el comando para generarlo está en `.env.example`) y `SEED_PASSWORD`. Después:

```bash
npm run db:seed     # crea las cuentas de prueba y las categorías (se puede repetir sin duplicar)
npm run db:probar   # comprueba que las cuentas existen y que las contraseñas coinciden
npm run dev         # API en http://localhost:3000/api
```

- Estado del servidor y conexión a la base: http://localhost:3000/api/salud
- Documentación de la API (Swagger): http://localhost:3000/api/docs
- Al arrancar, la consola indica si falta el script 015 y qué transporte de correo se usa.

## 4. Frontend

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
5. Cambia `CORREO_TRANSPORTE=gmail` y prueba: `npm run correo:probar -- tu-buzon-de-prueba@gmail.com`.
6. Prueba el flujo completo: registra una cuenta con el buzón de prueba, usa "¿Olvidaste tu contraseña?"
   y abre el enlace que llega.

Mientras la app de OAuth esté en modo *Prueba*, Google caduca el refresh token a los 7 días. Repite el paso 4
o publica la app. Las credenciales de Google nunca se suben a Git ni se comparten por chat.

## 8. Modo demostración

Está **desactivado**: el login, el registro, el perfil y la recuperación usan la API real y PostgreSQL.
Para presentar pantallas sin backend, pon `modoDemo: true` en `frontend/src/environments/environment*.ts`:
el login muestra accesos simulados por rol, que viven solo en memoria y se pierden al recargar.

Las pantallas de cursos, aprendizaje y paneles siguen usando los datos del prototipo
(`frontend/src/app/data/datos-demo.ts`) hasta que sus sprints conecten la API.

---

## 9. Arquitectura del backend: monolito modular en capas

Cada módulo tiene las mismas cuatro capas. **Cada capa solo llama a la de abajo.**

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
| `cursos` | Cursos, módulos, lecciones, categorías, catálogo | 2–3 |
| `contenido` | Videos, PDF y PowerPoint (Multer + FFmpeg) | 2 |
| `aprendizaje` | Inscripciones y progreso | 3 |
| `evaluaciones` | Preguntas, intentos y notas | 4 |
| `administracion` | Usuarios, solicitudes, revisión, indicadores | 2–4 |

## 10. Sprint 1 · estado

Implementado con PostgreSQL real: registro (RF-01), login con bloqueo (RF-02), sesión con refresh rotatorio,
cierre de sesión, perfil y cambio de contraseña (RF-04), recuperación por correo (RF-06).
Ninguna ruta de Identidad responde 501.

Pruebas (`cd backend && npm test`, con una base de pruebas en `.env.test`): 22 pruebas de integración
cubren registro, política de contraseña, login y bloqueo, límite por IP, perfil y permisos por rol,
rotación y reutilización del refresh token, CSRF y origen, cierre de sesión, cambio de contraseña,
recuperación (un solo uso, vencimiento, invalidación, límite por hora) y logs sin secretos.

**Pendiente para cerrar el Sprint 1:** configurar la cuenta emisora de Gmail (sección 7) y probar el envío
real con un buzón de prueba. Hasta entonces la recuperación funciona con el buzón local.

## 11. Comandos útiles

| Dónde | Comando | Qué hace |
|---|---|---|
| backend | `npm run dev` | API con recarga automática |
| backend | `npm run build` / `npm start` | Compilar y ejecutar en producción |
| backend | `npm run typecheck` | Revisar tipos (código, scripts y pruebas) |
| backend | `npm test` | Pruebas de integración de Identidad (lee `.env.test`) |
| backend | `npm run correo:autorizar` | Autorizar una vez la cuenta emisora de Gmail |
| backend | `npm run correo:probar -- correo@ejemplo.com` | Enviar un correo de prueba |
| frontend | `npm start` | App en modo desarrollo |
| frontend | `npm run build` | Compilación de producción en `dist/` |
| frontend | `npm test` | Pruebas unitarias (Vitest) |
