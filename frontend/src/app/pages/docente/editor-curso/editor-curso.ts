import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { Router, RouterLink } from '@angular/router';

import { GestionCursosApi } from '../../../core/cursos/gestion-cursos.api';

import {
  CursoDetalle,
  NivelCurso,
  esEditable,
} from '../../../core/cursos/gestion-cursos.model';

import {
  CategoriaPublica,
  CursosPublicosService,
} from '../../publico/cursos-publicos.service';

import { EstadoCursoBadge } from '../../../shared/ui/estado-curso';
import { Peticion } from '../../../core/estado/peticion';
import { TemarioCurso } from '../../../shared/cursos/temario-curso';

const lineas = (texto: string) =>
  texto
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean);

@Component({
  selector: 'app-editor-curso',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    EstadoCursoBadge,
    TemarioCurso,
  ],
  templateUrl: './editor-curso.html',
  styleUrl: './editor-curso.scss',
})
export class EditorCurso {
  readonly id = input.required<string>();

  private readonly api = inject(GestionCursosApi);
  private readonly publicos = inject(CursosPublicosService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly carga = new Peticion();
  protected readonly p = new Peticion();

  protected readonly curso = signal<CursoDetalle | null>(null);
  protected readonly categorias = signal<CategoriaPublica[]>([]);

  protected readonly sucio = signal(false);
  protected readonly contenidoOcupado = signal(false);
  protected readonly formularioContenido = signal(false);

  protected readonly editable = computed(
    () =>
      !this.curso() ||
      esEditable(this.curso()!.estado),
  );

  protected readonly bloqueado = computed(
    () =>
      this.p.ocupada() ||
      this.contenidoOcupado() ||
      this.p.requiereRecarga(),
  );

  protected readonly form = this.fb.group({
    titulo: [
      '',
      [
        Validators.required,
        Validators.maxLength(150),
        Validators.pattern(/\S/),
      ],
    ],

    subtitulo: [
      '',
      Validators.maxLength(200),
    ],

    descripcion: [
      '',
      Validators.maxLength(10000),
    ],

    categoriaId: [
      0,
      [
        Validators.required,
        Validators.min(1),
      ],
    ],

    nivel: [
      'PRINCIPIANTE' as NivelCurso,
      Validators.required,
    ],

    portadaUrl: [
      '',
      Validators.maxLength(255),
    ],

    objetivos: [''],
    requisitos: [''],
  });

  private version = 0;

  constructor() {
    effect(() => {
      const id = this.id();

      untracked(() => {
        void this.cargar(id);
      });
    });
  }

  protected async cargar(
    id = this.id(),
  ): Promise<void> {
    const version = ++this.version;

    this.curso.set(null);
    this.categorias.set([]);

    this.carga.limpiar();
    this.p.limpiar();

    this.carga.ocupada.set(true);

    this.contenidoOcupado.set(false);
    this.formularioContenido.set(false);

    try {
      if (
        id !== 'nuevo' &&
        !/^[1-9]\d*$/.test(id)
      ) {
        throw new Error('ID inválido');
      }

      const [categorias, curso] = await Promise.all([
        this.publicos.categorias(),

        id === 'nuevo'
          ? Promise.resolve(null)
          : this.api.detalleDocente(Number(id)),
      ]);

      if (version !== this.version) return;

      this.categorias.set(categorias);
      this.aplicar(curso);
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

  protected aplicar(
    curso: CursoDetalle | null,
  ): void {
    this.curso.set(curso);

    this.form.reset({
      titulo: curso?.titulo ?? '',
      subtitulo: curso?.subtitulo ?? '',
      descripcion: curso?.descripcion ?? '',
      categoriaId: curso?.categoriaId ?? 0,
      nivel: curso?.nivel ?? 'PRINCIPIANTE',
      portadaUrl: curso?.portadaUrl ?? '',
      objetivos: curso?.objetivos.join('\n') ?? '',
      requisitos: curso?.requisitos.join('\n') ?? '',
    });

    this.sucio.set(false);

    if (curso && !esEditable(curso.estado)) {
      this.form.disable();
    } else {
      this.form.enable();
    }
  }

  protected errorCampo(
    nombre: keyof typeof this.form.controls,
  ): string {
    const control = this.form.controls[nombre];

    return (
      this.p.campo(nombre) ||
      (
        control.touched && control.invalid
          ? 'Revisa este campo y su longitud permitida.'
          : ''
      )
    );
  }

  protected async guardar(): Promise<void> {
    this.form.markAllAsTouched();

    if (
      this.form.invalid ||
      !this.editable() ||
      this.bloqueado() ||
      this.formularioContenido()
    ) {
      return;
    }

    const valor = this.form.getRawValue();

    const objetivos = lineas(valor.objetivos);
    const requisitos = lineas(valor.requisitos);

    const listasInvalidas = [
      objetivos,
      requisitos,
    ].some(
      (lista) =>
        lista.length > 10 ||
        lista.some((texto) => texto.length > 200),
    );

    if (listasInvalidas) {
      this.p.error.set(
        'Usa como máximo 10 objetivos y 10 requisitos, de hasta 200 caracteres cada uno.',
      );

      return;
    }

    const datos = {
      ...valor,
      titulo: valor.titulo.trim(),
      subtitulo: valor.subtitulo.trim(),
      descripcion: valor.descripcion.trim(),
      portadaUrl: valor.portadaUrl.trim(),
      objetivos,
      requisitos,
    };

    const ruta = this.id();

    await this.p.ejecutar(
      () =>
        this.api.guardarCurso(
          this.curso()?.id ?? null,
          datos,
        ),

      (curso) => {
        if (this.id() !== ruta) return;

        this.aplicar(curso);

        if (ruta === 'nuevo') {
          void this.router.navigate(
            ['/docente/cursos', curso.id, 'editar'],
            { replaceUrl: true },
          );
        }
      },

      'Curso guardado.',
    );
  }

  protected async enviar(): Promise<void> {
    const curso = this.curso();

    if (
      !curso ||
      !this.editable() ||
      this.bloqueado() ||
      this.sucio() ||
      this.formularioContenido() ||
      !curso.validacion.completo
    ) {
      return;
    }

    await this.p.ejecutar(
      () => this.api.enviarRevision(curso.id),

      (respuesta) => this.aplicar(respuesta),

      'Curso enviado a revisión.',
    );
  }
}