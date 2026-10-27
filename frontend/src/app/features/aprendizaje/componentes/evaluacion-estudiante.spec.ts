import { importProvidersFrom } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { describe, expect, it, vi } from 'vitest';
import { ICONOS } from '../../../shared/ui/iconos';
import { AprendizajeApi, type EvaluacionEstudiante as Evaluacion, type ResultadoIntento } from '../aprendizaje.api';
import { EvaluacionEstudiante } from './evaluacion-estudiante';

const opciones = [
  { letra: 'A' as const, texto: 'Uno' }, { letra: 'B' as const, texto: 'Dos' },
  { letra: 'C' as const, texto: 'Tres' }, { letra: 'D' as const, texto: 'Cuatro' },
];
const evaluacion: Evaluacion = {
  id: 3, leccionId: 9, titulo: 'Repaso final', porcentajeAprobacion: 60,
  preguntas: [
    { id: 11, orden: 1, enunciado: 'Primera', opciones },
    { id: 12, orden: 2, enunciado: 'Segunda', opciones },
  ],
  resumen: { intentos: 0, mejorPuntaje: null, ultimoPuntaje: null, aprobada: false },
};
const suspenso: ResultadoIntento = {
  intento: { id: 1, puntaje: 50, aprobado: false, correctas: 1, total: 2, realizadoEn: '2026-10-24T10:00:00Z' },
  respuestas: [{ preguntaId: 11, opcion: 'B', correcta: true }, { preguntaId: 12, opcion: 'A', correcta: false }],
  resumen: { intentos: 1, mejorPuntaje: 50, ultimoPuntaje: 50, aprobada: false },
  progresoPct: 0, estado: 'ACTIVA',
};

describe('evaluación del estudiante', () => {
  async function crear() {
    const api = { evaluacion: vi.fn().mockResolvedValue(evaluacion), responderEvaluacion: vi.fn().mockResolvedValue(suspenso) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        importProvidersFrom(LucideAngularModule.pick(ICONOS)),
        { provide: AprendizajeApi, useValue: api },
      ],
    });
    const f = TestBed.createComponent(EvaluacionEstudiante);
    f.componentRef.setInput('evaluacionId', 3);
    f.componentRef.setInput('siguienteRuta', '/aprender/1/10');
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    return { f, api, el: f.nativeElement as HTMLElement };
  }

  it('no muestra respuestas correctas y exige responder todas antes de enviar', async () => {
    const { f, api, el } = await crear();
    expect(api.evaluacion).toHaveBeenCalledWith(3);
    expect(el.textContent).not.toContain('Correcta');
    const siguiente = el.querySelector('button.btn-siguiente') as HTMLButtonElement;
    expect(siguiente.disabled).toBe(true);
    (el.querySelector('input[name="pregunta-11"][value="B"]') as HTMLInputElement).click();
    f.detectChanges();
    expect(siguiente.disabled).toBe(false);
    expect(el.textContent).toContain('Pregunta 1 de 2');
  });

  it('envía solo las opciones elegidas y, si suspende, deja seguir con el curso', async () => {
    const { f, api, el } = await crear();
    const calificada = vi.fn();
    f.componentInstance.calificada.subscribe(calificada);
    (el.querySelector('input[name="pregunta-11"][value="B"]') as HTMLInputElement).click();
    f.detectChanges();
    (el.querySelector('button.btn-siguiente') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el.textContent).toContain('Pregunta 2 de 2');
    const enviar = el.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(enviar.disabled).toBe(true);
    (el.querySelector('input[name="pregunta-12"][value="A"]') as HTMLInputElement).click();
    f.detectChanges();
    expect(enviar.disabled).toBe(false);
    enviar.click();
    await f.whenStable();
    f.detectChanges();
    expect(api.responderEvaluacion).toHaveBeenCalledWith(3, {
      respuestas: [{ preguntaId: 11, opcion: 'B' }, { preguntaId: 12, opcion: 'A' }],
    });
    expect(calificada).toHaveBeenCalledWith(suspenso);
    expect(el.textContent).toContain('1 de 2 respuestas correctas');
    expect(el.querySelector('a[href="/aprender/1/10"]')?.textContent).toContain('Continuar con el curso');
    const repetir = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Intentar de nuevo'))!;
    repetir.click();
    f.detectChanges();
    expect(el.textContent).toContain('Pregunta 1 de 2');
  });
});
