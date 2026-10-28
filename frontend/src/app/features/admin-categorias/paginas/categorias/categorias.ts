import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { erroresPorCampo, mensajeDeError } from '../../../../core/http/error-api';
import { EstadoVistaComponent } from '../../../../shared/ui/estado-vista';
import { Modal } from '../../../../shared/ui/modal';
import { ICONO_CATEGORIA } from '../../../../shared/ui/tipos-ui';
import { ToastService } from '../../../../shared/ui/toast.service';
import { AdminCategoriasApi, type CategoriaAdmin } from '../../admin-categorias.api';

interface Formulario {
  id: number | null;
  nombre: string;
  descripcion: string;
  activa: boolean;
}

/** Categorías del catálogo (ADR-012): crear, editar y activar o desactivar. No se borran. */
@Component({
  selector: 'app-categorias',
  imports: [FormsModule, LucideAngularModule, EstadoVistaComponent, Modal],
  templateUrl: './categorias.html',
  styleUrl: './categorias.scss',
})
export class Categorias {
  private readonly api = inject(AdminCategoriasApi);
  private readonly toast = inject(ToastService);

  protected readonly categorias = signal<CategoriaAdmin[] | null>(null);
  protected readonly error = signal('');
  protected readonly formulario = signal<Formulario | null>(null);
  protected readonly errores = signal<Record<string, string>>({});
  protected readonly guardando = signal(false);
  protected readonly desactivando = signal<CategoriaAdmin | null>(null);

  constructor() {
    void this.cargar();
  }

  protected icono(nombre: string): string {
    return ICONO_CATEGORIA[nombre] ?? 'tags';
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
    this.formulario.set({ id: null, nombre: '', descripcion: '', activa: true });
  }

  protected editar(c: CategoriaAdmin): void {
    this.errores.set({});
    this.formulario.set({ id: c.id, nombre: c.nombre, descripcion: c.descripcion ?? '', activa: c.activa });
  }

  protected async guardar(): Promise<void> {
    const f = this.formulario();
    if (!f || this.guardando()) return;
    if (!f.nombre.trim()) {
      this.errores.set({ nombre: 'Escribe el nombre de la categoría.' });
      return;
    }
    this.guardando.set(true);
    try {
      const datos = { nombre: f.nombre.trim(), descripcion: f.descripcion.trim() || null };
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

  /** Activar es inmediato; desactivar se confirma porque afecta a los docentes que la usan. */
  protected pedirCambio(c: CategoriaAdmin): void {
    if (c.activa) this.desactivando.set(c);
    else void this.cambiarActiva(c, true);
  }

  protected async cambiarActiva(c: CategoriaAdmin, activa: boolean): Promise<void> {
    this.desactivando.set(null);
    try {
      this.aplicar(await this.api.actualizar(c.id, { nombre: c.nombre, descripcion: c.descripcion, activa }));
      this.toast.exito(activa ? `«${c.nombre}» vuelve a estar disponible.` : `«${c.nombre}» desactivada.`);
    } catch (error) {
      this.toast.error(mensajeDeError(error, 'Cambiar el estado de la categoría'));
    }
  }

  private aplicar(guardada: CategoriaAdmin): void {
    this.categorias.update((lista) => {
      const resto = (lista ?? []).filter((c) => c.id !== guardada.id);
      return [...resto, guardada].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    });
  }
}
