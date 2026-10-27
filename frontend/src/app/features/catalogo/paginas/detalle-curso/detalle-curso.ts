import { HttpErrorResponse } from '@angular/common/http';
import { I18nPluralPipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import {
  CatalogoApi,
  type DetalleCursoPublico,
  type TipoLeccionPublica,
} from '../../catalogo.api';
import { Avatar } from '../../../../shared/ui/avatar';
import { PortadaCurso } from '../../../../shared/ui/portada-curso';
import { AuthService } from '../../../../core/auth/auth.service';
import { mensajeDeError } from '../../../../core/http/error-api';
import { AprendizajeApi, type DetalleAprendizaje } from '../../../aprendizaje/aprendizaje.api';
import { ReproductorYoutube } from '../../../contenido/componentes/reproductor-youtube';

@Component({
  selector: 'app-detalle-curso',
  imports: [NgTemplateOutlet, I18nPluralPipe, RouterLink, LucideAngularModule, Avatar, PortadaCurso, ReproductorYoutube],
  templateUrl: './detalle-curso.html',
  styleUrl: './detalle-curso.scss',
})
export class DetalleCurso {
  private readonly api = inject(CatalogoApi);
  private readonly aprendizaje = inject(AprendizajeApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
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
  protected readonly inscripcion = signal<DetalleAprendizaje | null>(null);
  protected readonly consultandoInscripcion = signal(false);
  protected readonly procesando = signal(false);
  protected readonly errorInscripcion = signal('');
  protected readonly muestra = signal<{ leccionId: number; titulo: string; videoId: string } | null>(null);
  protected readonly cargandoMuestra = signal<number | null>(null);
  protected readonly errorMuestra = signal('');
  protected readonly puedeInscribirse = computed(() => this.auth.tieneRol('ESTUDIANTE'));
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
    this.inscripcion.set(null);
    this.errorInscripcion.set('');
    this.muestra.set(null);
    this.errorMuestra.set('');
    try {
      const curso = await this.api.detalle(id);
      if (actual !== this.solicitud) return;
      if (!curso) {
        this.noEncontrado.set(true);
      } else {
        this.curso.set(curso);
        this.abiertos.set(curso.temario.length ? [curso.temario[0]!.id] : []);
        if (this.puedeInscribirse()) await this.consultarInscripcion(curso.id, actual);
      }
    } catch (error) {
      if (actual !== this.solicitud) return;
      if (error instanceof HttpErrorResponse && error.status === 404) this.noEncontrado.set(true);
      else this.error.set(true);
    } finally {
      if (actual === this.solicitud) this.cargando.set(false);
    }
  }

  private async consultarInscripcion(id: number, actual: number): Promise<void> {
    this.consultandoInscripcion.set(true);
    try {
      const detalle = await this.aprendizaje.detalle(id);
      if (actual === this.solicitud) this.inscripcion.set(detalle);
    } catch (error) {
      if (actual !== this.solicitud) return;
      if (!(error instanceof HttpErrorResponse && error.status === 404)) {
        this.errorInscripcion.set(mensajeDeError(error, 'Comprobar la inscripción'));
      }
    } finally {
      if (actual === this.solicitud) this.consultandoInscripcion.set(false);
    }
  }

  protected async accionInscripcion(): Promise<void> {
    const curso = this.curso();
    if (!curso || this.procesando()) return;
    if (!this.auth.autenticado()) {
      await this.router.navigate(['/login'], { queryParams: { volver: `/cursos/${curso.id}` } });
      return;
    }
    if (!this.puedeInscribirse()) {
      this.errorInscripcion.set('Necesitas una cuenta de estudiante para inscribirte.');
      return;
    }
    this.procesando.set(true);
    this.errorInscripcion.set('');
    try {
      if (!this.inscripcion()) await this.aprendizaje.inscribir(curso.id);
      const detalle = await this.aprendizaje.detalle(curso.id);
      this.inscripcion.set(detalle);
      const primera = detalle.modulos.flatMap((modulo) => modulo.lecciones)[0];
      const leccionId = detalle.inscripcion.ultimaLeccionId ?? primera?.id;
      await this.router.navigate(leccionId ? ['/aprender', curso.id, leccionId] : ['/mi-aprendizaje']);
    } catch (error) {
      this.errorInscripcion.set(mensajeDeError(error, 'La inscripción'));
    } finally {
      this.procesando.set(false);
    }
  }

  protected reintentar() {
    this.reintento.update((n) => n + 1);
  }

  protected async alternarMuestra(leccion: { id: number; titulo: string }): Promise<void> {
    if (this.muestra()?.leccionId === leccion.id) {
      this.muestra.set(null);
      return;
    }
    this.errorMuestra.set('');
    this.muestra.set(null);
    this.cargandoMuestra.set(leccion.id);
    const actual = this.solicitud;
    try {
      const respuesta = await this.api.videoVistaPrevia(leccion.id);
      if (actual === this.solicitud) {
        this.muestra.set({ leccionId: leccion.id, titulo: leccion.titulo,
          videoId: respuesta.youtubeVideoId });
      }
    } catch (error) {
      if (actual === this.solicitud) {
        this.errorMuestra.set(error instanceof HttpErrorResponse && error.status === 404
          ? 'Esta lección no tiene una muestra pública.'
          : mensajeDeError(error, 'Cargar la muestra'));
      }
    } finally {
      if (actual === this.solicitud) this.cargandoMuestra.set(null);
    }
  }

  protected contieneMuestra(lecciones: readonly { id: number }[], id: number): boolean {
    return lecciones.some((leccion) => leccion.id === id);
  }

  protected alternar(id: number) {
    this.abiertos.update((a) => (a.includes(id) ? a.filter((n) => n !== id) : [...a, id]));
  }

  protected icono(tipo: TipoLeccionPublica): string {
    switch (tipo) {
      case 'VIDEO':
        return 'play';
      case 'DOCUMENTO':
        return 'file-text';
      case 'EVALUACION':
        return 'list-checks';
    }
  }

  protected nombreNivel(nivel: DetalleCursoPublico['nivel']): string {
    return nivel.charAt(0) + nivel.slice(1).toLowerCase();
  }
}
