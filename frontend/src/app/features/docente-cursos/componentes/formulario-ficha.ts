import { Component, input, output } from '@angular/core';
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

  protected errorCampo(nombre: string): string {
    const servidor = this.errores()[nombre];
    if (servidor) return servidor;
    const control = this.form().get(nombre);
    if (!control?.touched || !control.errors) return '';
    if (nombre === 'categoriaId') return 'Selecciona una categoría.';
    return 'Completa este campo.';
  }
}
