import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import { ICONOS } from '../marca/iconos';
import { BuscadorCurso, type OpcionCursoBusqueda } from './buscador-curso';

const CURSOS_PRUEBA: OpcionCursoBusqueda[] = [
  { id: 1, titulo: 'Álgebra inicial', subtitulo: 'Matemáticas' },
  { id: 2, titulo: 'Cálculo avanzado', subtitulo: 'Matemáticas' },
  { id: 3, titulo: 'Diseño de interfaces', subtitulo: 'Diseño' },
];

@Component({
  imports: [BuscadorCurso],
  template: `
    <app-buscador-curso
      idCampo="test-buscador"
      [cursos]="cursos()"
      [cursoId]="cursoId()"
      [permitirTodos]="true"
      textoTodos="Todos mis cursos"
      (seleccion)="cursoId.set($event)"
      (cursoSeleccionado)="seleccionado.set($event)"
    />
  `,
})
class HostComponent {
  readonly cursos = signal<OpcionCursoBusqueda[]>(CURSOS_PRUEBA);
  readonly cursoId = signal<number | null>(null);
  readonly seleccionado = signal<OpcionCursoBusqueda | null>(null);
}

describe('BuscadorCurso', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) },
      ],
    }).compileComponents();
  });

  it('no muestra lista previa al enfocar y solo despliega al escribir una búsqueda', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input#test-buscador') as HTMLInputElement;
    expect(input).toBeTruthy();
    // Por defecto sin selección muestra el placeholder de "Todos mis cursos"
    expect(input.placeholder).toBe('Todos mis cursos');

    // Enfocar sin escribir NO abre el desplegable (no hay lista previa)
    input.focus();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.desplegable-sugerencias')).toBeNull();

    // Al escribir un término aparecen únicamente los cursos coincidentes (sin opción "Todos los cursos")
    input.value = 'algeb';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    const opciones = fixture.nativeElement.querySelectorAll('.lista-opciones li');
    expect(opciones.length).toBe(1);
    expect(opciones[0].textContent).toContain('Álgebra inicial');
    expect(opciones[0].textContent).not.toContain('Todos mis cursos');

    // Navegar con flecha abajo
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();

    const activo = fixture.nativeElement.querySelector('.lista-opciones li.activo');
    expect(activo?.textContent).toContain('Álgebra inicial');

    // Presionar Enter para elegir
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.cursoId()).toBe(1);
    expect(fixture.componentInstance.seleccionado()?.titulo).toBe('Álgebra inicial');
    expect(input.value).toBe('Álgebra inicial');

    // Al elegir se cierra el desplegable
    expect(fixture.nativeElement.querySelector('.desplegable-sugerencias')).toBeNull();
  });

  it('filtra por texto ignorando mayúsculas y acentos y limpia con el botón X para volver al valor por defecto', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input#test-buscador') as HTMLInputElement;

    // Escribir "calculo" sin acento
    input.focus();
    input.value = 'calculo';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    const opciones = fixture.nativeElement.querySelectorAll('.lista-opciones li');
    expect(opciones.length).toBe(1);
    expect(opciones[0].textContent).toContain('Cálculo avanzado');

    // Presionar Enter selecciona la única coincidencia
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.cursoId()).toBe(2);

    // Botón limpiar X restablece a null (todos los cursos por defecto)
    const btnLimpiar = fixture.nativeElement.querySelector('.btn-limpiar') as HTMLButtonElement;
    expect(btnLimpiar).toBeTruthy();
    btnLimpiar.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.cursoId()).toBeNull();
    expect(input.value).toBe('');
    expect(input.placeholder).toBe('Todos mis cursos');
  });
});
