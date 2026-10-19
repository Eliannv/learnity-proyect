import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { DESTACADOS, INDICADORES_PUBLICOS, RECIENTES } from '../../../data/datos-demo';
import { TarjetaCurso } from '../../../shared/ui/tarjeta-curso';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-inicio',
  imports: [RouterLink, LucideAngularModule, TarjetaCurso],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
})
export class Inicio {
  protected readonly auth = inject(AuthService);
  protected readonly sprint34Habilitado = environment.sprint34Habilitado;
  protected readonly destacados = DESTACADOS;
  protected readonly recientes = RECIENTES;
  protected readonly indicadores = INDICADORES_PUBLICOS;
  protected readonly pasos = [
    { icono: 'search', titulo: 'Busca un tema', texto: 'Explora el catálogo sin cuenta y abre el curso que te sirva.' },
    { icono: 'circle-play', titulo: 'Mira videos cortos', texto: 'Videos cortos y livianos. Tu avance se guarda solo.' },
    { icono: 'list-checks', titulo: 'Rinde evaluaciones', texto: 'Al final de cada módulo. Apruebas con 60 % y puedes reintentar.' },
  ];
}
