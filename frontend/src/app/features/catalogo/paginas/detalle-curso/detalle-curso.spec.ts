import { HttpErrorResponse } from '@angular/common/http';
import { importProvidersFrom } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ICONOS } from '../../../../shared/ui/marca/iconos';
import { CatalogoApi } from '../../catalogo.api';
import { AprendizajeApi } from '../../../aprendizaje/aprendizaje.api';
import { AuthService } from '../../../../core/auth/auth.service';
import { DetalleCurso } from './detalle-curso';

describe('Detalle público', () => {
  it('muestra curso no disponible ante 404 sin recurrir a datos demo', async () => {
    const api = { detalle: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 404 })) };
    TestBed.configureTestingModule({
      imports: [DetalleCurso],
      providers: [
        provideRouter([]),
        importProvidersFrom(LucideAngularModule.pick(ICONOS)),
        { provide: CatalogoApi, useValue: api },
        { provide: AprendizajeApi, useValue: { detalle: vi.fn() } },
        { provide: AuthService, useValue: { autenticado: () => false, tieneRol: () => false } },
      ],
    });
    const fixture = TestBed.createComponent(DetalleCurso);
    fixture.componentRef.setInput('id', '42');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cargando curso');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.detalle).toHaveBeenCalledWith('42');
    expect(fixture.nativeElement.textContent).toContain('Curso no disponible');
    expect(fixture.nativeElement.textContent).not.toContain('Introducción a Python');
  });
});
