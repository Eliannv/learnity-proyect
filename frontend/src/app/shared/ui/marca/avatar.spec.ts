import { TestBed } from '@angular/core/testing';
import { Avatar } from './avatar';

describe('Avatar', () => {
  it('muestra el texto recibido', () => {
    const f = TestBed.createComponent(Avatar);
    f.componentRef.setInput('texto', 'AB');
    f.detectChanges();
    expect(f.nativeElement.querySelector('.avatar').textContent).toContain('AB');
  });
});
