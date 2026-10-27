import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

interface PreguntaDemo {
  id: number;
  enunciado: string;
  opciones: { letra: string; texto: string }[];
  correcta: string;
}

const PREGUNTAS_DEMO: PreguntaDemo[] = [
  {
    id: 1,
    enunciado: '¿Cuál es la extensión de archivo estándar para los programas escritos en Python?',
    opciones: [
      { letra: 'A', texto: '.py' },
      { letra: 'B', texto: '.pt' },
      { letra: 'C', texto: '.p' },
      { letra: 'D', texto: '.python' },
    ],
    correcta: 'A',
  },
  {
    id: 2,
    enunciado: '¿Cómo se define una variable en Python?',
    opciones: [
      { letra: 'A', texto: 'var x = 10' },
      { letra: 'B', texto: 'x := 10' },
      { letra: 'C', texto: 'x = 10' },
      { letra: 'D', texto: 'int x = 10' },
    ],
    correcta: 'C',
  },
  {
    id: 3,
    enunciado: '¿Cuál de los siguientes es un tipo de dato numérico en Python?',
    opciones: [
      { letra: 'A', texto: 'string' },
      { letra: 'B', texto: 'float' },
      { letra: 'C', texto: 'boolean' },
      { letra: 'D', texto: 'list' },
    ],
    correcta: 'B',
  },
  {
    id: 4,
    enunciado: '¿Qué operador se utiliza para calcular el residuo de una división entera en Python?',
    opciones: [
      { letra: 'A', texto: '/' },
      { letra: 'B', texto: '//' },
      { letra: 'C', texto: '%' },
      { letra: 'D', texto: '#' },
    ],
    correcta: 'C',
  },
  {
    id: 5,
    enunciado: '¿Qué función muestra un mensaje en pantalla en Python?',
    opciones: [
      { letra: 'A', texto: 'input()' },
      { letra: 'B', texto: 'print()' },
      { letra: 'C', texto: 'len()' },
      { letra: 'D', texto: 'type()' },
    ],
    correcta: 'B',
  },
];

/**
 * Evaluación de un módulo. Muestra las preguntas una a una paso a paso
 * y muestra el resultado solo al enviar las respuestas.
 */
@Component({
  selector: 'app-evaluacion',
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './evaluacion.html',
  styleUrl: './evaluacion.scss',
})
export class Evaluacion {
  readonly cursoId = input.required<string>();
  readonly evaluacionId = input.required<string>();

  protected readonly preguntas = PREGUNTAS_DEMO;
  protected readonly indice = signal(0);
  protected readonly elegidas = signal<Record<number, string>>({});
  protected readonly calificada = signal(false);

  protected readonly total = computed(() => this.preguntas.length);
  protected readonly preguntaActual = computed(() => this.preguntas[this.indice()]);
  protected readonly esPrimera = computed(() => this.indice() === 0);
  protected readonly esUltima = computed(() => this.indice() === this.total() - 1);
  protected readonly actualRespondida = computed(() => !!this.elegidas()[this.preguntaActual().id]);
  protected readonly completa = computed(() => Object.keys(this.elegidas()).length === this.total());

  protected readonly aciertos = computed(() =>
    this.preguntas.filter((p) => this.elegidas()[p.id] === p.correcta).length,
  );
  protected readonly aprobado = computed(() => this.aciertos() / this.total() >= 0.6);

  protected elegir(letra: string): void {
    if (!this.calificada()) {
      const pid = this.preguntaActual().id;
      this.elegidas.update((map) => ({ ...map, [pid]: letra }));
    }
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

  protected calificar(): void {
    if (this.completa()) {
      this.calificada.set(true);
    }
  }

  protected reintentar(): void {
    this.elegidas.set({});
    this.calificada.set(false);
    this.indice.set(0);
  }

  protected estado(preguntaId: number, letra: string): 'correcta' | 'incorrecta' | 'elegida' | null {
    const elegida = this.elegidas()[preguntaId];
    if (this.calificada()) {
      const p = this.preguntas.find((q) => q.id === preguntaId);
      if (p && letra === p.correcta && letra === elegida) return 'correcta';
      if (letra === elegida) return 'incorrecta';
      return null;
    }
    return letra === elegida ? 'elegida' : null;
  }
}
