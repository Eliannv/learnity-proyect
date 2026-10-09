import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { CATEGORIAS, CURSOS } from '../../../data/datos-demo';
import { BuscadorMovil } from '../../../shared/ui/buscador-movil';
import { Modal } from '../../../shared/ui/modal';
import { TarjetaCurso } from '../../../shared/ui/tarjeta-curso';

/** Total de cursos por categoría del prototipo (datos de demostración). */
const TOTAL_POR_CATEGORIA: Record<string, number> = {
  Programación: 8,
  Diseño: 6,
  Idiomas: 5,
  Negocios: 4,
  Ofimática: 4,
  Marketing: 7,
};

@Component({
  selector: 'app-catalogo',
  imports: [NgTemplateOutlet, LucideAngularModule, TarjetaCurso, Modal, BuscadorMovil],
  templateUrl: './catalogo.html',
  styleUrl: './catalogo.scss',
})
export class Catalogo {
  private readonly router = inject(Router);

  /** Parámetros de la URL: /cursos?categoria=Diseño&q=python */
  readonly categoria = input<string>();
  readonly q = input<string>();

  protected readonly categorias = CATEGORIAS;
  protected readonly totales = TOTAL_POR_CATEGORIA;
  protected readonly niveles = ['Principiante', 'Intermedio'] as const;

  protected readonly seleccion = linkedSignal<string[]>(() => (this.categoria() ? [this.categoria()!] : []));
  protected readonly nivelesSel = signal<string[]>([]);
  protected readonly orden = signal('recientes');
  protected readonly filtrosMovil = signal(false);

  protected readonly cursos = computed(() => {
    const termino = (this.q() ?? '').toLowerCase();
    const lista = CURSOS.filter(
      (c) =>
        (this.seleccion().length === 0 || this.seleccion().includes(c.categoria)) &&
        (this.nivelesSel().length === 0 || this.nivelesSel().includes(c.nivel)) &&
        (!termino || c.titulo.toLowerCase().includes(termino)),
    );
    return this.orden() === 'az' ? [...lista].sort((a, b) => a.titulo.localeCompare(b.titulo)) : lista;
  });

  protected readonly resumen = computed(() => {
    const total = this.cursos().length;
    const partes = [`${total} ${total === 1 ? 'curso' : 'cursos'}`];
    if (this.seleccion().length) partes.push(`filtrando por ${this.seleccion().join(', ')}`);
    if (this.q()) partes.push(`búsqueda “${this.q()}”`);
    return partes.join(' · ');
  });

  protected alternar(lista: 'categoria' | 'nivel', valor: string) {
    const objetivo = lista === 'categoria' ? this.seleccion : this.nivelesSel;
    objetivo.update((actual) => (actual.includes(valor) ? actual.filter((v) => v !== valor) : [...actual, valor]));
  }

  protected limpiar() {
    this.seleccion.set([]);
    this.nivelesSel.set([]);
    void this.router.navigate(['/cursos']);
  }

}
