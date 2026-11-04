import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import { describe, expect, it, vi } from 'vitest';
import type { CursoDetalle } from '../../../../core/api/contrato';
import type { RecortadorFoto } from '../../../../shared/ui/recortador/recortador-foto';
import { ICONOS } from '../../../../shared/ui/marca/iconos';
import { DocenteCursosApi } from '../cursos.api';
import { FormularioFicha } from './formulario-ficha';

const URL_SUBIDA = '/api/fotos/00000000-0000-4000-8000-000000000000.jpg';

describe('ficha del curso · portada subida', () => {
  function crear(curso: CursoDetalle | null) {
    const subirPortada = vi.fn().mockResolvedValue(URL_SUBIDA);
    TestBed.configureTestingModule({
      providers: [
        { provide: DocenteCursosApi, useValue: { subirPortada } },
        { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) },
      ],
    });
    const form = new FormGroup({
      titulo: new FormControl('Curso'), subtitulo: new FormControl(''), descripcion: new FormControl(''),
      categoriaId: new FormControl(1), nivel: new FormControl('PRINCIPIANTE'), portadaUrl: new FormControl(''),
      objetivos: new FormControl(''), requisitos: new FormControl(''),
    });
    const f = TestBed.createComponent(FormularioFicha);
    f.componentRef.setInput('form', form);
    f.componentRef.setInput('curso', curso);
    f.componentRef.setInput('editable', true);
    const cambio = vi.fn();
    const portadaSubida = vi.fn();
    f.componentInstance.cambio.subscribe(cambio);
    f.componentInstance.portadaSubida.subscribe(portadaSubida);
    f.detectChanges();
    return { f, form, cambio, portadaSubida, subirPortada, el: f.nativeElement as HTMLElement };
  }

  const recortador = { recortar: async () => new File(['x'], 'portada-curso.jpg', { type: 'image/jpeg' }) } as RecortadorFoto;
  const guardarRecorte = (f: ReturnType<typeof crear>['f']) =>
    (f.componentInstance as unknown as { guardarRecortePortada(r: RecortadorFoto): Promise<void> }).guardarRecortePortada(recortador);

  it('en un curso ya creado avisa al editor para guardarla, sin dejar la ficha como cambio pendiente', async () => {
    const { f, form, cambio, portadaSubida } = crear({ id: 5 } as CursoDetalle);
    await guardarRecorte(f);
    expect(form.value.portadaUrl).toBe(URL_SUBIDA);
    expect(portadaSubida).toHaveBeenCalledTimes(1);
    expect(cambio).not.toHaveBeenCalled();
  });

  it('en un curso nuevo la deja en el formulario como cambio pendiente', async () => {
    const { f, form, cambio, portadaSubida } = crear(null);
    await guardarRecorte(f);
    expect(form.value.portadaUrl).toBe(URL_SUBIDA);
    expect(cambio).toHaveBeenCalledTimes(1);
    expect(portadaSubida).not.toHaveBeenCalled();
  });

  it('elegir un archivo no marca la ficha como modificada (se puede cancelar el recorte)', () => {
    const { cambio, el } = crear({ id: 5 } as CursoDetalle);
    const entrada = el.querySelector<HTMLInputElement>('input[type="file"]')!;
    entrada.dispatchEvent(new Event('change', { bubbles: true }));
    expect(cambio).not.toHaveBeenCalled();
  });
});
