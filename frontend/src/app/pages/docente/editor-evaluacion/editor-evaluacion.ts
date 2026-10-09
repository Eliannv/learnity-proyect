import { Component, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { PREGUNTAS_EDITOR } from '../../../data/datos-demo';

/** Editor de evaluación (RF-18): 5 a 10 preguntas, 4 opciones y una sola correcta. */
@Component({
  selector: 'app-editor-evaluacion',
  imports: [FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './editor-evaluacion.html',
  styleUrl: './editor-evaluacion.scss',
})
export class EditorEvaluacion {
  readonly id = input.required<string>();

  protected readonly guardadas = signal([...PREGUNTAS_EDITOR]);
  protected enunciado = '¿Qué tipo de dato es el valor 3.14 en Python?';
  protected opciones = ['int', 'float', 'str', 'bool'];
  protected readonly correcta = signal(1);
  protected readonly total = computed(() => this.guardadas().length + 1);

  protected agregarPregunta() {
    if (this.total() >= 10) return;
    this.guardadas.update((p) => [...p, this.enunciado.trim() || 'Pregunta sin título']);
    this.enunciado = '';
    this.opciones = ['', '', '', ''];
    this.correcta.set(0);
  }

  protected eliminar(i: number) {
    this.guardadas.update((p) => p.filter((_, idx) => idx !== i));
  }
}
