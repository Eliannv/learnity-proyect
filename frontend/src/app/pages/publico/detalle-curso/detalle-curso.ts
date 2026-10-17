import { HttpErrorResponse } from '@angular/common/http';
import { I18nPluralPipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { CursosPublicosService, type DetalleCursoPublico, type TipoLeccionPublica } from '../cursos-publicos.service';
import { Avatar } from '../../../shared/ui/avatar';
import { PortadaCurso } from '../../../shared/ui/portada-curso';

@Component({
  selector: 'app-detalle-curso',
  imports: [NgTemplateOutlet, I18nPluralPipe, RouterLink, LucideAngularModule, Avatar, PortadaCurso],
  templateUrl: './detalle-curso.html',
  styleUrl: './detalle-curso.scss',
})
export class DetalleCurso {
  private readonly api = inject(CursosPublicosService);
  private solicitud = 0;

  readonly id = input.required<string>();

  protected readonly modulos = { '=1': '# módulo', other: '# módulos' };
  protected readonly lecciones = { '=1': '# lección', other: '# lecciones' };
  protected readonly curso = signal<DetalleCursoPublico | null>(null);
  protected readonly cargando = signal(true);
  protected readonly noEncontrado = signal(false);
  protected readonly error = signal(false);
  protected readonly reintento = signal(0);
  protected readonly abiertos = signal<number[]>([]);
  protected readonly tono = computed<1 | 2 | 3>(() => {
    const id = this.curso()?.categoria.id ?? 1;
    return id % 3 === 0 ? 3 : id % 3 === 1 ? 1 : 2;
  });

  constructor() {
    effect(() => {
      const id = this.id();
      this.reintento();
      void this.cargar(id);
    });
  }

  private async cargar(id: string) {
    const actual = ++this.solicitud;
    this.cargando.set(true);
    this.error.set(false);
    this.noEncontrado.set(false);
    this.curso.set(null);
    this.abiertos.set([]);
    try {
      const curso = await this.api.detalle(id);
      if (actual !== this.solicitud) return;
      if (!curso) {
        this.noEncontrado.set(true);
      } else {
        this.curso.set(curso);
        this.abiertos.set(curso.temario.length ? [curso.temario[0]!.id] : []);
      }
    } catch (error) {
      if (actual !== this.solicitud) return;
      if (error instanceof HttpErrorResponse && error.status === 404) this.noEncontrado.set(true);
      else this.error.set(true);
    } finally {
      if (actual === this.solicitud) this.cargando.set(false);
    }
  }

  protected reintentar() {
    this.reintento.update((n) => n + 1);
  }

  protected alternar(id: number) {
    this.abiertos.update((a) => a.includes(id) ? a.filter((n) => n !== id) : [...a, id]);
  }

  protected icono(tipo: TipoLeccionPublica): string {
    switch (tipo) {
      case 'VIDEO': return 'play';
      case 'DOCUMENTO': return 'file-text';
      case 'EVALUACION': return 'list-checks';
    }
  }

  protected nombreNivel(nivel: DetalleCursoPublico['nivel']): string {
    return nivel.charAt(0) + nivel.slice(1).toLowerCase();
  }

}
