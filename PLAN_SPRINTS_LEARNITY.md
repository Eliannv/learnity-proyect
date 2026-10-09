# Plan Scrum de Learnity — cuatro semanas

**Fecha de planificación:** 8 de octubre de 2026; estado revisado el 9 de octubre. **Cadencia asumida:** cuatro sprints de una semana. El equipo confirmó el envío por Gmail API en una prueba, pero aún no verificó la recepción en el buzón. La capacidad exacta dependerá del número de integrantes y horas disponibles. El Product Owner ordena el backlog y el equipo selecciona lo que puede terminar en cada planificación.

**Ritmo Scrum sugerido:** planificación al inicio de cada semana (60–90 min), Daily Scrum de 15 min, refinamiento a mitad de semana, revisión del incremento con demostración (45 min) y retrospectiva (30 min). Mantener un tablero con pendientes, en curso, en revisión y terminados. Asignar explícitamente Product Owner, Scrum Master y responsables técnicos, aunque una persona pueda cubrir más de un rol en un grupo pequeño.

## Objetivo del producto en este mes

Demostrar un recorrido real de extremo a extremo: una persona crea su cuenta, inicia sesión, encuentra un curso publicado, se inscribe, consume una lección, guarda progreso y responde una evaluación. El docente crea el curso y el administrador aprueba su publicación. Los cursos son gratuitos. El diseño de Pencil es referencia visual; una pantalla con datos de demostración no cuenta como función terminada.

## Acuerdos técnicos para el MVP

1. Mantener la arquitectura monolítica modular en capas y PostgreSQL local administrado con pgAdmin.
2. Para aprovechar el JWT existente, usar **access JWT de 15 minutos solo en memoria** y **refresh token opaco rotatorio** guardado como hash en PostgreSQL y entregado mediante cookie `HttpOnly`, `Secure` y `SameSite=Lax` en HTTPS. En desarrollo HTTP local, documentar la excepción de `Secure`; antes de publicar, HTTPS y `Secure` son obligatorios. Revocar refresh tokens al cerrar sesión, cambiar o restablecer contraseña. Proteger refresh/logout y cualquier operación autenticada por cookie frente a CSRF. No guardar tokens de sesión en `localStorage`.
3. Conservar bcrypt con coste 12 (ya existe) y salt propio por hash. Exigir al menos 15 caracteres mientras no haya MFA general, sin reglas arbitrarias de composición, y comprobar contraseñas comprometidas. Con bcrypt, validar el límite de **72 bytes UTF-8**, no solo 72 caracteres. La API de Pwned Passwords consulta solo un prefijo del hash; jamás envía la contraseña completa.
4. Usar la Gmail API desde el **backend**, con OAuth 2.0 de una cuenta emisora y el alcance mínimo `gmail.send`. Guardar credenciales y refresh token de Google fuera de Git. Los estudiantes no autorizan su Gmail: solo reciben un correo. Una cuenta de servicio requiere delegación de dominio si se pretende enviar en nombre de usuarios de Google Workspace.
5. El flujo de recuperación usa token aleatorio de un solo uso, guarda solo su hash, vence en 15–30 minutos y responde igual para correos existentes e inexistentes. Un correo de recuperación nunca contiene contraseña ni sesión.
6. Validar entradas por tipo, longitud y formato, usar SQL parametrizado, escape de salida en Angular y sanitización específica si algún campo permite HTML. Registrar eventos de seguridad sin contraseñas, tokens, cookies ni cuerpos sensibles.

Estas decisiones concretan el MVP; no sustituyen una revisión de seguridad previa a un despliegue público.

## Sprint 1 — base técnica e identidad segura (semana 1)

**Objetivo:** una persona puede crear cuenta, iniciar y cerrar sesión, recuperar acceso por correo y editar su perfil usando PostgreSQL real.

**Estado revisado el 9 de octubre:** repositorio, esquema PostgreSQL, pantallas Angular e identidad real están implementados; `modoDemo` está desactivado. El README informa 22 pruebas de integración y deja pendiente la prueba de envío Gmail con una cuenta emisora real.

**Criterios de aceptación del sprint:**

| Trabajo | Evidencia de aceptación |
|---|---|
| Conexión y scripts de BD | Base local creada con roles técnicos; `/api/salud`, seed y consulta de identidad funcionan en una instalación limpia. Cambios de esquema versionados en SQL. |
| Registro y perfil | `identidad.service.ts` deja de responder 501; cuenta y rol ESTUDIANTE se crean en una transacción; correo duplicado se rechaza; perfil y cambio de contraseña funcionan. |
| Login y sesión | Error genérico para credenciales inválidas; bloqueo por cuenta tras 5 fallos durante 15 minutos más límite por IP/ruta; access token breve, refresh rotatorio/revocable, cierre de sesión real y restauración segura tras recargar. |
| Seguridad del formulario | Política de contraseña consistente en Angular y API, chequeo de contraseñas comprometidas, entradas validadas, protección CSRF donde haya cookies, pruebas de autorización por rol y logs sin secretos. |
| Recuperación por Gmail API | Configuración OAuth de la cuenta emisora; correo con enlace único; token de un uso con vencimiento; respuesta uniforme; nueva contraseña invalida sesiones previas. Probar con buzón de prueba. |
| Integración y documentación | Quitar `modoDemo` del flujo normal cuando el recorrido real pase; actualizar OpenAPI, `.env.example` y README; pruebas de registro, login, bloqueo, refresh/revocación, recuperación y errores. |

**Cierre pendiente:** el equipo informa que el comando de Gmail API confirmó el envío a la cuenta emisora; falta comprobar la recepción y que el enlace de recuperación funcione desde el buzón. El README conserva una nota anterior sobre esta prueba y debe actualizarse cuando se confirme. Los métodos de identidad ya no responden 501 y la sesión ya no se persiste en `localStorage`.

## Sprint 2 — catálogo, creación y publicación (semana 2)

**Objetivo:** un docente crea un curso con módulos y lecciones; un administrador lo revisa y el visitante lo descubre en el catálogo.

**Detalle y reparto para cuatro integrantes:** ver [`SPRINT_2_LEARNITY.md`](SPRINT_2_LEARNITY.md). Para publicar sin saltarse la regla de contenido válido, se adelanta al Sprint 2 una subida mínima de PDF; video y PowerPoint quedan en el Sprint 3.

**Avance actual:** Angular Público y las tres rutas de lectura de Cursos están implementadas y se verificaron con PostgreSQL local y en navegador. Búsqueda, filtros, paginación, detalle y 404 para borradores funcionaron con datos sintéticos identificados; las 6 pruebas nuevas del módulo público pasaron contra PostgreSQL local. Quedan las rutas privadas de creación/edición, Administración y Contenido, además de ejecutar la suite general del backend cuando se configure `learnity_test`.

| Entrega | Criterio de terminado |
|---|---|
| Cursos y categorías | API real para CRUD de categorías, cursos, módulos y lecciones; consultas paginadas; validaciones de límites y orden. |
| Catálogo público | Buscar y filtrar cursos **publicados** por texto, categoría y nivel; detalle con temario; Angular deja de usar datos demo en esas pantallas. |
| Roles y publicación | Solicitud de docente, aprobación por administrador, propiedad del curso, envío a revisión, aprobación/rechazo con motivo; un curso en revisión no se edita. |
| Integración | Prueba de recorrido docente → administrador → catálogo; permisos negativos (estudiante no edita, docente no publica, docente ajeno no modifica). |

**Recorte si falta capacidad:** indicadores avanzados del panel, filtros secundarios y edición sofisticada del temario; mantener el recorrido completo de un curso.

## Sprint 3 — archivos y aprendizaje (semana 3)

**Objetivo:** un estudiante se inscribe, accede al contenido autorizado y conserva su progreso.

| Entrega | Criterio de terminado |
|---|---|
| Subida de contenido | Cargar MP4 ≤ 5 MB y 480p, PDF/PPT/PPTX ≤ 10 MB; validar extensión, firma/tipo real, tamaño y resolución en el servidor; nombres aleatorios y almacenamiento fuera del directorio público. |
| Entrega segura | Vista previa solo donde corresponde; archivos completos únicamente para inscritos, docente propietario o administrador; rutas inaccesibles por enumeración o recorrido de directorios. |
| Inscripción y progreso | Inscripción gratuita única; lista “Mi aprendizaje”; marcar lección completada, guardar última lección y minuto, reanudar tras nueva sesión. |
| Integración | Sustituir datos demo de lección y aprendizaje; probar inscripción duplicada, curso no publicado, acceso sin inscripción y límites de archivo. |

**Recorte si falta capacidad:** descarga de presentaciones y adjuntos adicionales; conservar al menos un tipo de lección reproducible y progreso persistente. No publicar archivos sin control de acceso.

## Sprint 4 — evaluaciones, cierre y revisión (semana 4)

**Objetivo:** el estudiante completa una evaluación y el equipo entrega un MVP verificable, documentado y recuperable.

| Entrega | Criterio de terminado |
|---|---|
| Evaluaciones | Docente crea 5–10 preguntas con 4 opciones y una correcta; la API no revela respuestas al estudiante; intentos ilimitados, aprobado desde 60 %, mejor nota y curso completado según reglas. |
| Administración esencial | Revisión de usuarios/cursos y categorías integrada; indicadores básicos solo si los flujos principales están estables. |
| Seguridad y calidad | Pruebas de rutas/roles, XSS/CSRF, sesiones, recuperación, subida de archivos y casos límite; revisión de dependencias y secretos; accesibilidad básica y móvil. |
| Operación y entrega | Scripts reproducibles de BD, README de instalación, variables de entorno de ejemplo, datos seed sin secretos, respaldo y restauración probados para BD y archivos locales; demostración del flujo completo. |
| MFA administrativo | MFA para cuentas ADMIN antes de cualquier exposición pública. Si no cabe en el mes, el resultado se presenta como prototipo de desarrollo local y queda explícito como bloqueo de publicación pública. |

**Recorte si falta capacidad:** indicadores, estadísticas de docentes, adjuntos secundarios y detalles visuales. No recortar la autorización de archivos, la seguridad de sesión ni las pruebas del flujo principal.

## Definición de terminado para cada historia

- La funcionalidad usa PostgreSQL real y API real; el modo demo no es evidencia.
- Las reglas de negocio y permisos se verifican en el backend, no solo en Angular.
- Hay pruebas del camino feliz y al menos un rechazo o caso límite significativo.
- El código compila, los scripts SQL se pueden aplicar en orden y la API está documentada.
- La historia se demuestra desde la interfaz correspondiente y el equipo revisa el incremento al final del sprint.

## Riesgos y decisiones tempranas

- **Capacidad:** 25 requisitos funcionales, correo OAuth, archivos y seguridad son ambiciosos para cuatro semanas. Si el grupo tiene menos de 3 personas con dedicación suficiente, reducir el MVP a un curso simple antes de prometer todos los paneles.
- **Gmail API:** habilitar el proyecto Google Cloud, OAuth y cuenta emisora al inicio del Sprint 1; la autorización puede retrasar la recuperación por correo.
- **Base local:** acordar cómo compartir cambios SQL y datos de prueba. Cada integrante puede tener su PostgreSQL local; los cambios de esquema van al repositorio, no por exportaciones manuales de pgAdmin.
- **Publicación:** el desarrollo local y el despliegue público son trabajos distintos. HTTPS, cookies `Secure`, MFA administrativo y respaldo operativo son puertas de salida para publicar.

## Prompt original del Sprint 1 (histórico)

El siguiente prompt se escribió antes de los avances del 9 de octubre. Verificar el estado actual del código y del README antes de reutilizarlo; no repetir trabajo ya implementado.

> Trabaja en el repositorio Learnity. Antes de editar, lee `CONTEXTO_LEARNITY.md`, `PLAN_SPRINTS_LEARNITY.md`, el README, la guía PostgreSQL y el módulo `backend/src/modules/identidad/`. Cierra el Sprint 1 con un flujo real de registro, login, logout, perfil, cambio y recuperación de contraseña. Mantén el monolito modular en capas y PostgreSQL local con SQL parametrizado. Implementa el servicio de identidad que hoy responde 501; crea scripts SQL versionados para sesiones/refresh y tokens de recuperación; integra la Gmail API solo desde backend mediante OAuth 2.0 y alcance `gmail.send`, con secretos fuera de Git. Usa bcrypt con coste actual 12, valida el límite de 72 bytes UTF-8 y una política de contraseña de al menos 15 caracteres, más comprobación de contraseñas expuestas sin enviar la contraseña completa. Implementa access JWT de 15 minutos solo en memoria, refresh token opaco rotatorio y revocable en cookie `HttpOnly`/`Secure`/`SameSite=Lax` bajo HTTPS, protección CSRF para endpoints basados en cookie, límite por IP y bloqueo temporal por cuenta, respuestas genéricas y auditoría sin secretos. El enlace de recuperación debe ser aleatorio, de un solo uso, vencer en 15–30 minutos e invalidar sesiones al usarlo. Sustituye `localStorage` y el modo demo en el flujo normal cuando la integración esté probada. Actualiza OpenAPI, README y `.env.example`. Añade pruebas de seguridad y de extremo a extremo significativas. No declares completado el sprint si alguna ruta sigue respondiendo 501 o si el correo de recuperación no se ha probado con un buzón de prueba. Explica cualquier credencial o configuración externa que deba aportar el equipo, sin pedir ni imprimir secretos en el chat.

## Fuentes para los criterios de seguridad

- [NIST SP 800-63B-4: contraseñas y listas de bloqueo](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [OWASP: almacenamiento de contraseñas](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [autenticación](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [recuperación](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [sesiones](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [logs](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), [archivos](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) y [MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)
- [Google: Gmail API `users.messages.send`](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send), [alcances](https://developers.google.com/workspace/gmail/api/auth/scopes) y [OAuth de servidor](https://developers.google.com/workspace/gmail/api/auth/web-server)
- [Have I Been Pwned: Pwned Passwords con k-anonimato](https://haveibeenpwned.com/API/V3)
