import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import { ICONOS } from '../../../../../shared/ui/marca/iconos';
import { ToastService } from '../../../../../shared/ui/retroalimentacion/toast.service';
import { AdminCategoriasApi, type CategoriaAdmin } from '../../categorias.api';
import { Categorias } from './categorias';

const diseno: CategoriaAdmin = {
  id: 1, nombre: 'Diseño', descripcion: null, activa: true, icono: 'pen-tool', cursos: 3, cursosPublicados: 2,
};
const arte: CategoriaAdmin = { id: 2, nombre: 'Arte', descripcion: null, activa: true, icono: 'palette', cursos: 0, cursosPublicados: 0 };
const vieja: CategoriaAdmin = { id: 3, nombre: 'Vieja', descripcion: null, activa: false, icono: 'tags', cursos: 0, cursosPublicados: 0 };

function montar() {
  const api = {
    listar: vi.fn().mockResolvedValue([arte, diseno, vieja]),
    crear: vi.fn().mockImplementation((d) => Promise.resolve({ ...d, id: 9, activa: true, cursos: 0, cursosPublicados: 0 })),
    actualizar: vi.fn().mockImplementation((id, d) => Promise.resolve({ ...diseno, ...d, id })),
  };
  const toasts = { exito: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AdminCategoriasApi, useValue: api }, { provide: ToastService, useValue: toasts },
      { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) },
    ],
  });
  const fixture = TestBed.createComponent(Categorias);
  fixture.detectChanges();
  return { fixture, api, toasts, el: fixture.nativeElement as HTMLElement };
}

const boton = (el: ParentNode, texto: string) =>
  [...el.querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith(texto)) as HTMLButtonElement;

async function estable(fixture: ReturnType<typeof montar>['fixture']) {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('categorías del administrador', () => {
  it('la tabla muestra el ícono que devuelve la API', async () => {
    const { fixture, el } = montar();
    await estable(fixture);
    const iconos = [...el.querySelectorAll('tbody .icono lucide-icon')].map((i) => i.getAttribute('ng-reflect-name') ?? i.innerHTML);
    expect(iconos.length).toBe(3);
    expect(el.querySelector('tbody')?.innerHTML).toContain('lucide-palette');
  });

  it('crea la categoría con el ícono elegido en el selector (radios con nombre accesible)', async () => {
    const { fixture, api, el } = montar();
    await estable(fixture);
    boton(el, 'Nueva categoría').click();
    await estable(fixture);
    const nombre = el.querySelector<HTMLInputElement>('input[name="nombre"]')!;
    nombre.value = 'Música';
    nombre.dispatchEvent(new Event('input'));
    const radio = el.querySelector<HTMLInputElement>('input[name="icono"][aria-label="Música"]')!;
    expect(el.querySelectorAll('input[name="icono"]').length).toBe(22);
    radio.click();
    await estable(fixture);
    boton(el.querySelector('app-modal')!, 'Crear categoría').click();
    await vi.waitFor(() => expect(api.crear).toHaveBeenCalledWith({ nombre: 'Música', descripcion: null, icono: 'music' }));
  });

  it('al desactivar una categoría con cursos avisa cuántos tiene y los mueve a otra activa en la misma petición', async () => {
    const { fixture, api, toasts, el } = montar();
    await estable(fixture);
    boton(el, 'Desactivar').click(); // la primera fila con «Desactivar» es «Arte» (orden alfabético): sin cursos
    await estable(fixture);
    expect(el.querySelector('app-modal')?.textContent).not.toContain('Tiene');
    boton(el.querySelector('app-modal')!, 'Cancelar').click();
    await estable(fixture);

    el.querySelector<HTMLButtonElement>('button[aria-label="Desactivar Diseño"]')!.click();
    await estable(fixture);
    const modal = el.querySelector('app-modal')!;
    expect(modal.textContent).toContain('3 cursos');
    expect(modal.textContent).toContain('2 publicados');

    modal.querySelectorAll<HTMLInputElement>('input[name="mover"]')[1]!.click();
    await estable(fixture);
    boton(modal, 'Mover cursos y desactivar').click();
    await estable(fixture);
    expect(api.actualizar).not.toHaveBeenCalled();
    expect(modal.textContent).toContain('Elige la categoría a la que se moverán los cursos.');

    const select = modal.querySelector<HTMLSelectElement>('select[name="destino"]')!;
    const opciones = [...select.options].map((o) => o.textContent?.trim());
    expect(opciones).toEqual(['Elige una categoría', 'Arte']); // ni ella misma ni las inactivas
    select.selectedIndex = 1;
    select.dispatchEvent(new Event('change'));
    await estable(fixture);
    boton(modal, 'Mover cursos y desactivar').click();
    await vi.waitFor(() => expect(api.actualizar).toHaveBeenCalledWith(1,
      { nombre: 'Diseño', descripcion: null, icono: 'pen-tool', activa: false, reasignarA: 2 }));
    await vi.waitFor(() => expect(toasts.exito).toHaveBeenCalledWith('«Diseño» desactivada. Sus 3 cursos pasaron a «Arte».'));
    expect(api.listar).toHaveBeenCalledTimes(2); // recarga: cambiaron los conteos del destino
  });
});
