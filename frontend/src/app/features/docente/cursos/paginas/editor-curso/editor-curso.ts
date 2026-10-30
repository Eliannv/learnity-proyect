import { Esqueleto } from '../../../../../shared/ui/retroalimentacion/esqueleto';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import {
  type CursoDetalle,
  type DatosCuestionario,
  type DatosCurso,
  type DatosLeccion,
  type DatosModulo,
  type NivelCurso,
  esEditable,
} from '../../../../../core/cursos/gestion-cursos.model';
import { Peticion } from '../../../../../core/estado/peticion';
import { EstadoCursoBadge } from '../../../../../shared/ui/cursos/estado-curso';
import {
  CatalogoApi,
  type CategoriaPublica,
} from '../../../../catalogo/catalogo.api';
import { ContenidoApi } from '../../../../contenido/contenido.api';
import { ArbolTemario } from '../../componentes/arbol-temario';
import { FormularioFicha } from '../../componentes/formulario-ficha';
import { PanelPublicacion } from '../../componentes/panel-publicacion';
import { DocenteCursosApi } from '../../cursos.api';
import { ConfirmacionService } from '../../../../../shared/ui/retroalimentacion/confirmacion.service';

@Component({
  selector: 'app-editor-curso',
  imports: [Esqueleto,
    RouterLink,
    LucideAngularModule,
    EstadoCursoBadge,
    FormularioFicha,
    ArbolTemario,
    PanelPublicacion,
  ],
  templateUrl: './editor-curso.html',
  styleUrl: './editor-curso.scss',
})
export class EditorCurso {
  readonly id = input.required<string>();

  protected readonly carga = new Peticion();
  protected readonly p = new Peticion();

  protected readonly curso = signal<CursoDetalle | null>(null);
  protected readonly categorias = signal<CategoriaPublica[]>([]);
  protected readonly sucio = signal(false);
  protected readonly contenidoOcupado = signal(false);
  protected readonly formularioContenido = signal(false);
  protected readonly pasoActual = signal<1 | 2>(1);

  protected readonly editable = computed(() => {
    const c = this.curso();
    return c ? esEditable(c.estado) : this.id() === 'nuevo';
  });

  protected readonly bloqueado = computed(
    () =>
      this.p.ocupada() ||
      this.contenidoOcupado() ||
      this.p.requiereRecarga(),
  );

  protected readonly paso1Completo = computed(() => {
    const c = this.curso();
    return c ? this.form.valid && !this.sucio() : false;
  });

  protected readonly paso2Completo = computed(() => {
    const c = this.curso();
    if (!c || c.modulos.length === 0) return false;
    return c.modulos.every((m) => m.lecciones.length > 0 &&
      m.lecciones.every((l) => l.tipo === 'VIDEO' ? Boolean(l.youtubeVideoId) : Boolean(l.archivo)));
  });

  protected cambiarPaso(paso: 1 | 2): void {
    if (this.id() === 'nuevo' && paso !== 1) {
      return;
    }
    this.pasoActual.set(paso);
  }

  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly api = inject(DocenteCursosApi);
  private readonly contenidoApi = inject(ContenidoApi);
  private readonly catalogoApi = inject(CatalogoApi);
  private readonly router = inject(Router);
  private readonly confirmacion = inject(ConfirmacionService);
  private version = 0;

  protected readonly guardarModuloFn = (
    cursoId: number,
    id: number | null,
    datos: DatosModulo,
  ) => this.api.guardarModulo(cursoId, id, datos);

  protected readonly guardarLeccionFn = (
    moduloId: number,
    id: number | null,
    datos: DatosLeccion,
  ) => this.api.guardarLeccion(moduloId, id, datos);

  protected readonly eliminarContenidoFn = (
    tipo: 'modulos' | 'lecciones',
    id: number,
  ) => this.api.eliminar(tipo, id);

  protected readonly subirArchivoFn = (leccionId: number, archivo: File) =>
    this.contenidoApi.subirPdf(leccionId, archivo);

  protected readonly descargarArchivoFn = (archivoId: number) =>
    this.contenidoApi.descargarPdf(archivoId);

  protected readonly cargarCuestionarioFn = (leccionId: number) =>
    this.api.cuestionario(leccionId);

  protected readonly guardarCuestionarioFn = (leccionId: number, datos: DatosCuestionario) =>
    this.api.guardarCuestionario(leccionId, datos);

  protected readonly form = this.fb.group({
    titulo: ['', [Validators.required, Validators.maxLength(150)]],
    subtitulo: ['', [Validators.maxLength(200)]],
    descripcion: ['', [Validators.maxLength(10_000)]],
    categoriaId: [0, [Validators.required, Validators.min(1)]],
    nivel: ['PRINCIPIANTE' as NivelCurso, [Validators.required]],
    portadaUrl: ['', [Validators.maxLength(255)]],
    objetivos: [''],
    requisitos: [''],
  });

  constructor() {
    effect(() => {
      this.id();
      untracked(() => {
        void this.cargar();
      });
    });
  }

  protected async cargar(): Promise<void> {
    const version = ++this.version;
    const id = this.id();

    this.curso.set(null);
    this.carga.limpiar();
    this.p.limpiar();
    this.sucio.set(false);
    this.contenidoOcupado.set(false);
    this.formularioContenido.set(false);
    this.carga.ocupada.set(true);

    try {
      const idNum = id === 'nuevo' ? null : Number(id);
      if (idNum !== null && (!Number.isInteger(idNum) || idNum <= 0)) {
        this.carga.error.set('El identificador del curso no es válido.');
        return;
      }

      const [categorias, detalle] = await Promise.all([
        this.catalogoApi.categorias(),
        idNum === null
          ? Promise.resolve(null)
          : this.api.detalleDocente(idNum),
      ]);

      if (version !== this.version) return;

      this.categorias.set(categorias);

      if (detalle) {
        this.aplicar(detalle);
      } else {
        this.form.reset({
          titulo: '',
          subtitulo: '',
          descripcion: '',
          categoriaId: categorias[0]?.id ?? 0,
          nivel: 'PRINCIPIANTE',
          portadaUrl: '',
          objetivos: '',
          requisitos: '',
        });
      }
    } catch (error) {
      if (version === this.version) {
        this.carga.fallar(error);
      }
    } finally {
      if (version === this.version) {
        this.carga.ocupada.set(false);
      }
    }
  }

  protected aplicar(c: CursoDetalle): void {
    this.curso.set(c);
    this.sucio.set(false);
    this.form.reset({
      titulo: c.titulo,
      subtitulo: c.subtitulo,
      descripcion: c.descripcion,
      categoriaId: c.categoriaId,
      nivel: c.nivel,
      portadaUrl: c.portadaUrl,
      objetivos: c.objetivos.join('\n'),
      requisitos: c.requisitos.join('\n'),
    });
  }

  protected async guardar(): Promise<void> {
    if (!this.editable() || this.bloqueado() || this.formularioContenido()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const datos: DatosCurso = {
      titulo: v.titulo.trim(),
      subtitulo: v.subtitulo.trim(),
      descripcion: v.descripcion.trim(),
      categoriaId: Number(v.categoriaId),
      nivel: v.nivel,
      portadaUrl: v.portadaUrl.trim(),
      objetivos: this.lineas(v.objetivos),
      requisitos: this.lineas(v.requisitos),
    };
    const idActual = this.curso()?.id ?? null;

    await this.p.ejecutar(
      () => this.api.guardarCurso(idActual, datos),
      (curso) => {
        this.aplicar(curso);
        if (idActual === null) {
          void this.router.navigate(['/docente/cursos', curso.id, 'editar'], {
            replaceUrl: true,
          });
        }
      },
      'Datos guardados.',
    );
  }

  protected async enviar(): Promise<void> {
    const c = this.curso();
    if (
      !c ||
      !this.editable() ||
      this.bloqueado() ||
      this.sucio() ||
      this.formularioContenido()
    ) {
      return;
    }

    const confirmado = await this.confirmacion.confirmar({
      titulo: '¿Enviar el curso a revisión?',
      mensaje: 'Un administrador lo revisará antes de publicarlo. Mientras tanto no podrás modificarlo.',
      accion: 'Enviar a revisión', icono: 'shield-check',
    });
    if (!confirmado) return;

    await this.p.ejecutar(
      () => this.api.enviarRevision(c.id),
      (curso) => this.aplicar(curso),
      'Curso enviado a revisión.',
    );
  }

  private lineas(texto: string): string[] {
    return texto
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  }
}
