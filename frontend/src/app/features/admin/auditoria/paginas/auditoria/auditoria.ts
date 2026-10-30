import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { mensajeDeError } from '../../../../../core/http/error-api';
import { EstadoVistaComponent } from '../../../../../shared/ui/retroalimentacion/estado-vista';
import { Modal } from '../../../../../shared/ui/retroalimentacion/modal';
import {
  AuditoriaApi, type CambioAuditoria, type DetalleCambioAuditoria, type OpcionesAuditoria, type PaginaAuditoria,
} from '../../auditoria.api';
import { DiffCambio } from '../../componentes/diff-cambio/diff-cambio';

type Operacion = CambioAuditoria['operacion'];

interface Filtros {
  tabla: string;
  operacion: '' | Operacion;
  usuarioBd: string;
  actor: string;
  /** AAAA-MM-DD (input date). */
  desde: string;
  hasta: string;
}

const FILTROS_INICIALES: Filtros = { tabla: '', operacion: '', usuarioBd: '', actor: '', desde: '', hasta: '' };
const LIMITE = 25;

const OPERACION: Record<Operacion, string> = { INSERT: 'Alta', UPDATE: 'Cambio', DELETE: 'Borrado' };

/** Medianoche local del día indicado (+ días), en ISO: el servidor la compara con cambiado_en. */
function medianoche(dia: string, mas = 0): string {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a!, m! - 1, d! + mas).toISOString();
}

/**
 * Visor de auditoría: cada INSERT, UPDATE y DELETE de las tablas auditadas, con su actor y el rol de la base que lo
 * ejecutó. El detalle muestra los datos antes y después.
 */
import { AdminUsuariosApi } from '../../../usuarios/usuarios.api';

@Component({
  selector: 'app-admin-auditoria',
  imports: [DatePipe, FormsModule, LucideAngularModule, EstadoVistaComponent, Modal, DiffCambio],
  templateUrl: './auditoria.html',
  styleUrl: './auditoria.scss',
})
export class AdminAuditoria {
  private readonly api = inject(AuditoriaApi);
  private readonly router = inject(Router);
  private solicitud = 0;

  protected readonly operaciones = OPERACION;
  protected readonly filtros = signal<Filtros>(FILTROS_INICIALES);
  protected readonly hayFiltros = computed(() => Object.values(this.filtros()).some((v) => v !== ''));
  protected readonly errorFechas = computed(() => {
    const { desde, hasta } = this.filtros();
    return desde && hasta && desde > hasta ? '«Desde» debe ser anterior o igual a «Hasta».' : '';
  });
  protected readonly pagina = signal(1);
  protected readonly datos = signal<PaginaAuditoria | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly opciones = signal<OpcionesAuditoria>({ tablas: [], usuariosBd: [], actores: [] });
  /** Texto del buscador de actor y las cuentas que coinciden (de la búsqueda de Usuarios en el backend). */
  protected readonly textoActor = signal('');
  protected readonly sugerenciasActor = signal<{ id: number; etiqueta: string }[]>([]);
  private esperaActor: ReturnType<typeof setTimeout> | undefined;
  private readonly usuarios = inject(AdminUsuariosApi);

  /** Registro abierto en el modal de detalle. */
  protected readonly abierto = signal<CambioAuditoria | null>(null);
  protected readonly detalle = signal<DetalleCambioAuditoria | null>(null);
  protected readonly errorDetalle = signal('');

  constructor() {
    void this.cargarOpciones();
    void this.cargar();
    // Las alertas de seguridad enlazan con ?ver=<id> para abrir directamente ese registro.
    const ver = Number(inject(ActivatedRoute).snapshot.queryParamMap.get('ver'));
    if (Number.isSafeInteger(ver) && ver > 0) void this.abrirPorId(ver);
  }

  protected filtrar(cambio: Partial<Filtros>): void {
    this.filtros.update((f) => ({ ...f, ...cambio }));
    if (this.errorFechas()) return;
    this.irA(1);
  }

  protected buscarActor(texto: string): void {
    this.textoActor.set(texto);
    clearTimeout(this.esperaActor);
    if (!texto.trim()) {
      this.sugerenciasActor.set([]);
      if (this.filtros().actor) this.filtrar({ actor: '' });
      return;
    }
    if (this.sugerenciasActor().some((s) => s.etiqueta === texto)) return;
    this.esperaActor = setTimeout(async () => {
      try {
        const r = await this.usuarios.listar({ q: texto.trim(), pagina: 1, limite: 8 });
        this.sugerenciasActor.set(r.items.map((u) => ({ id: u.idPersona, etiqueta: `${u.nombre} · ${u.correo}` })));
      } catch {
        this.sugerenciasActor.set([]);
      }
    }, 250);
  }

  /** Al elegir una sugerencia filtra por esa persona; un texto que no es una sugerencia no filtra. */
  protected elegirActor(texto: string): void {
    const elegida = this.sugerenciasActor().find((s) => s.etiqueta === texto);
    if (elegida) this.filtrar({ actor: String(elegida.id) });
  }

  protected limpiar(): void {
    this.textoActor.set('');
    this.sugerenciasActor.set([]);
    this.filtros.set(FILTROS_INICIALES);
    this.irA(1);
  }

  protected irA(pagina: number): void {
    this.pagina.set(pagina);
    void this.cargar();
  }

  protected async cargarOpciones(): Promise<void> {
    try {
      this.opciones.set(await this.api.opciones());
    } catch {
      // Sin opciones, los desplegables quedan en «Todas»; la tabla sigue funcionando.
    }
  }

  protected async cargar(): Promise<void> {
    const actual = ++this.solicitud;
    const f = this.filtros();
    this.cargando.set(true);
    this.error.set('');
    try {
      const datos = await this.api.listar({
        tabla: f.tabla || undefined,
        operacion: f.operacion || undefined,
        usuarioBd: f.usuarioBd || undefined,
        actor: f.actor ? Number(f.actor) : undefined,
        desde: f.desde ? medianoche(f.desde) : undefined,
        hasta: f.hasta ? medianoche(f.hasta, 1) : undefined,
        pagina: this.pagina(),
        limite: LIMITE,
      });
      if (actual === this.solicitud) this.datos.set(datos);
    } catch (error) {
      if (actual === this.solicitud) this.error.set(mensajeDeError(error, 'Cargar la auditoría'));
    } finally {
      if (actual === this.solicitud) this.cargando.set(false);
    }
  }

  protected async abrir(c: CambioAuditoria): Promise<void> {
    this.abierto.set(c);
    this.detalle.set(null);
    this.errorDetalle.set('');
    try {
      const d = await this.api.detalle(c.id);
      if (this.abierto()?.id === c.id) this.detalle.set(d);
    } catch (error) {
      if (this.abierto()?.id === c.id) this.errorDetalle.set(mensajeDeError(error, 'Cargar el detalle'));
    }
  }

  protected cerrar(): void {
    this.abierto.set(null);
    if (this.router.url.includes('ver=')) {
      void this.router.navigate([], { queryParams: { ver: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }

  /** Abre el detalle de un registro que quizá no está en la página actual (enlace desde una alerta). */
  private async abrirPorId(id: number): Promise<void> {
    this.errorDetalle.set('');
    try {
      const d = await this.api.detalle(id);
      this.abierto.set(d);
      this.detalle.set(d);
    } catch (error) {
      this.error.set(mensajeDeError(error, `Abrir el registro de auditoría ${id}`));
    }
  }

  /** Columnas cambiadas para la tabla: las tres primeras y cuántas más. */
  protected resumenColumnas(c: CambioAuditoria): string {
    const columnas = c.columnasCambiadas ?? [];
    if (!columnas.length) return '—';
    return columnas.length > 3 ? `${columnas.slice(0, 3).join(', ')} y ${columnas.length - 3} más` : columnas.join(', ');
  }
}
