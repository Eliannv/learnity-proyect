import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import type { CuestionarioDocente, LeccionPrivada } from '../../../core/cursos/gestion-cursos.model';
import { EditorEvaluacion } from './editor-evaluacion';

const leccion = (preguntas: number): LeccionPrivada => ({
  id: 7, titulo: 'Repaso', orden: 2, tipo: 'EVALUACION', archivo: null,
  youtubeVideoId: null, preguntas, recursos: [],
});

describe('editor de evaluación del docente', () => {
  async function crear(preguntas: number, editable = true, cuestionario?: CuestionarioDocente) {
    const cargar = vi.fn().mockResolvedValue(cuestionario);
    const guardar = vi.fn().mockResolvedValue({ id: 1 });
    const f = TestBed.createComponent(EditorEvaluacion);
    f.componentRef.setInput('leccion', leccion(preguntas));
    f.componentRef.setInput('editable', editable);
    f.componentRef.setInput('cargarFn', cargar);
    f.componentRef.setInput('guardarFn', guardar);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    return { f, cargar, guardar, el: f.nativeElement as HTMLElement };
  }

  function escribir(campo: HTMLInputElement | HTMLTextAreaElement, valor: string) {
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  it('abre una evaluación nueva con 5 preguntas vacías y no guarda si faltan textos', async () => {
    const { f, guardar, el } = await crear(0);
    expect(el.querySelectorAll('fieldset.pregunta').length).toBe(5);
    (el.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    f.detectChanges();
    expect(guardar).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Escribe el enunciado.');
  });

  it('envía cada pregunta con sus cuatro opciones y la correcta elegida', async () => {
    const { f, guardar, el } = await crear(0);
    const actualizado = vi.fn();
    f.componentInstance.actualizado.subscribe(actualizado);
    el.querySelectorAll('textarea').forEach((t, i) => escribir(t, `Pregunta ${i + 1}`));
    el.querySelectorAll<HTMLInputElement>('input.control').forEach((o, i) => escribir(o, `Opción ${i % 4}`));
    (el.querySelector('input[aria-label="La opción C es la correcta en la pregunta 1"]') as HTMLInputElement).click();
    f.detectChanges();
    await f.whenStable();
    (el.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await f.whenStable();
    expect(guardar).toHaveBeenCalledTimes(1);
    const [leccionId, datos] = guardar.mock.calls[0]!;
    expect(leccionId).toBe(7);
    expect(datos.preguntas).toHaveLength(5);
    expect(datos.preguntas[0]).toEqual({
      enunciado: 'Pregunta 1', opciones: ['Opción 0', 'Opción 1', 'Opción 2', 'Opción 3'], correcta: 'C',
    });
    expect(datos.preguntas[1].correcta).toBe('A');
    expect(actualizado).toHaveBeenCalledWith({ id: 1 });
  });

  it('el administrador solo consulta las preguntas guardadas', async () => {
    const cuestionario: CuestionarioDocente = {
      leccionId: 7, porcentajeAprobacion: 60,
      preguntas: [{ id: 1, orden: 1, enunciado: '¿2 + 2?', correcta: 'B', opciones: [
        { letra: 'A', texto: '3' }, { letra: 'B', texto: '4' }, { letra: 'C', texto: '5' }, { letra: 'D', texto: '6' },
      ] }],
    };
    const { f, cargar, el } = await crear(5, false, cuestionario);
    expect(el.querySelector('form')).toBeNull();
    (el.querySelector('button') as HTMLButtonElement).click();
    await f.whenStable();
    f.detectChanges();
    expect(cargar).toHaveBeenCalledWith(7);
    expect((el.querySelector('fieldset.cuestionario-preguntas') as HTMLFieldSetElement).disabled).toBe(true);
    expect(el.querySelector('button[type="submit"]')).toBeNull();
    expect(el.textContent).toContain('Correcta');
  });
});
