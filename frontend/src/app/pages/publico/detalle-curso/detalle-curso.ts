import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { CURSOS, DETALLE_PYTHON, TEMARIO_PYTHON, iconoLeccion } from '../../../data/datos-demo';
import { Avatar } from '../../../shared/ui/avatar';
import { Modal } from '../../../shared/ui/modal';

@Component({
  selector: 'app-detalle-curso',
  imports: [NgTemplateOutlet, RouterLink, LucideAngularModule, Avatar, Modal],
  templateUrl: './detalle-curso.html',
  styleUrl: './detalle-curso.scss',
})
export class DetalleCurso {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** :id de la ruta /cursos/:id */
  readonly id = input.required<string>();

  // Demostración: todos los cursos muestran el temario de "Introducción a Python".
  protected readonly curso = computed(() => CURSOS.find((c) => c.id === this.id()) ?? CURSOS[0]!);
  protected readonly temario = TEMARIO_PYTHON;
  protected readonly detalle = DETALLE_PYTHON;
  protected readonly icono = iconoLeccion;
  protected readonly abiertos = signal<number[]>([1]);
  protected readonly confirmar = signal(false);

  protected alternar(numero: number) {
    this.abiertos.update((a) => (a.includes(numero) ? a.filter((n) => n !== numero) : [...a, numero]));
  }

  /** Visitante → login (vuelve aquí después). Con sesión → confirmar inscripción. */
  protected inscribirme() {
    if (!this.auth.autenticado()) {
      void this.router.navigate(['/login'], { queryParams: { volver: `/cursos/${this.id()}` } });
      return;
    }
    this.confirmar.set(true);
  }

  protected confirmarInscripcion() {
    this.confirmar.set(false);
    void this.router.navigateByUrl('/mi-aprendizaje');
  }
}
