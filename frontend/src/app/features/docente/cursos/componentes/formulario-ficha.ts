import { LucideAngularModule } from 'lucide-angular';
import { Component, inject, input, output, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import type { CategoriaPublica, CursoDetalle } from '../../../../core/api/contrato';
import { mensajeDeError } from '../../../../core/http/error-api';
import { Modal } from '../../../../shared/ui/retroalimentacion/modal';
import { RecortadorFoto } from '../../../../shared/ui/recortador/recortador-foto';
import { ToastService } from '../../../../shared/ui/retroalimentacion/toast.service';
import { DocenteCursosApi } from '../cursos.api';

const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PORTADA_BYTES = 15 * 1024 * 1024;

@Component({
  selector: 'app-formulario-ficha',
  imports: [ReactiveFormsModule, LucideAngularModule, Modal, RecortadorFoto],
  templateUrl: './formulario-ficha.html',
  styleUrl: './formulario-ficha.scss',
})
export class FormularioFicha {
  private readonly cursosApi = inject(DocenteCursosApi, { optional: true });
  private readonly toast = inject(ToastService, { optional: true });

  readonly form = input.required<FormGroup>();
  readonly curso = input<CursoDetalle | null>(null);
  readonly categorias = input<CategoriaPublica[]>([]);
  readonly editable = input(false);
  readonly deshabilitado = input(false);
  readonly guardando = input(false);
  readonly errores = input<Record<string, string>>({});

  readonly guardar = output<void>();
  readonly cambio = output<void>();
  readonly continuar = output<void>();

  protected readonly modoPortada = signal<'archivo' | 'url'>('url');
  protected readonly archivoPortada = signal<File | null>(null);
  protected readonly recorteListo = signal(false);
  protected readonly subiendoPortada = signal(false);
  protected readonly errorSubidaPortada = signal('');
  protected readonly errorCargaPortada = signal(false);
  protected readonly portadaCargada = signal(false);

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
      this.cambio.emit();
      this.toast?.exito('Imagen de portada lista. Guarda los cambios del curso para aplicarla.');
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
