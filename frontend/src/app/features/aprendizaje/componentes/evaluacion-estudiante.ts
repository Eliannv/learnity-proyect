import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { mensajeDeError } from '../../../core/http/error-api';
import {
  AprendizajeApi, type EvaluacionEstudiante as Evaluacion, type LetraOpcion, type ResultadoIntento,
} from '../aprendizaje.api';

/**
 * Evaluación de opción múltiple del estudiante. Intentos ilimitados: suspender nunca bloquea el
 * resto del curso, y aprobar marca la lección como completada en el servidor.
 */
@Component({
  selector: 'app-evaluacion-estudiante',
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './evaluacion-estudiante.html',
  styleUrl: './evaluacion-estudiante.scss',
})
export class EvaluacionEstudiante {
  readonly evaluacionId = input.required<number>();
  /** Ruta del contenido siguiente, para seguir aunque no se apruebe. */
  readonly siguienteRuta = input<string | null>(null);

  readonly calificada = output<ResultadoIntento>();

  private readonly api = inject(AprendizajeApi);
  private solicitud = 0;

  protected readonly indice = signal(0);
  protected readonly evaluacion = signal<Evaluacion | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly enviando = signal(false);
  protected readonly errorEnvio = signal('');
  protected readonly elegidas = signal<Record<number, LetraOpcion>>({});
  protected readonly resultado = signal<ResultadoIntento | null>(null);

  protected readonly respondidas = computed(() => Object.keys(this.elegidas()).length);
  protected readonly total = computed(() => this.evaluacion()?.preguntas.length ?? 0);
  protected readonly completa = computed(() => this.total() > 0 && this.respondidas() === this.total());

  protected readonly preguntaActual = computed(() => {
    const preguntas = this.evaluacion()?.preguntas;
    if (!preguntas || preguntas.length === 0) return null;
    const idx = Math.max(0, Math.min(this.indice(), preguntas.length - 1));
    return preguntas[idx] ?? null;
  });

  protected readonly esPrimera = computed(() => this.indice() === 0);
  protected readonly esUltima = computed(() => {
    const t = this.total();
    return t > 0 && this.indice() === t - 1;
  });

  protected readonly actualRespondida = computed(() => {
    const p = this.preguntaActual();
    return p ? !!this.elegidas()[p.id] : false;
  });

  constructor() {
    effect(() => {
      const id = this.evaluacionId();
      untracked(() => void this.cargar(id));
    });
  }

  protected reintentarCarga(): void {
    void this.cargar(this.evaluacionId());
  }

  protected siguiente(): void {
    if (!this.esUltima()) {
      this.indice.update((i) => i + 1);
    }
  }

  protected anterior(): void {
    if (!this.esPrimera()) {
      this.indice.update((i) => i - 1);
    }
  }

  private async cargar(id: number): Promise<void> {
    const actual = ++this.solicitud;
    this.cargando.set(true);
    this.error.set('');
    this.resultado.set(null);
    this.elegidas.set({});
    this.indice.set(0);
    try {
      const evaluacion = await this.api.evaluacion(id);
      if (actual === this.solicitud) this.evaluacion.set(evaluacion);
    } catch (error) {
      if (actual === this.solicitud) this.error.set(mensajeDeError(error, 'Cargar la evaluación'));
    } finally {
      if (actual === this.solicitud) this.cargando.set(false);
    }
  }

  protected elegir(preguntaId: number, letra: LetraOpcion): void {
    this.elegidas.update((actuales) => ({ ...actuales, [preguntaId]: letra }));
  }

  protected async enviar(): Promise<void> {
    const evaluacion = this.evaluacion();
    if (!evaluacion || !this.completa() || this.enviando()) return;
    this.enviando.set(true);
    this.errorEnvio.set('');
    try {
      const elegidas = this.elegidas();
      const resultado = await this.api.responderEvaluacion(evaluacion.id, {
        respuestas: evaluacion.preguntas.map((p) => ({ preguntaId: p.id, opcion: elegidas[p.id]! })),
      });
      this.resultado.set(resultado);
      this.evaluacion.set({ ...evaluacion, resumen: resultado.resumen });
      this.calificada.emit(resultado);
    } catch (error) {
      this.errorEnvio.set(mensajeDeError(error, 'Enviar tus respuestas'));
    } finally {
      this.enviando.set(false);
    }
  }

  protected repetir(): void {
    this.resultado.set(null);
    this.elegidas.set({});
    this.indice.set(0);
  }

  protected acierto(preguntaId: number): boolean | null {
    return this.resultado()?.respuestas.find((r) => r.preguntaId === preguntaId)?.correcta ?? null;
  }

  protected puntaje(valor: number | null): string {
    return valor === null ? '—' : `${Number.isInteger(valor) ? valor : valor.toFixed(2)} %`;
  }
}
