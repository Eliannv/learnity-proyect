import { Component, OnInit, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  CuestionarioDocente,
  CursoDetalle,
  DatosCuestionario,
  LeccionPrivada,
  LetraOpcion,
} from '../../../core/cursos/gestion-cursos.model';
import { Peticion } from '../../../core/estado/peticion';

export const MIN_PREGUNTAS = 5;
export const MAX_PREGUNTAS = 10;
const LETRAS: readonly LetraOpcion[] = ['A', 'B', 'C', 'D'];

interface PreguntaEditable {
  clave: number;
  enunciado: string;
  opciones: string[];
  correcta: LetraOpcion;
}

/** Preguntas de una lección EVALUACION: de 5 a 10, cuatro opciones y una correcta. */
@Component({
  selector: 'app-editor-evaluacion',
  imports: [FormsModule],
  templateUrl: './editor-evaluacion.html',
  styleUrl: './editor-evaluacion.scss',
})
export class EditorEvaluacion implements OnInit {
  readonly leccion = input.required<LeccionPrivada>();
  readonly editable = input(false);
  readonly bloqueado = input(false);
  readonly cargarFn = input.required<(leccionId: number) => Promise<CuestionarioDocente>>();
  /** Sin función de guardado (revisión del administrador) las preguntas solo se consultan. */
  readonly guardarFn =
    input<(leccionId: number, datos: DatosCuestionario) => Promise<CursoDetalle>>();

  readonly actualizado = output<CursoDetalle>();
  readonly ocupado = output<boolean>();
  readonly recargar = output<void>();

  protected readonly p = new Peticion();
  protected readonly abierto = signal(false);
  protected readonly cargando = signal(false);
  protected readonly letras = LETRAS;
  protected readonly maximo = MAX_PREGUNTAS;
  protected readonly minimo = MIN_PREGUNTAS;
  protected preguntas: PreguntaEditable[] = [];
  private claves = 0;

  ngOnInit(): void {
    // Una evaluación recién creada abre su editor para empezar a escribir las preguntas.
    if (this.editable() && this.leccion().preguntas === 0) void this.abrir();
  }

  protected async abrir(): Promise<void> {
    if (this.abierto() || this.cargando()) return;
    this.p.limpiar();
    if (this.leccion().preguntas === 0) {
      this.preguntas = Array.from({ length: MIN_PREGUNTAS }, () => this.vacia());
      this.abierto.set(true);
      return;
    }
    this.cargando.set(true);
    try {
      const cuestionario = await this.cargarFn()(this.leccion().id);
      this.preguntas = cuestionario.preguntas.map((pregunta) => ({
        clave: ++this.claves,
        enunciado: pregunta.enunciado,
        opciones: LETRAS.map((letra) => pregunta.opciones.find((o) => o.letra === letra)?.texto ?? ''),
        correcta: pregunta.correcta,
      }));
      this.abierto.set(true);
    } catch (error) {
      this.p.fallar(error);
    } finally {
      this.cargando.set(false);
    }
  }

  protected cerrar(): void {
    this.abierto.set(false);
    this.preguntas = [];
    this.p.campos.set({});
  }

  protected agregar(): void {
    if (this.preguntas.length < MAX_PREGUNTAS) this.preguntas.push(this.vacia());
  }

  protected quitar(indice: number): void {
    this.preguntas.splice(indice, 1);
    this.p.campos.set({});
  }

  protected error(campo: string): string {
    return this.p.campos()[campo] ?? '';
  }

  protected async guardar(): Promise<void> {
    const guardarFn = this.guardarFn();
    if (!guardarFn || !this.editable() || this.bloqueado() || this.p.ocupada()) return;
    const errores = this.validar();
    this.p.error.set('');
    this.p.campos.set(errores);
    if (Object.keys(errores).length > 0) {
      this.p.error.set('Revisa las preguntas marcadas antes de guardar.');
      return;
    }

    const datos: DatosCuestionario = {
      preguntas: this.preguntas.map((pregunta) => ({
        enunciado: pregunta.enunciado.trim(),
        opciones: pregunta.opciones.map((texto) => texto.trim()),
        correcta: pregunta.correcta,
      })),
    };
    this.ocupado.emit(true);
    await this.p.ejecutar(
      () => guardarFn(this.leccion().id, datos),
      (curso) => {
        this.abierto.set(false);
        this.preguntas = [];
        this.actualizado.emit(curso);
      },
      'Preguntas guardadas.',
    );
    this.ocupado.emit(false);
  }

  private validar(): Record<string, string> {
    const errores: Record<string, string> = {};
    if (this.preguntas.length < MIN_PREGUNTAS || this.preguntas.length > MAX_PREGUNTAS) {
      errores['preguntas'] = `La evaluación necesita entre ${MIN_PREGUNTAS} y ${MAX_PREGUNTAS} preguntas.`;
    }
    this.preguntas.forEach((pregunta, i) => {
      if (!pregunta.enunciado.trim()) {
        errores[`preguntas.${i}.enunciado`] = 'Escribe el enunciado.';
      }
      pregunta.opciones.forEach((texto, j) => {
        if (!texto.trim()) errores[`preguntas.${i}.opciones.${j}`] = `Escribe la opción ${LETRAS[j]}.`;
      });
    });
    return errores;
  }

  private vacia(): PreguntaEditable {
    return { clave: ++this.claves, enunciado: '', opciones: ['', '', '', ''], correcta: 'A' };
  }
}
