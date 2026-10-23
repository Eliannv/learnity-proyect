import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import type { SeguimientoDocente } from '../../../core/api/contrato';
import { AuthService } from '../../../core/auth/auth.service';
import { DocenteCursosApi } from '../../../features/docente-cursos/docente-cursos.api';
import { SeguimientoDocenteApi } from '../../../features/docente-cursos/seguimiento-docente.api';
import { cursoDocente, seguimientoDocente, diferido } from '../../../features/catalogo/pruebas/sprint3.fixtures';
import { EstudiantesCurso } from './estudiantes';

describe('Seguridad y concurrencia del seguimiento docente', () => {
  function montar(params: Record<string, string> = {}) {
    const cursosApi = { misCursos: vi.fn().mockResolvedValue({ items: [cursoDocente(8), cursoDocente(9)] }) };
    const api = { listar: vi.fn((id: number, pagina: number) => Promise.resolve(seguimientoDocente(id, pagina))) };
    const auth = { sesionExpirada: vi.fn() };
    const map = convertToParamMap(params);
    TestBed.configureTestingModule({ providers: [
      provideRouter([]), { provide: DocenteCursosApi, useValue: cursosApi },
      { provide: SeguimientoDocenteApi, useValue: api }, { provide: AuthService, useValue: auth },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: map }, queryParamMap: of(map) } },
    ] });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(EstudiantesCurso);
    return { fixture, api, auth };
  }
  async function estable(fixture: ReturnType<typeof montar>['fixture']) {
    for (let paso = 0; paso < 3; paso++) {
      fixture.detectChanges(); await fixture.whenStable();
    }
    fixture.detectChanges();
  }

  it('no solicita el seguimiento de un curso que no figura entre los cursos propios', async () => {
    const { fixture, api } = montar({ curso: '999' });
    await estable(fixture);
    expect(api.listar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('no está disponible');
    expect(fixture.nativeElement.textContent).not.toContain('Estudiante 8');
  });

  it('descarta la respuesta anterior cuando se cambia rápidamente de curso', async () => {
    const { fixture, api } = montar();
    const primero = diferido<SeguimientoDocente>();
    const segundo = diferido<SeguimientoDocente>();
    api.listar.mockReturnValueOnce(primero.promesa).mockReturnValueOnce(segundo.promesa);
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('select')).not.toBeNull();
    });
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = '9'; select.dispatchEvent(new Event('change'));
    segundo.resolver(seguimientoDocente(9));
    await estable(fixture);
    primero.resolver(seguimientoDocente(8));
    await estable(fixture);
    expect(fixture.nativeElement.textContent).toContain('Estudiante 9');
    expect(fixture.nativeElement.textContent).not.toContain('Estudiante 8');
  });

  it('un 403 no sustituye el error por estudiantes de ejemplo', async () => {
    const { fixture, api } = montar();
    api.listar.mockRejectedValue(new HttpErrorResponse({ status: 403 }));
    await estable(fixture);
    expect(fixture.nativeElement.textContent).toContain('No tienes permiso');
    expect(fixture.nativeElement.querySelector('tbody')).toBeNull();
  });

  it('invalida la sesión ante un 401 del servidor', async () => {
    const { fixture, api, auth } = montar();
    api.listar.mockRejectedValue(new HttpErrorResponse({ status: 401 }));
    await estable(fixture);
    expect(auth.sesionExpirada).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Tu sesión caducó');
  });
});
