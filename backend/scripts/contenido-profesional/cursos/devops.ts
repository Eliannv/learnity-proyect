import type { Curso } from '../tipos.js';

export const devops: Curso = {
  clave: 'devops',
  titulo: 'DevOps en la Nube: Contenedores, Kubernetes y CI/CD Seguro',
  subtitulo: 'Lleva una aplicación desde el repositorio hasta producción con contenedores reproducibles, orquestación y pipelines seguros.',
  descripcion:
    'Curso intermedio para desarrolladores y administradores que quieren automatizar el ciclo completo de entrega. ' +
    'Trabajamos el flujo con Git, construimos imágenes Docker mínimas y seguras, desplegamos en Kubernetes con ' +
    'sondas, recursos y secretos, y diseñamos un pipeline de CI/CD que prueba, analiza dependencias, firma artefactos y ' +
    'despliega con estrategias sin interrupción del servicio.',
  nivel: 'INTERMEDIO',
  categoria: 'DevOps y Cloud',
  autor: 'kevin.valarezo.1848@gmail.com',
  nombreAutor: 'Kevin Valarezo',
  publicadoHaceDias: 67,
  objetivos: [
    'Trabajar con ramas cortas, revisiones y versionado semántico en Git',
    'Construir imágenes Docker multi-etapa, pequeñas y sin privilegios de root',
    'Desplegar en Kubernetes con Deployments, Services, sondas y límites de recursos',
    'Diseñar un pipeline de CI/CD con pruebas, análisis de dependencias y despliegue progresivo',
    'Automatizar tareas de operación con Bash en Linux',
  ],
  requisitos: [
    'Uso básico de la terminal de Linux',
    'Haber desarrollado y ejecutado una aplicación web en local',
  ],
  modulos: [
    {
      titulo: 'Flujo de trabajo con Git y entrega continua',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'Git explicado en 100 segundos (vídeo en inglés)', youtube: 'hwP7WQkmECE', minutos: 2 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: trunk-based development y versionado',
          apunte: {
            archivo: 'flujo-git-entrega-continua.pdf',
            titulo: 'Flujo de trabajo con Git y entrega continua',
            secciones: [
              {
                titulo: 'Ramas cortas e integración frecuente',
                vinetas: [
                  'Ramas de funcionalidad de vida corta (horas o pocos días) que se integran a main mediante pull request.',
                  'main siempre desplegable: protegida, con revisiones obligatorias y pipeline en verde.',
                  'Feature flags para integrar trabajo incompleto sin exponerlo a los usuarios.',
                  'Nunca reescribas la historia compartida (push --force sobre main).',
                ],
              },
              {
                titulo: 'Commits y versiones',
                parrafos: [
                  'Conventional Commits (feat, fix, refactor, chore) permite generar el registro de cambios y decidir la ' +
                  'siguiente versión semántica de forma automática: fix sube el parche, feat la menor y BREAKING CHANGE la mayor.',
                ],
              },
              {
                titulo: 'Las cuatro métricas DORA',
                vinetas: [
                  'Frecuencia de despliegue.',
                  'Tiempo de entrega de un cambio (lead time).',
                  'Tasa de fallos de cambios.',
                  'Tiempo de recuperación ante un incidente.',
                ],
              },
            ],
          },
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación: Git y entrega continua',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: 'Según Conventional Commits, ¿qué tipo de commit sube la versión menor?',
              opciones: ['fix', 'feat', 'chore', 'docs'],
              correcta: 'B',
            },
            {
              enunciado: '¿Qué técnica permite integrar en main una funcionalidad incompleta sin exponerla?',
              opciones: ['Feature flags', 'Ramas de larga duración', 'push --force', 'Desactivar las pruebas'],
              correcta: 'A',
            },
            {
              enunciado: '¿Cuál de estas es una métrica DORA?',
              opciones: ['Líneas de código por día', 'Número de reuniones', 'Tiempo de recuperación ante incidentes', 'Cobertura de comentarios'],
              correcta: 'C',
            },
          ],
        },
      ],
    },
    {
      titulo: 'Contenedores con Docker',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'Docker en 100 segundos (vídeo en inglés)', youtube: 'Gjnup-PuquQ', minutos: 2 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: imágenes multi-etapa, pequeñas y seguras',
          apunte: {
            archivo: 'contenedores-docker-seguros.pdf',
            titulo: 'Contenedores Docker seguros',
            secciones: [
              {
                titulo: 'Dockerfile multi-etapa para Node.js',
                vinetas: [
                  'Etapa build: FROM node:22-alpine, npm ci y npm run build.',
                  'Etapa final: copia solo dist/ y node_modules de producción (npm ci --omit=dev).',
                  'USER node para no ejecutar como root; EXPOSE y CMD en forma de lista.',
                  '.dockerignore con .git, node_modules, .env* y artefactos locales.',
                ],
              },
              {
                titulo: 'Buenas prácticas',
                vinetas: [
                  'Fija versiones de imagen base por digest para builds reproducibles.',
                  'Ordena las capas de menos a más cambiantes para aprovechar la caché.',
                  'Nunca copies secretos a la imagen: se inyectan en tiempo de ejecución.',
                  'Escanea la imagen (Trivy, Grype) en el pipeline y falla ante vulnerabilidades críticas.',
                  'Un proceso por contenedor y registros a stdout/stderr.',
                ],
              },
            ],
          },
          recursos: [
            {
              archivo: 'dockerfile-referencia-node.pdf',
              titulo: 'Dockerfile de referencia para Node.js',
              secciones: [
                {
                  titulo: 'Dockerfile comentado',
                  vinetas: [
                    'FROM node:22-alpine AS build',
                    'WORKDIR /app',
                    'COPY package*.json ./',
                    'RUN npm ci',
                    'COPY . .',
                    'RUN npm run build && npm prune --omit=dev',
                    'FROM node:22-alpine',
                    'WORKDIR /app',
                    'ENV NODE_ENV=production',
                    'COPY --from=build --chown=node:node /app/dist ./dist',
                    'COPY --from=build --chown=node:node /app/node_modules ./node_modules',
                    'USER node',
                    'EXPOSE 3000',
                    'CMD ["node", "dist/server.js"]',
                  ],
                },
              ],
            },
          ],
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación: Docker',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: '¿Qué ventaja principal ofrece un Dockerfile multi-etapa?',
              opciones: ['Imágenes finales más pequeñas sin herramientas de compilación', 'Arranque más lento', 'Permite usar Windows y Linux a la vez', 'Elimina la necesidad de .dockerignore'],
              correcta: 'A',
            },
            {
              enunciado: '¿Cómo deben llegar los secretos a un contenedor?',
              opciones: ['Copiados en la imagen', 'En una capa ENV del Dockerfile', 'Inyectados en tiempo de ejecución', 'En el nombre de la etiqueta'],
              correcta: 'C',
            },
            {
              enunciado: '¿Qué instrucción evita que la aplicación se ejecute como root?',
              opciones: ['EXPOSE', 'USER node', 'WORKDIR', 'HEALTHCHECK'],
              correcta: 'B',
            },
          ],
        },
      ],
    },
    {
      titulo: 'Orquestación con Kubernetes',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'Kubernetes explicado en 100 segundos (vídeo en inglés)', youtube: 'PziYflu8cB8', minutos: 2 },
        { tipo: 'VIDEO', titulo: 'Arquitectura de Kubernetes en 6 minutos (vídeo en inglés)', youtube: 'TlHvYWVUZyc', minutos: 6 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: objetos esenciales y despliegues sin interrupción',
          apunte: {
            archivo: 'kubernetes-objetos-despliegues.pdf',
            titulo: 'Kubernetes: objetos esenciales y despliegues',
            secciones: [
              {
                titulo: 'Objetos que usarás a diario',
                vinetas: [
                  'Pod: una o más instancias de contenedor que comparten red y almacenamiento.',
                  'Deployment: estado deseado de réplicas y estrategia de actualización.',
                  'Service: dirección estable y balanceo hacia los pods.',
                  'Ingress / Gateway: entrada HTTP desde fuera del clúster con TLS.',
                  'ConfigMap y Secret: configuración y credenciales separadas de la imagen.',
                ],
              },
              {
                titulo: 'Salud y recursos',
                vinetas: [
                  'readinessProbe: el pod solo recibe tráfico cuando está listo.',
                  'livenessProbe: reinicia contenedores bloqueados; no la apuntes a dependencias externas.',
                  'requests y limits de CPU y memoria para planificar y evitar vecinos ruidosos.',
                  'HorizontalPodAutoscaler para escalar según métricas.',
                ],
              },
              {
                titulo: 'Estrategias de despliegue',
                parrafos: [
                  'RollingUpdate sustituye pods poco a poco (maxSurge, maxUnavailable). Blue/green mantiene dos entornos y ' +
                  'cambia el tráfico de golpe. Canary envía un porcentaje pequeño del tráfico a la nueva versión y lo aumenta ' +
                  'si las métricas de error y latencia se mantienen.',
                ],
              },
            ],
          },
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación: Kubernetes',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: '¿Qué sonda evita que un pod reciba tráfico antes de estar listo?',
              opciones: ['livenessProbe', 'readinessProbe', 'startupProbe obligatoria', 'Ninguna, el Service lo detecta solo'],
              correcta: 'B',
            },
            {
              enunciado: '¿Qué objeto proporciona una dirección estable para un conjunto de pods?',
              opciones: ['ConfigMap', 'Service', 'Secret', 'Namespace'],
              correcta: 'B',
            },
            {
              enunciado: 'Envías el 5 % del tráfico a la nueva versión y lo aumentas según métricas. ¿Qué estrategia es?',
              opciones: ['Recreate', 'Blue/green', 'Canary', 'Big bang'],
              correcta: 'C',
            },
          ],
        },
      ],
    },
    {
      titulo: 'Pipelines de CI/CD y automatización en Linux',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'Linux en 100 segundos (vídeo en inglés)', youtube: 'rrB13utjYV4', minutos: 2 },
        { tipo: 'VIDEO', titulo: 'Bash en 100 segundos (vídeo en inglés)', youtube: 'I4EWvMFj37g', minutos: 2 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: anatomía de un pipeline seguro',
          apunte: {
            archivo: 'pipeline-ci-cd-seguro.pdf',
            titulo: 'Anatomía de un pipeline de CI/CD seguro',
            secciones: [
              {
                titulo: 'Etapas del pipeline',
                vinetas: [
                  'Lint y verificación de tipos en cada pull request.',
                  'Pruebas unitarias y de integración contra servicios efímeros (contenedores de PostgreSQL).',
                  'Análisis de dependencias (npm audit, Dependabot) y de secretos filtrados (gitleaks).',
                  'Build de la imagen, escaneo y firma (cosign) con SBOM adjunto.',
                  'Despliegue automático a staging y promoción a producción con aprobación.',
                ],
              },
              {
                titulo: 'Seguridad de la cadena de suministro',
                vinetas: [
                  'Credenciales de corta duración con OIDC entre el CI y la nube; nada de claves estáticas.',
                  'Permisos mínimos para el token del pipeline (permissions: contents: read).',
                  'Acciones de terceros fijadas por SHA, no por etiqueta móvil.',
                  'Entornos protegidos con revisores para producción.',
                ],
              },
              {
                titulo: 'Scripts de operación con Bash',
                parrafos: [
                  'Empieza todo script con set -euo pipefail, cita las variables ("$VAR"), valida argumentos y registra lo que ' +
                  'hace. Un script que pueda borrar datos debe pedir confirmación explícita o un parámetro como --confirmo.',
                ],
              },
            ],
          },
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación final: CI/CD y automatización',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: '¿Cómo debe autenticarse el pipeline ante el proveedor de nube?',
              opciones: ['Con una clave de acceso estática guardada en el repositorio', 'Con credenciales de corta duración mediante OIDC', 'Con la contraseña del administrador', 'Sin autenticación'],
              correcta: 'B',
            },
            {
              enunciado: '¿Por qué fijar las acciones de terceros por SHA?',
              opciones: ['Porque es más rápido', 'Para evitar que un cambio en la etiqueta introduzca código malicioso', 'Porque GitHub lo exige', 'Para ahorrar espacio'],
              correcta: 'B',
            },
            {
              enunciado: '¿Qué hace set -euo pipefail en un script Bash?',
              opciones: ['Detiene el script ante errores, variables no definidas y fallos en tuberías', 'Activa el modo depuración', 'Ejecuta el script como root', 'Ignora todos los errores'],
              correcta: 'A',
            },
          ],
        },
      ],
    },
  ],
};
