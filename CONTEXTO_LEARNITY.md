# Contexto de Learnity

Actualizado: 9 de octubre de 2026.

## Fuentes del proyecto

- `Documentacion_Learnity.docx`: alcance, RF, RNF, reglas de negocio, roles y pantallas.
- `Arquitectura_Learnity.docx`: arquitectura vigente y modelo de datos.
- `Guia_Learnity_PostgreSQL_pgAdmin.docx`: creación y administración de la base local.
- `Diseño App/Diseño App.pen` y `Prototipo Learnity/index.html`: diseño y prototipo de Pencil.
- Este repositorio: estado efectivo de la implementación. Ante una discrepancia sobre lo que ya funciona, comprobar el código y ejecutar las pruebas.

Los documentos Word y PDF se encuentran en `C:\Users\ASUS VIVOBOOK\OneDrive - utmachala.edu.ec\Proyecto Practicas`.

## Decisión de arquitectura vigente

Learnity es una plataforma de cursos gratuitos con frontend Angular 21 y un solo backend Node.js 22, Express 5 y TypeScript. La comunicación se hace mediante una API REST. El backend es un **monolito modular en capas**: `routes → controller → service → repository → PostgreSQL`. Sus módulos son `identidad`, `cursos`, `contenido`, `aprendizaje`, `evaluaciones` y `administracion`.

La base `learnity` se ejecuta en **PostgreSQL 17 local** durante el desarrollo. **pgAdmin es el cliente de administración**, no el motor de base de datos. El backend usa la cuenta `learnity_app`, el paquete `pg` y consultas SQL parametrizadas. Los cambios estructurales usan scripts SQL; no hay Prisma ni migraciones de Prisma. El despliegue público, el almacenamiento definitivo de archivos y el servicio de correo aún no están decididos ni implementados.

En desarrollo, Angular sirve en `localhost:4200`, redirige `/api` a Express en `localhost:3000` y Express se conecta a PostgreSQL en `localhost:5432` según `backend/.env`.

## Estado comprobado del repositorio

| Área | Estado al 8 de octubre de 2026 |
|---|---|
| Base de datos | `database/learnity_esquema.sql` y modelo DBML disponibles. La conexión a un servidor PostgreSQL en ejecución no se verificó en esta revisión. |
| Backend común | Aplicación Express, pool `pg`, JWT, bcrypt, validación con Zod, manejo de errores y OpenAPI presentes. |
| Identidad | Registro, login, sesión con refresh rotatorio, perfil y recuperación implementados. El README informa 22 pruebas de integración. Falta comprobar Gmail con una cuenta emisora y un buzón reales. |
| Otros módulos | Carpetas y archivos de las cuatro capas creados. Sus rutas y servicios todavía están vacíos o documentan endpoints previstos. |
| Frontend | Rutas y pantallas Angular para visitante, estudiante, docente y administrador presentes. La identidad usa API real y `modoDemo` está desactivado; muchas pantallas de cursos y paneles aún consumen `data/datos-demo.ts`. |
| Prototipo | Diseño `.pen` y visor HTML con pantallas exportadas; sirven como referencia visual, no como evidencia de integración funcional. |
| Archivos y correo | La recuperación tiene transporte de buzón local y código de Gmail API; falta probar el envío Gmail real. La carga, validación y entrega segura de archivos siguen pendientes. |

## Reglas que deben guiar la implementación

- Toda cuenta nueva comienza como **Estudiante**. El rol Docente se solicita después y lo aprueba un administrador. El registro actual no acepta elegir rol.
- Los roles son acumulativos. Un docente conserva la vista y los cursos de estudiante.
- Cada módulo controla sus reglas en `service`; las consultas SQL van en `repository`. Un módulo no consulta directamente el repositorio de otro.
- El frontend nunca recibe las credenciales de PostgreSQL; solo consume la API.
- Los límites de medios del alcance son MP4 hasta 5 MB y 480p; PDF y PowerPoint hasta 10 MB. Su cumplimiento en servidor está pendiente.
- Las figuras de secuencia funcional en la arquitectura describen el comportamiento objetivo; no indican que esos flujos ya estén operativos.

## Siguiente paso de implementación

Cerrar la prueba de envío Gmail del Sprint 1. Después ejecutar el [Sprint 2](SPRINT_2_LEARNITY.md): cursos, catálogo, subida mínima de PDF y revisión administrativa. Las pantallas de cursos deben reemplazar los datos del prototipo por llamadas a la API.
