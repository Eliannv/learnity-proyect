import { Esqueleto } from '../../../../shared/ui/retroalimentacion/esqueleto';
import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import {
  CatalogoApi,
  type CategoriaPublica,
  type NivelCurso,
  type OrdenCatalogo,
  type PaginaCursos,
} from '../../catalogo.api';
import { BuscadorMovil } from '../../../../shared/ui/navegacion/buscador-movil';
import { Modal } from '../../../../shared/ui/retroalimentacion/modal';
import { TarjetaCurso } from '../../../../shared/ui/cursos/tarjeta-curso';

const LIMITE = 9;
const NIVELES: { valor: NivelCurso; texto: string }[] = [
  { valor: 'PRINCIPIANTE', texto: 'Principiante' },
  { valor: 'INTERMEDIO', texto: 'Intermedio' },
  { valor: 'AVANZADO', texto: 'Avanzado' },
];

@Component({
  selector: 'app-catalogo',
  imports: [Esqueleto, NgTemplateOutlet, LucideAngularModule, TarjetaCurso, Modal, BuscadorMovil],
  templateUrl: './catalogo.html',
  styleUrl: './catalogo.scss',
})
export class Catalogo {
  private readonly router = inject(Router);
  private readonly api = inject(CatalogoApi);
  private solicitud = 0;

  readonly categoria = input<string>();
  readonly q = input<string>();

  protected readonly categorias = signal<CategoriaPublica[]>([]);
  protected readonly categoriasError = signal(false);
  protected readonly seleccion = linkedSignal<string[]>(() =>
    this.categoria() ? [this.categoria()!] : [],
  );
  protected readonly nivelesSel = signal<NivelCurso[]>([]);
  protected readonly niveles = NIVELES;
  protected readonly orden = signal<OrdenCatalogo>('recientes');
  protected readonly pagina = linkedSignal<number>(() => {
    this.q();
    this.seleccion();
    this.nivelesSel();
    this.orden();
    return 1;
  });
  protected readonly filtrosMovil = signal(false);
  protected readonly cargando = signal(true);
  protected readonly error = signal(false);
  protected readonly respuesta = signal<PaginaCursos | null>(null);
  protected readonly reintento = signal(0);
  protected readonly cursos = computed(() => this.respuesta()?.items ?? []);
  protected readonly totalPaginas = computed(() => this.respuesta()?.totalPaginas ?? 0);
  protected readonly resumen = computed(() => {
    const total = this.respuesta()?.total ?? 0;
    const partes = [`${total} ${total === 1 ? 'curso' : 'cursos'}`];
    if (this.seleccion().length) partes.push(`filtrando por ${this.seleccion().join(', ')}`);
    if (this.q()) partes.push(`búsqueda “${this.q()}”`);
    return partes.join(' · ');
  });

  constructor() {
    void this.cargarCategorias();
    effect(() => {
      this.reintento();
      const filtros = {
        q: this.q(),
        categorias: this.seleccion(),
        niveles: this.nivelesSel(),
        orden: this.orden(),
        pagina: this.pagina(),
        limite: LIMITE,
      };
      void this.cargarCursos(filtros);
    });
  }

  private async cargarCategorias() {
    this.categoriasError.set(false);
    try {
      this.categorias.set(await this.api.categorias());
    } catch {
      this.categoriasError.set(true);
    }
  }

  private async cargarCursos(filtros: Parameters<CatalogoApi['catalogo']>[0]) {
    const actual = ++this.solicitud;
    this.cargando.set(true);
    this.error.set(false);
    this.respuesta.set(null);
    try {
      const respuesta = await this.api.catalogo(filtros);
      if (actual === this.solicitud) this.respuesta.set(respuesta);
    } catch {
      if (actual === this.solicitud) this.error.set(true);
    } finally {
      if (actual === this.solicitud) this.cargando.set(false);
    }
  }

  protected reintentar() {
    this.reintento.update((n) => n + 1);
    if (this.categoriasError()) void this.cargarCategorias();
  }

  protected alternar(lista: 'categoria' | 'nivel', valor: string) {
    if (lista === 'categoria') {
      this.seleccion.update((actual) =>
        actual.includes(valor) ? actual.filter((v) => v !== valor) : [...actual, valor],
      );
    } else {
      const nivel = valor as NivelCurso;
      this.nivelesSel.update((actual) =>
        actual.includes(nivel) ? actual.filter((v) => v !== nivel) : [...actual, nivel],
      );
    }
  }

  protected cambiarOrden(valor: string) {
    if (valor === 'recientes' || valor === 'populares' || valor === 'az') this.orden.set(valor);
  }

  protected cambiarPagina(pagina: number) {
    if (pagina >= 1 && pagina <= this.totalPaginas()) {
      this.pagina.set(pagina);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  protected limpiar() {
    this.seleccion.set([]);
    this.nivelesSel.set([]);
    void this.router.navigate(['/cursos']);
  }
}
