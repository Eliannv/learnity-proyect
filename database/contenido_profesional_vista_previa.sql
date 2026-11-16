-- =====================================================================
-- Vista previa (SOLO LECTURA) de database/contenido_profesional.sql
-- Generado por backend/scripts/contenido-profesional/generar.mts; no lo edites a mano.
--
-- Lista los cursos que el script ELIMINARÍA con todo su contenido (módulos, lecciones, archivos,
-- inscripciones, reseñas e hilos) y comprueba que existen las cuentas autoras.
-- No modifica nada: ejecútalo antes del script principal y revisa el resultado.
-- =====================================================================
WITH conservar (correo, titulo) AS (
  VALUES
    ('elianguaman145@gmail.com', 'Arquitectura Hexagonal y Clean Code en Node.js y TypeScript'),
    ('kevin.valarezo.1848@gmail.com', 'Seguridad Ofensiva y OWASP Top 10 para Aplicaciones Web Modernas'),
    ('ana.torres@learnity.com', 'Optimización de Consultas SQL y Concurrencia en PostgreSQL / Supabase'),
    ('elianguaman145@gmail.com', 'Angular 21 Avanzado: Signals, Change Detection y Arquitectura Standalone'),
    ('bettyguaman75@gmail.com', 'Diseño de Sistemas UX/UI Escalables con Design Systems'),
    ('kevin.valarezo.1848@gmail.com', 'DevOps en la Nube: Contenedores, Kubernetes y CI/CD Seguro')
)
SELECT c.id_curso, c.estado, c.titulo, u.correo AS docente,
       (SELECT count(*) FROM inscripcion i WHERE i.id_curso = c.id_curso) AS inscripciones,
       (SELECT count(*) FROM resena r JOIN inscripcion i USING (id_inscripcion) WHERE i.id_curso = c.id_curso) AS resenas,
       (SELECT count(*) FROM archivo a WHERE a.id_curso = c.id_curso) AS archivos
  FROM curso c
  JOIN docente d ON d.id_docente = c.id_docente
  JOIN usuario u ON u.id_persona = d.id_persona
 WHERE NOT EXISTS (SELECT 1 FROM conservar k WHERE lower(k.correo) = lower(u.correo) AND k.titulo = c.titulo)
 ORDER BY c.id_curso;

-- Cuentas autoras: todas deben aparecer con existe = true.
SELECT x.correo, EXISTS (SELECT 1 FROM usuario u WHERE lower(u.correo) = lower(x.correo)) AS existe
  FROM (VALUES ('elianguaman145@gmail.com'), ('kevin.valarezo.1848@gmail.com'), ('bettyguaman75@gmail.com'), ('jvalarezo854@gmail.com'), ('ana.torres@learnity.com')) AS x(correo);
