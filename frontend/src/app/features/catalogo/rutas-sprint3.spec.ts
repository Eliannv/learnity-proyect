import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, type CanActivateFn, type Routes, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { routes } from '../../app.routes';
import { sesionPrueba } from './pruebas/sprint3.fixtures';

function rutas(ramas: Routes, prefijo = ''): string[] {
  return ramas.flatMap((ruta) => {
    const path = [prefijo, ruta.path].filter(Boolean).join('/');
    return [path, ...rutas(ruta.children ?? [], path)];
  });
}
describe('Rutas verificadas del Sprint 3', () => {
  it('activa aprendizaje y seguimiento sin activar evaluaciones ni usuarios del Sprint 4', () => {
    const anterior = environment.sprint34Habilitado;
    environment.sprint34Habilitado = true;
    try {
      const paths = rutas(routes);
      expect(paths).toContain('mi-aprendizaje');
      expect(paths).toContain('aprender/:cursoId/:leccionId');
      expect(paths).toContain('docente/estudiantes');
      expect(paths.some((path) => path.includes('evaluacion'))).toBe(false);
      expect(paths).not.toContain('admin/usuarios');
    } finally { environment.sprint34Habilitado = anterior; }
  });

  it('el guard docente rechaza al visitante y al estudiante, también al navegar entre hijos', () => {
    const auth = sesionPrueba(null);
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: auth }] });
    const docente = routes.find((ruta) => ruta.path === 'docente')!;
    const guard = docente.canActivate![0] as CanActivateFn;
    const evaluar = () => TestBed.runInInjectionContext(() => guard(
      {} as ActivatedRouteSnapshot, { url: '/docente/estudiantes' } as RouterStateSnapshot,
    ));
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(evaluar() as ReturnType<Router['parseUrl']>)).toContain('/login?volver=');
    auth.usuario.set({ idUsuario: 2, idPersona: 2, nombres: 'Estudiante', apellidos: 'Prueba',
      correo: 'estudiante@example.test', roles: ['ESTUDIANTE'], fotoUrl: null });
    expect(router.serializeUrl(evaluar() as ReturnType<Router['parseUrl']>)).toBe('/');
    expect(docente.canActivateChild).toBeDefined();
  });
});
