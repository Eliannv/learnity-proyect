import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

/** Buscador del catálogo para teléfonos (en escritorio está dentro del header). */
@Component({
  selector: 'app-buscador-movil',
  imports: [LucideAngularModule],
  template: `
    <form class="buscador solo-movil" (submit)="buscar($event, termino.value)" role="search">
      <lucide-icon name="search" [size]="18" />
      <input #termino type="search" [value]="valor()" placeholder="Busca por tema o palabra clave…" aria-label="Buscar cursos" />
      <button type="submit" class="btn btn-primario btn-sm">Buscar</button>
    </form>
  `,
  styles: `
    .buscador {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 12px 16px 0;
      padding: 4px 4px 4px 14px;
      border: 1px solid var(--azul-200);
      border-radius: 999px;
      color: var(--gris-500);
    }
    input {
      flex: 1;
      min-width: 0;
      border: 0;
      outline: none;
      background: transparent;
    }
    .btn {
      border-radius: 999px;
    }
  `,
})
export class BuscadorMovil {
  private readonly router = inject(Router);
  readonly valor = input('');

  protected buscar(evento: Event, termino: string) {
    evento.preventDefault();
    void this.router.navigate(['/cursos'], { queryParams: termino.trim() ? { q: termino.trim() } : {} });
  }
}
