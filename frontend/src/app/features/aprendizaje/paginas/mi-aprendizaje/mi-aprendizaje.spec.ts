import { importProvidersFrom } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { AprendizajeApi } from '../../aprendizaje.api';
import { ICONOS } from '../../../../shared/ui/marca/iconos';
import { MiAprendizaje } from './mi-aprendizaje';

describe('Mi aprendizaje', () => {
  function montar(items: unknown[]) {
    const api = { listar: vi.fn().mockResolvedValue({ items }), detalle: vi.fn() };
    TestBed.configureTestingModule({
      imports: [MiAprendizaje],
      providers: [
        provideRouter([]),
        importProvidersFrom(LucideAngularModule.pick(ICONOS)),
        { provide: AprendizajeApi, useValue: api },
        { provide: AuthService, useValue: { usuario: () => ({ nombres: 'Ana' }) } },
      ],
    });
    return { fixture: TestBed.createComponent(MiAprendizaje), api };
  }

  it('muestra estado vacío basado en la respuesta real', async () => {
    const { fixture, api } = montar([]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.listar).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Todavía no te has inscrito');
    expect(fixture.nativeElement.textContent).not.toContain('Introducción a Python');
  });

  it('renderiza el porcentaje y la lección completada que devolvió el servidor', async () => {
    const { fixture } = montar([{
      curso: { id: 8, titulo: 'Seguridad de datos', subtitulo: null, portadaUrl: null,
        nivel: 'PRINCIPIANTE', categoria: { id: 3, nombre: 'Tecnología', icono: 'cpu' }, docente: 'Elena' },
      inscripcion: { id: 4, cursoId: 8, estado: 'ACTIVA', progresoPct: 50,
        ultimaLeccionId: 40, inscritoEn: '2026-10-22T00:00:00Z', completadoEn: null },
      totalLecciones: 2, leccionesCompletadas: 1,
    }]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Seguridad de datos');
    expect(texto).toContain('50% completado');
    expect(texto).toContain('1/2 lecciones');
  });

  it('D2: un curso suspendido conserva su avance, muestra el aviso y no se puede abrir', async () => {
    const { fixture, api } = montar([{
      curso: { id: 9, titulo: 'Redacción', subtitulo: null, portadaUrl: null,
        nivel: 'PRINCIPIANTE', categoria: { id: 3, nombre: 'Idiomas', icono: 'languages' }, docente: 'Luis' },
      inscripcion: { id: 5, cursoId: 9, estado: 'ACTIVA', progresoPct: 30,
        ultimaLeccionId: 41, inscritoEn: '2026-10-22T00:00:00Z', completadoEn: null },
      totalLecciones: 3, leccionesCompletadas: 1, suspendido: true,
    }]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const tarjeta = el.querySelector('article.curso.suspendido')!;
    expect(tarjeta.textContent).toContain('Curso suspendido.');
    expect(tarjeta.textContent).toContain('30% completado');
    expect(tarjeta.querySelector('button')).toBeNull();
    expect(tarjeta.querySelector('a')).toBeNull();
    expect(el.textContent).toContain('Tus cursos sin terminar están suspendidos temporalmente.');
    expect(el.textContent).not.toContain('Completaste todos los cursos');
    expect(api.detalle).not.toHaveBeenCalled();
  });

  it('filtra por categoría, docente y curso tanto por texto como por selección en combobox', async () => {
    const { fixture } = montar([
      {
        curso: { id: 8, titulo: 'Seguridad de datos', subtitulo: null, portadaUrl: null,
          nivel: 'PRINCIPIANTE', categoria: { id: 3, nombre: 'Tecnología', icono: 'cpu' }, docente: 'Elena Vargas' },
        inscripcion: { id: 4, cursoId: 8, estado: 'ACTIVA', progresoPct: 50,
          ultimaLeccionId: 40, inscritoEn: '2026-10-22T00:00:00Z', completadoEn: null },
        totalLecciones: 2, leccionesCompletadas: 1,
      },
      {
        curso: { id: 9, titulo: 'Redacción académica', subtitulo: null, portadaUrl: null,
          nivel: 'PRINCIPIANTE', categoria: { id: 4, nombre: 'Idiomas', icono: 'languages' }, docente: 'Luis Gómez' },
        inscripcion: { id: 5, cursoId: 9, estado: 'ACTIVA', progresoPct: 30,
          ultimaLeccionId: 41, inscritoEn: '2026-10-23T00:00:00Z', completadoEn: null },
        totalLecciones: 3, leccionesCompletadas: 1,
      },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const campoCat = el.querySelector<HTMLInputElement>('#categoria-aprendizaje')!;
    const campoDoc = el.querySelector<HTMLInputElement>('#docente-aprendizaje')!;
    const campoCurso = el.querySelector<HTMLInputElement>('#buscar-mis-cursos')!;
    expect(campoCat.getAttribute('role')).toBe('combobox');
    expect(campoDoc.getAttribute('role')).toBe('combobox');
    expect(campoCurso.getAttribute('role')).toBe('combobox');

    // Búsqueda por texto en categoría (sin tildes).
    campoCat.value = 'tecnologia';
    campoCat.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.querySelectorAll('article.curso').length).toBe(1);
    expect(el.textContent).toContain('Seguridad de datos');

    // Al escribir en el buscador de cursos, las opciones del desplegable respetan el contexto activo.
    campoCurso.dispatchEvent(new Event('focus'));
    campoCurso.value = 'seg';
    campoCurso.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const opcionesCurso = el.querySelectorAll('#buscar-mis-cursos-lista li[role="option"]');
    expect(opcionesCurso.length).toBe(1);
    expect(opcionesCurso[0]?.textContent).toContain('Seguridad de datos');

    // Quitar filtros restablece todos los comboboxes.
    const btnQuitar = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Quitar filtros'))!;
    btnQuitar.click();
    fixture.detectChanges();
    expect(el.querySelectorAll('article.curso').length).toBe(2);
    expect(campoCat.value).toBe('');

    // Selección por combobox en Docente tras escribir.
    campoDoc.dispatchEvent(new Event('focus'));
    campoDoc.value = 'luis';
    campoDoc.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const opcionLuis = Array.from(el.querySelectorAll<HTMLElement>('#docente-aprendizaje-lista li[role="option"]'))
      .find((li) => li.textContent?.includes('Luis Gómez'))!;
    opcionLuis.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(el.querySelectorAll('article.curso').length).toBe(1);
    expect(el.textContent).toContain('Redacción académica');
    expect(campoDoc.value).toBe('Luis Gómez');
  });
});
