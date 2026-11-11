import { Esqueleto } from '../../../../shared/ui/retroalimentacion/esqueleto';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { metaCurso } from '../../../../shared/ui/cursos/formato-curso';
import { TarjetaCurso } from '../../../../shared/ui/cursos/tarjeta-curso';
import type { Tono } from '../../../../shared/ui/tipos-ui';
import {
  CatalogoApi,
  type CursoPublico,
} from '../../catalogo.api';

@Component({
  selector: 'app-inicio',
  imports: [Esqueleto, RouterLink, TarjetaCurso],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
})
export class Inicio {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(CatalogoApi);

  protected readonly destacados = signal<CursoPublico[]>([]);
  protected readonly recientes = signal<CursoPublico[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal(false);

  constructor() {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(false);
    try {
      const [populares, recientes] = await Promise.all([
        this.api.listar({ orden: 'populares', limite: 4 }),
        this.api.listar({ orden: 'recientes', limite: 4 }),
      ]);
      this.destacados.set(populares.items.slice(0, 4));
      this.recientes.set(recientes.items.slice(0, 4));
    } catch {
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  protected readonly meta = (c: CursoPublico) => metaCurso(c);

  protected tonoDe(categoriaId: number): Tono {
    return categoriaId % 3 === 0 ? 3 : categoriaId % 3 === 1 ? 1 : 2;
  }
}
