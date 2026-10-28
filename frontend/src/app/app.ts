import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Confirmacion } from './shared/ui/confirmacion';
import { Toasts } from './shared/ui/toasts';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toasts, Confirmacion],
  template: '<router-outlet /><app-toasts /><app-confirmacion />',
})
export class App {}
