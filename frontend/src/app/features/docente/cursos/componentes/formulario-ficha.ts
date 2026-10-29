import { Component, input, output, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import type { CategoriaPublica, CursoDetalle } from '../../../core/api/contrato';

@Component({
  selector: 'app-formulario-ficha',
  imports: [ReactiveFormsModule],
  templateUrl: './formulario-ficha.html',
  styleUrl: './formulario-ficha.scss',
})
export class FormularioFicha {
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

  protected readonly errorCargaPortada = signal(false);
  protected readonly portadaCargada = signal(false);

  protected onUrlPortadaInput(): void {
    this.errorCargaPortada.set(false);
    this.portadaCargada.set(false);
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
        return 'Ingresa una URL de imagen válida (máx. 255 caracteres).';
      default:
        return 'Completa este campo.';
    }
  }
}
