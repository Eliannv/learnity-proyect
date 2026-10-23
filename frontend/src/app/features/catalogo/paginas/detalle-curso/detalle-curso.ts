import { HttpErrorResponse } from '@angular/common/http';
import { I18nPluralPipe, NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { CatalogoApi, type DetalleCursoPublico, type TipoLeccionPublica } from '../../catalogo.api';
import { leccionParaContinuar } from '../../aprendizaje-navegacion';
import { Avatar } from '../../../../shared/ui/avatar';
import { PortadaCurso } from '../../../../shared/ui/portada-curso';
import { AuthService } from '../../../../core/auth/auth.service';
import { convertirErrorApi } from '../../../../core/http/error-api';
import { AprendizajeApi, type DetalleAprendizaje } from '../../../aprendizaje/aprendizaje.api';
import { ReproductorYoutube } from '../../../contenido/componentes/reproductor-youtube';
import { esIdYoutube } from '../../../contenido/youtube';

@Component({
  selector: 'app-detalle-curso',
  imports: [NgTemplateOutlet, I18nPluralPipe, RouterLink, LucideAngularModule, Avatar, PortadaCurso, ReproductorYoutube],
  templateUrl: './detalle-curso.html',
  styleUrl: './detalle-curso.scss',
})
export class DetalleCurso {
  private readonly api = inject(CatalogoApi);
  private readonly aprendizaje = inject(AprendizajeApi);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private solicitud = 0;
  private solicitudInscripcion = 0;
  private solicitudMuestra = 0;
  private destruido = false;

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
  protected readonly confirmada = signal(false);
  protected readonly comprobada = signal(false);
  protected readonly consultandoInscripcion = signal(false);
  protected readonly procesando = signal(false);
  protected readonly errorInscripcion = signal('');
  protected readonly exitoInscripcion = signal('');
  protected readonly muestra = signal<{ leccionId: number; titulo: string; videoId: string } | null>(null);
  protected readonly cargandoMuestra = signal<number | null>(null);
  protected readonly errorMuestra = signal('');
  protected readonly puedeInscribirse = computed(() => this.auth.tieneRol('ESTUDIANTE'));
  protected readonly rutaContinuar = computed(() => {
    const detalle = this.inscripcion();
    if (!detalle) return ['/mi-aprendizaje'];
    const leccion = leccionParaContinuar(detalle);
    return leccion ? ['/aprender', detalle.curso.id, leccion.id] : ['/mi-aprendizaje'];
  });
  protected readonly tono = computed<1 | 2 | 3>(() => {
    const id = this.curso()?.categoria.id ?? 1;
    return id % 3 === 0 ? 3 : id % 3 === 1 ? 1 : 2;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destruido = true;
      this.solicitud++;
      this.solicitudInscripcion++;
      this.solicitudMuestra++;
    });
    effect(() => {
      const id = this.id();
      this.reintento();
      untracked(() => void this.cargar(id));
    });
    effect(() => {
      const curso = this.curso();
      const usuario = this.auth.usuario();
      const autenticado = this.auth.autenticado();
      const permitido = this.puedeInscribirse();
      untracked(() => {
        const actual = ++this.solicitudInscripcion;
        this.inscripcion.set(null);
        this.confirmada.set(false);
        this.comprobada.set(false);
        this.consultandoInscripcion.set(false);
        this.procesando.set(false);
        this.errorInscripcion.set('');
        this.exitoInscripcion.set('');
        if (curso && autenticado && permitido && usuario) {
          void this.consultarInscripcion(curso.id, actual, usuario.idUsuario);
        }
      });
    });
  }

  private async cargar(id: string): Promise<void> {
    const actual = ++this.solicitud;
    this.solicitudMuestra++;
    this.cargando.set(true);
    this.error.set(false);
    this.noEncontrado.set(false);
    this.curso.set(null);
    this.abiertos.set([]);
    this.muestra.set(null);
    this.cargandoMuestra.set(null);
    this.errorMuestra.set('');
    try {
      const curso = await this.api.detalle(id);
      if (actual !== this.solicitud) return;
      if (!curso) this.noEncontrado.set(true);
      else {
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

  private vigente(cursoId: number, version: number, usuarioId: number): boolean {
    return !this.destruido && version === this.solicitudInscripcion
      && this.curso()?.id === cursoId && this.auth.autenticado()
      && this.auth.usuario()?.idUsuario === usuarioId && this.puedeInscribirse();
  }

  private explicar(error: unknown, accion: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        this.auth.sesionExpirada();
        return 'Tu sesión caducó. Inicia sesión para continuar.';
      }
      if (error.status === 403) return 'Tu cuenta no tiene permiso para realizar esta acción.';
      if (error.status === 0) return 'No pudimos conectar. Comprueba tu conexión y vuelve a intentarlo.';
      if (error.status === 429) return 'Espera unos minutos antes de volver a intentarlo.';
      if (error.status === 404) return 'Este servicio o contenido no está disponible en este momento.';
    }
    return accion + ' no se pudo completar. Inténtalo de nuevo.';
  }

  private async consultarInscripcion(id: number, actual: number, usuarioId: number): Promise<void> {
    this.consultandoInscripcion.set(true);
    this.errorInscripcion.set('');
    try {
      const detalle = await this.aprendizaje.detalle(id);
      if (!this.vigente(id, actual, usuarioId)) return;
      if (detalle.curso.id !== id) throw new Error('Respuesta de otro curso');
      this.inscripcion.set(detalle);
      this.confirmada.set(true);
      this.comprobada.set(true);
    } catch (error) {
      if (!this.vigente(id, actual, usuarioId)) return;
      // 404 de la operación: estudiante no inscrito. Un backend antiguo puede devolver
      // otro 404 para una ruta inexistente: ese caso no confirma la comprobación.
      if (error instanceof HttpErrorResponse && error.status === 404
        && !/^La ruta /i.test(convertirErrorApi(error)?.mensaje ?? '')) {
        this.comprobada.set(true);
      } else this.errorInscripcion.set(this.explicar(error, 'Comprobar la inscripción'));
    } finally {
      if (this.vigente(id, actual, usuarioId)) this.consultandoInscripcion.set(false);
    }
  }

  protected async accionInscripcion(): Promise<void> {
    const curso = this.curso();
    if (!curso || this.procesando() || this.consultandoInscripcion()) return;
    if (!this.auth.autenticado()) {
      await this.router.navigate(['/login'], { queryParams: { volver: '/cursos/' + curso.id } });
      return;
    }
    if (!this.puedeInscribirse()) {
      this.errorInscripcion.set('Necesitas el rol de estudiante para inscribirte.');
      return;
    }
    const usuarioId = this.auth.usuario()!.idUsuario;
    const actual = this.solicitudInscripcion;
    if (!this.comprobada()) {
      await this.consultarInscripcion(curso.id, actual, usuarioId);
      return;
    }
    if (this.confirmada()) return;
    this.procesando.set(true);
    this.errorInscripcion.set('');
    this.exitoInscripcion.set('');
    try {
      const respuesta = await this.aprendizaje.inscribir(curso.id);
      if (!this.vigente(curso.id, actual, usuarioId)) return;
      if (respuesta.cursoId !== curso.id) throw new Error('Respuesta de otro curso');
      // El POST es idempotente: 200 y 201 confirman la misma inscripción.
      this.confirmada.set(true);
      this.exitoInscripcion.set('Tu inscripción está confirmada.');
      await this.consultarInscripcion(curso.id, actual, usuarioId);
    } catch (error) {
      if (!this.vigente(curso.id, actual, usuarioId)) return;
      this.comprobada.set(false);
      this.errorInscripcion.set(this.explicar(error, 'Confirmar la inscripción'));
    } finally {
      if (this.vigente(curso.id, actual, usuarioId)) this.procesando.set(false);
    }
  }

  protected comprobarDeNuevo(): void {
    const curso = this.curso();
    const usuario = this.auth.usuario();
    if (curso && usuario && !this.consultandoInscripcion() && !this.procesando()) {
      void this.consultarInscripcion(curso.id, this.solicitudInscripcion, usuario.idUsuario);
    }
  }

  protected reintentar(): void { this.reintento.update((n) => n + 1); }

  protected async alternarMuestra(leccion: { id: number; titulo: string }): Promise<void> {
    const actual = ++this.solicitudMuestra;
    if (this.muestra()?.leccionId === leccion.id) {
      this.muestra.set(null);
      this.cargandoMuestra.set(null);
      return;
    }
    this.errorMuestra.set('');
    this.muestra.set(null);
    this.cargandoMuestra.set(leccion.id);
    const cursoActual = this.solicitud;
    try {
      const respuesta = await this.api.videoVistaPrevia(leccion.id);
      if (actual !== this.solicitudMuestra || cursoActual !== this.solicitud || this.destruido) return;
      if (respuesta.leccionId !== leccion.id || !esIdYoutube(respuesta.youtubeVideoId)) {
        throw new Error('Vista previa inválida');
      }
      this.muestra.set({ leccionId: leccion.id, titulo: leccion.titulo, videoId: respuesta.youtubeVideoId });
    } catch (error) {
      if (actual !== this.solicitudMuestra || cursoActual !== this.solicitud || this.destruido) return;
      this.errorMuestra.set(error instanceof HttpErrorResponse && error.status === 404
        ? 'Esta lección no tiene una muestra pública.'
        : 'No pudimos cargar la muestra. Comprueba tu conexión y vuelve a intentarlo.');
    } finally {
      if (actual === this.solicitudMuestra && cursoActual === this.solicitud) this.cargandoMuestra.set(null);
    }
  }

  protected contieneMuestra(lecciones: readonly { id: number }[], id: number): boolean {
    return lecciones.some((leccion) => leccion.id === id);
  }

  protected alternar(id: number): void {
    if (this.abiertos().includes(id)) {
      const lecciones = this.curso()?.temario.find((modulo) => modulo.id === id)?.lecciones ?? [];
      if (lecciones.some((leccion) => leccion.id === this.muestra()?.leccionId
        || leccion.id === this.cargandoMuestra())) {
        this.solicitudMuestra++;
        this.muestra.set(null);
        this.cargandoMuestra.set(null);
      }
    }
    this.abiertos.update((ids) => ids.includes(id) ? ids.filter((n) => n !== id) : [...ids, id]);
  }

  protected icono(tipo: TipoLeccionPublica): string {
    return tipo === 'VIDEO' ? 'play' : tipo === 'DOCUMENTO' ? 'file-text' : 'list-checks';
  }

  protected nombreNivel(nivel: DetalleCursoPublico['nivel']): string {
    return nivel.charAt(0) + nivel.slice(1).toLowerCase();
  }
}
