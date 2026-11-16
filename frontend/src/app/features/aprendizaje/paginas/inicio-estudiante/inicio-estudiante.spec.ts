import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import type { CursoInscrito } from '../../../../core/api/contrato';
import { AuthService } from '../../../../core/auth/auth.service';
import { ICONOS } from '../../../../shared/ui/marca/iconos';
import { CatalogoApi } from '../../../catalogo/catalogo.api';
import { AprendizajeApi } from '../../aprendizaje.api';
import { InicioEstudiante } from './inicio-estudiante';

function inscrito(id: number, ultimaLeccionId: number | null, progresoPct: number): CursoInscrito {
  return {
    curso: {
      id, titulo: `Curso ${id}`, subtitulo: null, portadaUrl: `/api/fotos/portada-${id}.png`, nivel: 'AVANZADO',
      categoria: { id: 8, nombre: 'Bases de Datos', icono: 'database' }, docente: 'Ana Torres',
    },
    inscripcion: {
      id: id * 10, cursoId: id, estado: 'ACTIVA', progresoPct, ultimaLeccionId,
      inscritoEn: '2026-10-01T10:00:00.000Z', completadoEn: null,
    },
    totalLecciones: 12, leccionesCompletadas: Math.round(progresoPct * 12 / 100), suspendido: false,
  };
}

function montar(items: CursoInscrito[]) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AprendizajeApi, useValue: { listar: vi.fn().mockResolvedValue({ items }) } },
      {
        provide: CatalogoApi,
        useValue: { categorias: vi.fn().mockResolvedValue([]), listar: vi.fn().mockResolvedValue({ items: [] }) },
      },
      {
        provide: AuthService,
        useValue: {
          usuario: signal({ nombres: 'Cristo', fotoUrl: null }), iniciales: signal('CC'), rutaPerfil: signal('/perfil'),
          esDocente: signal(false), esAdmin: signal(false),
        },
      },
      { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) },
    ],
  });
  const fixture = TestBed.createComponent(InicioEstudiante);
  fixture.detectChanges();
  return fixture;
}

describe('inicio con sesión: continúa donde lo dejaste', () => {
  it('usa la tarjeta del catálogo con la portada del curso y el avance', async () => {
    const fixture = montar([inscrito(18, 205, 33)]);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#t-continuar')).toBeTruthy();
    });
    const tarjeta = fixture.nativeElement.querySelector('section[aria-labelledby="t-continuar"] app-tarjeta-curso') as HTMLElement;
    expect(tarjeta.querySelector('img')?.getAttribute('src')).toBe('/api/fotos/portada-18.png');
    expect(tarjeta.querySelector('.docente')?.textContent).toContain('Ana Torres');
    expect(tarjeta.querySelector('.avance-texto')?.textContent).toContain('4 de 12 lecciones');
    expect(tarjeta.querySelector('.avance-texto')?.textContent).toContain('33 %');
    expect(tarjeta.querySelector('a.titulo')?.getAttribute('href')).toBe('/aprender/18/205');
  });

  it('un curso sin empezar lleva a su ficha', async () => {
    const fixture = montar([inscrito(19, null, 0)]);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#t-continuar')).toBeTruthy();
    });
    const tarjeta = fixture.nativeElement.querySelector('section[aria-labelledby="t-continuar"] app-tarjeta-curso') as HTMLElement;
    expect(tarjeta.querySelector('a.titulo')?.getAttribute('href')).toBe('/cursos/19');
    expect(tarjeta.querySelector('.avance-texto')?.textContent).toContain('Sin empezar');
  });
});
