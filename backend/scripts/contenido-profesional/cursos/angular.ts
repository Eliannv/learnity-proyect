import type { Curso } from '../tipos.js';

export const angular: Curso = {
  clave: 'angular',
  titulo: 'Angular 21 Avanzado: Signals, Change Detection y Arquitectura Standalone',
  subtitulo: 'Construye aplicaciones Angular reactivas, sin zonas y organizadas por funcionalidades, listas para escalar.',
  descripcion:
    'Curso avanzado para desarrolladores frontend que ya trabajan con Angular. Migramos de NgModules a componentes ' +
    'standalone, dominamos signal, computed, effect y linkedSignal, entendemos a fondo la detección de cambios con OnPush ' +
    'y el modo zoneless, y cerramos con estado, datos remotos con resource y pruebas con Vitest. Cada módulo incluye ' +
    'apuntes con patrones probados en proyectos reales.',
  nivel: 'AVANZADO',
  categoria: 'Programación',
  autor: 'elianguaman145@gmail.com',
  nombreAutor: 'Elián Guamán',
  publicadoHaceDias: 74,
  objetivos: [
    'Organizar una aplicación por funcionalidades con componentes standalone y rutas con carga diferida',
    'Modelar estado local y derivado con signal, computed y linkedSignal',
    'Explicar cómo funciona la detección de cambios con OnPush y sin zone.js',
    'Cargar datos remotos con resource y httpResource manejando carga y errores',
    'Probar componentes y servicios con TestBed y Vitest',
  ],
  requisitos: [
    'Experiencia con Angular 15 o superior y TypeScript',
    'Conocimientos de RxJS básicos (Observable, pipe, switchMap)',
  ],
  modulos: [
    {
      titulo: 'Arquitectura standalone y organización por funcionalidades',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'Angular en 100 segundos (vídeo en inglés)', youtube: 'Ata9cSC2WpM', minutos: 2 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: estructura de una aplicación Angular moderna',
          apunte: {
            archivo: 'arquitectura-standalone-angular.pdf',
            titulo: 'Arquitectura standalone en Angular',
            resumen:
              'Desde Angular 19 los componentes son standalone por defecto. La unidad de organización deja de ser el ' +
              'NgModule y pasa a ser la funcionalidad: sus rutas, páginas, componentes y servicios viven juntos.',
            secciones: [
              {
                titulo: 'Capas de carpetas',
                vinetas: [
                  'core/: servicios únicos de la aplicación (autenticación, interceptores, cliente de API).',
                  'shared/: componentes de interfaz reutilizables sin dependencias de negocio.',
                  'features/<funcionalidad>/: rutas, páginas, componentes y servicios propios.',
                  'Una funcionalidad no importa archivos internos de otra; comparte a través de core o shared.',
                ],
              },
              {
                titulo: 'Arranque sin NgModules',
                parrafos: [
                  'bootstrapApplication(App, appConfig) recibe los proveedores: provideRouter(rutas, withComponentInputBinding()), ' +
                  'provideHttpClient(withInterceptors([...])) y provideZonelessChangeDetection(). Cada ruta puede cargar su ' +
                  'funcionalidad con loadChildren o loadComponent para dividir el bundle.',
                ],
              },
              {
                titulo: 'Guards e inputs desde la ruta',
                vinetas: [
                  'Guards funcionales (CanActivateFn) con inject() en lugar de clases.',
                  'withComponentInputBinding() expone parámetros, query params y data como input() del componente.',
                  'Usa @defer para diferir bloques pesados de la plantilla hasta que sean visibles.',
                ],
              },
            ],
          },
          recursos: [
            {
              archivo: 'checklist-migracion-standalone.pdf',
              titulo: 'Checklist de migración a standalone y zoneless',
              secciones: [
                {
                  titulo: 'Pasos de la migración',
                  vinetas: [
                    'Ejecuta ng generate @angular/core:standalone en sus tres fases y revisa cada diff.',
                    'Sustituye *ngIf y *ngFor por @if y @for con track.',
                    'Convierte @Input y @Output en input(), model() y output().',
                    'Marca los componentes con ChangeDetectionStrategy.OnPush.',
                    'Activa provideZonelessChangeDetection() y elimina zone.js de polyfills.',
                    'Revisa setTimeout y eventos de terceros que dependían de zone.js para refrescar la vista.',
                  ],
                },
              ],
            },
          ],
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación: arquitectura standalone',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: '¿Qué proveedor permite recibir parámetros de ruta como input() del componente?',
              opciones: ['withComponentInputBinding()', 'withHashLocation()', 'provideAnimations()', 'withPreloading()'],
              correcta: 'A',
            },
            {
              enunciado: '¿Dónde debe vivir un componente de botón reutilizable sin lógica de negocio?',
              opciones: ['core/', 'shared/', 'Dentro de cada funcionalidad', 'En app.config.ts'],
              correcta: 'B',
            },
            {
              enunciado: '¿Qué bloque de plantilla difiere la carga de una sección hasta que entra en pantalla?',
              opciones: ['@if', '@switch', '@defer (on viewport)', '@let'],
              correcta: 'C',
            },
          ],
        },
      ],
    },
    {
      titulo: 'Signals a fondo',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'Signals: la guía completa (vídeo en inglés)', youtube: '6W6gycuhiN0', minutos: 30 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: signal, computed, effect y linkedSignal',
          apunte: {
            archivo: 'signals-a-fondo.pdf',
            titulo: 'Signals a fondo',
            secciones: [
              {
                titulo: 'Las primitivas',
                vinetas: [
                  'signal(valor): estado escribible con set() y update().',
                  'computed(() => ...): valor derivado, perezoso y memoizado; se recalcula solo si cambia una dependencia.',
                  'effect(() => ...): efectos secundarios (registro, sincronizar con localStorage); no para derivar estado.',
                  'linkedSignal: estado escribible que se reinicia cuando cambia su fuente (p. ej., la página al cambiar el filtro).',
                ],
              },
              {
                titulo: 'Reglas de oro',
                vinetas: [
                  'Si puedes expresarlo con computed, no uses effect.',
                  'No escribas signals dentro de computed: debe ser una función pura.',
                  'Usa untracked() para leer un signal sin crear dependencia dentro de un effect.',
                  'Expón signals de solo lectura con asReadonly() desde los servicios.',
                ],
              },
              {
                titulo: 'Interoperabilidad con RxJS',
                parrafos: [
                  'toSignal(observable$, { initialValue }) convierte un flujo en signal y gestiona la suscripción con el ciclo de ' +
                  'vida del componente. toObservable(signal) hace lo contrario. RxJS sigue siendo la mejor herramienta para ' +
                  'eventos en el tiempo (debounce, cancelación); los signals, para estado sincrónico.',
                ],
              },
            ],
          },
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación: signals',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: 'Necesitas el total de un carrito a partir de un signal de productos. ¿Qué usas?',
              opciones: ['effect', 'computed', 'Un setInterval', 'ngOnChanges'],
              correcta: 'B',
            },
            {
              enunciado: '¿Qué primitiva reinicia la página a 1 cuando cambia el filtro y aun así permite cambiarla a mano?',
              opciones: ['computed', 'effect', 'linkedSignal', 'toObservable'],
              correcta: 'C',
            },
            {
              enunciado: '¿Para qué sirve untracked() dentro de un effect?',
              opciones: ['Para leer un signal sin crear una dependencia', 'Para cancelar peticiones HTTP', 'Para desactivar OnPush', 'Para escribir en un computed'],
              correcta: 'A',
            },
          ],
        },
      ],
    },
    {
      titulo: 'Detección de cambios: OnPush y zoneless',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'Signals en profundidad de Angular 16 a 20 (vídeo en inglés)', youtube: 'iIc55d5ww5A', minutos: 45 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: cómo decide Angular qué volver a pintar',
          apunte: {
            archivo: 'deteccion-cambios-onpush-zoneless.pdf',
            titulo: 'Detección de cambios: OnPush y zoneless',
            secciones: [
              {
                titulo: 'El modelo clásico con zone.js',
                parrafos: [
                  'zone.js intercepta eventos, temporizadores y promesas y, al terminar cada tarea, Angular recorre el árbol de ' +
                  'componentes comprobando las expresiones de las plantillas. Con la estrategia Default se revisa todo el árbol.',
                ],
              },
              {
                titulo: 'OnPush',
                vinetas: [
                  'Un componente OnPush solo se revisa si cambia la referencia de un input, ocurre un evento en su plantilla, ' +
                  'emite un async pipe o cambia un signal leído en su plantilla.',
                  'Exige inmutabilidad: crea objetos y arrays nuevos en lugar de mutarlos.',
                ],
              },
              {
                titulo: 'Zoneless',
                vinetas: [
                  'provideZonelessChangeDetection() elimina zone.js: menos peso y trazas de error más limpias.',
                  'La vista se programa para refrescar cuando cambia un signal leído en la plantilla, un evento del DOM o markForCheck().',
                  'Código de terceros que muta estado fuera de Angular debe escribir en un signal.',
                ],
              },
              {
                titulo: 'Depuración',
                parrafos: [
                  'Angular DevTools muestra el perfil de detección de cambios por componente. Busca componentes que se revisan ' +
                  'en cada ciclo sin necesidad y conviértelos en OnPush con estado en signals.',
                ],
              },
            ],
          },
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación: detección de cambios',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: 'En un componente OnPush mutas un array con push(). ¿Qué ocurre si la vista depende de ese input?',
              opciones: ['Se actualiza siempre', 'Puede no actualizarse porque la referencia no cambió', 'Angular lanza un error de compilación', 'Se recarga la página'],
              correcta: 'B',
            },
            {
              enunciado: 'Sin zone.js, ¿qué dispara una nueva pasada de detección de cambios?',
              opciones: ['Cualquier setTimeout', 'El cambio de un signal leído en la plantilla', 'Cada petición HTTP aunque no cambie estado', 'Nada, hay que recargar'],
              correcta: 'B',
            },
            {
              enunciado: '¿Qué herramienta permite perfilar la detección de cambios por componente?',
              opciones: ['Lighthouse', 'Angular DevTools', 'ng lint', 'npm audit'],
              correcta: 'B',
            },
          ],
        },
      ],
    },
    {
      titulo: 'Estado, datos remotos y pruebas',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'Curso de Angular moderno: introducción a signals (vídeo en inglés)', youtube: 'j1diBkWLk1k', minutos: 20 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: resource, servicios con estado y Vitest',
          apunte: {
            archivo: 'estado-datos-remotos-pruebas-angular.pdf',
            titulo: 'Estado, datos remotos y pruebas',
            secciones: [
              {
                titulo: 'Servicios con estado basados en signals',
                vinetas: [
                  'Un servicio por agregado de estado, con signals privados y lecturas públicas con asReadonly().',
                  'Métodos con intención (agregarAlCarrito) en lugar de exponer set().',
                  'Para estado global complejo, NgRx SignalStore ofrece la misma idea con herramientas de depuración.',
                ],
              },
              {
                titulo: 'Datos remotos con resource',
                parrafos: [
                  'resource({ params: () => ({ id: this.id() }), loader: ({ params }) => api.obtener(params.id) }) vuelve a ' +
                  'cargar cuando cambian los parámetros y expone value(), isLoading() y error(). httpResource hace lo mismo ' +
                  'sobre HttpClient. Muestra un esqueleto mientras carga y un mensaje accionable si falla.',
                ],
              },
              {
                titulo: 'Pruebas con Vitest',
                vinetas: [
                  'Configura TestBed con provideRouter y dobles de los servicios de API.',
                  'Interactúa como el usuario: busca por texto o rol, dispara eventos y espera con vi.waitFor.',
                  'Verifica lo que el usuario ve, no los detalles internos del componente.',
                ],
              },
            ],
          },
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación final: estado y pruebas',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: '¿Qué expone un resource de Angular para reflejar el estado de la carga?',
              opciones: ['value(), isLoading() y error()', 'Solo una promesa', 'Un Subject', 'Un evento del DOM'],
              correcta: 'A',
            },
            {
              enunciado: '¿Cómo debe exponer un servicio su estado interno basado en signals?',
              opciones: ['Como signals escribibles públicos', 'Como signals de solo lectura con asReadonly()', 'Mediante variables globales', 'Con localStorage'],
              correcta: 'B',
            },
            {
              enunciado: '¿Qué enfoque de prueba resiste mejor los refactors del componente?',
              opciones: ['Comprobar propiedades privadas', 'Contar llamadas a métodos internos', 'Verificar lo que el usuario ve e interactuar como él', 'Hacer snapshots de todo el DOM'],
              correcta: 'C',
            },
          ],
        },
      ],
    },
  ],
};
