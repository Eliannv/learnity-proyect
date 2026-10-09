import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { PREGUNTA_EVALUACION } from '../../../data/datos-demo';

/**
 * Evaluación de un módulo (RF-19). Demostración con la última pregunta (5 de 5):
 * las 4 anteriores se cuentan como 2 correctas, así que acertar esta da 3 de 5 = 60 % (aprobado).
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

  protected readonly pregunta = PREGUNTA_EVALUACION;
  protected readonly elegida = signal<string | null>(null);
  protected readonly calificada = signal(false);

  private readonly correctasPrevias = 2;
  protected readonly aciertos = computed(() => this.correctasPrevias + (this.elegida() === this.pregunta.correcta ? 1 : 0));
  protected readonly aprobado = computed(() => this.aciertos() / 5 >= 0.6);

  protected elegir(letra: string) {
    if (!this.calificada()) this.elegida.set(letra);
  }

  protected calificar() {
    if (this.elegida()) this.calificada.set(true);
  }

  protected reintentar() {
    this.elegida.set(null);
    this.calificada.set(false);
  }

  protected estado(letra: string): 'correcta' | 'incorrecta' | 'elegida' | null {
    if (this.calificada()) {
      if (letra === this.pregunta.correcta && letra === this.elegida()) return 'correcta';
      if (letra === this.elegida()) return 'incorrecta';
      return null;
    }
    return letra === this.elegida() ? 'elegida' : null;
  }
}
