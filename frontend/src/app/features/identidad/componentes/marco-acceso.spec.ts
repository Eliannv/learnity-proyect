import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import { ICONOS } from '../../../shared/ui/iconos';
import { MarcoAcceso } from './marco-acceso';

describe('MarcoAcceso', () => {
  it('renderiza un único landmark main', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) }] });
    const f = TestBed.createComponent(MarcoAcceso);
    f.componentRef.setInput('tituloAntes', 'Aprende');
    f.componentRef.setInput('tituloResaltado', 'mejor');
    f.componentRef.setInput('descripcion', 'Texto');
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('main').length).toBe(1);
  });
});
