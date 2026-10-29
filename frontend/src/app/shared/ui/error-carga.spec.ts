import { TestBed } from '@angular/core/testing';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import { ErrorCargaService, esErrorDeCarga } from '../../core/navegacion/error-carga';
import { ErrorCarga } from './error-carga';
import { ICONOS } from './iconos';

describe('error al cargar una sección', () => {
  it('reconoce los mensajes de los navegadores y no otros errores', () => {
    expect(esErrorDeCarga(new TypeError('Failed to fetch dynamically imported module: http://x/chunk-AB.js'))).toBe(true);
    expect(esErrorDeCarga(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(esErrorDeCarga(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(esErrorDeCarga(new Error('No tienes permiso'))).toBe(false);
    expect(esErrorDeCarga(undefined)).toBe(false);
  });

  it('avisa con role=alert y recarga la sección pedida solo cuando la persona lo decide', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) }],
    });
    const fixture = TestBed.createComponent(ErrorCarga);
    const recargar = vi.spyOn(fixture.componentInstance as unknown as { recargar(d: string): void }, 'recargar')
      .mockImplementation(() => undefined);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();

    const servicio = TestBed.inject(ErrorCargaService);
    servicio.fallo('/docente/resenas');
    fixture.detectChanges();
    const aviso = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(aviso.textContent).toContain('No se pudo cargar esta sección');
    expect(recargar).not.toHaveBeenCalled(); // nunca recarga por su cuenta

    (aviso.querySelector('.btn-primario') as HTMLButtonElement).click();
    expect(recargar).toHaveBeenCalledWith('/docente/resenas');

    (aviso.querySelector('.cerrar') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });
});
