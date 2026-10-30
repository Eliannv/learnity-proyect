import { Esqueleto } from '../../../../shared/ui/retroalimentacion/esqueleto';
import { HttpErrorResponse } from '@angular/common/http';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import {
  CatalogoApi,
  type DetalleCursoPublico,
  type TipoLeccionPublica,
} from '../../catalogo.api';
import { Avatar } from '../../../../shared/ui/marca/avatar';
import { PortadaCurso } from '../../../../shared/ui/cursos/portada-curso';
import { AuthService } from '../../../../core/auth/auth.service';
import { mensajeDeError } from '../../../../core/http/error-api';
import { AprendizajeApi, type DetalleAprendizaje } from '../../../aprendizaje/aprendizaje.api';
import { Estrellas } from '../../../../shared/ui/datos/estrellas';
import { ResenasCurso } from '../../componentes/resenas-curso';
import { duracionCurso, leccionesTexto, NIVEL_TEXTO } from '../../../../shared/ui/cursos/formato-curso';
import type { PaginaResenas } from '../../resenas.api';

type ModuloTemario = DetalleCursoPublico['temario'][number];
type LeccionTemario = ModuloTemario['lecciones'][number];

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

@Component({
  selector: 'app-detalle-curso',
  imports: [Esqueleto,
    NgTemplateOutlet, DecimalPipe, RouterLink, LucideAngularModule, Avatar, PortadaCurso,
    Estrellas, ResenasCurso,
  ],
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
  protected readonly puedeInscribirse = computed(() => this.auth.tieneRol('ESTUDIANTE'));
  protected readonly todosAbiertos = computed(() => {
    const temario = this.curso()?.temario ?? [];
    return temario.length > 0 && temario.every((m) => this.abiertos().includes(m.id));
  });

  /** «Este curso incluye»: solo lo que de verdad tiene el temario publicado. */
  protected readonly incluye = computed(() => {
    const c = this.curso();
    if (!c) return [];
    const lecciones = c.temario.flatMap((m) => m.lecciones);
    const cuenta = (tipo: TipoLeccionPublica) => lecciones.filter((l) => l.tipo === tipo).length;
    const videos = cuenta('VIDEO');
    const documentos = cuenta('DOCUMENTO');
    const evaluaciones = cuenta('EVALUACION');
    const duracion = duracionCurso(c.minutos);
    return [
      { icono: 'book-open', texto: `${plural(c.modulos, 'módulo', 'módulos')} y ${leccionesTexto(c.lecciones)}` },
      ...(duracion ? [{ icono: 'clock', texto: `${duracion} de vídeo` }] : []),
      ...(videos ? [{ icono: 'video', texto: plural(videos, 'vídeo', 'vídeos') }] : []),
      ...(documentos ? [{ icono: 'file-text', texto: plural(documentos, 'documento PDF descargable', 'documentos PDF descargables') }] : []),
      ...(evaluaciones ? [{ icono: 'list-checks', texto: plural(evaluaciones, 'evaluación', 'evaluaciones') }] : []),
      { icono: 'check', texto: 'Acceso a tu ritmo, sin fechas límite' },
    ];
  });

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

  protected alternar(id: number) {
    this.abiertos.update((a) => (a.includes(id) ? a.filter((n) => n !== id) : [...a, id]));
  }

  protected alternarTodos() {
    this.abiertos.set(this.todosAbiertos() ? [] : (this.curso()?.temario ?? []).map((m) => m.id));
  }

  /** «Intermedio · 3 módulos · 12 lecciones · 1 h 20 min»; sin «0 min». */
  protected metaCabecera(c: DetalleCursoPublico): string {
    return [NIVEL_TEXTO[c.nivel] ?? c.nivel, plural(c.modulos, 'módulo', 'módulos'), leccionesTexto(c.lecciones), duracionCurso(c.minutos)]
      .filter(Boolean)
      .join(' · ');
  }

  protected resumenTemario(c: DetalleCursoPublico): string {
    return [plural(c.temario.length, 'sección', 'secciones'), leccionesTexto(c.lecciones), duracionCurso(c.minutos)]
      .filter(Boolean)
      .join(' · ');
  }

  protected conteoModulo(m: ModuloTemario): string {
    const minutos = m.lecciones.reduce((total, l) => total + l.minutos, 0);
    return [leccionesTexto(m.lecciones.length), duracionCurso(minutos)].filter(Boolean).join(' · ');
  }

  /** A la derecha de cada lección: el tipo y, si es un vídeo con duración, sus minutos. */
  protected tipoLeccion(l: LeccionTemario): string {
    if (l.tipo === 'DOCUMENTO') return 'PDF';
    if (l.tipo === 'EVALUACION') return 'Evaluación';
    return duracionCurso(l.minutos) || 'Vídeo';
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

  /** Las reseñas del estudiante cambian el promedio de la cabecera sin recargar el curso. */
  protected actualizarCalificacion(resumen: PaginaResenas['resumen']): void {
    this.curso.update((c) => c && { ...c, calificacion: { promedio: resumen.promedio, total: resumen.total } });
  }

  protected irAResenas(evento: Event): void {
    evento.preventDefault();
    document.getElementById('resenas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
