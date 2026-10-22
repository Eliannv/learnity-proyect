import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { CursoResumen, SeguimientoDocente } from '../../../core/api/contrato';
import { DocenteCursosApi } from '../../../features/docente-cursos/docente-cursos.api';
import { SeguimientoDocenteApi } from '../../../features/docente-cursos/seguimiento-docente.api';
import { EstudiantesCurso } from './estudiantes';

const curso = { id: 7, titulo: 'Álgebra inicial', estado: 'PUBLICADO' } as CursoResumen;
const paginaUno: SeguimientoDocente = {
  curso: { id: 7, titulo: curso.titulo }, pagina: 1, limite: 20, total: 21, totalPaginas: 2,
  resumen: { inscritos: 21, completados: 3, progresoPromedio: 35 },
  items: [{
    idPersona: 8, nombre: 'Ana Pérez', estado: 'ACTIVA', progresoPct: 35,
    ultimaLeccionId: 11, inscritoEn: '2026-10-21T10:00:00.000Z',
    ultimaActividadEn: '2026-10-22T10:00:00.000Z',
  }],
};

describe('seguimiento docente', () => {
  it('carga cursos y estudiantes desde API, navega páginas y conserva la selección', async () => {
    const cursosApi = { misCursos: vi.fn().mockResolvedValue({ items: [curso] }) };
    const seguimientoApi = { listar: vi.fn().mockResolvedValueOnce(paginaUno).mockResolvedValueOnce({
      ...paginaUno, pagina: 2, items: [],
    }) };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: DocenteCursosApi, useValue: cursosApi },
        { provide: SeguimientoDocenteApi, useValue: seguimientoApi }],
    });
    const fixture = TestBed.createComponent(EstudiantesCurso);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cargando tus cursos');
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(seguimientoApi.listar).toHaveBeenCalledWith(7, 1);
      expect(fixture.nativeElement.textContent).toContain('Ana Pérez');
    });
    expect(fixture.nativeElement.textContent).toContain('21');
    const siguiente = [...fixture.nativeElement.querySelectorAll('button')].find(
      (boton: HTMLButtonElement) => boton.textContent?.trim() === 'Siguiente',
    ) as HTMLButtonElement;
    siguiente.click();
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(seguimientoApi.listar).toHaveBeenLastCalledWith(7, 2);
      expect(fixture.nativeElement.textContent).toContain('No hay estudiantes en esta página');
    });
  });

  it('explica lista vacía y permite reintentar tras un error', async () => {
    const cursosApi = { misCursos: vi.fn().mockRejectedValueOnce(new Error('red')).mockResolvedValue({ items: [] }) };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: DocenteCursosApi, useValue: cursosApi },
        { provide: SeguimientoDocenteApi, useValue: { listar: vi.fn() } }],
    });
    const fixture = TestBed.createComponent(EstudiantesCurso);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    const reintentar = [...fixture.nativeElement.querySelectorAll('button')].find(
      (boton: HTMLButtonElement) => boton.textContent?.trim() === 'Reintentar',
    ) as HTMLButtonElement;
    reintentar.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aún no tienes cursos');
  });
});
