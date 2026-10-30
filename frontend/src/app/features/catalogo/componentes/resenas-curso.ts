import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { mensajeDeError } from '../../../core/http/error-api';
import { Avatar } from '../../../shared/ui/marca/avatar';
import { Estrellas, TRAZO_ESTRELLA } from '../../../shared/ui/datos/estrellas';
import { Modal } from '../../../shared/ui/retroalimentacion/modal';
import { ToastService } from '../../../shared/ui/retroalimentacion/toast.service';
import { ResenasApi, type PaginaResenas, type Resena } from '../resenas.api';

const NOMBRE_NOTA = ['', 'Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente'];

/**
 * Reseñas de un curso: resumen con distribución, lista paginada y, para el estudiante
 * inscrito, su propia reseña (escribir, editar o borrar).
 */
@Component({
  selector: 'app-resenas-curso',
  imports: [DatePipe, DecimalPipe, FormsModule, Avatar, Estrellas, Modal],
  templateUrl: './resenas-curso.html',
  styleUrl: './resenas-curso.scss',
})
export class ResenasCurso {
  private readonly api = inject(ResenasApi);
  private readonly toast = inject(ToastService);

  readonly cursoId = input.required<number>();
  /** Estudiante con sesión: se consulta si puede reseñar. */
  readonly estudiante = input(false);
  /** Avisa al detalle del curso para refrescar el promedio de la cabecera. */
  readonly cambio = output<PaginaResenas['resumen']>();

  protected readonly nombreNota = NOMBRE_NOTA;
  protected readonly trazoEstrella = TRAZO_ESTRELLA;
  protected readonly pagina = signal<PaginaResenas | null>(null);
  protected readonly items = signal<Resena[]>([]);
  protected readonly cargando = signal(true);
  protected readonly cargandoMas = signal(false);
  protected readonly error = signal('');

  protected readonly puedeResenar = signal(false);
  /** Un administrador ocultó su reseña: no puede editarla ni volver a publicarla. */
  protected readonly ocultada = signal(false);
  protected readonly mia = signal<Resena | null>(null);
  protected readonly editando = signal(false);
  protected readonly estrellas = signal(0);
  protected comentario = '';
  protected readonly guardando = signal(false);
  protected readonly errorForm = signal('');
  protected readonly confirmarBorrado = signal(false);

  protected readonly hayMas = computed(() => {
    const p = this.pagina();
    return !!p && this.items().length < p.total;
  });

  constructor() {
    effect(() => {
      const id = this.cursoId();
      const estudiante = this.estudiante();
      untracked(() => void this.cargar(id, estudiante));
    });
  }

  protected porcentaje(cantidad: number): number {
    const total = this.pagina()?.resumen.total ?? 0;
    return total ? Math.round((cantidad * 100) / total) : 0;
  }

  protected iniciales(autor: string): string {
    return autor.split(' ').map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase();
  }

  protected async cargar(id = this.cursoId(), estudiante = this.estudiante()): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      const [pagina, mia] = await Promise.all([
        this.api.listar(id, 1),
        estudiante ? this.api.mia(id) : Promise.resolve(null),
      ]);
      this.pagina.set(pagina);
      this.items.set(pagina.items);
      this.puedeResenar.set(!!mia?.puedeResenar);
      this.ocultada.set(!!mia?.ocultada);
      this.mia.set(mia?.resena ?? null);
    } catch (error) {
      this.error.set(mensajeDeError(error, 'Cargar las reseñas'));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async verMas(): Promise<void> {
    const p = this.pagina();
    if (!p || this.cargandoMas()) return;
    this.cargandoMas.set(true);
    try {
      const siguiente = await this.api.listar(this.cursoId(), p.pagina + 1);
      this.pagina.set(siguiente);
      this.items.update((lista) => [...lista, ...siguiente.items.filter((r) => !lista.some((x) => x.id === r.id))]);
    } catch (error) {
      this.toast.error(mensajeDeError(error, 'Cargar más reseñas'));
    } finally {
      this.cargandoMas.set(false);
    }
  }

  protected empezar(): void {
    const mia = this.mia();
    this.estrellas.set(mia?.estrellas ?? 0);
    this.comentario = mia?.comentario ?? '';
    this.errorForm.set('');
    this.editando.set(true);
  }

  protected async guardar(): Promise<void> {
    if (!this.estrellas()) {
      this.errorForm.set('Elige de 1 a 5 estrellas.');
      return;
    }
    this.guardando.set(true);
    this.errorForm.set('');
    try {
      const nueva = !this.mia();
      await this.api.guardar(this.cursoId(), { estrellas: this.estrellas(), comentario: this.comentario.trim() || null });
      this.editando.set(false);
      await this.recargarTodo();
      this.toast.exito(nueva ? 'Gracias por tu reseña.' : 'Reseña actualizada.');
    } catch (error) {
      this.errorForm.set(mensajeDeError(error, 'Guardar tu reseña'));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async borrar(): Promise<void> {
    this.confirmarBorrado.set(false);
    try {
      await this.api.eliminar(this.cursoId());
      await this.recargarTodo();
      this.toast.exito('Reseña borrada.');
    } catch (error) {
      this.toast.error(mensajeDeError(error, 'Borrar tu reseña'));
    }
  }

  private async recargarTodo(): Promise<void> {
    await this.cargar();
    const resumen = this.pagina()?.resumen;
    if (resumen) this.cambio.emit(resumen);
  }
}
