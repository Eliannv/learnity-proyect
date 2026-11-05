# Informe de auditoría de seguridad · Learnity

| Dato | Valor |
|---|---|
| Fecha | 5 de noviembre de 2026 |
| Rama auditada | `sprint4/elian-panel-admin` (base `ebd5f1f`) |
| Alcance | `backend/`, `frontend/`, `database/`, `e2e/`, configuración de despliegue (Render y Vercel) e historial completo de Git (285 commits, 14 ramas remotas) |
| Referencia | OWASP Top 10 (2021) y OWASP ASVS 4.0, nivel 2 |
| Entorno de pruebas | PostgreSQL 16 desechable con la base `learnity_test` y todas las migraciones (017–040). La base de Supabase no se tocó |

## 1. Resumen ejecutivo

La aplicación parte de una base sólida:

- Sesiones con refresh rotatorio y detección de reúso, CSRF firmado y bcrypt con coste 12.
- SQL parametrizado, privilegios mínimos en PostgreSQL y validación de archivos por firma binaria.
- Segregación de funciones probada y registros sin secretos.

Se encontraron **13 hallazgos**: 3 de severidad alta, 3 media, 4 baja y 3 informativos. Se corrigieron en código los 10 corregibles desde el repositorio. Quedan **3 acciones que solo puede hacer el equipo en Render y Supabase** (sección 4), y una de ellas es **obligatoria antes de desplegar** esta rama.

| Severidad | Hallazgos | Corregidos en código | Requieren acción externa |
|---|---|---|---|
| Alta | 3 | 2 | 2 (H-01 configurar la CA, H-03 rotar contraseñas) |
| Media | 3 | 3 | 1 (H-04 revisar variables antes del despliegue) |
| Baja | 4 | 4 | 0 |
| Informativa | 3 | 0 (documentados) | 1 (H-11 verificar `TRUST_PROXY`) |

## 2. Hallazgos

### H-01 · Alta · Conexión TLS a PostgreSQL sin verificar el certificado (A02, A05)

- **Evidencia:** `backend/src/shared/database/pool.ts` usaba `ssl: { rejectUnauthorized: false }` desde el commit `0e051d3` («soporte SSL Supabase»). La conexión se cifraba, pero aceptaba cualquier certificado. Alguien en la red entre Render y Supabase podía hacerse pasar por la base y leer la contraseña de `learnity_app` y todos los datos.
- **Corrección:**
  - Con `DB_SSL=true` el certificado **se verifica siempre**: con la CA indicada en la variable nueva `DB_SSL_CA` (PEM; admite `\n` para pegarla en una línea en Render) o con las CA del sistema y `NODE_EXTRA_CA_CERTS`.
  - La única forma de cifrar sin verificar es declararlo con `DB_SSL_SIN_VERIFICAR=true`, y el servidor registra el aviso `postgresql_tls_sin_verificar` al arrancar.
  - Prueba: `test/seguridad/endurecimiento.test.ts` («TLS hacia PostgreSQL…»).
- **Acción pendiente:** configurar `DB_SSL_CA` en Render **antes** de desplegar esta rama (sección 4.1).

### H-02 · Alta · Dependencias del backend con vulnerabilidades conocidas (A06)

- **Evidencia:** `npm audit` en `backend/` informaba **4 vulnerabilidades (1 moderada, 3 altas)**, las mismas del registro de Render:

  | Paquete | Severidad | Problema |
  |---|---|---|
  | `body-parser` 2.3.0 | Alta | DoS con bytes sobrantes tras un cuerpo comprimido (GHSA-27r3-jxmh-p828) |
  | `multer` 2.4.0, versión fijada exacta | Alta | DoS por `fileFilter` asíncrono pendiente tras cerrar la petición (GHSA-q7qp-rjg7-q26m) |
  | `zod` < 4.6.6 | Alta | — |
  | `qs` 6.16.0 | Moderada | DoS en `stringify` |

- **Corrección:** `multer` 2.5.0 (sigue fijado exacto), `zod` ^4.6.6 (instalado 4.6.7), `body-parser` 2.4.0 y `qs` 6.17.1. Resultado: **`npm audit`: found 0 vulnerabilities**. El lockfile conserva su formato (solo cambian las versiones).

### H-03 · Alta (condicional) · Contraseña de las cuentas de prueba publicada en el historial (A07, A02)

- **Evidencia:** `SEED_PASSWORD=Learnity2026!` fue el valor por defecto de `backend/.env.example`, `README.md`, `seed.ts` y `probar-repositorio.ts` en los commits `47a58f2` y `31e9cfe` (8 de octubre de 2026). Se retiró en `109cad0` (20 de octubre), pero sigue en el historial público del repositorio. Las cuentas sembradas incluyen un **administrador** (`ana.torres@learnity.com`).
- **Riesgo:** si esas cuentas existen en Supabase (producción) con esa contraseña, o con otra que alguien reutilizó, cualquiera puede entrar como administrador.
- **Corrección:** no se reescribe el historial (sería `push --force` sobre ramas compartidas y el valor ya es público). La medida eficaz es la rotación (sección 4.2). El escaneo completo del historial **no encontró ninguna otra credencial real**: ni contraseñas de Supabase, ni cadenas de conexión, ni secretos de Gmail o JWT, ni claves privadas. Los demás valores son marcadores de ejemplo (`CAMBIA_ESTA_CLAVE_APP`, `TU_SECRETO_DE_CLIENTE`, etc.).

### H-04 · Media · El servidor arrancaba en producción con configuraciones inseguras (A05)

- **Evidencia:** `env.ts` ya exigía Gmail y cookies `Secure` en producción y un `JWT_SECRET` de al menos 32 caracteres. Pero aceptaba en producción `DB_SSL=false`, `CORS_ORIGIN=*` o por `http://`, `FRONTEND_URL` por `http://` y el `JWT_SECRET` de ejemplo de `.env.example`, que tiene 50 caracteres y por eso pasaba la validación de longitud.
- **Corrección:** con `NODE_ENV=production` el proceso termina con código 1 y lista las variables inválidas, sin imprimir sus valores, si:
  - `DB_SSL` no es `true`;
  - algún origen de `CORS_ORIGIN` no es un origen `https://` exacto (sin `*`, rutas ni credenciales);
  - `FRONTEND_URL` no es `https://`;
  - `JWT_SECRET` contiene fragmentos de los secretos de ejemplo o de prueba, o tiene menos de 10 caracteres distintos.
- **Pruebas:** 8 casos en `test/seguridad/endurecimiento.test.ts`, además de uno que comprueba que una configuración correcta sí arranca.

### H-05 · Media · El frontend en Vercel no enviaba cabeceras de seguridad (A05)

- **Evidencia:** `frontend/vercel.json` no definía `headers`. La SPA podía incrustarse en un `<iframe>` de otro sitio (clickjacking sobre el panel de administración) y no tenía HSTS, `nosniff`, `Referrer-Policy` ni CSP.
- **Corrección:** cabeceras para todas las rutas menos `/api/` (la API pone las suyas):
  - **En modo obligatorio:** `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'; object-src 'none'; base-uri 'self'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security` (1 año) y `Permissions-Policy` (cámara, micrófono, geolocalización, pagos y USB desactivados).
  - **En `Content-Security-Policy-Report-Only`:** la CSP completa. Permite `self`, el reproductor de YouTube, Google Fonts, imágenes https/data/blob y marcos de YouTube y blob para el PDF.
- **Pendiente:** activar la CSP completa en modo obligatorio después de revisar la consola en producción (sección 4.3). No se activó directamente porque desde aquí no se puede probar contra el despliegue real de Vercel, y una CSP errónea dejaría la aplicación en blanco.

### H-06 · Media · Herramientas de desarrollo del frontend con vulnerabilidades (A06)

- **Evidencia:** `npm audit` en `frontend/` informaba 27 avisos (varios altos) en `@angular/cli`, `@angular/build`, `vite`, `vitest`, `undici`, `@modelcontextprotocol/sdk`, `body-parser`, `qs`, `fast-uri`, `ip-address`, `glob` y `minimatch`. Son herramientas de compilación y prueba: **no se incluyen en el bundle del navegador**, pero se ejecutan en las máquinas del equipo y en el build de Vercel.
- **Corrección:**
  - `npm audit fix`. npm 10 falla con `edgesOut` al resolver dependencias peer, así que se usó npm 11; el lockfile resultante instala limpio con `npm ci` de npm 10.
  - Para los 16 avisos que npm solo resolvía subiendo a Angular 22 (`glob` y `minimatch` dentro de `@angular/cli` → `pacote`), se añadieron `overrides` acotados en `package.json`: `glob@^13` → `^14.0.2` y `minimatch@^10` → `^11.0.1`. No tocan el `minimatch@5` que usa otra dependencia.
  - Resultado: **0 vulnerabilidades**. `ng version`, `ng build` y las 207 pruebas unitarias siguen en verde.

### H-07 · Baja · Búsqueda de usuarios del administrador sin escapar comodines (A03)

- **Evidencia:** `usuarios.repository.ts` (`listarUsuariosAdmin`) metía `q` en `LIKE` sin escapar `%`, `_` ni `\`. No es inyección SQL (el valor va parametrizado), pero `q=%` o `q=_` devolvían coincidencias falsas y permitían búsquedas costosas.
- **Corrección:** se escapan como en el resto de los repositorios.
- **Prueba:** `sprint4-admin-usuarios.test.ts` («los comodines de LIKE en q se buscan como texto»). Falla con el código anterior y pasa con el nuevo.

### H-08 · Baja · La portada del curso aceptaba cualquier ruta relativa (A03, A10)

- **Evidencia:** `esPortadaValida` admitía cualquier valor que empezara por `/` (por ejemplo `/api/admin/usuarios`) y la guardaba como `src` de imagen para todos los visitantes del catálogo.
- **Corrección:**
  - Las rutas propias quedan limitadas a `/img/<segmentos>` y `/api/fotos/<uuid>.(jpg|png|webp)`.
  - Las URLs absolutas siguen restringidas a `http(s)://` con host y sin credenciales.
  - `javascript:`, `data:`, `file:`, `//host`, `..`, `?`, `#`, espacios y `\` se rechazan.
  - El validador del frontend usa la misma regla.
  - Prueba: `test/cursos/portada-url.test.ts`, con 21 casos.
- **SSRF:** no aplica. El servidor nunca descarga estas URLs; solo las devuelve para que el navegador las pinte.

### H-09 · Baja · La comprobación de origen solo protegía `/api/auth` (A01, defensa en profundidad)

- **Evidencia:** `verificarOrigen` (Origin y `Sec-Fetch-Site`) solo se aplicaba al router de autenticación.
- **Contexto:** las rutas privadas se autentican con `Authorization: Bearer` y el token vive solo en memoria. El navegador no adjunta esa cabecera solo, así que **no son vulnerables a CSRF**. Las únicas rutas autenticadas por cookie, `/api/auth/refresh` y `/api/auth/logout`, ya exigían el doble envío firmado `XSRF-TOKEN` + `X-XSRF-TOKEN`.
- **Corrección:** como segunda capa, toda petición `POST`/`PUT`/`PATCH`/`DELETE` bajo `/api` se rechaza con 403 `ORIGEN_NO_PERMITIDO` si llega desde otro origen o marcada `cross-site`. Esto incluye `POST /api/cursos/portada` y `PUT /api/perfil/foto` en ambos modos. Las lecturas y los clientes sin navegador (sin `Origin`) no cambian.
- **Pruebas:** en `endurecimiento.test.ts`.

### H-10 · Baja · CSP por defecto de Helmet en la API (A05)

- **Evidencia:** la API usaba `helmet()` con su CSP genérica, pensada para páginas HTML (permitía scripts, estilos e imágenes de `self` y marcos del mismo origen).
- **Corrección:** como la API solo devuelve JSON y archivos, recibe `default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` y `X-Frame-Options: DENY`. Swagger, que solo existe en desarrollo, conserva la política por defecto porque necesita scripts. Se mantienen HSTS, `nosniff`, `Referrer-Policy: no-referrer`, CORP y COOP, y `x-powered-by` sigue desactivado.

### H-11 · Informativo · `TRUST_PROXY` detrás de Vercel → Render

- Los límites por IP y la auditoría usan `req.ip`. Con la cadena navegador → Vercel (rewrite) → Render hay dos proxies delante de la API:
  - Si `TRUST_PROXY` es menor de lo debido, todas las peticiones parecen venir del proxy y comparten un único límite por IP. Ejemplo: 20 inicios de sesión cada 15 minutos para **todos** los usuarios.
  - Si es mayor, un cliente puede falsear su IP con `X-Forwarded-For`.
- Se documentó en `.env.example`. Hay que verificarlo en Render (sección 4.4).

### H-12 · Informativo · Un administrador puede asignarse el rol `DOCENTE` (aceptado por diseño)

- `PUT /api/admin/usuarios/:id/roles` permite a un administrador añadirse `DOCENTE` sin pasar por la solicitud. Es una función intencional: el commit `af424d2` creó las cuentas Admin+Docente con conmutador de panel.
- El riesgo está mitigado por la segregación de funciones existente y probada (`sprint4-segregacion-funciones.test.ts`): ese administrador **no puede** aprobar, rechazar, suspender ni reactivar sus propios cursos, moderar reseñas o reportes de sus cursos, ni revocar su propia solicitud. Quitarse `ADMIN` también está bloqueado.
- Recomendación opcional: exigir que otro administrador asigne `DOCENTE` a una cuenta administradora.

### H-13 · Informativo · Otros puntos revisados sin riesgo

- **Límite por IP en memoria:** es correcto con una sola instancia en Render. Si se escala a varias, hay que mover el contador a PostgreSQL o Redis (ya está anotado en `limite-peticiones.ts`).
- **Esquemas de identidad:** `registro`, `login`, `perfil` y `contraseña` usan `z.object`, que descarta los campos desconocidos; no hay asignación masiva (por ejemplo, `roles` en el registro se ignora). Pasarlos a `z.strictObject` sería solo coherencia.
- **Foto de perfil por enlace:** solo admite `https://` externos, no `http://` ni rutas propias. Es más restrictivo que lo indicado en el encargo y es deliberado: aceptar `/api/fotos/...` permitía borrar la foto o la portada de otra persona (IDOR corregido en `905fe24` en esta misma rama), y `http://` provoca contenido mixto en un sitio HTTPS.

## 3. Estado de cada control solicitado

Leyenda: ✅ cumple · 🔧 corregido en esta auditoría · ⚠️ requiere acción externa · ➖ no aplica.

### 3.1 Secretos, variables de entorno e historial

| Control | Estado | Detalle |
|---|---|---|
| Secretos en el árbol actual | ✅ | Solo plantillas `.env.example` y `.env.test.example` con marcadores |
| Secretos en el historial (285 commits, todas las ramas) | ⚠️ | Solo `SEED_PASSWORD=Learnity2026!` (H-03); ninguna credencial de Supabase, JWT, Gmail ni clave privada |
| `.gitignore` | 🔧 | Ya cubría `.env*`, `backend/uploads/` y `.buzon/`. Se añadieron `*.dump`, `*.backup`, `*.sql.gz`, `*.pem`, `*.key`, `*.p12`, `*.pfx` y `client_secret*.json` |
| Frontend: `environments/` y bundle `dist/` | ✅ | Solo `apiUrl: '/api'` y `modoDemo`. El bundle no contiene credenciales; la única coincidencia es la etiqueta del rol `learnity_app` en el panel de auditoría |
| Fail-fast en producción (`JWT_SECRET`, `DB_SSL`, CORS) | 🔧 | H-04 |

### 3.2 Autenticación, sesiones, cookies y CSRF

| Control | Estado | Detalle |
|---|---|---|
| bcrypt, coste ≥ 12 | ✅ | `RONDAS = 12` y rehash automático de costes antiguos al iniciar sesión |
| `contrasena_hash` nunca sale | ✅ | Solo se lee en el repositorio de identidad para comparar. Los registros descartan claves `contrasena\|password\|token\|cookie\|secret\|hash\|authorization` y enmascaran correos. La auditoría excluye `contrasena_hash` y `token_hash` |
| Política de contraseñas | ✅ | De 15 caracteres a 72 bytes; rechaza contraseñas comunes, basadas en el nombre o el correo, y filtradas según HIBP con k-anonimato |
| Sesiones invalidadas al cambiar la contraseña, desactivar o eliminar | ✅ | Cambiar la contraseña cierra las demás sesiones; restablecerla, todas. Desactivar revoca. Cada petición vuelve a consultar sesión, estado `ACTIVO` y roles actuales |
| JWT de acceso de 15 minutos | ✅ | HS256 fijo, con emisor, audiencia y `sid`, y comprobado contra la tabla `sesion` en cada petición |
| Refresh rotatorio con detección de reúso | ✅ | Token opaco de 256 bits guardado como SHA-256. Reutilizar uno revoca la familia (`refresh_reutilizado`) |
| Enlaces de recuperación e invitación | ✅ | Hasheados, con vencimiento (20 minutos y 72 horas), consumo atómico de un solo uso; un enlace nuevo invalida los anteriores |
| Cookies | ✅ | `learnity_rt`: `HttpOnly`, `SameSite=Lax`, `Path=/api/auth`, `Secure` obligatorio en producción |
| CSRF en endpoints mutantes | ✅ / 🔧 | Las rutas por cookie tienen doble envío firmado. Las rutas Bearer no son vulnerables a CSRF; aun así se añadió la comprobación de origen en todas las escrituras (H-09) |

### 3.3 Control de acceso y reglas de negocio

| Control | Estado | Detalle |
|---|---|---|
| `autenticar` y `autorizar` en rutas privadas | ✅ | Revisadas las 93 rutas. Solo son públicas el catálogo, las reseñas públicas, las fotos y la autenticación |
| IDOR en cursos, contenido, evaluaciones, aprendizaje y reseñas | ✅ | El servicio comprueba propiedad o inscripción dentro de la transacción; hay pruebas `CAR-CUR-*`, `CAR-CON-*`, `aprendizaje` y `resenas` |
| Cálculos en servidor (progreso, 60 %, publicación) | ✅ | La nota se calcula en `evaluaciones.service`, el progreso en `aprendizaje` y la validación de publicación en `detalle-privado.service`, reutilizada al enviar y al aprobar |
| Segregación de funciones del administrador | ✅ | Probado: no decide su propia solicitud ni aprueba, suspende o reactiva sus cursos; no modera reseñas ni reportes de sus cursos; no se desactiva, elimina ni se quita `ADMIN`; nunca queda sin administradores |

### 3.4 Base de datos

| Control | Estado | Detalle |
|---|---|---|
| SQL 100 % parametrizado | ✅ | Toda interpolación `${…}` en los repositorios es un fragmento constante del código. Los valores van como `$n` |
| `ILIKE` escapa comodines | 🔧 | Ya se hacía en reseñas, aprendizaje, identidad y catálogo; faltaba en usuarios (H-07) |
| Mínimo privilegio de `learnity_app` | ✅ | Sin permisos directos sobre `auditoria_cambio`; en `evento_acceso` solo `INSERT` y `SELECT`; en `alerta_seguridad` solo `SELECT`; sin `CREATE` en `public` y sin ser dueño de ninguna tabla |
| `SECURITY DEFINER` con `search_path` fijo | ✅ | Las 8 funciones fijan `search_path = pg_catalog, pg_temp`, más estricto que `public, pg_temp` |
| `matriz_privilegios.sql` | ✅ | **MATRIZ OK: 123 filas, 0 diferencias** |
| RLS en Supabase | ➖ | El backend se conecta como `learnity_app` y la autorización está en el servicio. Supabase no expone estas tablas a clientes (no se usa PostgREST ni las claves `anon`). Recomendación: confirmar en el panel que la API de datos de Supabase está desactivada o sin acceso a `public` |
| Registro de accesos, cambios y alertas | ✅ | `evento_acceso` (fallos, bloqueos y recuperación), `auditoria_cambio` (triggers con actor) y `alerta_seguridad` (análisis), todo sin contraseñas ni tokens |

### 3.5 Validación, XSS y archivos

| Control | Estado | Detalle |
|---|---|---|
| Zod en cuerpo, parámetros y consulta | ✅ | Todas las rutas con datos tienen `validarCuerpo`/`validarParametros`/`validarConsulta`. Los ids son enteros estrictos dentro de INTEGER |
| URLs seguras (`portadaUrl`, foto de perfil) | 🔧 | H-08 y H-13 |
| XSS en Angular | ✅ | No hay `innerHTML`, `insertAdjacentHTML`, `eval` ni `document.write`. El único `bypassSecurityTrustResourceUrl` envuelve un `blob:` de la descarga autenticada, después de comprobar `%PDF-` |
| Límites de tamaño en `multer` | ✅ | Fotos y portadas 2 MiB (en memoria, `files: 1`); PDF y recursos 10 MiB (temporal en disco con `flags: 'wx'` y modo `0600`) |
| Firma binaria (magic bytes) | ✅ | PDF (`%PDF-x.y` y análisis con `pdf-lib`), JPEG, PNG, WebP, ZIP (`PK\x03\x04`) y PPT OLE (`D0CF11E0…`). La extensión debe coincidir con el contenido. SVG rechazado |
| Nombres generados por el servidor | ✅ | UUID v4 para fotos y archivos; la ruta física nunca se expone |
| Cabeceras al servir archivos | ✅ | PDF y recursos: `Content-Disposition: attachment`, `Cache-Control: private, no-store` y `nosniff`. Fotos: tipo MIME según la firma y `nosniff` |

### 3.6 Red, CORS, límites y errores

| Control | Estado | Detalle |
|---|---|---|
| Helmet: CSP, HSTS, X-Frame-Options, Referrer-Policy | 🔧 | API endurecida (H-10). SPA en Vercel con cabeceras nuevas (H-05) |
| CORS solo para el frontend y con credenciales | ✅ / 🔧 | Lista exacta de `CORS_ORIGIN`; en producción se exige `https://` sin comodines (H-04) |
| `limitarPorIp` en endpoints sensibles | ✅ | Login, registro, refresh, logout, recuperación, restablecimiento, cambio de contraseña, fotos, portadas, PDF, recursos, inscripción, progreso, intentos de evaluación, reseñas, respuestas, reportes, solicitudes, alta de usuarios, exportación CSV y análisis de alertas |
| `trust proxy` | ⚠️ | Configurable con `TRUST_PROXY`; verificar el valor en Render (H-11) |
| Errores sin fugas en producción | ✅ | Ni trazas ni mensajes de PostgreSQL. Las violaciones de restricciones se traducen a 400/409 genéricos y el JSON malformado da 400 genérico. Los detalles solo se registran en el servidor, sin `detail` ni parámetros |

### 3.7 Dependencias y archivos expuestos

| Control | Estado | Detalle |
|---|---|---|
| `npm audit` backend | 🔧 | De 4 vulnerabilidades (1 moderada, 3 altas) a **0** (H-02) |
| `npm audit` frontend | 🔧 | De 27 avisos a **0** (H-06) |
| `npm audit` e2e | ✅ | 0 |
| Paquetes sin uso | ✅ | Ninguno. Las dependencias sin importación directa (`dotenv/config`, `typescript`, `tsx`, `@angular/compiler`, `@angular/compiler-cli`, `tslib`) las usan los scripts o el propio build |
| Estáticos de Express | ✅ | No hay `express.static`. Los archivos solo salen por los controladores autenticados o, para fotos, por un nombre UUID validado. Swagger solo existe en desarrollo |

## 4. Acciones pendientes del equipo (fuera del repositorio)

### 4.1 Antes de desplegar esta rama en Render (obligatorio)

Desde esta versión, con `NODE_ENV=production` el servidor **no arranca** sin estas variables:

| Variable | Valor en Render |
|---|---|
| `DB_SSL` | `true` |
| `DB_SSL_CA` | Certificado de Supabase: *Project Settings → Database → SSL Configuration → Download certificate*. Pega el contenido del `.crt` cambiando cada salto de línea por `\n` |
| `CORS_ORIGIN` | `https://learnity-topaz.vercel.app` (y cualquier otro dominio propio, separados por comas) |
| `FRONTEND_URL` | `https://learnity-topaz.vercel.app` |
| `JWT_SECRET` | Un valor aleatorio propio, por ejemplo `openssl rand -base64 48`. Si hoy usa el de ejemplo, cambiarlo cierra todas las sesiones, lo cual es deseable |
| `COOKIE_SECURE` | `true` o sin definir |

Si no se puede configurar la CA de inmediato, `DB_SSL_SIN_VERIFICAR=true` mantiene el comportamiento anterior (cifrado sin verificar) con un aviso en los registros. Es una solución temporal.

### 4.2 Rotar las contraseñas de las cuentas de prueba (H-03)

1. En producción (Supabase), comprobar si existen `ana.torres@learnity.com`, `carlos.mendoza@correo.com` y `rosa.vera@correo.com`.
2. Si existen y no se usan, desactivarlas desde el panel de administración. Si se usan, cambiar su contraseña por una nueva de al menos 15 caracteres.
3. Revisar en **Accesos y sesiones** los inicios de sesión de esas cuentas y cerrar las sesiones abiertas que no se reconozcan.

### 4.3 Activar la CSP completa en Vercel (H-05)

1. Desplegar y navegar por catálogo, lección con vídeo de YouTube, PDF, editor de cursos y panel de administración con la consola del navegador abierta.
2. Si no aparecen avisos `[Report Only]`, cambiar en `frontend/vercel.json` la clave `Content-Security-Policy-Report-Only` por `Content-Security-Policy`, reemplazando la mínima actual.

### 4.4 Verificar `TRUST_PROXY` en Render (H-11)

Desde la aplicación, provocar un inicio de sesión fallido y comprobar en **Accesos y sesiones** que la IP registrada es la del cliente y no la de Vercel o Render. Con el rewrite de Vercel suele ser `TRUST_PROXY=2`.

## 5. Archivos modificados

| Archivo | Cambio |
|---|---|
| `backend/src/shared/config/env.ts` | Fail-fast de producción y variables `DB_SSL_CA` y `DB_SSL_SIN_VERIFICAR` (H-01, H-04) |
| `backend/src/shared/database/pool.ts` | Verificación del certificado TLS (H-01) |
| `backend/src/server.ts` | Aviso al arrancar si TLS no se verifica (H-01) |
| `backend/src/app.ts` | CSP estricta de la API y comprobación de origen en las escrituras (H-09, H-10) |
| `backend/src/modules/usuarios/usuarios.repository.ts` | Escape de comodines `LIKE` (H-07) |
| `backend/src/modules/cursos/cursos.esquemas.ts` | Rutas de portada acotadas (H-08) |
| `frontend/src/app/features/docente/cursos/paginas/editor-curso/editor-curso.ts` | Misma regla de portada en el cliente (H-08) |
| `frontend/vercel.json` | Cabeceras de seguridad de la SPA (H-05) |
| `backend/package.json`, `backend/package-lock.json` | `multer` 2.5.0, `zod` ^4.6.6, `body-parser` 2.4.0 y `qs` 6.17.1 (H-02) |
| `frontend/package.json`, `frontend/package-lock.json` | `npm audit fix` y `overrides` acotados (H-06) |
| `backend/.env.example` | Documentación de TLS, CA y `TRUST_PROXY` |
| `.gitignore` | Respaldos y claves privadas; excepción para este informe |
| `backend/test/seguridad/endurecimiento.test.ts` (nuevo) | 13 pruebas: origen de las escrituras, cabeceras, TLS y fail-fast |
| `backend/test/cursos/portada-url.test.ts` (nuevo) | 2 pruebas con 21 casos de URL de portada |
| `backend/test/sprint4-admin-usuarios.test.ts` | Prueba de comodines en la búsqueda |
| `backend/test/caracterizacion/general.test.ts` | `CAR-GEN-09` fija la CSP estricta de la API (antes fijaba la genérica) |

## 6. Verificación

| Comprobación | Resultado |
|---|---|
| `npm audit` backend · frontend · e2e | 0 · 0 · 0 vulnerabilidades |
| `npm run typecheck` y `npm run build` (backend) | ✅ |
| `npm test` (backend, contra `learnity_test`) | ✅ 416 pruebas en 113 suites. En la corrida completa falló solo `CAR-GEN-09`, que congelaba la CSP genérica anterior; se actualizó a la política nueva y su archivo pasa (11/11) |
| `npx ng test --watch=false` (frontend) | ✅ 46 archivos, 207 pruebas |
| `npx ng build` (frontend) | ✅ sin advertencias |
| `npx playwright test` (E2E con axe) | ✅ 35/35, limpieza con 0 residuos |
| `matriz_privilegios.sql` | ✅ MATRIZ OK, 123 filas, 0 diferencias |
