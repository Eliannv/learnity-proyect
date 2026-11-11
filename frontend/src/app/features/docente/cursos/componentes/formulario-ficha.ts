import { LucideAngularModule } from 'lucide-angular';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import type { CategoriaPublica, CursoDetalle } from '../../../../core/api/contrato';
import { mensajeDeError } from '../../../../core/http/error-api';
import { SolicitudesDocenteService } from '../../../../core/solicitudes/solicitudes-docente.service';
import { BuscadorCurso, type OpcionCursoBusqueda } from '../../../../shared/ui/cursos/buscador-curso';
import { InfoAyuda } from '../../../../shared/ui/retroalimentacion/info-ayuda';
import { Modal } from '../../../../shared/ui/retroalimentacion/modal';
import { RecortadorFoto } from '../../../../shared/ui/recortador/recortador-foto';
import { ToastService } from '../../../../shared/ui/retroalimentacion/toast.service';
import { DocenteCursosApi } from '../cursos.api';

const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PORTADA_BYTES = 15 * 1024 * 1024;

@Component({
  selector: 'app-formulario-ficha',
  imports: [ReactiveFormsModule, FormsModule, LucideAngularModule, InfoAyuda, Modal, RecortadorFoto, BuscadorCurso],
  templateUrl: './formulario-ficha.html',
  styleUrl: './formulario-ficha.scss',
})
export class FormularioFicha {
  private readonly cursosApi = inject(DocenteCursosApi, { optional: true });
  private readonly solicitudes = inject(SolicitudesDocenteService, { optional: true });
  private readonly toast = inject(ToastService, { optional: true });

  readonly form = input.required<FormGroup>();
  readonly curso = input<CursoDetalle | null>(null);
  readonly categorias = input<CategoriaPublica[]>([]);
  readonly especialidadDocente = input<string | null>(null);
  readonly editable = input(false);
  readonly deshabilitado = input(false);
  readonly guardando = input(false);
  readonly errores = input<Record<string, string>>({});

  readonly guardar = output<void>();
  readonly cambio = output<void>();
  /** La portada ya está subida y puesta en el formulario: el editor la guarda en el curso al momento. */
  readonly portadaSubida = output<void>();
  readonly continuar = output<void>();

  protected readonly modoPortada = signal<'archivo' | 'url'>('url');
  protected readonly archivoPortada = signal<File | null>(null);
  protected readonly recorteListo = signal(false);
  protected readonly subiendoPortada = signal(false);
  protected readonly errorSubidaPortada = signal('');
  protected readonly errorCargaPortada = signal(false);
  protected readonly portadaCargada = signal(false);

  protected readonly modalEspecialidadAbierto = signal(false);
  protected readonly categoriaEspecialidadId = signal<number | null>(null);
  protected readonly especialidadElegida = signal('');
  protected motivoEspecialidad = '';
  protected readonly enviandoEspecialidad = signal(false);
  protected readonly errorEspecialidad = signal('');

  protected readonly categoriasOpciones = computed<OpcionCursoBusqueda[]>(() =>
    this.categorias().map((c) => ({ id: c.id, titulo: c.nombre, iconoCategoria: c.icono })),
  );

  protected esCategoriaEspecialidad(nombre: string): boolean {
    const esp = this.especialidadDocente()?.trim().toLowerCase();
    return Boolean(esp && (nombre.toLowerCase() === esp || esp.includes(nombre.toLowerCase())));
  }

  protected abrirModalEspecialidad(): void {
    this.errorEspecialidad.set('');
    this.categoriaEspecialidadId.set(null);
    this.especialidadElegida.set('');
    this.motivoEspecialidad = '';
    this.modalEspecialidadAbierto.set(true);
  }

  protected cerrarModalEspecialidad(): void {
    if (this.enviandoEspecialidad()) return;
    this.modalEspecialidadAbierto.set(false);
  }

  protected alElegirCategoriaEspecialidad(op: OpcionCursoBusqueda | null): void {
    this.categoriaEspecialidadId.set(op?.id ?? null);
    this.especialidadElegida.set(op?.titulo ?? '');
  }

  protected alEscribirEspecialidad(texto: string): void {
    const limpio = texto.trim();
    if (limpio) {
      this.categoriaEspecialidadId.set(null);
      this.especialidadElegida.set(limpio);
    } else if (this.categoriaEspecialidadId() === null) {
      this.especialidadElegida.set('');
    }
  }

  protected async enviarSolicitudEspecialidad(): Promise<void> {
    if (!this.solicitudes || this.enviandoEspecialidad()) return;
    const esp = this.especialidadElegida().trim();
    const motivo = this.motivoEspecialidad.trim();
    if (esp.length < 3) {
      this.errorEspecialidad.set('Selecciona o escribe una categoría (mínimo 3 caracteres).');
      return;
    }
    if (motivo.length < 20) {
      this.errorEspecialidad.set('Explica brevemente tu experiencia en esta especialidad (mínimo 20 caracteres).');
      return;
    }
    this.enviandoEspecialidad.set(true);
    this.errorEspecialidad.set('');
    try {
      await this.solicitudes.solicitarEspecialidad(esp, motivo);
      this.modalEspecialidadAbierto.set(false);
      this.toast?.exito(`Solicitud de especialidad «${esp}» enviada a revisión.`);
    } catch (error) {
      this.errorEspecialidad.set(mensajeDeError(error, 'Solicitar la especialidad'));
    } finally {
      this.enviandoEspecialidad.set(false);
    }
  }

  protected onUrlPortadaInput(): void {
    this.errorCargaPortada.set(false);
    this.portadaCargada.set(false);
  }

  protected elegirArchivoPortada(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo) return;
    if (!TIPOS_IMAGEN.includes(archivo.type)) {
      this.errorSubidaPortada.set(`«${archivo.name}» no es JPG, PNG ni WebP.`);
      return;
    }
    if (archivo.size > MAX_PORTADA_BYTES) {
      this.errorSubidaPortada.set(`«${archivo.name}» supera el máximo de 15 MB.`);
      return;
    }
    this.errorSubidaPortada.set('');
    this.recorteListo.set(false);
    this.archivoPortada.set(archivo);
  }

  protected descartarRecortePortada(): void {
    if (this.subiendoPortada()) return;
    this.archivoPortada.set(null);
    this.errorSubidaPortada.set('');
  }

  protected async guardarRecortePortada(recortador: RecortadorFoto): Promise<void> {
    if (!this.cursosApi) return;
    this.subiendoPortada.set(true);
    this.errorSubidaPortada.set('');
    try {
      const recorte = await recortador.recortar();
      if (!recorte) throw new Error('recorte');
      const url = await this.cursosApi.subirPortada(recorte);
      const control = this.form().get('portadaUrl');
      control?.setValue(url);
      control?.markAsDirty();
      control?.markAsTouched();
      this.errorCargaPortada.set(false);
      this.portadaCargada.set(true);
      this.archivoPortada.set(null);
      if (this.curso()) {
        // Curso existente: el editor guarda la ficha enseguida y el temario no queda bloqueado.
        this.portadaSubida.emit();
      } else {
        this.cambio.emit();
        this.toast?.exito('Imagen de portada lista. Se guardará al crear el curso.');
      }
    } catch (error) {
      this.errorSubidaPortada.set(mensajeDeError(error, 'Subir la portada'));
    } finally {
      this.subiendoPortada.set(false);
    }
  }

  protected contarLineas(texto: unknown): number {
    if (typeof texto !== 'string') return 0;
    return texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).length;
  }

  protected longitud(nombre: string): number {
    const valor = this.form().get(nombre)?.value;
    return typeof valor === 'string' ? valor.length : 0;
  }

  protected errorCampo(nombre: string): string {
    const servidor = this.errores()[nombre];
    if (servidor) return servidor;
    const control = this.form().get(nombre);
    if (!control?.touched || !control.errors) return '';
    switch (nombre) {
      case 'titulo':
        return 'El título es obligatorio y debe tener como máximo 150 caracteres.';
      case 'subtitulo':
        return 'El subtítulo no puede superar los 200 caracteres.';
      case 'descripcion':
        return 'La descripción no puede superar los 10 000 caracteres.';
      case 'categoriaId':
        return 'Selecciona una categoría.';
      case 'nivel':
        return 'Selecciona un nivel de dificultad.';
      case 'portadaUrl':
        return 'Ingresa una URL o ruta de imagen válida (máx. 255 caracteres).';
      default:
        return 'Completa este campo.';
    }
  }
}
