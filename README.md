# Learnity

Plataforma web de cursos en línea (tipo Udemy): cursos organizados en módulos y lecciones con videos
cortos (MP4 ≤ 5 MB, 480p), documentos PDF y PowerPoint (≤ 10 MB) y evaluaciones de opción múltiple.

**Arquitectura:** monolito modular en capas · API REST (Node.js + Express 5 + TypeScript) · frontend Angular 21 · PostgreSQL 17.

```
learnity/
├── backend/      API REST (Express 5 + TypeScript + pg)
├── frontend/     Aplicación web (Angular 21)
└── database/     Modelo SQL de referencia (la base se crea con la guía de pgAdmin)
```

---

## 1. Requisitos

- Node.js 22 o superior (`node -v`)
- PostgreSQL 17 con la base `learnity` creada según la guía `Guia_Learnity_PostgreSQL_pgAdmin.docx`
- Angular CLI: `npm install -g @angular/cli@21` (opcional; también funciona con `npx ng`)

## 2. Backend

```bash
cd backend
npm install
copy .env.example .env      # en macOS/Linux: cp .env.example .env
```

Completa `backend/.env` con la contraseña de `learnity_app` y un `JWT_SECRET` largo. Después:

```bash
npm run db:seed     # crea las cuentas de prueba y las categorías (se puede repetir sin duplicar)
npm run db:probar   # comprueba que las cuentas existen y que las contraseñas coinciden
npm run dev         # API en http://localhost:3000/api
```

- Estado del servidor y conexión a la base: http://localhost:3000/api/salud
- Documentación de la API (Swagger): http://localhost:3000/api/docs

## 3. Frontend

```bash
cd frontend
npm install
npm start           # http://localhost:4200
```

En desarrollo, las llamadas a `/api` se redirigen al backend (`proxy.conf.json`).

## 4. Cuentas de prueba

Las crea `npm run db:seed`. Contraseña de todas: **`Learnity2026!`** (se cambia con `SEED_PASSWORD` en `.env`).

| Rol | Correo | Clic en la foto de perfil |
|---|---|---|
| Estudiante | rosa.vera@correo.com | Mi perfil (`/perfil`, diseño de Pencil) |
| Docente (también Estudiante) | carlos.mendoza@correo.com | Ajustes y perfil en su panel (`/docente/perfil`) |
| Administrador (también Estudiante) | ana.torres@learnity.com | Ajustes y perfil en su panel (`/admin/perfil`) |

Al iniciar sesión, todos los roles llegan al inicio personalizado (`/`): retomar la última lección,
recomendaciones, destacados y categorías.

- **Pasar el mouse sobre la foto de perfil** muestra el menú de la cuenta: paneles (Docente / Administración),
  Mi aprendizaje, Mi perfil y Cerrar sesión. Es la única entrada a los paneles.
- **Pasar el mouse sobre Mi aprendizaje** muestra los cursos recientes con su avance.
- Si un Docente o Administrador abre `/perfil`, se le lleva a Ajustes y perfil de su panel.
- El **Panel del docente** (`/docente`) es un resumen con accesos directos y lo que requiere atención;
  la lista completa con filtro por estado está en **Mis cursos** (`/docente/cursos`).

El visitante no tiene cuenta: ve Inicio, Catálogo, Detalle del curso, Login, Registro y Recuperar contraseña.

## 5. Modo demostración

Mientras el inicio de sesión del Sprint 1 no esté terminado, el login muestra **Accesos de demostración**
(Estudiante, Docente, Administrador) para presentar todas las pantallas sin backend.

Cuando el login real funcione, desactívalo en `frontend/src/environments/environment.ts`:

```ts
modoDemo: false,
```

Las pantallas usan por ahora los datos del prototipo de Pencil (`frontend/src/app/data/datos-demo.ts`).
En cada sprint, la lista correspondiente se reemplaza por su llamada a la API.

---

## 6. Arquitectura del backend: monolito modular en capas

Cada módulo tiene las mismas cuatro capas. **Cada capa solo llama a la de abajo.**

```
Petición → routes → controller → service → repository → PostgreSQL
```

| Capa | Archivo | Hace | No hace |
|---|---|---|---|
| routes | `*.routes.ts` | URL, verbo, middlewares de sesión/rol y validación | lógica |
| controller | `*.controller.ts` | recibe la petición, llama al service, responde | SQL ni reglas |
| service | `*.service.ts` | reglas del negocio (límites, estados, permisos) | SQL |
| repository | `*.repository.ts` | consultas SQL parametrizadas (`$1, $2…`) | reglas |

Reglas del equipo:

- Un módulo **no** consulta las tablas de otro: llama al *service* de ese módulo.
- Lo común está en `backend/src/shared/` (configuración, conexión, errores, JWT, bcrypt).
- Para crear un módulo nuevo con la misma forma: `npm run crear-modulo -- nombre "descripción"`.

| Módulo | Responsabilidad | Sprint |
|---|---|---|
| `identidad` | Registro, login, perfil, recuperar contraseña | 1 |
| `cursos` | Cursos, módulos, lecciones, categorías, catálogo | 2–3 |
| `contenido` | Videos, PDF y PowerPoint (Multer + FFmpeg) | 2 |
| `aprendizaje` | Inscripciones y progreso | 3 |
| `evaluaciones` | Preguntas, intentos y notas | 4 |
| `administracion` | Usuarios, solicitudes, revisión, indicadores | 2–4 |

## 7. Sprint 1 · qué queda por implementar

Ya está hecho:

- Estructura del backend y del frontend, conexión a PostgreSQL con `learnity_app`.
- `identidad.repository.ts`: consultas de cuentas, roles, perfil e intentos fallidos (probadas).
- `shared/auth`: `cifrarContrasena`, `compararContrasena`, `firmarToken`, middlewares `autenticar` y `autorizar`.
- Rutas, validación de datos (zod) y contrato de la API en Swagger.
- Frontend: `AuthService`, interceptor del token, guardas por rol y todas las pantallas del prototipo.

Falta (paso a paso dentro de cada método): **`backend/src/modules/identidad/identidad.service.ts`**

- `registrar` (RF-01), `iniciarSesion` con bloqueo temporal (RF-02),
  `obtenerPerfil` / `actualizarPerfil` / `cambiarContrasena` (RF-04),
  `solicitarRecuperacion` / `restablecerContrasena` (RF-06).

Mientras tanto esos endpoints responden **501** y el frontend muestra el aviso correspondiente.

## 8. Comandos útiles

| Dónde | Comando | Qué hace |
|---|---|---|
| backend | `npm run dev` | API con recarga automática |
| backend | `npm run build` / `npm start` | Compilar y ejecutar en producción |
| backend | `npm run typecheck` | Revisar tipos de TypeScript |
| frontend | `npm start` | App en modo desarrollo |
| frontend | `npm run build` | Compilación de producción en `dist/` |
| frontend | `npm test` | Pruebas unitarias (Vitest) |
