import type { Curso } from '../tipos.js';

export const seguridad: Curso = {
  clave: 'seguridad',
  titulo: 'Seguridad Ofensiva y OWASP Top 10 para Aplicaciones Web Modernas',
  subtitulo: 'Aprende a atacar tu propia aplicación como lo haría un adversario y corrige cada vulnerabilidad desde el código.',
  descripcion:
    'Curso práctico de seguridad de aplicaciones para desarrolladores full stack. Recorremos las categorías del OWASP Top 10 ' +
    'con la mentalidad de un pentester: modelamos amenazas, explotamos inyecciones, XSS y CSRF en un entorno controlado y ' +
    'aplicamos las defensas correctas en Node.js, Angular y PostgreSQL. Todo el trabajo ofensivo se realiza únicamente sobre ' +
    'laboratorios propios y con autorización explícita.',
  nivel: 'AVANZADO',
  categoria: 'Ciberseguridad',
  autor: 'kevin.valarezo.1848@gmail.com',
  nombreAutor: 'Kevin Valarezo',
  publicadoHaceDias: 88,
  objetivos: [
    'Construir un modelo de amenazas STRIDE para una aplicación web',
    'Explotar y mitigar inyección SQL con consultas parametrizadas y mínimos privilegios',
    'Prevenir XSS y CSRF con codificación de salida, CSP y cookies SameSite',
    'Almacenar credenciales con algoritmos lentos y sal, y diseñar sesiones seguras',
    'Integrar pruebas de seguridad en el ciclo de desarrollo',
  ],
  requisitos: [
    'Desarrollo web con HTTP, cookies y formularios',
    'Conocimientos básicos de SQL y JavaScript',
    'Disponer de un entorno de laboratorio propio (Docker recomendado)',
  ],
  modulos: [
    {
      titulo: 'Modelado de amenazas y panorama del OWASP Top 10',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'Siete riesgos que un desarrollador nunca debería asumir (vídeo en inglés)', youtube: '4YOpILi9Oxs', minutos: 6 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: STRIDE y las categorías del OWASP Top 10',
          apunte: {
            archivo: 'modelado-amenazas-owasp-top10.pdf',
            titulo: 'Modelado de amenazas y OWASP Top 10',
            resumen:
              'Atacar con método empieza por saber qué proteger. Este apunte presenta STRIDE como herramienta de ' +
              'modelado y relaciona cada amenaza con las categorías del OWASP Top 10 (edición 2021).',
            secciones: [
              {
                titulo: 'STRIDE en un diagrama de flujo de datos',
                vinetas: [
                  'Spoofing (suplantación) -> autenticación robusta y MFA.',
                  'Tampering (manipulación) -> integridad: firmas, HMAC, validación en servidor.',
                  'Repudiation (repudio) -> auditoría inmutable con actor y marca de tiempo.',
                  'Information disclosure -> cifrado en tránsito y en reposo, mínimo privilegio.',
                  'Denial of service -> límites de tasa, tamaños máximos y tiempos de espera.',
                  'Elevation of privilege -> autorización en cada operación, no solo en la interfaz.',
                ],
              },
              {
                titulo: 'OWASP Top 10 (2021) en una línea cada uno',
                vinetas: [
                  'A01 Control de acceso roto: el servidor no comprueba que el recurso pertenece al usuario.',
                  'A02 Fallos criptográficos: datos sensibles sin cifrar o con algoritmos débiles.',
                  'A03 Inyección: SQL, NoSQL, comandos del sistema y XSS.',
                  'A04 Diseño inseguro: faltan controles desde el diseño, no solo en el código.',
                  'A05 Configuración insegura: cabeceras, CORS abierto, mensajes de error detallados.',
                  'A06 Componentes vulnerables y desactualizados.',
                  'A07 Fallos de identificación y autenticación.',
                  'A08 Fallos de integridad de software y datos (CI/CD, deserialización).',
                  'A09 Fallos de registro y monitoreo.',
                  'A10 Server-Side Request Forgery (SSRF).',
                ],
              },
              {
                titulo: 'Reglas del laboratorio',
                parrafos: [
                  'Solo se ataca infraestructura propia o con autorización por escrito. Documenta cada hallazgo con pasos de ' +
                  'reproducción, impacto, evidencia y recomendación; un informe sin reproducción no es accionable.',
                ],
              },
            ],
          },
          recursos: [
            {
              archivo: 'plantilla-informe-vulnerabilidad.pdf',
              titulo: 'Plantilla de informe de vulnerabilidad',
              secciones: [
                {
                  titulo: 'Campos obligatorios del informe',
                  vinetas: [
                    'Título y categoría OWASP / CWE.',
                    'Severidad con CVSS 3.1 y justificación del vector.',
                    'Componente y versión afectados.',
                    'Pasos de reproducción numerados y evidencia (petición, respuesta, captura).',
                    'Impacto para el negocio y para los usuarios.',
                    'Recomendación concreta y referencia (OWASP Cheat Sheet).',
                    'Estado: reportado, en corrección, verificado, cerrado.',
                  ],
                },
              ],
            },
          ],
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación: amenazas y Top 10',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: 'Un usuario cambia el id en /api/facturas/1042 y ve la factura de otra persona. ¿Qué categoría del Top 10 es?',
              opciones: ['A01 Control de acceso roto', 'A03 Inyección', 'A06 Componentes vulnerables', 'A10 SSRF'],
              correcta: 'A',
            },
            {
              enunciado: 'En STRIDE, ¿qué control mitiga principalmente el repudio?',
              opciones: ['Cifrado TLS', 'Auditoría con actor y marca de tiempo', 'Límites de tasa', 'Validación de formularios en el cliente'],
              correcta: 'B',
            },
            {
              enunciado: '¿Qué condición es imprescindible antes de ejecutar una prueba ofensiva?',
              opciones: ['Tener una VPN', 'Usar herramientas comerciales', 'Contar con autorización explícita sobre el objetivo', 'Hacerla fuera del horario laboral'],
              correcta: 'C',
            },
          ],
        },
      ],
    },
    {
      titulo: 'Inyección SQL: explotación y defensa',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'Ejecutando un ataque de inyección SQL (Computerphile, en inglés)', youtube: 'ciNHn38EyRc', minutos: 18 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: de la comilla simple a la exfiltración',
          apunte: {
            archivo: 'inyeccion-sql-explotacion-defensa.pdf',
            titulo: 'Inyección SQL: explotación y defensa',
            secciones: [
              {
                titulo: 'Cómo nace la vulnerabilidad',
                parrafos: [
                  'Aparece cuando el código concatena datos del usuario dentro de una sentencia SQL. El motor no puede ' +
                  'distinguir entre la intención del programador y el texto del atacante, por lo que una entrada como ' +
                  "' OR '1'='1 cambia la lógica de la consulta.",
                ],
              },
              {
                titulo: 'Variantes que verás en el laboratorio',
                vinetas: [
                  'Basada en errores: el mensaje del motor revela la estructura de la consulta.',
                  'UNION: se añade una segunda consulta para leer otras tablas.',
                  'Ciega booleana y por tiempo: se infiere información con respuestas sí/no o con pg_sleep.',
                  'De segundo orden: el dato malicioso se guarda y se ejecuta más tarde en otra consulta.',
                ],
              },
              {
                titulo: 'Defensa en profundidad',
                vinetas: [
                  'Consultas parametrizadas siempre ($1, $2 en node-postgres); nunca plantillas de texto.',
                  'Listas blancas para identificadores dinámicos (columnas de orden, nombres de tabla).',
                  'Usuario de aplicación con mínimos privilegios: sin DDL, sin superusuario, sin acceso a otras bases.',
                  'Errores genéricos al cliente y detalle solo en registros internos.',
                  'Row Level Security como última barrera cuando varios inquilinos comparten tablas.',
                ],
              },
            ],
          },
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación: inyección SQL',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: '¿Cuál es la defensa principal contra la inyección SQL?',
              opciones: ['Escapar comillas a mano', 'Consultas parametrizadas', 'Ocultar los mensajes de error', 'Usar un WAF'],
              correcta: 'B',
            },
            {
              enunciado: 'Necesitas ordenar por una columna elegida por el usuario. ¿Qué haces?',
              opciones: ['Concatenar el nombre recibido', 'Parametrizar el nombre de la columna con $1', 'Validarlo contra una lista blanca de columnas permitidas', 'Codificarlo en Base64'],
              correcta: 'C',
            },
            {
              enunciado: 'Un atacante usa pg_sleep(5) y mide el tiempo de respuesta. ¿Qué variante es?',
              opciones: ['Inyección ciega basada en tiempo', 'UNION based', 'XSS reflejado', 'CSRF'],
              correcta: 'A',
            },
          ],
        },
      ],
    },
    {
      titulo: 'XSS, CSRF y seguridad del navegador',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'Cross-Site Scripting explicado (Computerphile, en inglés)', youtube: 'L5l9lSnNMxg', minutos: 9 },
        { tipo: 'VIDEO', titulo: 'Cross-Site Request Forgery explicado (Computerphile, en inglés)', youtube: 'vRBihr41JTo', minutos: 9 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: codificación de salida, CSP y cookies SameSite',
          apunte: {
            archivo: 'xss-csrf-seguridad-navegador.pdf',
            titulo: 'XSS, CSRF y seguridad del navegador',
            secciones: [
              {
                titulo: 'Tipos de XSS',
                vinetas: [
                  'Reflejado: el script viaja en la URL y vuelve en la respuesta.',
                  'Almacenado: el script se guarda (una reseña, un comentario) y afecta a todos los visitantes.',
                  'Basado en DOM: el propio JavaScript del cliente inserta datos sin codificar (innerHTML).',
                ],
              },
              {
                titulo: 'Defensas contra XSS',
                vinetas: [
                  'Codifica según el contexto (HTML, atributo, URL, JavaScript). Angular codifica las interpolaciones por defecto.',
                  'Evita bypassSecurityTrust* salvo con contenido sanitizado y revisado.',
                  'Content-Security-Policy estricta: script-src con nonces, sin unsafe-inline.',
                  'Cookies de sesión HttpOnly para que un script inyectado no pueda leerlas.',
                ],
              },
              {
                titulo: 'CSRF y su mitigación',
                parrafos: [
                  'En CSRF el navegador de la víctima envía una petición autenticada que el atacante ha preparado. Las cookies ' +
                  'SameSite=Lax o Strict bloquean la mayoría de casos; añade tokens anti-CSRF para operaciones sensibles y ' +
                  'comprueba la cabecera Origin en el servidor. Nunca uses GET para cambiar estado.',
                ],
              },
            ],
          },
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación: XSS y CSRF',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: 'Un comentario con <script> se guarda y se ejecuta a cada visitante. ¿Qué tipo de XSS es?',
              opciones: ['Reflejado', 'Almacenado', 'Basado en DOM', 'No es XSS'],
              correcta: 'B',
            },
            {
              enunciado: '¿Qué atributo de cookie impide que un script inyectado lea la cookie de sesión?',
              opciones: ['Secure', 'SameSite=None', 'HttpOnly', 'Max-Age'],
              correcta: 'C',
            },
            {
              enunciado: '¿Qué práctica reduce el riesgo de CSRF?',
              opciones: ['Cookies SameSite y verificación de Origin', 'Usar GET para eliminar recursos', 'Desactivar HTTPS', 'Guardar el token de sesión en localStorage'],
              correcta: 'A',
            },
          ],
        },
      ],
    },
    {
      titulo: 'Autenticación, sesiones y almacenamiento de credenciales',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'Cómo NO almacenar contraseñas (Computerphile, en inglés)', youtube: '8ZtInClXe1Q', minutos: 9 },
        { tipo: 'VIDEO', titulo: 'Sesiones frente a tokens en 100 segundos (vídeo en inglés)', youtube: 'UBUNrFtufWo', minutos: 2 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: hashing, sesiones y OAuth 2.0',
          apunte: {
            archivo: 'autenticacion-sesiones-credenciales.pdf',
            titulo: 'Autenticación, sesiones y credenciales',
            secciones: [
              {
                titulo: 'Almacenar contraseñas',
                vinetas: [
                  'Nunca en texto plano ni con hashes rápidos (MD5, SHA-1, SHA-256 sin más).',
                  'Usa algoritmos lentos con sal: Argon2id, scrypt o bcrypt con un coste ajustado.',
                  'Compara en tiempo constante y aplica bloqueo progresivo ante intentos fallidos.',
                  'Comprueba contraseñas filtradas (k-anonimato con Have I Been Pwned).',
                ],
              },
              {
                titulo: 'Sesiones seguras',
                vinetas: [
                  'Identificador opaco y aleatorio de al menos 128 bits; guarda solo su hash en la base.',
                  'Rota el identificador tras iniciar sesión y tras cambiar privilegios.',
                  'Expiración por inactividad y absoluta; cierre de sesión en todos los dispositivos.',
                ],
              },
              {
                titulo: 'OAuth 2.0 y OpenID Connect',
                parrafos: [
                  'Para aplicaciones web y móviles usa el flujo de código de autorización con PKCE. Valida el parámetro state, ' +
                  'restringe las redirect_uri registradas y solicita el mínimo de scopes. El access token no es una prueba de ' +
                  'identidad: para eso está el ID token de OpenID Connect.',
                ],
              },
            ],
          },
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación final: autenticación y credenciales',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: '¿Qué algoritmo es adecuado para almacenar contraseñas?',
              opciones: ['MD5', 'SHA-256 sin sal', 'Argon2id', 'Base64'],
              correcta: 'C',
            },
            {
              enunciado: '¿Qué flujo de OAuth 2.0 se recomienda para una SPA?',
              opciones: ['Implícito', 'Código de autorización con PKCE', 'Credenciales de contraseña del propietario', 'Ninguno, OAuth no sirve para SPA'],
              correcta: 'B',
            },
            {
              enunciado: '¿Cuándo debe rotarse el identificador de sesión?',
              opciones: ['Tras iniciar sesión y tras cambiar privilegios', 'Nunca, para no molestar al usuario', 'Solo al cerrar el navegador', 'Cada vez que se carga una imagen'],
              correcta: 'A',
            },
          ],
        },
      ],
    },
  ],
};
