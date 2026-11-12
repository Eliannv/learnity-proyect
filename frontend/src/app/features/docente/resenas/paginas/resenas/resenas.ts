import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import type {
  BandejaResenas, FiltrosBandejaResenas, MotivoReporte, ResenaDocente,
} from '../../../../../core/api/contrato';
import { AuthService } from '../../../../../core/auth/auth.service';
import { Peticion } from '../../../../../core/estado/peticion';
import { mensajeDeError } from '../../../../../core/http/error-api';
import { Avatar } from '../../../../../shared/ui/marca/avatar';
import { Esqueleto } from '../../../../../shared/ui/retroalimentacion/esqueleto';
import { Estrellas } from '../../../../../shared/ui/datos/estrellas';
import { GraficoSeries, etiquetasMes } from '../../../../../shared/ui/datos/grafico-series';
import { Indicador } from '../../../../../shared/ui/datos/indicador';
import { Modal } from '../../../../../shared/ui/retroalimentacion/modal';
import { ToastService } from '../../../../../shared/ui/retroalimentacion/toast.service';
import { ConfirmacionService } from '../../../../../shared/ui/retroalimentacion/confirmacion.service';
import { DocenteResenasApi } from '../../resenas.api';
import { CatalogoApi } from '../../../../catalogo/catalogo.api';
import { ResenasApi } from '../../../../catalogo/resenas.api';

import { BuscadorCurso } from '../../../../../shared/ui/cursos/buscador-curso';

type Filtro = Required<Pick<FiltrosBandejaResenas, 'pagina'>> & Omit<FiltrosBandejaResenas, 'pagina' | 'limite'>;

const MOTIVOS: { valor: MotivoReporte; texto: string; ayuda: string }[] = [
  { valor: 'OFENSIVO', texto: 'Lenguaje ofensivo', ayuda: 'Insultos, acoso o contenido discriminatorio.' },
  { valor: 'SPAM', texto: 'Spam o publicidad', ayuda: 'Enlaces, promociones o texto sin relación con el curso.' },
  { valor: 'OTRO', texto: 'Otro motivo', ayuda: 'Explica el motivo en el detalle.' },
];

/** Bandeja de reseñas de todos los cursos del docente: filtra, responde en público y reporta al administrador. */
@Component({
  selector: 'app-resenas-docente',
  imports: [
    DatePipe, DecimalPipe, FormsModule, RouterLink, LucideAngularModule, Avatar, BuscadorCurso, Esqueleto, Estrellas,
    GraficoSeries, Indicador, Modal,
  ],
  templateUrl: './resenas.html',
  styleUrl: './resenas.scss',
})
export class ResenasDocente {
  private readonly api = inject(DocenteResenasApi);
  private readonly resenasApi = inject(ResenasApi);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly auth = inject(AuthService);
  private version = 0;

  protected readonly motivos = MOTIVOS;
  protected readonly carga = new Peticion();
  protected readonly datos = signal<BandejaResenas | null>(null);
  protected readonly filtro = signal<Filtro>(this.filtroDeUrl());

  /** Reseña con una acción en curso (borrar la respuesta clásica o reportar). */
  protected readonly enviando = signal<number | null>(null);
  /** Reseña con el formulario de respuesta abierto: el docente responde siempre en el hilo. */
  protected readonly respondiendoHiloId = signal<number | null>(null);
  protected readonly textoHilo = signal('');
  protected readonly enviandoHilo = signal(false);

  /** Reseña que se está reportando, con el motivo y el detalle elegidos. */
  protected readonly reportando = signal<ResenaDocente | null>(null);
  protected readonly motivo = signal<MotivoReporte | null>(null);
  protected readonly detalle = signal('');
  protected readonly errorReporte = signal('');

  protected readonly hayFiltros = computed(() => {
    const f = this.filtro();
    return f.curso !== undefined || f.estrellas !== undefined || f.comentario !== undefined || f.respuesta !== undefined
      || f.categoria !== undefined || f.q !== undefined;
  });

  /** Categorías activas como opciones del selector buscable compartido (el filtro envía su nombre). */
  private readonly catalogo = inject(CatalogoApi);
  protected readonly categorias = signal<{ id: number; titulo: string; iconoCategoria: string }[]>([]);
  protected readonly idCategoria = computed(() => this.categorias().find((c) => c.titulo === this.filtro().categoria)?.id ?? null);
  private espera: ReturnType<typeof setTimeout> | undefined;

  protected elegirCategoria(id: number | null): void {
    this.cambiar('categoria', this.categorias().find((c) => c.id === id)?.titulo ?? '');
  }

  /** La búsqueda espera a que se deje de escribir (estudiante, comentario o respuesta). */
  protected buscarTexto(texto: string): void {
    clearTimeout(this.espera);
    this.espera = setTimeout(() => this.cambiar('q', texto.trim()), 300);
  }

  protected readonly evolucion = computed(() => {
    const puntos = this.datos()?.evolucion ?? [];
    const { cortas, largas } = etiquetasMes(puntos.map((p) => p.mes));
    return {
      cortas, largas,
      series: [
        { nombre: 'Promedio del mes', valores: puntos.map((p) => p.promedio) },
        { nombre: 'Promedio acumulado', valores: puntos.map((p) => p.promedioAcumulado) },
      ],
    };
  });

  constructor() {
    void this.cargar();
    this.catalogo.categorias().then(
      (lista) => this.categorias.set(lista.map((c) => ({ id: c.id, titulo: c.nombre, iconoCategoria: c.icono }))),
      () => undefined,
    );
  }

  protected cambiar<K extends keyof Filtro>(clave: K, valor: string): void {
    const convertido = valor === '' ? undefined : clave === 'curso' || clave === 'estrellas' ? Number(valor) : valor;
    this.filtro.update((f) => ({ ...f, [clave]: convertido, pagina: 1 }));
    this.actualizarUrl();
    void this.cargar();
  }

  protected quitarFiltros(): void {
    this.filtro.set({ pagina: 1 });
    this.actualizarUrl();
    void this.cargar();
  }

  protected irAPagina(pagina: number): void {
    this.filtro.update((f) => ({ ...f, pagina }));
    this.actualizarUrl();
    void this.cargar();
  }

  private actualizarUrl(): void {
    const filtro = this.filtro();
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: {
        curso: filtro.curso,
        estrellas: filtro.estrellas,
        comentario: filtro.comentario,
        respuesta: filtro.respuesta,
        categoria: filtro.categoria,
        q: filtro.q,
        pagina: filtro.pagina > 1 ? filtro.pagina : undefined,
      },
      replaceUrl: true,
    });
  }

  protected async cargar(): Promise<void> {
    const version = ++this.version;
    const filtro = this.filtro();
    this.carga.limpiar();
    this.carga.ocupada.set(true);
    try {
      const datos = await this.api.bandeja({ ...filtro, limite: 10 });
      if (version === this.version) this.datos.set(datos);
    } catch (error) {
      if (version === this.version) this.carga.fallar(error);
    } finally {
      if (version === this.version) this.carga.ocupada.set(false);
    }
  }

  // ------------------------------------------------------------ responder (siempre en el hilo)

  /** Nombre del docente con la inicial del apellido, como lo muestra el hilo («Ana P.»). */
  protected readonly miNombre = computed(() => {
    const u = this.auth.usuario();
    if (!u) return 'Tú';
    const inicial = u.apellidos?.trim().charAt(0);
    return inicial ? `${u.nombres} ${inicial}.` : u.nombres;
  });

  /** Respondida: con la respuesta clásica o con algún comentario propio en el hilo (igual que el backend). */
  private respondida(r: ResenaDocente): boolean {
    return !!r.respuesta || (r.respuestas ?? []).some((h) => h.propia && h.autor.esDocenteCurso);
  }

  /** Borra la respuesta clásica (anterior a los hilos), que se muestra como la primera del hilo. */
  protected async retirarRespuesta(r: ResenaDocente): Promise<void> {
    const ok = await this.confirmacion.confirmar({
      titulo: '¿Borrar tu respuesta?', mensaje: 'Dejará de verse en la página del curso. La reseña no cambia.',
      accion: 'Borrar respuesta', peligro: true, icono: 'reply',
    });
    if (!ok) return;
    this.enviando.set(r.id);
    try {
      const actualizada = await this.api.retirarRespuesta(r.id);
      this.reemplazar({ ...actualizada, respuestas: actualizada.respuestas ?? r.respuestas });
      this.toasts.exito('Respuesta borrada.');
    } catch (error) {
      this.toasts.error(mensajeDeError(error, 'Borrar la respuesta'));
    } finally {
      this.enviando.set(null);
    }
  }

  protected abrirFormularioHilo(resenaId: number): void {
    if (this.respondiendoHiloId() === resenaId) {
      this.respondiendoHiloId.set(null);
      this.textoHilo.set('');
      return;
    }
    this.respondiendoHiloId.set(resenaId);
    this.textoHilo.set('');
  }

  protected async enviarRespuestaHilo(r: ResenaDocente): Promise<void> {
    const comentario = this.textoHilo().trim();
    if (!comentario || this.enviandoHilo()) return;
    this.enviandoHilo.set(true);
    try {
      const nueva = await this.resenasApi.crearRespuestaHilo(r.id, comentario);
      this.reemplazar({ ...r, respuestas: [...(r.respuestas ?? []), nueva] });
      this.respondiendoHiloId.set(null);
      this.textoHilo.set('');
      this.toasts.exito('Respuesta publicada.');
    } catch (error) {
      this.toasts.error(mensajeDeError(error, 'Publicar la respuesta'));
    } finally {
      this.enviandoHilo.set(false);
    }
  }

  protected async eliminarRespuestaHilo(r: ResenaDocente, idRespuesta: number): Promise<void> {
    try {
      await this.resenasApi.eliminarRespuestaHilo(r.id, idRespuesta);
      this.reemplazar({ ...r, respuestas: (r.respuestas ?? []).filter((x) => x.id !== idRespuesta) });
      this.toasts.exito('Respuesta borrada.');
    } catch (error) {
      this.toasts.error(mensajeDeError(error, 'Borrar la respuesta'));
    }
  }

  // ------------------------------------------------------------ reportar

  protected abrirReporte(r: ResenaDocente): void {
    this.reportando.set(r);
    this.motivo.set(null);
    this.detalle.set('');
    this.errorReporte.set('');
  }

  protected async enviarReporte(): Promise<void> {
    const r = this.reportando();
    const motivo = this.motivo();
    if (!r) return;
    if (!motivo) {
      this.errorReporte.set('Elige el motivo del reporte.');
      return;
    }
    this.enviando.set(r.id);
    try {
      this.reemplazar(await this.api.reportar(r.id, { motivo, detalle: this.detalle().trim() || null }));
      this.reportando.set(null);
      this.toasts.exito('Reporte enviado. El administrador lo revisará.');
    } catch (error) {
      this.errorReporte.set(mensajeDeError(error, 'Enviar el reporte'));
    } finally {
      this.enviando.set(null);
    }
  }

  // ------------------------------------------------------------ ayudas de vista

  protected iniciales(nombre: string): string {
    return nombre.split(/\s+/).slice(0, 2).map((p) => p[0] ?? '').join('').toUpperCase();
  }

  protected textoMotivo(motivo: MotivoReporte): string {
    return MOTIVOS.find((m) => m.valor === motivo)?.texto ?? motivo;
  }

  /** Cambia una reseña de la lista y ajusta «Sin responder» si pasó de respondida a no respondida (o al revés). */
  private reemplazar(actualizada: ResenaDocente): void {
    this.datos.update((d) => {
      if (!d) return d;
      const anterior = d.items.find((r) => r.id === actualizada.id);
      const antes = anterior ? this.respondida(anterior) : false;
      return {
        ...d,
        items: d.items.map((r) => (r.id === actualizada.id ? actualizada : r)),
        resumen: {
          ...d.resumen,
          sinResponder: Math.max(0, d.resumen.sinResponder + (antes ? 1 : 0) - (this.respondida(actualizada) ? 1 : 0)),
        },
      };
    });
  }

  private filtroDeUrl(): Filtro {
    const q = this.ruta.snapshot.queryParamMap;
    const numero = (clave: string) => (q.get(clave) ? Number(q.get(clave)) : undefined);
    const comentario = q.get('comentario');
    const respuesta = q.get('respuesta');
    return {
      pagina: numero('pagina') ?? 1,
      curso: numero('curso'),
      estrellas: numero('estrellas'),
      comentario: comentario === 'con' || comentario === 'sin' ? comentario : undefined,
      respuesta: respuesta === 'respondidas' || respuesta === 'sin-responder' ? respuesta : undefined,
      categoria: q.get('categoria')?.trim() || undefined,
      q: q.get('q')?.trim() || undefined,
    };
  }
}
