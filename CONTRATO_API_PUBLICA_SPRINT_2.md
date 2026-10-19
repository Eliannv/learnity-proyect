# Contrato implementado: API pública de cursos (Sprint 2)

Este contrato es la interfaz que consumen Angular Público y las tres rutas de lectura del módulo Cursos. Se verificó contra PostgreSQL local y el navegador el 9 de octubre de 2026. Los compañeros deben conservarlo al añadir las rutas privadas.

## `GET /api/categorias`

Sin autenticación. Devuelve `200` y un arreglo de categorías **activas**, ordenadas por `nombre`. Una categoría inactiva nunca aparece.

```json
[{ "id": 1, "nombre": "Programación" }]
```

## `GET /api/cursos`

Sin autenticación. Parámetros opcionales: `q` (búsqueda por título, subtítulo o descripción), `categoria` (nombre exacto, repetible), `nivel` (`PRINCIPIANTE`, `INTERMEDIO`, `AVANZADO`; repetible), `orden` (`recientes`, `populares`, `az`), `pagina` (desde 1) y `limite` (Angular usa 9). Los filtros repetidos se combinan con OR dentro del mismo tipo y con AND entre tipos. `recientes` ordena por `publicadoEn` descendente; `az` por título ascendente; `populares` por número de inscripciones descendente. Desempatar por `id` para paginación estable.

`200` devuelve:

```json
{
  "items": [{
    "id": 12,
    "titulo": "Introducción a Python",
    "subtitulo": "Aprende desde cero",
    "categoria": { "id": 1, "nombre": "Programación" },
    "docente": "Carlos Mendoza",
    "nivel": "PRINCIPIANTE",
    "portadaUrl": "/portadas/python.webp",
    "modulos": 2,
    "lecciones": 5,
    "minutos": 18,
    "publicadoEn": "2026-10-09T15:00:00.000Z",
    "estado": "PUBLICADO"
  }],
  "pagina": 1,
  "limite": 9,
  "total": 1,
  "totalPaginas": 1
}
```

`subtitulo` y `portadaUrl` pueden ser `null`. Las cantidades son números no negativos; `minutos` es la suma de duraciones conocidas, redondeada a minutos. `total` cuenta únicamente cursos publicados después de aplicar filtros; `totalPaginas` es `ceil(total/limite)` y vale 0 cuando `total` es 0. La lista vacía responde `200` con `items: []`.

## `GET /api/cursos/:id`

Sin autenticación. `id` es el entero `curso.id_curso`. Solo responde un curso `PUBLICADO`; un borrador, un curso en revisión, rechazado, archivado o un ID inexistente responde `404` indistinguible.

`200` devuelve todos los campos de un elemento del catálogo y además:

```json
{
  "descripcion": "Descripción completa del curso.",
  "docenteBio": "Biografía pública del docente.",
  "objetivos": ["Escribir programas básicos"],
  "requisitos": ["Ninguno"],
  "temario": [{
    "id": 4,
    "orden": 1,
    "titulo": "Primeros pasos",
    "lecciones": [{
      "id": 18,
      "orden": 1,
      "titulo": "Instalación",
      "tipo": "DOCUMENTO",
      "minutos": 0
    }]
  }]
}
```

`docenteBio` puede ser `null`. `temario` y `lecciones` se devuelven en orden ascendente. El detalle público no incluye rutas privadas, IDs de archivo ni URLs de descarga.

## Errores y privacidad

El formato de error es el existente en el backend: `{ "error": { "codigo": "NO_ENCONTRADO", "mensaje": "..." } }`. Parámetros inválidos: `400` con `SOLICITUD_INVALIDA`; fallo interno: `500`. Los filtros y la paginación deben aplicarse en consultas SQL parametrizadas. El servidor filtra `estado = 'PUBLICADO'` en catálogo, conteo y detalle; el filtro defensivo de Angular no sustituye esa regla.
