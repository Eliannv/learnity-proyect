import { Route, Routes } from '@angular/router';
import { routes } from './app.routes';

/** Aplana el árbol de rutas (resolviendo loadChildren y loadComponent) en una línea por ruta. */
async function describir(rutas: Routes, prefijo = ''): Promise<string[]> {
  const lineas: string[] = [];
  for (const ruta of rutas) {
    const url = [prefijo, ruta.path ?? ''].filter(Boolean).join('/');
    if (!esContenedor(ruta)) lineas.push(await linea(ruta, url));
    if (ruta.children) lineas.push(...(await describir(ruta.children, url)));
    if (ruta.loadChildren) {
      const hijas = (await ruta.loadChildren()) as unknown as Routes | { default: Routes };
      lineas.push(...(await describir(Array.isArray(hijas) ? hijas : hijas.default, url)));
    }
  }
  return lineas;
}

/** Una ruta que solo agrupa con loadChildren no aporta nada propio: sus hijas llevan los atributos. */
function esContenedor(ruta: Route): boolean {
  return !!ruta.loadChildren && !ruta.component && !ruta.title && !ruta.data && !ruta.canActivate && !ruta.canMatch;
}

async function linea(ruta: Route, url: string): Promise<string> {
  const partes = [`/${url}`];
  if (ruta.pathMatch) partes.push(`match=${ruta.pathMatch}`);
  if (ruta.redirectTo !== undefined) partes.push(`redirige=${ruta.redirectTo}`);
  if (ruta.title) partes.push(`titulo=${ruta.title}`);
  if (ruta.data) partes.push(`data=${JSON.stringify(ruta.data)}`);
  if (ruta.canMatch) partes.push(`canMatch=${ruta.canMatch.length}`);
  if (ruta.canActivate) partes.push(`canActivate=${ruta.canActivate.map(nombreGuard).join('+')}`);
  if (ruta.component) partes.push(`layout=${limpiar(ruta.component.name)}`);
  if (ruta.loadComponent) {
    const componente = (await ruta.loadComponent()) as { name: string };
    partes.push(`pagina=${limpiar(componente.name)}`);
  }
  return partes.join(' | ');
}

// El empaquetado antepone "_" a los nombres de clase.
function limpiar(nombre: string): string {
  return nombre.replace(/^_/, '');
}

// rolGuard(rol) devuelve una función anónima: el rol queda fijado en data.rol de la misma ruta.
function nombreGuard(guard: unknown): string {
  return (guard as { name: string }).name || 'rolGuard';
}

// Rutas activas de Sprint 2 y Sprint 3; evaluaciones y administración futura siguen ocultas.
const ESPERADO: string[] = [
  '/login | titulo=Iniciar sesión · Learnity | canActivate=invitadoGuard | pagina=Login',
  '/registro | titulo=Crear cuenta · Learnity | canActivate=invitadoGuard | pagina=Registro',
  '/recuperar-contrasena | titulo=Recuperar contraseña · Learnity | canActivate=invitadoGuard | pagina=Recuperar',
  '/restablecer-contrasena | titulo=Crear nueva contraseña · Learnity | pagina=Restablecer',
  '/ | layout=LayoutSitio',
  '/ | match=full | titulo=Inicio · Learnity | canMatch=1 | pagina=InicioEstudiante',
  '/ | match=full | titulo=Learnity · Cursos en línea | pagina=Inicio',
  '/cursos | titulo=Catálogo de cursos · Learnity | pagina=Catalogo',
  '/cursos/:id | titulo=Detalle del curso · Learnity | pagina=DetalleCurso',
  '/mi-aprendizaje | titulo=Mi aprendizaje · Learnity | canActivate=rolGuard | pagina=MiAprendizaje',
  '/aprender/:cursoId/:leccionId | titulo=Lección · Learnity | canActivate=rolGuard | pagina=SeguimientoCurso',
  '/perfil | titulo=Mi perfil · Learnity | canActivate=autenticadoGuard+perfilEstudianteGuard | pagina=PerfilEstudiante',
  '/docente | data={\"rol\":\"DOCENTE\"} | canActivate=rolGuard | layout=LayoutPanel',
  '/docente | match=full | redirige=cursos',
  '/docente/cursos | titulo=Mis cursos · Learnity | data={\"seccion\":\"Mis cursos\"} | pagina=MisCursosDocente',
  '/docente/cursos/:id/editar | titulo=Editar curso · Learnity | data={\"seccion\":\"Constructor de curso\"} | pagina=EditorCurso',
  '/docente/estudiantes | titulo=Estudiantes del curso · Learnity | data={\"seccion\":\"Estudiantes\"} | pagina=EstudiantesCurso',
  '/docente/resenas | titulo=Reseñas · Learnity | data={\"seccion\":\"Reseñas\"} | pagina=ResenasDocente',
  '/docente/analiticas | titulo=Analíticas · Learnity | data={\"seccion\":\"Analíticas\"} | pagina=AnaliticasDocente',
  '/docente/perfil | titulo=Ajustes y perfil · Learnity | data={\"seccion\":\"Ajustes y perfil\"} | pagina=AjustesPerfil',
  '/admin | data={\"rol\":\"ADMIN\"} | canActivate=rolGuard | layout=LayoutPanel',
  '/admin | match=full | redirige=revision',
  '/admin/usuarios | titulo=Usuarios · Learnity | data={"seccion":"Usuarios"} | pagina=AdminUsuarios',
  '/admin/solicitudes | titulo=Solicitudes de docente · Learnity | data={\"seccion\":\"Solicitudes de docente\"} | pagina=Solicitudes',
  '/admin/revision | titulo=Revisión de cursos · Learnity | data={\"seccion\":\"Revisión de cursos\"} | pagina=RevisionCursos',
  '/admin/revision/:id | titulo=Revisión de curso · Learnity | data={\"seccion\":\"Revisión de cursos\"} | pagina=RevisionCurso',
  '/admin/categorias | titulo=Categorías · Learnity | data={\"seccion\":\"Categorías\"} | pagina=Categorias',
  '/admin/resenas | titulo=Reseñas · Learnity | data={\"seccion\":\"Reseñas\"} | pagina=ModeracionResenas',
  '/admin/accesos | titulo=Accesos · Learnity | data={"seccion":"Accesos"} | pagina=AdminAccesos',
  '/admin/auditoria | titulo=Auditoría · Learnity | data={"seccion":"Auditoría"} | pagina=AdminAuditoria',
  '/admin/sesiones | titulo=Sesiones y base de datos · Learnity | data={"seccion":"Sesiones y base de datos"} | pagina=AdminSesiones',
  '/admin/perfil | titulo=Ajustes y perfil · Learnity | data={\"seccion\":\"Ajustes y perfil\"} | pagina=AjustesPerfil',
  '/acceso-denegado | layout=LayoutSitio',
  '/acceso-denegado | titulo=Acceso denegado · Learnity | data={"tipo":"403"} | pagina=PaginaError',
  '/** | layout=LayoutSitio',
  '/** | titulo=Página no encontrada · Learnity | data={"tipo":"404"} | pagina=PaginaError',
];

describe('árbol de rutas', () => {
  it('conserva URLs, guards, títulos, data y redirecciones', async () => {
    const actual = await describir(routes);
    expect(actual).toEqual(ESPERADO);
  });
});
