import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import type { GrupoCurso, GruposCurso } from '../../../../../core/api/contrato';
import { mensajeDeError } from '../../../../../core/http/error-api';
import { ConfirmacionService } from '../../../../../shared/ui/retroalimentacion/confirmacion.service';
import { GruposApi } from '../../grupos.api';

@Component({
  selector: 'app-grupos-curso',
  imports: [FormsModule, LucideAngularModule],
  templateUrl: './grupos-curso.html',
  styleUrl: './grupos-curso.scss',
})
export class GruposCursoPanel {
  readonly curso = input.required<number>();
  readonly actualizado = output<void>();
  private readonly api = inject(GruposApi);
  private readonly confirmacion = inject(ConfirmacionService);

  protected readonly datos = signal<GruposCurso | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly error = signal('');
  protected readonly seleccion = signal<GrupoCurso | null>(null);
  protected readonly nombre = signal('');
  protected readonly miembros = signal<Set<number>>(new Set());
  protected readonly busqueda = signal('');
  protected readonly inscritosVisibles = computed(() => {
    const texto = this.normalizar(this.busqueda().trim());
    return (this.datos()?.inscritos ?? []).filter((persona) =>
      !texto || this.normalizar(persona.nombre).includes(texto),
    );
  });
  protected readonly todosVisiblesSeleccionados = computed(() => {
    const visibles = this.inscritosVisibles();
    const miembros = this.miembros();
    return visibles.length > 0 && visibles.every((persona) => miembros.has(persona.id));
  });
  protected readonly cambios = computed(() => {
    const grupo = this.seleccion();
    const miembros = this.miembros();
    if (!grupo) return !!this.nombre().trim() || miembros.size > 0;
    return (
      this.nombre().trim() !== grupo.nombre ||
      miembros.size !== grupo.miembros.length ||
      grupo.miembros.some((id) => !miembros.has(id))
    );
  });
  private version = 0;

  constructor() {
    effect(() => {
      const curso = this.curso();
      untracked(() => void this.cargar(curso));
    });
  }

  protected iniciales(nombre: string): string {
    return nombre.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0] ?? '').join('').toUpperCase();
  }

  private normalizar(texto: string): string {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  }

  private establecerSeleccion(grupo: GrupoCurso | null): void {
    this.seleccion.set(grupo);
    this.nombre.set(grupo?.nombre ?? '');
    this.miembros.set(new Set(grupo?.miembros ?? []));
    this.busqueda.set('');
  }

  protected async elegir(grupo: GrupoCurso | null): Promise<void> {
    if (this.ocupado() || this.seleccion()?.id === grupo?.id) return;
    const version = this.version;
    if (this.cambios()) {
      const confirmado = await this.confirmacion.confirmar({
        titulo: '¿Descartar los cambios?',
        mensaje: 'Los cambios que no hayas guardado en este grupo se perderán.',
        accion: 'Descartar cambios',
        icono: 'circle-alert',
      });
      if (!confirmado || version !== this.version || this.ocupado()) return;
    }
    this.error.set('');
    this.establecerSeleccion(grupo);
  }

  protected marcar(id: number, marcado: boolean): void {
    const nuevos = new Set(this.miembros());
    if (marcado) nuevos.add(id);
    else nuevos.delete(id);
    this.miembros.set(nuevos);
  }

  protected alternarVisibles(): void {
    const nuevos = new Set(this.miembros());
    const seleccionar = !this.todosVisiblesSeleccionados();
    for (const estudiante of this.inscritosVisibles()) {
      if (seleccionar) nuevos.add(estudiante.id);
      else nuevos.delete(estudiante.id);
    }
    this.miembros.set(nuevos);
  }

  protected descartar(): void {
    this.error.set('');
    this.establecerSeleccion(this.seleccion());
  }

  protected async cargar(curso = this.curso()): Promise<void> {
    const v = ++this.version;
    this.datos.set(null);
    this.ocupado.set(true);
    this.error.set('');
    try {
      const datos = await this.api.listar(curso);
      if (v === this.version) {
        this.datos.set(datos);
        this.establecerSeleccion(null);
      }
    } catch (error) {
      if (v === this.version) this.error.set(mensajeDeError(error, 'Cargar los grupos'));
    } finally {
      if (v === this.version) this.ocupado.set(false);
    }
  }

  protected async guardar(borrar = false): Promise<void> {
    const curso = this.curso();
    const grupo = this.seleccion();
    const nombre = this.nombre().trim();
    const ids = [...this.miembros()];
    const v = this.version;
    if (this.ocupado() || (!borrar && !nombre)) return;

    if (borrar) {
      if (!grupo || !(await this.confirmacion.confirmar({
        titulo: '¿Eliminar este grupo?',
        mensaje: grupo.nombre,
        accion: 'Eliminar grupo',
        peligro: true,
        icono: 'trash-2',
      }))) return;
    }
    if (v !== this.version || this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set('');
    try {
      const datos = borrar && grupo
        ? await this.api.quitar(curso, grupo.id)
        : await this.api.guardar(curso, grupo, { nombre, miembros: ids });
      if (v === this.version) {
        this.datos.set(datos);
        const actualizado = borrar ? null : datos.grupos.find((g) =>
          grupo ? g.id === grupo.id : g.nombre === nombre,
        ) ?? null;
        this.establecerSeleccion(actualizado);
        this.actualizado.emit();
      }
    } catch (error) {
      if (v !== this.version) return;
      // Refresca la revisión en el servidor sin borrar el borrador del docente.
      try {
        const datos = await this.api.listar(curso);
        if (v !== this.version) return;
        this.datos.set(datos);
        this.seleccion.set(datos.grupos.find((g) => g.id === grupo?.id) ?? null);
        this.nombre.set(nombre);
        this.miembros.set(new Set(ids));
      } catch {
        // Conserva los datos visibles y el borrador para poder reintentar.
      }
      if (v === this.version) this.error.set(mensajeDeError(error, 'Guardar el grupo'));
    } finally {
      if (v === this.version) this.ocupado.set(false);
    }
  }
}
