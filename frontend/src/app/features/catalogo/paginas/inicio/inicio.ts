import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { BuscadorMovil } from '../../../../shared/ui/buscador-movil';
import { TarjetaCurso } from '../../../../shared/ui/tarjeta-curso';
import { ICONO_CATEGORIA, type Tono } from '../../../../shared/ui/tipos-ui';
import {
  CatalogoApi,
  type CategoriaPublica,
  type CursoPublico,
} from '../../catalogo.api';

@Component({
  selector: 'app-inicio',
  imports: [RouterLink, LucideAngularModule, TarjetaCurso, BuscadorMovil],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
})
export class Inicio {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(CatalogoApi);

  protected readonly categorias = signal<CategoriaPublica[]>([]);
  protected readonly destacados = signal<CursoPublico[]>([]);
  protected readonly recientes = signal<CursoPublico[]>([]);
  protected readonly totalCursos = signal(0);
  protected readonly cargando = signal(true);
  protected readonly error = signal(false);
  protected readonly iconos = ICONO_CATEGORIA;

  protected readonly indicadores = computed(() => [
    { valor: String(this.totalCursos()), etiqueta: 'Cursos disponibles' },
    { valor: String(this.categorias().length), etiqueta: 'Categorías activas' },
    { valor: '100%', etiqueta: 'A tu ritmo' },
    { valor: 'PDF', etiqueta: 'Material descargable' },
  ]);

  constructor() {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(false);
    try {
      const [categorias, populares, recientes] = await Promise.all([
        this.api.categorias(),
        this.api.listar({ orden: 'populares', limite: 4 }),
        this.api.listar({ orden: 'recientes', limite: 4 }),
      ]);
      this.categorias.set(categorias);
      this.destacados.set(populares.items.slice(0, 4));
      this.recientes.set(recientes.items.slice(0, 4));
      this.totalCursos.set(populares.total);
    } catch {
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  protected tonoDe(categoriaId: number): Tono {
    return categoriaId % 3 === 0 ? 3 : categoriaId % 3 === 1 ? 1 : 2;
  }
}
