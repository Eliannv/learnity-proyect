import { Component, computed, input, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { CURSOS, LeccionTemario, RECURSOS_LECCION, TEMARIO_PYTHON, iconoLeccion } from '../../../data/datos-demo';
import { BarraProgreso } from '../../../shared/ui/barra-progreso';

const DESCRIPCIONES: Record<string, string> = {
  'tipos-de-datos': 'En esta lección escribirás tu primer programa en Python y aprenderás a mostrar mensajes en pantalla con print().',
  'presentacion-del-tema':
    'Documento con los tipos de datos básicos de Python: enteros, decimales, textos y booleanos. Puedes leerlo aquí o descargarlo junto con la presentación de la clase.',
  'guia-instalacion': 'Guía paso a paso para instalar Python en Windows, macOS o Linux y comprobar que funciona.',
};

/** Lección de video o documento (PDF / PowerPoint), con el temario del curso a la derecha. */
@Component({
  selector: 'app-leccion',
  imports: [RouterLink, LucideAngularModule, BarraProgreso],
  templateUrl: './leccion.html',
  styleUrl: './leccion.scss',
})
export class Leccion {
  /** Parámetros de /aprender/:cursoId/:leccionId */
  readonly cursoId = input.required<string>();
  readonly leccionId = input.required<string>();

  protected readonly temario = TEMARIO_PYTHON;
  protected readonly recursos = RECURSOS_LECCION;
  protected readonly icono = iconoLeccion;

  private readonly todas = TEMARIO_PYTHON.flatMap((m) => m.lecciones.map((l) => ({ ...l, modulo: m.numero })));

  protected readonly curso = computed(() => CURSOS.find((c) => c.id === this.cursoId()) ?? CURSOS[0]!);
  private readonly indice = computed(() => Math.max(0, this.todas.findIndex((l) => l.id === this.leccionId())));
  protected readonly leccion = computed(() => this.todas[this.indice()]!);
  protected readonly esVideo = computed(() => this.leccion().tipo === 'VIDEO');
  protected readonly modulo = computed(() => TEMARIO_PYTHON.find((m) => m.numero === this.leccion().modulo)!);
  protected readonly posicion = computed(
    () => `Módulo ${this.modulo().numero} · lección ${this.modulo().lecciones.findIndex((l) => l.id === this.leccion().id) + 1} de ${this.modulo().lecciones.length}`,
  );
  protected readonly descripcion = computed(
    () => DESCRIPCIONES[this.leccion().id] ?? 'Revisa el contenido de la lección y márcala como vista para avanzar en el curso.',
  );
  protected readonly anterior = computed(() => this.todas[this.indice() - 1] ?? null);
  protected readonly siguiente = computed(() => this.todas[this.indice() + 1] ?? null);

  protected readonly abiertos = linkedSignal<number[]>(() => [this.leccion().modulo]);
  protected readonly vista = linkedSignal(() => !!this.leccion().completada);
  protected readonly reproduciendo = signal(false);
  protected readonly zoom = signal(100);

  protected ruta(l: LeccionTemario): string {
    return l.tipo === 'EVALUACION' ? `/aprender/${this.cursoId()}/evaluacion/${l.id}` : `/aprender/${this.cursoId()}/${l.id}`;
  }

  protected alternar(numero: number) {
    this.abiertos.update((a) => (a.includes(numero) ? a.filter((n) => n !== numero) : [...a, numero]));
  }

  protected cambiarZoom(paso: number) {
    this.zoom.update((z) => Math.min(150, Math.max(70, z + paso)));
  }
}
