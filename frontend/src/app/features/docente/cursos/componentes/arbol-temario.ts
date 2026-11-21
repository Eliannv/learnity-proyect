import { HttpEvent } from '@angular/common/http';
import {
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Observable } from 'rxjs';
import { InfoAyuda } from '../../../../shared/ui/retroalimentacion/info-ayuda';
import {
  type CuestionarioDocente,
  type CursoDetalle,
  type DatosCuestionario,
  type DatosLeccion,
  type DatosModulo,
  type LeccionPrivada,
  type ModuloPrivado,
  siguienteOrden,
} from '../../../../core/cursos/gestion-cursos.model';
import { Peticion } from '../../../../core/estado/peticion';
import { PdfLeccion } from '../../../contenido/componentes/pdf-leccion';
import { ReproductorYoutube } from '../../../contenido/componentes/reproductor-youtube';
import { esIdYoutube, validarEnlaceYoutube } from '../../../contenido/youtube';
import { GruposApi } from '../../estudiantes/grupos.api';
import type { GrupoCurso } from '../../../../core/api/contrato';
import { ContenidoApi } from '../../../contenido/contenido.api';
import { ReproductorPrivado } from '../../../contenido/componentes/reproductor-privado';
import { mensajeDeError } from '../../../../core/http/error-api';
import { CampoYoutube } from './campo-youtube';
import { EditorEvaluacion } from './editor-evaluacion';
import { RecursosLeccion } from './recursos-leccion';
import { ConfirmacionService } from '../../../../shared/ui/retroalimentacion/confirmacion.service';

type TipoContenido = LeccionPrivada['tipo'];

const NOMBRE_TIPO: Record<TipoContenido, string> = {
  VIDEO: 'vídeo',
  DOCUMENTO: 'documento PDF',
  EVALUACION: 'evaluación',
};

@Component({
  selector: 'app-arbol-temario',
  imports: [ReproductorPrivado, NgTemplateOutlet, FormsModule, LucideAngularModule, InfoAyuda, PdfLeccion, CampoYoutube, ReproductorYoutube, EditorEvaluacion, RecursosLeccion],
  templateUrl: './arbol-temario.html',
  styleUrl: './arbol-temario.scss',
})
export class ArbolTemario {
  readonly curso = input.required<CursoDetalle>();
  readonly editable = input(false);
  readonly bloqueado = input(false);
  /** El botón para volver al paso de la ficha solo tiene sentido en el editor del docente. */
  readonly mostrarVolver = input(true);
  readonly guardarModuloFn =
    input<
      (
        cursoId: number,
        id: number | null,
        datos: DatosModulo,
      ) => Promise<CursoDetalle>
    >();
  readonly guardarLeccionFn =
    input<
      (
        moduloId: number,
        id: number | null,
        datos: DatosLeccion,
      ) => Promise<CursoDetalle>
    >();
  readonly eliminarContenidoFn =
    input<
      (tipo: 'modulos' | 'lecciones', id: number) => Promise<CursoDetalle>
    >();
  readonly subirArchivoFn =
    input.required<
      (leccionId: number, archivo: File) => Observable<HttpEvent<CursoDetalle>>
    >();
  readonly descargarArchivoFn =
    input.required<(archivoId: number) => Promise<Blob>>();
  readonly cargarCuestionarioFn =
    input.required<(leccionId: number) => Promise<CuestionarioDocente>>();
  readonly guardarCuestionarioFn =
    input<(leccionId: number, datos: DatosCuestionario) => Promise<CursoDetalle>>();

  protected nombreTipo(tipo: TipoContenido): string {
    return NOMBRE_TIPO[tipo];
  }

  readonly actualizado = output<CursoDetalle>();
  readonly ocupado = output<boolean>();
  readonly formularioAbierto = output<boolean>();
  readonly recargar = output<void>();
  readonly continuar = output<void>();
  readonly volver = output<void>();

  protected readonly p = new Peticion();
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly gruposApi = inject(GruposApi);
  private readonly contenidoApi = inject(ContenidoApi);
  protected readonly grupos = signal<GrupoCurso[]>([]);
  protected readonly avisoGrupos = signal('');
  protected readonly porcentajeCarga = signal<number | null>(null);
  private readonly trabajo = signal(false);

  protected deshabilitado(): boolean {
    return this.bloqueado() || this.trabajo() || this.p.requiereRecarga();
  }

  protected modulo: {
    id: number | null;
    titulo: string;
    orden: number;
  } | null = null;

  protected leccion: {
    id: number | null;
    moduloId: number;
    titulo: string;
    orden: number;
    tipo: TipoContenido;
    youtubeUrl: string;
    origen: 'YOUTUBE' | 'ARCHIVO';
    grabacionId: string | null;
    grupoId: number | null;
    archivo: File | null;
    operacion: string;
  } | null = null;

  protected hayFormulario(): boolean {
    return this.modulo !== null || this.leccion !== null;
  }

  protected abrirModulo(m?: ModuloPrivado): void {
    this.p.limpiar();
    this.leccion = null;
    this.modulo = {
      id: m?.id ?? null,
      titulo: m?.titulo ?? '',
      orden: m?.orden ?? siguienteOrden(this.curso().modulos, 10),
    };
    this.formularioAbierto.emit(true);
  }

  protected abrirLeccion(m: ModuloPrivado, tipo: TipoContenido, l?: LeccionPrivada): void {
    this.p.limpiar();
    this.modulo = null;
    this.leccion = {
      id: l?.id ?? null,
      moduloId: m.id,
      titulo: l?.titulo ?? '',
      orden: l?.orden ?? siguienteOrden(m.lecciones, 12),
      tipo: l?.tipo ?? tipo,
      youtubeUrl: this.urlVideo(l),
      origen: l?.grabacionId ? 'ARCHIVO' : 'YOUTUBE',
      grabacionId: l?.grabacionId ?? null,
      grupoId: l?.grupoId ?? null,
      archivo: null,
      operacion: '',
    };
    if (tipo === 'VIDEO') void this.cargarGrupos();
    this.formularioAbierto.emit(true);
  }

  protected async cargarGrupos() {
    const formulario = this.leccion;
    this.grupos.set([]);
    this.avisoGrupos.set('');
    try {
      const d = await this.gruposApi.listar(this.curso().id);
      if (this.leccion === formulario) this.grupos.set(d.grupos);
    } catch (e) {
      if (this.leccion === formulario) this.avisoGrupos.set(mensajeDeError(e, 'Cargar los grupos'));
    }
  }
  protected seleccionarArchivo(e: Event) {
    if (!this.leccion) return;
    this.leccion.archivo = (e.target as HTMLInputElement).files?.[0] ?? null;
    this.leccion.operacion = crypto.randomUUID();
  }

  protected cerrarFormulario(): void {
    this.modulo = null;
    this.leccion = null;
    this.formularioAbierto.emit(false);
  }

  protected cambiarOcupado(valor: boolean): void {
    this.trabajo.set(valor);
    this.ocupado.emit(valor);
  }

  protected async guardarModulo(): Promise<void> {
    const m = this.modulo;
    const fn = this.guardarModuloFn();
    if (!m || !fn) return;

    if (!m.titulo.trim()) {
      this.p.campos.set({ titulo: 'Escribe el título del módulo.' });
      return;
    }

    if (!Number.isInteger(m.orden) || m.orden < 1 || m.orden > 10) {
      this.p.campos.set({ orden: 'Usa un número entero entre 1 y 10.' });
      return;
    }

    if (!this.editable() || this.deshabilitado()) return;
    await this.mutar(() => fn(this.curso().id, m.id, {
      titulo: m.titulo.trim(), orden: m.orden,
    }), 'Módulo guardado.');
  }

  protected async guardarLeccion(): Promise<void> {
    const l = this.leccion;
    const fn = this.guardarLeccionFn();
    if (!l || !fn) return;

    if (!l.titulo.trim()) {
      this.p.campos.set({ titulo: 'Escribe el título del contenido.' });
      return;
    }

    if (!Number.isInteger(l.orden) || l.orden < 1 || l.orden > 12) {
      this.p.campos.set({ orden: 'Usa un número entero entre 1 y 12.' });
      return;
    }

    if (l.tipo === 'VIDEO' && l.origen === 'ARCHIVO') {
      if (!l.archivo && !l.grabacionId) {
        this.p.campos.set({ grabacionId: 'Selecciona un MP4.' });
        return;
      }
      if (l.archivo && (l.archivo.size === 0 || l.archivo.size > 100 * 1024 * 1024)) {
        this.p.campos.set({ grabacionId: 'Elige un MP4 de hasta 100 MiB.' });
        return;
      }
      await this.mutar(async () => {
        try {
          if (l.archivo) {
            this.porcentajeCarga.set(0);
            l.grabacionId = await this.contenidoApi.subirGrabacion(
              this.curso().id,
              l.archivo,
              l.operacion,
              (p) => this.porcentajeCarga.set(p),
            );
          }
          return await fn(l.moduloId, l.id, {
            titulo: l.titulo.trim(),
            orden: l.orden,
            tipo: 'VIDEO',
            grabacionId: l.grabacionId!,
            grupoId: l.grupoId,
          });
        } finally {
          this.porcentajeCarga.set(null);
        }
      }, 'Grabación guardada.');
      return;
    }
    let datos: DatosLeccion;
    if (l.tipo === 'VIDEO') {
      const enlace = validarEnlaceYoutube(l.youtubeUrl);
      if (!enlace.valido) {
        this.p.campos.set({ youtubeUrl: enlace.mensaje });
        return;
      }
      datos = {
        titulo: l.titulo.trim(),
        orden: l.orden,
        tipo: 'VIDEO',
        youtubeUrl: enlace.enlaceCanonico,
        grupoId: l.grupoId,
      };
    } else {
      datos = { titulo: l.titulo.trim(), orden: l.orden, tipo: l.tipo };
    }
    await this.mutar(
      () => fn(l.moduloId, l.id, datos),
      {
        VIDEO: 'Vídeo guardado.',
        DOCUMENTO: 'Documento guardado.',
        EVALUACION: 'Evaluación guardada. Escribe ahora sus preguntas.',
      }[l.tipo],
    );
  }

  protected async eliminar(
    tipo: 'modulos' | 'lecciones',
    id: number,
  ): Promise<void> {
    const fn = this.eliminarContenidoFn();
    if (!fn) return;

    const confirmado = await this.confirmacion.confirmar(tipo === 'modulos'
      ? {
          titulo: '¿Eliminar este módulo?',
          mensaje: 'Se eliminarán también todas sus lecciones, evaluaciones y archivos. No se puede deshacer.',
          accion: 'Eliminar módulo', peligro: true, icono: 'trash-2',
        }
      : {
          titulo: '¿Eliminar este contenido?',
          mensaje: 'Se eliminarán también su PDF, sus recursos y, si es una evaluación, sus preguntas. No se puede deshacer.',
          accion: 'Eliminar contenido', peligro: true, icono: 'trash-2',
        });
    if (!confirmado) return;

    await this.mutar(() => fn(tipo, id));
  }

  private async mutar(tarea: () => Promise<CursoDetalle>, mensaje = 'Contenido guardado.'): Promise<void> {
    if (!this.editable() || this.deshabilitado()) return;

    this.cambiarOcupado(true);
    await this.p.ejecutar(
      tarea,
      (curso) => {
        this.cerrarFormulario();
        this.actualizado.emit(curso);
      },
      mensaje,
    );
    this.cambiarOcupado(false);
  }

  protected cuantos(m: ModuloPrivado, tipo: TipoContenido): number {
    return m.lecciones.filter((item) => item.tipo === tipo).length;
  }

  private urlVideo(l?: LeccionPrivada): string {
    const id = l?.youtubeVideoId;
    return id && esIdYoutube(id) ? `https://www.youtube.com/watch?v=${id}` : '';
  }
}
