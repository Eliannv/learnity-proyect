import { importProvidersFrom } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { AprendizajeApi } from '../../../features/aprendizaje/aprendizaje.api';
import { ICONOS } from '../../../shared/ui/marca/iconos';
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
        nivel: 'PRINCIPIANTE', categoria: { id: 3, nombre: 'Tecnología' }, docente: 'Elena' },
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
});
