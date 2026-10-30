import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { erroresPorCampo, mensajeDeError } from '../../../../../core/http/error-api';
import { EstadoVistaComponent } from '../../../../../shared/ui/retroalimentacion/estado-vista';
import { Modal } from '../../../../../shared/ui/retroalimentacion/modal';
import { ICONOS_CATEGORIA, LISTA_ICONOS_CATEGORIA, type IconoCategoria } from '../../../../../shared/ui/marca/iconos-categoria';
import { ToastService } from '../../../../../shared/ui/retroalimentacion/toast.service';
import { AdminCategoriasApi, type CategoriaAdmin } from '../../categorias.api';

interface Formulario {
  id: number | null;
  nombre: string;
  descripcion: string;
  activa: boolean;
  icono: IconoCategoria;
}

/** Desactivación pendiente de confirmar; `cambios` trae lo editado si se desactivó desde el formulario. */
interface Desactivacion {
  categoria: CategoriaAdmin;
  cambios?: { nombre: string; descripcion: string | null; icono: IconoCategoria };
}

/**
 * Categorías del catálogo (ADR-012): crear, editar (con su ícono) y activar o desactivar. No se borran.
 * Al desactivar una con cursos se puede moverlos a otra categoría activa en la misma operación.
 */
@Component({
  selector: 'app-categorias',
  imports: [FormsModule, LucideAngularModule, EstadoVistaComponent, Modal],
  templateUrl: './categorias.html',
  styleUrl: './categorias.scss',
})
export class Categorias {
  private readonly api = inject(AdminCategoriasApi);
  private readonly toast = inject(ToastService);

  protected readonly iconos = LISTA_ICONOS_CATEGORIA;
  protected readonly nombreIcono = ICONOS_CATEGORIA;

  protected readonly categorias = signal<CategoriaAdmin[] | null>(null);
  protected readonly error = signal('');
  protected readonly formulario = signal<Formulario | null>(null);
  protected readonly errores = signal<Record<string, string>>({});
  protected readonly guardando = signal(false);

  protected readonly desactivando = signal<Desactivacion | null>(null);
  /** En el modal de desactivar: mover los cursos a otra categoría y cuál. */
  protected moverCursos = false;
  protected destino: number | null = null;
  protected readonly errorDestino = signal('');

  /** Categorías activas a las que se pueden mover los cursos de la que se desactiva. */
  protected readonly destinos = computed(() => {
    const origen = this.desactivando()?.categoria.id;
    return (this.categorias() ?? []).filter((c) => c.activa && c.id !== origen);
  });

  constructor() {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.error.set('');
    try {
      this.categorias.set(await this.api.listar());
    } catch (error) {
      this.error.set(mensajeDeError(error, 'Cargar las categorías'));
    }
  }

  protected nueva(): void {
    this.errores.set({});
    this.formulario.set({ id: null, nombre: '', descripcion: '', activa: true, icono: 'tags' });
  }

  protected editar(c: CategoriaAdmin): void {
    this.errores.set({});
    this.formulario.set({ id: c.id, nombre: c.nombre, descripcion: c.descripcion ?? '', activa: c.activa, icono: c.icono });
  }

  protected async guardar(): Promise<void> {
    const f = this.formulario();
    if (!f || this.guardando()) return;
    if (!f.nombre.trim()) {
      this.errores.set({ nombre: 'Escribe el nombre de la categoría.' });
      return;
    }
    const datos = { nombre: f.nombre.trim(), descripcion: f.descripcion.trim() || null, icono: f.icono };
    const original = f.id === null ? null : this.categorias()?.find((c) => c.id === f.id) ?? null;
    // Desactivar una categoría con cursos pasa por el modal que ofrece moverlos.
    if (original?.activa && !f.activa && original.cursos > 0) {
      this.formulario.set(null);
      this.abrirDesactivacion(original, datos);
      return;
    }
    this.guardando.set(true);
    try {
      const guardada = f.id === null
        ? await this.api.crear(datos)
        : await this.api.actualizar(f.id, { ...datos, activa: f.activa });
      this.aplicar(guardada);
      this.formulario.set(null);
      this.toast.exito(f.id === null ? `Categoría «${guardada.nombre}» creada.` : 'Categoría guardada.');
    } catch (error) {
      const campos = erroresPorCampo(error);
      this.errores.set(Object.keys(campos).length ? campos : { general: mensajeDeError(error, 'Guardar la categoría') });
    } finally {
      this.guardando.set(false);
    }
  }

  /** Activar es inmediato; desactivar se confirma porque afecta a los docentes y a los cursos que la usan. */
  protected pedirCambio(c: CategoriaAdmin): void {
    if (c.activa) this.abrirDesactivacion(c);
    else void this.activar(c);
  }

  private abrirDesactivacion(categoria: CategoriaAdmin, cambios?: Desactivacion['cambios']): void {
    this.moverCursos = false;
    this.destino = null;
    this.errorDestino.set('');
    this.desactivando.set({ categoria, cambios });
  }

  private async activar(c: CategoriaAdmin): Promise<void> {
    try {
      this.aplicar(await this.api.actualizar(c.id, { nombre: c.nombre, descripcion: c.descripcion, activa: true }));
      this.toast.exito(`«${c.nombre}» vuelve a estar disponible.`);
    } catch (error) {
      this.toast.error(mensajeDeError(error, 'Cambiar el estado de la categoría'));
    }
  }

  /** Desactiva y, si se eligió, mueve todos sus cursos a la categoría de destino en la misma transacción. */
  protected async desactivar(): Promise<void> {
    const d = this.desactivando();
    if (!d || this.guardando()) return;
    const { categoria: c, cambios } = d;
    const mover = this.moverCursos && c.cursos > 0;
    if (mover && this.destino === null) {
      this.errorDestino.set('Elige la categoría a la que se moverán los cursos.');
      return;
    }
    const destino = mover ? this.destinos().find((x) => x.id === this.destino) ?? null : null;
    this.guardando.set(true);
    try {
      await this.api.actualizar(c.id, {
        nombre: cambios?.nombre ?? c.nombre,
        descripcion: cambios ? cambios.descripcion : c.descripcion,
        icono: cambios?.icono ?? c.icono,
        activa: false,
        ...(destino && { reasignarA: destino.id }),
      });
      this.desactivando.set(null);
      this.toast.exito(destino
        ? `«${c.nombre}» desactivada. ${c.cursos === 1 ? 'Su curso pasó' : `Sus ${c.cursos} cursos pasaron`} a «${destino.nombre}».`
        : `«${c.nombre}» desactivada.`);
      await this.cargar(); // los conteos de la categoría de destino también cambiaron
    } catch (error) {
      const campos = erroresPorCampo(error);
      if (campos['reasignarA']) this.errorDestino.set(campos['reasignarA']);
      else this.toast.error(mensajeDeError(error, 'Desactivar la categoría'));
    } finally {
      this.guardando.set(false);
    }
  }

  private aplicar(guardada: CategoriaAdmin): void {
    this.categorias.update((lista) => {
      const resto = (lista ?? []).filter((c) => c.id !== guardada.id);
      return [...resto, guardada].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    });
  }
}
