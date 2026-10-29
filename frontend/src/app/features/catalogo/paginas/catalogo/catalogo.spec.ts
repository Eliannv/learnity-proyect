import { importProvidersFrom } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ICONOS } from '../../../../shared/ui/marca/iconos';
import { CatalogoApi, type PaginaCursos } from '../../catalogo.api';
import { Catalogo } from './catalogo';

const vacia: PaginaCursos = { items: [], pagina: 1, limite: 9, total: 0, totalPaginas: 0 };

describe('Catálogo público', () => {
  it('muestra carga, lista vacía y error con reintento; envía los filtros', async () => {
    let resolver!: (pagina: PaginaCursos) => void;
    const primera = new Promise<PaginaCursos>((resolve) => {
      resolver = resolve;
    });
    const api = {
      categorias: vi.fn().mockResolvedValue([{ id: 1, nombre: 'Programación' }]),
      catalogo: vi
        .fn()
        .mockReturnValueOnce(primera)
        .mockRejectedValueOnce(new Error('red'))
        .mockResolvedValue(vacia),
      listar: vi.fn().mockResolvedValue(vacia),
    };
    TestBed.configureTestingModule({
      imports: [Catalogo],
      providers: [
        provideRouter([]),
        importProvidersFrom(LucideAngularModule.pick(ICONOS)),
        { provide: CatalogoApi, useValue: api },
      ],
    });
    const fixture = TestBed.createComponent(Catalogo);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cargando cursos');

    resolver(vacia);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay cursos con esos filtros');

    const casilla = fixture.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
    casilla.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.catalogo).toHaveBeenLastCalledWith(
      expect.objectContaining({ categorias: ['Programación'], pagina: 1 }),
    );
    expect(fixture.nativeElement.textContent).toContain('No se pudo cargar el catálogo');

    const reintentar = [...fixture.nativeElement.querySelectorAll('button')].find(
      (boton: HTMLButtonElement) => boton.textContent?.trim() === 'Reintentar',
    ) as HTMLButtonElement;
    reintentar.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay cursos con esos filtros');
  });
});
