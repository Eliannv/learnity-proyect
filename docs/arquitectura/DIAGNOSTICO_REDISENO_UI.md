# Diagnóstico y plan de rediseño UI/UX de Learnity (referencia: Udemy)

- **Fecha:** 2026-10-30 · **Fase:** 1, auditoría y propuesta. No se ha modificado código.
- **Rama:** `sprint4/elian-panel-admin` (HEAD `b6abfb6`).
- **Skills aplicadas, en este orden:**
  1. `design-taste-frontend`, que es Taste Skill v2. El repositorio ya no publica `redesign-skill` aparte: su modo «rediseño o revisión de una pantalla existente» está dentro de esta skill.
  2. `web-design-guidelines` (Vercel): directrices descargadas hoy de `vercel-labs/web-interface-guidelines`.
  3. `apple-design` (Emil Kowalski): solo la parte de movimiento.

## 0. Cómo se hizo

| Paso | Herramienta | Resultado |
|---|---|---|
| Capturas del «antes» | Prueba Playwright temporal contra `learnity_test`. Prepara 4 cursos publicados (2 módulos, lecciones PDF, reseñas, progreso) y un borrador, y fotografía 22 vistas a 1440 y a 390 px. La prueba no se commitea. | 43 capturas en `scratchpad/antes/`; el apéndice A da la ruta completa |
| Linter de Taste | `lint.mjs frontend/src` | **131 FAIL, 116 WARN** (detalle en §1.3) |
| Repartidor de Taste | `draw.mjs --app --kind creator` y `draw.mjs --sector education` | Estilo de aplicación **`accent-ladder`** (semilla 924416548). Las direcciones de página se descartan (§2.1) |
| Directrices de Vercel | Lectura de `styles.scss`, `shared/estilos/cursos.scss`, `layouts/**`, `shared/ui/**` y las vistas principales, y búsqueda dirigida | Hallazgos `archivo:línea` en §1.2 |
| Contraste | Cálculo WCAG de cada par de tokens propuesto | Todos ≥ 4,5:1 en texto y ≥ 3:1 en gráficos y bordes de control (§2.2) |

**Aviso de los datos de prueba:** los nombres de categoría y de docente llevan el prefijo de la marca E2E (`e2e_1793374045934_6j1gvz …`), mucho más largo que un nombre real. Eso exagera algunos desbordes, pero no los inventa: un nombre largo real produce lo mismo, y la causa está en el CSS (§1.1, H1).

---

## 1. Hallazgos

### 1.1 Lo que se ve en las capturas (los que más pesan primero)

| # | Hallazgo | Dónde se ve | Causa en el código |
|---|---|---|---|
| H1 | **Scroll horizontal en escritorio.** A 1440 px, las rejillas de cursos del inicio llegan a 1856 px y las del catálogo a 1478 px. La última tarjeta queda fuera de la página | `01-inicio-visitante`, `02-catalogo` | `features/catalogo/paginas/inicio/inicio.scss:65`, `:77` y `catalogo/catalogo.scss:65` usan `repeat(n, 1fr)`. `1fr` vale `minmax(auto, 1fr)` y el chip de categoría no se parte (`styles.scss:333` `.chip`), así que un nombre largo ensancha la columna. Hay que usar `minmax(0, 1fr)` y truncar el chip |
| H2 | **Nada de cifras tabulares.** En toda la app solo `shared/ui/datos/grafico-echarts.ts:219` usa `tabular-nums`. Duraciones, contadores, KPI, fechas en tablas, «4,5», «50 %» y «1/5 lecciones» bailan de ancho | Todas las vistas con números | Falta un `.num` / `font-variant-numeric` global |
| H3 | **El panel tiene un riel oscuro de iconos sin etiqueta con 11 destinos.** Taste lo prohíbe en pantallas de aplicación: un menú lateral oscuro sobre lienzo claro, y un riel sin etiquetas solo es aceptable con 5 destinos o menos | `10-docente-cursos`, `15/16-admin-*` | `layouts/panel/layout-panel.html:1`; `layout-panel.scss:39` (fondo `--tinta-900`), `:103-105` (barra izquierda de acento), `:19` (`transition: width`, que anima una propiedad de layout) |
| H4 | **El pie de página del sitio aparece dentro de los paneles.** Una pantalla de trabajo termina en un bloque de marketing azul marino | `10`, `15`, `16` | `layouts/panel/layout-panel.html:49` |
| H5 | **Títulos de landing en pantallas de trabajo:** «Mis cursos», «Usuarios», «Resumen» y «Reseñas» a 40px/800. Taste fija entre 18 y 32 px para pantallas de aplicación | Paneles | `styles.scss:177-182` (`.titulo-pagina` a 40px/800) |
| H6 | **Dos acentos compiten:** el azul (enlaces, botones, pestañas) y el ámbar (CTA del hero, «Inscribirme gratis», «Nuevo curso»). Además, el azul aparece relleno en botones, filtros activos y en tres botones de ancho completo seguidos en «Mi aprendizaje» | `01`, `03`, `07`, `10` | `styles.scss:254-268` (`.btn-primario` y `.btn-acento`). Falta además `--morado-600` violeta en `styles.scss:40` |
| H7 | **Etiquetas pequeñas en mayúsculas con espaciado (eyebrows)** encima de títulos y en cabeceras: «APRENDIZAJE EN LÍNEA», «NOVEDADES», «FILTRAR», cabeceras de tabla, estados de curso y títulos del pie | `01`, `02`, `16`, pie | `styles.scss:195-200` (`.eyebrow`), `:375-378` (`.estado`), `:629-632` (`th`), `layouts/comun/footer-sitio.ts:78-79`; `inicio.html:9`, `:25`, `:95`; `catalogo.html:32` |
| H8 | **Cabecera de tabla con banda azul** y texto en mayúsculas espaciadas (en pantallas de trabajo: sin banda, minúscula de frase, 12px gris) | `16-admin-usuarios` | `styles.scss:626` (`background: var(--azul-050)`) |
| H9 | **Tarjeta de curso poco densa y con la jerarquía invertida:** el chip de categoría encabeza la tarjeta, no hay valoración, la duración «0 min» se imprime aunque sea cero, el título no tiene un recorte fijo y las tarjetas de una fila acaban a alturas distintas | `01`, `02` | `shared/ui/cursos/tarjeta-curso.ts:23-34` (chip primero, sin estrellas), `:71-76` (título sin `line-clamp`), `:51-54` (la sombra al pasar el ratón es el único estado) |
| H10 | **Banda de cifras inventada en el inicio:** «100 % A tu ritmo» y «PDF Material descargable» no son métricas. Además, «Cómo funciona» usa tarjetas numeradas 1./2./3. con icono, un patrón de plantilla | `01` | `inicio.html:133-145` y la banda de estadísticas anterior |
| H11 | **La ficha del curso no tiene cabecera destacada.** El título se apoya sobre el blanco, la tarjeta lateral repite la portada y queda pobre («Curso gratuito.» y un botón), y no hay lista de «Este curso incluye» | `03-ficha-visitante` | `catalogo/paginas/detalle-curso/detalle-curso.scss:3` (rejilla `1fr 340px`), `:172` (sticky) |
| H12 | **En el móvil, la barra inferior tapa el botón «Inscribirme gratis»** al desplazarse, y no hay barra de compra fija | `03-ficha-visitante-movil` (la barra aparece encima del botón) | No existe una barra inferior con el CTA en la ficha |
| H13 | **El aula repite las reseñas completas debajo del visor** y las tarjetas de información desbordan su texto (Docente y Categoría se salen de la caja). Hay `transition: all` y `100vh` | `08-aula` | `aprendizaje/paginas/seguimiento-curso/seguimiento-curso.scss:112`, `:160`, `:179`, `:462` (`transition: all`), `:326-327` (`100vh`) |
| H14 | **Los filtros de «Mis cursos» del docente son seis botones con contorno azul** del mismo peso, y las portadas miden 260 px de alto en dos columnas. La lista se lee como un álbum, no como una herramienta | `10-docente-cursos` | `features/docente/cursos/componentes/listado-cursos.*`; `.estado` en mayúsculas y verde saturado (`styles.scss:370-401`) |
| H15 | **«Usuarios» recorta la columna de acciones a 1440 px** («Editar roles» se corta) y los chips de rol se apilan en dos líneas | `16-admin-usuarios` | La tabla no reserva ancho para la acción ni trunca el correo; `styles.scss:613-640` |
| H16 | **«Resumen»: las tarjetas de una fila no terminan juntas.** «Satisfacción» queda con una franja vacía bajo «Ver reseñas» (`ragged-row` / `panel-void` en Taste) | `15-admin-resumen` | `features/admin/resumen/paginas/resumen/resumen.scss` |
| H17 | **El modal tiene un icono blanco sobre un cuadrado azul relleno** (prohibido por Taste), un contador de caracteres en píldora ámbar y aparece y desaparece en seco | `22-modal-escritorio` | `shared/ui/retroalimentacion/modal.ts:67-75`; sin animación de entrada ni de salida |
| H18 | **«Mi aprendizaje»: el subtítulo toca el borde inferior de la banda oscura** y el h1 está a 44px | `07-mi-aprendizaje` | `aprendizaje/paginas/mi-aprendizaje/mi-aprendizaje.scss:8` |
| H19 | **Tipografía por defecto:** Inter cargada desde Google Fonts. El linter lo marca como la cara por defecto del kit. Además, el cuerpo a 15px no encaja en la escala de 14/16 | Global | `frontend/src/index.html:13`; `styles.scss:89` |

### 1.2 Directrices de Vercel (`archivo:línea`)

Solo lo que incumple. La regla de Vercel de poner los encabezados en mayúscula inicial en cada palabra (*Title Case*) **no aplica**: es una norma del inglés y en español se usa la minúscula de frase. Además, los textos no se cambian porque los usa la E2E.

```text
## frontend/src/styles.scss
styles.scss:89    - cuerpo a 15px; escala 14/16 (sitio 16, paneles 14)
styles.scss:142   - prefers-reduced-motion global a 0.01ms: cortar no es una alternativa; dar fundidos por componente
styles.scss:178   - .titulo-pagina 40px/800: tamaño de landing en pantallas de trabajo
styles.scss:195   - .eyebrow: mayúsculas con espaciado de 0.12em
styles.scss:228   - .btn sin estado :active (sin respuesta al pulsar)
styles.scss:249   - .btn:disabled opacity .45: ilegible y no dice por qué está deshabilitado
styles.scss:262   - .btn-acento: segundo acento (ámbar) en acciones
styles.scss:375   - .estado: mayúsculas con espaciado
styles.scss:499   - .control:focus con box-shadow además de :focus-visible: doble anillo al hacer clic
styles.scss:626   - th con banda de fondo y mayúsculas espaciadas
styles.scss:686   - .esqueleto: brillo con degradado infinito
falta             - .num { font-variant-numeric: tabular-nums } y alineación a la derecha de números en tablas
falta             - text-wrap: balance en h1/h2 (en las capturas hay títulos de dos líneas con viuda)
falta             - touch-action: manipulation en botones y enlaces; -webkit-tap-highlight-color decidido

## frontend/src/index.html
index.html:13     - fuente sin <link rel="preload"> ni preconnect a fonts.gstatic.com verificado

## shared/ui/cursos/tarjeta-curso.ts
tarjeta-curso.ts:24 - chip de categoría sin truncar (desborda la rejilla, H1)
tarjeta-curso.ts:30 - título sin line-clamp: alturas de tarjeta distintas
tarjeta-curso.ts:34 - meta sin truncado; imprime «0 min»
tarjeta-curso.ts:51 - estado hover solo con box-shadow (pintado); sin :focus-within ni :active

## shared/ui/cursos/portada-curso.ts
portada-curso.ts:16 - <img> sin width/height (salto de layout)
portada-curso.ts:38 - radial-gradient decorativo
portada-curso.ts:51 - radial-gradient decorativo

## shared/ui/datos/estrellas.ts
estrellas.ts:11   - estrellas con el carácter ★: dependen de la fuente de reserva; usar SVG
estrellas.ts:27   - color fijo #b4690e en lugar de un token

## shared/ui/datos/indicador.ts
indicador.ts:45   - valor a 34px sin tabular-nums

## shared/ui/retroalimentacion/modal.ts
modal.ts:44       - .panel sin overscroll-behavior: contain
modal.ts:67       - icono en un cuadrado de color relleno
modal.ts          - sin animación de entrada y salida; en el móvil la hoja no sale ni entra desde abajo

## shared/ui/retroalimentacion/toasts.ts
toasts.ts:50      - solo animación de entrada; la salida es seca
toasts.ts:71      - en el móvil se muestran arriba pero entran subiendo desde abajo (camino incoherente)

## shared/ui/retroalimentacion/estado-vista.ts
estado-vista.ts:80 - spinner infinito; preferir una barra de esqueleto con el tamaño final

## layouts/panel/layout-panel.scss
layout-panel.scss:19  - transition: width (layout); el riel se ensancha al pasar el ratón
layout-panel.scss:39  - menú lateral oscuro sobre lienzo claro
layout-panel.scss:103 - barra izquierda de acento en el elemento activo

## layouts/panel/layout-panel.html
layout-panel.html:49  - app-footer-sitio dentro del panel

## layouts/comun/footer-sitio.ts
footer-sitio.ts:78    - títulos en mayúsculas con espaciado

## features/catalogo/paginas/inicio/inicio.scss
inicio.scss:65    - repeat(4, 1fr) → repeat(4, minmax(0, 1fr)) (H1)
inicio.scss:77    - ídem

## features/catalogo/paginas/catalogo/catalogo.scss
catalogo.scss:65  - repeat(3, 1fr) → minmax(0, 1fr) (H1)

## features/aprendizaje/paginas/seguimiento-curso/seguimiento-curso.scss
seguimiento-curso.scss:112 - transition: all
seguimiento-curso.scss:160 - transition: all
seguimiento-curso.scss:179 - transition: all
seguimiento-curso.scss:326 - height: 100vh → 100dvh
seguimiento-curso.scss:462 - transition: all

## features/docente/cursos/paginas/editor-curso/editor-curso.scss
editor-curso.scss:59  - backdrop-filter (vidrio)
editor-curso.scss:77  - transition: all

## features/docente/cursos/componentes/listado-cursos.*
listado-cursos.scss:51 - linear-gradient
listado-cursos.html:76 - <img> sin width/height

## features/admin/revision/paginas/revision-curso/revision-curso.html
revision-curso.html:29 - <img> sin width/height

## features/docente/cursos/componentes/formulario-ficha.html
formulario-ficha.html:132 - <img> sin width/height

## shared/ui/cursos/buscador-curso.ts
buscador-curso.ts:116 - <img> sin width/height

## shared/ui/datos/grafico-echarts.ts
grafico-echarts.ts:141 - transition: all

## features/admin/sesiones/paginas/sesiones/sesiones.scss
sesiones.scss:99  - pulso infinito de 2 s (bucle lento); comprobar que se detiene con movimiento reducido

## features/identidad/componentes/marco-acceso.scss
marco-acceso.scss:8 - linear-gradient de fondo
```

Lo que **sí cumple** y debe conservarse:
- El anillo de foco global de 3px (`styles.scss:131`, contraste 6,7:1).
- La trampa de foco y la devolución del foco en el modal.
- Los `aria-label` de los botones de icono.
- Las tablas desplazables con `tabindex="0"`.
- La barra inferior con `env(safe-area-inset-bottom)`.
- Los estados vacío y de error con `app-estado-vista`.
- Los esqueletos ya existen en todas las vistas.

### 1.3 Linter de Taste (`lint.mjs frontend/src`)

| Categoría | N | Lectura para Learnity |
|---|---|---|
| hairline (líneas finas) | 46 | En paneles se permiten las reglas de tabla y el borde de las tarjetas (`app-screens` §13). En el sitio público sobran: separadores de la ficha y bordes de las tarjetas de curso |
| shadow (sombras) | 40 | Solo deben quedar en lo que flota: modal, menú, toasts y el botón «siguiente» del aula |
| emoji | 22 | Son los «★» de texto: se cambian por SVG (`estrellas.ts`) |
| eyebrow | 16 | Se eliminan todos (H7) |
| gradient (degradados) | 5 | Se eliminan; queda el velo neutro bajo texto sobre una foto, si lo hubiera |
| purple (violeta) | 1 | `--morado-600` |
| outlined-box (cajas con contorno) | 102 | En paneles se permiten (bordes de 1px, tono 1,1–1,3:1). En el sitio se cambian por un escalón de tono |
| transition-all | 6 | Se listan las propiedades |
| default-font | 1 | Inter (H19) |

### 1.4 Crítica del «antes» (formato de `critique.md` §4)

```
ROUND 0 — sitio público (inicio, catálogo, ficha)
Seen in one second: una banda azul pálida con una foto de stock y un botón ámbar.
Idea (one sentence): ninguna propia; el formato estándar de marketplace sin decisión.
Live thing: el buscador del header (existe y funciona), y el temario plegable de la ficha.
Layout words by section: hero=split / categorías=chips / destacados=grid / recientes=grid / cifras=stats-band / cómo funciona=icon-cards / footer=sitemap
Scores: design 5.5 · usability 7 · creativity 5 · content 6 → overall 5.9
Caps applied: eyebrow + sombras en reposo → ≤ 6.5 (no limita); dos rejillas iguales seguidas.
Top three problems:
1. Scroll horizontal a 1440 (01, 02): las rejillas desbordan. Fix: minmax(0, 1fr) y chip truncado.
2. La tarjeta de curso, la pieza más repetida, tiene la jerarquía al revés (01, 02): chip arriba, sin valoración, «0 min». Fix: tarjeta estilo Udemy (§3, Lote 2).
3. La ficha no tiene cabecera ni una tarjeta de inscripción que convenza (03): fix banda oscura de cabecera + tarjeta sticky con «Este curso incluye».
```

Paneles (las siete preguntas de `app-screens.md` §2.7):

1. **¿La pregunta de la pantalla la responde lo más grande?** No. En «Mis cursos» lo más grande son las portadas de 260 px, y la pregunta del docente es «¿qué curso está en qué estado y qué hago ahora?». En «Usuarios», el h1 de 40 px pesa más que la tabla.
2. **¿Los bordes compartidos se respetan?** No. «Resumen» tiene filas desiguales (H16), «Usuarios» se sale por la derecha (H15) y «Mis cursos» deja huecos con un número impar de tarjetas.
3. **¿El color está solo en los datos, el estado y la acción?** No. El azul relleno está en filtros, pestañas y botones; el ámbar en «Nuevo curso»; el menú es azul marino.
4. **¿Las cifras cuadran y se alinean?** Cuadran, pero no se alinean: no hay cifras tabulares (H2).
5. **¿Un cero se ve como cero?** Sí: «0 Al día» en el resumen. Es correcto.
6. **¿La leyenda corresponde a la marca?** Sí en los gráficos de ECharts; conviene unificar el tono del dato con el acento (§2.2).
7. **En el móvil, ¿la navegación se pliega?** Sí: cuatro pestañas y «Más» (Lote 9). Es correcto.

---

## 2. Sistema de tokens propuesto

### 2.1 Decisiones de dirección

- **Pantallas de trabajo (paneles docente y admin, «Mi aprendizaje» y el aula):** estilo **`accent-ladder`** de Taste.
  - **El movimiento del estilo:** el tono pleno solo va en marcas pequeñas (el botón relleno, la serie principal de un gráfico y el icono activo del menú), y sus tintes pálidos cubren las áreas (fila activa del menú, insignias y pistas de progreso).
  - **La identidad:** la escalera se construye con el **azul de Learnity**, no con el frambuesa que repartió la skill. Así coincide con el logo y con la marca, y respeta la prohibición de violeta.
  - **Elemento propio del producto:** la lección como unidad visible. En el aula y en las tarjetas aparece el avance real «3 de 5 lecciones» como pista de progreso, y en los paneles, el estado del curso como píldora pálida junto a su miniatura.
- **Sitio público (inicio, catálogo y ficha): reglas de pantalla de aplicación para catálogo y detalle** (`app-screens` §1 incluye «un catálogo» y «la página de detalle de un objeto»), con la densidad de Udemy.
  - Las tres direcciones de página repartidas (`one-motif`, `loud-flat-poster`, `type-only-statement`) son para landings de autor y contradicen la referencia de Udemy. Se descartan, y lo dejo dicho.
  - Del método de página se conservan tres disciplinas en el hero del inicio: un h1 claro, una frase y una acción.
- **Tipografía: DM Sans** (repartida por el estilo), con 400, 500, 600 y 700 y cifras tabulares verificadas. Sustituye a Inter (H19). Una sola familia en todo el producto.

### 2.2 Paleta (contrastes calculados con la fórmula WCAG)

| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `--suelo` | `#f9fafb` | Fondo de los paneles | — |
| `--superficie` | `#ffffff` | Tarjetas, sitio, tablas | — |
| `--elevado` | `#f3f4f6` | Escalón de tono (filas de módulo del temario, bloque de cifras) | — |
| `--activo` | `#eef2f7` | Fondo al pasar el ratón por filas y menú | — |
| `--borde` | `#e5e7eb` | Borde de tarjeta y panel | 1,2:1 (decorativo) |
| `--regla` | `#f2f2f2` | Reglas de fila en tablas | — |
| `--borde-control` | `#868e9b` | Contorno de campos y selects | **3,30:1** sobre blanco, 3,16:1 sobre `--suelo` (WCAG 1.4.11) |
| `--tinta` | `#111827` | Texto principal | 17,7:1 |
| `--tinta-2` | `#4b5563` | Texto secundario | 7,6:1 |
| `--tinta-3` | `#5f6672` | Metadatos, cabeceras de tabla, marcadores de posición | 5,5:1 sobre `--suelo`, 5,2:1 sobre `--activo` |
| `--acento` | `#1d4ed8` | Botón relleno, enlaces, serie principal, foco | 6,7:1 (texto blanco sobre él: 6,7:1) |
| `--acento-hover` | `#1e40af` | Hover del botón | 8,7:1 |
| `--acento-suave` | `#eff6ff` | Fila activa del menú, insignia «Nuevo» | — |
| `--acento-pista` | `#dbeafe` | Pista de las barras de progreso | — |
| `--acento-tinta` | `#1e3a8a` | Texto sobre tintes del acento | 9,5:1 sobre suave, 8,5:1 sobre pista |
| `--estrella` | `#b4690e` | Estrellas y barras de valoración (gráfico) | 4,2:1 (≥ 3:1) |
| `--estrella-tinta` | `#8a4b08` | La cifra «4,5» junto a las estrellas (como Udemy) | 6,8:1 |
| `--positivo` / `--pill-pos` | `#1f7a4a` / `#dcfce7` + `#14532d` | Éxito, «Publicado», «Completado» | 5,3:1 / 8,3:1 |
| `--negativo` / `--pill-neg` | `#b42318` / `#ffedea` + `#831c1e` | Error, «Rechazado», peligro | 6,6:1 / 8,6:1 |
| `--pill-aviso` | `#fffbeb` + `#92400e` | «En revisión», «Suspendido» | 6,8:1 |
| `--cabecera-oscura` | `#16181d` | Banda de la ficha y del aula, y pie del sitio (neutro, no azul marino) | Texto `#ffffff` ≈ 18:1; secundario `#cbd5e1` 12:1 |

Salen `--morado-*`, `--naranja-*` y el ámbar como botón (`.btn-acento`). **El ámbar queda solo para las estrellas.** Los tokens actuales (`--azul-*`, `--gris-*`…) se mantienen como alias mientras dure la migración, para no romper componentes que aún no se hayan tocado.

### 2.3 Tipografía

| Rol | Sitio | Paneles | Peso | Otros |
|---|---|---|---|---|
| h1 de página | 32px (móvil 26) | 24px (móvil 22) | 700 | `letter-spacing: -0.02em`, `text-wrap: balance`, interlineado 1,15 |
| h1 de la ficha (sobre la banda) | 32px (móvil 24) | — | 700 | Como Udemy |
| Título de sección | 22px | 18px | 700 / 600 | interlineado 1,25 |
| Título de tarjeta de curso | 16px | 15px | 700 | `line-clamp: 2` |
| Cuerpo | 16px | 14px | 400 | interlineado 1,5 / 20px |
| Metadatos, etiquetas, cabecera de tabla | 13px | 12px | 400–500 | minúscula de frase, nunca mayúsculas espaciadas |
| Cifra de KPI | — | 24px (la cifra principal, 28) | 600 | `tabular-nums` |
| Píldoras | 12px | 12px | 500 | mínimo 11px |

Las cifras son tabulares en tablas, KPI, duraciones, contadores, porcentajes y valoraciones, con la clase global `.num` y en los componentes de datos.

### 2.4 Espacio, forma y profundidad

- **Escala de 4 px:** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. El hueco entre tarjetas de un panel es uno solo, **16px**; el relleno de tarjeta, 20px.
- **Radios, con modo estrecho** (`accent-ladder`): tarjeta 8, control 6, píldora o chip 999 (los filtros en píldora de Udemy), etiqueta de estado 4. Portadas de curso a 8 con la tarjeta sin borde, como Udemy.
- **Altura de controles:** 40px en el sitio, 36px en los filtros de los paneles y 44px de área táctil en el móvil.
- **Sombras:** ninguna en reposo. Solo `--sombra-flotante: 0 12px 32px rgb(17 24 39 / 14%)` en el modal, el menú de cuenta, los toasts, el panel «Más» y la tarjeta sticky de la ficha (que flota sobre la banda).

### 2.5 Movimiento (`apple-design`)

| Token | Valor | Para |
|---|---|---|
| `--curva-salida` | `cubic-bezier(0.23, 1, 0.32, 1)` | Entradas, hover y la mayoría de la UI: rápida al principio, se asienta sin rebote (equivale a un muelle con amortiguación 1,0) |
| `--curva-hoja` | `cubic-bezier(0.32, 0.72, 0, 1)` | Hoja del modal en el móvil, panel «Más», toasts (la curva de las hojas de iOS) |
| `--curva-entrada-salida` | `cubic-bezier(0.65, 0, 0.35, 1)` | Despliegue del acordeón del temario y movimientos simétricos |
| `--t-pulsar` | `100ms` | `:active` de botones y tarjetas |
| `--t-micro` | `160ms` | hover, color, borde |
| `--t-panel` | `220ms` | modal en escritorio, acordeón, menú |
| `--t-hoja` | `320ms` | hojas del móvil, toasts |

**Reglas:**
- **Respuesta al pulsar:** `:active` con `transform: scale(0.97)` en 100 ms. La respuesta llega en el `pointerdown`, no al soltar.
- **Propiedades animables:** solo `transform` y `opacity`; nunca `transition: all` ni `width`.
- **Interrumpible:** transiciones CSS en lugar de `@keyframes` en todo lo que se abre y se cierra, para que un segundo clic invierta el movimiento desde donde va.
- **Camino simétrico:** lo que entra desde abajo sale hacia abajo (toasts, hoja del móvil, panel «Más»). Los menús se escalan desde su disparador (`transform-origin` en la esquina del botón).
- **Salidas en Angular 21:** con `animate.enter` y `animate.leave` nativos, sin `@angular/animations`.
- **Movimiento reducido:**
  - Se sustituye el «0,01 ms a todo» (`styles.scss:142`) por un fundido de opacidad de 150 ms en modal, toasts y hojas, sin desplazamiento ni escala.
  - El esqueleto queda quieto y los bucles se detienen.
  - La regla global se mantiene como red de seguridad para lo que quede sin migrar.

---

## 3. Mejoras inspiradas en Udemy, por lotes

Lo que no se toca en ningún lote:
- **Textos visibles y `aria-label`:** los de botones, encabezados y navegación que busca Playwright, entre ellos «Ocultar reseña», «Ejecutar análisis ahora», «Navegación principal», «Más», «Inscribirme gratis», «Datos antes y después», «Resumen», «Marcar atendida» y las pestañas.
- **Clases y selectores que usa la E2E:** `li.tarjeta`, `.temario-lateral`, `details.modulo`, `article.curso`, `.contenido-fila`, `.aviso-publicado`, `.con-casos`, `.activo`, `td.antes`, `td.despues`, `table.tabla tbody tr`, `section.bloqueadas`, `.portada-curso`, `.embudo li`, `form.editor-integrado`, `fieldset.pregunta`, `app-tarjeta-curso` y `app-menu-cuenta img.foto`.
- **Las tablas desplazables** conservan su `tabindex="0"`.

Cada lote termina con `ng test`, `ng build`, la suite E2E completa con axe a 1440 y a 390, y capturas del «después» comparadas con las del «antes».

### Lote Visual 1: base y layouts

1. **Tokens (§2) en `styles.scss`:**
   - paleta, tipografía (DM Sans con `preconnect` y `display=swap` en `index.html`), escala, radios, sombra flotante y curvas;
   - `.num`, `text-wrap: balance` en h1 y h2, y `touch-action: manipulation`;
   - alias para los tokens antiguos.
2. **Componentes base en `styles.scss`:**
   - **Botones:** primario relleno de `--acento`; secundario blanco con borde de control y tinta; terciario de texto; peligro con contorno. `.btn-acento` pasa a ser un alias de `.btn-primario`, para no tocar las plantillas. `:active` con escala. El estado deshabilitado se queda legible (tinta-3 sobre elevado) en lugar de `opacity .45`.
   - **`.titulo-pagina`:** 32 px en el sitio y 24 px en los paneles, mediante una variable de contexto.
   - **Etiquetas:** `.eyebrow`, `.estado` y los `th` pasan a minúscula de frase. Se quita la banda de la cabecera de tabla y los números se alinean a la derecha.
   - **Píldoras de estado:** pares pálidos (§2.2).
   - **`.esqueleto`:** gris plano.
3. **`header-sitio`** (como Udemy):
   - logo, «Explorar», buscador en píldora a todo lo ancho y, a la derecha, «Enseña en Learnity», «Mi aprendizaje» y el avatar;
   - la tira de categorías bajo la cabecera pasa a enlaces de texto de 14 px en tinta-2 con subrayado al pasar el ratón, sin línea inferior;
   - la regla inferior de la cabecera aparece solo al desplazar (un escalón de tono, no una sombra).
4. **`footer-sitio`:** fondo `--cabecera-oscura` neutro, sin mayúsculas espaciadas, y el nombre Learnity a todo lo ancho como cierre. **No se muestra en los paneles** (`layout-panel.html:49`).
5. **`layout-panel` y `menu-panel`:** el riel oscuro de iconos se sustituye por un menú lateral **con etiquetas, de 232 px, sobre el fondo de la página**.
   - **Arriba:** la marca y el ámbito («Learnity · Admin» o «Docente»).
   - **Grupos** con etiquetas grises de 12 px en minúscula de frase: Principal (Resumen), Comunidad (Usuarios, Solicitudes), Contenido (Cursos, Categorías, Reseñas) y Seguridad (Accesos, Auditoría, Alertas, Sesiones).
   - **Elemento activo:** fondo `--acento-suave` con texto `--acento-tinta` y el icono en `--acento`, sin barra izquierda.
   - **Perfil y «Vista estudiante»** al pie.
   - **Contadores** solo en las colas que piden acción («Alertas 3»).
   - **Entre 901 y 1199 px:** un riel de 64 px con tooltip.
6. **`tab-bar` móvil:** se mantienen las cuatro pestañas y «Más».
   - **Activo:** icono en `--acento` con una marca superior de 2 px; etiqueta en tinta.
   - **Panel «Más»:** sale desde abajo con `--curva-hoja` y se cierra por el mismo camino.
   - **Pulsación:** escala.
   - **La ficha:** gana una barra de inscripción fija **encima** de la barra de pestañas (H12).

### Lote Visual 2: componentes compartidos

1. **`tarjeta-curso`**, estilo Udemy:
   - **Portada:** 16:9 con radio 8 y sin borde de tarjeta.
   - **Título:** 16px/700, dos líneas como máximo.
   - **Debajo:** el docente (13 px, tinta-3, una línea con elipsis); la valoración con «4,5» en `--estrella-tinta`, las estrellas SVG y «(2)» en gris tabular; y la meta «5 lecciones · 2 h 10 min». Si la duración es cero, se omite.
   - **Insignia** «Nuevo» pálida.
   - **El chip de categoría sale de la tarjeta:** ya está en el filtro y en la ficha.
   - **Interacción:** al pasar el ratón, la portada escala a 1,03 dentro de su máscara y el título se subraya. Toda la tarjeta es un único enlace con `::after` extendido. El foco visible rodea la tarjeta entera y `:active` escala a 0,99.
   - **Pendiente de comprobar:** si la API del catálogo ya devuelve la valoración media por curso. Si no la devuelve, la valoración espera a un cambio de backend.
2. **`estrellas`:** estrellas en SVG con relleno parcial por máscara y el color del token (fuera los «★» de texto).
3. **`barra-progreso`:** pista de 8 px en `--acento-pista` y relleno en `--acento`, completamente redondeada; el avance se anima con `transform: scaleX` (no con `width`). Texto «3 de 5 lecciones · 60 %» con cifras tabulares.
4. **`indicador` (KPI):** etiqueta gris de 13 px sobre una cifra de 24–28 px a 600 y tabular, sin icono de color. En una fila de KPI va un solo contenedor dividido por líneas de 1 px.
5. **`modal`:**
   - icono neutro o ninguno;
   - `overscroll-behavior: contain`;
   - **en escritorio:** entra con `opacity` y `scale(0.96 → 1)` en 220 ms con `--curva-salida`, y el fondo se funde en 160 ms;
   - **en el móvil:** hoja que sube desde abajo con `--curva-hoja` y baja por el mismo camino al cerrar;
   - salida con `animate.leave`;
   - el contador de caracteres pasa a texto gris de 12 px (fuera la píldora ámbar).
6. **`toasts`:**
   - **posición:** abajo a la izquierda en escritorio (como Udemy) y abajo, encima de la barra de pestañas, en el móvil;
   - **movimiento:** entra y sale con el mismo `translateY` y `--curva-hoja`;
   - un `aria-live` en el contenedor;
   - el de éxito con icono y sin color de fondo saturado.
7. **`esqueleto`:** barras grises planas con el tamaño final de cada valor. El movimiento reducido no cambia nada, porque ya no hay brillo.

### Lote Visual 3: estudiante y catálogo

1. **Inicio:**
   - **Hero:** imagen a la derecha de al menos el 50 % del ancho; sin eyebrow; h1 de 32 px y una frase; una sola acción, «Explorar cursos», en primario. «Crear cuenta» queda solo en la cabecera.
   - **Filas de cursos:** el carrusel con las tarjetas del Lote 2 y la rejilla corregida (H1).
   - **Banda de cifras:** se elimina, porque no son métricas (H10).
   - **«Cómo funciona»:** de tarjetas con icono y numeración pasa a una fila de tres frases con su verbo en negrita, o se elimina para dejar más filas de cursos.
   - **Estudiante con sesión:** «Continúa donde lo dejaste» en primer lugar, como en Udemy.
2. **Catálogo** (la búsqueda de Udemy):
   - **Encabezado:** título y contador «4 cursos» con cifras tabulares, y «Ordenar por» a la derecha.
   - **Filtros a la izquierda:** acordeones (Categoría, Nivel) con el recuento por opción y sin el eyebrow «FILTRAR».
   - **Resultados en escritorio:** **filas horizontales** con la portada de 260 px a la izquierda, título, subtítulo (dos líneas), docente, valoración y meta, como los resultados de Udemy.
   - **Resultados en el móvil:** las tarjetas del Lote 2.
   - **Desbordamiento:** se corrige (H1).
3. **Ficha del curso:**
   - **Cabecera:** banda **`--cabecera-oscura` a todo el ancho** con migas, título de 32 px, subtítulo, valoración (cifra, estrellas y «(2 reseñas)»), «Creado por» con el enlace del docente y la meta.
   - **Tarjeta lateral sticky** que se superpone a la banda, como en Udemy: portada, «Curso gratuito», «Inscribirme gratis» relleno y la lista **«Este curso incluye»** con datos reales (n módulos, n lecciones, documentos PDF, a tu ritmo).
   - **«Lo que aprenderás»:** caja con marcas de verificación en dos columnas.
   - **«Contenido del curso»:**
     - cabecera con «2 secciones · 5 lecciones · duración» y «Expandir todas»;
     - filas de módulo en `--elevado` con el título en negrita y el recuento a la derecha en cifras tabulares;
     - filas de lección con icono, título y tipo o duración a la derecha;
     - el despliegue se anima con `grid-template-rows: 0fr → 1fr` en 220 ms y el chevron gira con `transform`;
     - se conservan `details.modulo` y `aria-expanded`.
   - **Docente:** avatar de 64 px y cifras tabulares.
   - **Reseñas:** el resumen con barras de color estrella y las reseñas en dos columnas en escritorio.
   - **Móvil:** barra inferior fija con «Inscribirme gratis» encima de la barra de pestañas (H12).
4. **Aula (`seguimiento-curso`)**, el reproductor de Udemy:
   - visor a todo el ancho con fondo oscuro;
   - temario lateral sticky (`100dvh`) con el avance por sección y lecciones con casilla y tipo o duración;
   - **bajo el visor, pestañas** «Descripción general», «Recursos» y «Reseñas» en la URL (`?pestana=`), en lugar de repetir todo el bloque de reseñas (H13);
   - tarjetas de información con truncado y `min-width: 0`;
   - `transition: all` sustituido por propiedades concretas;
   - el botón «siguiente» flotante conserva su sombra (flota de verdad) con `:active` de escala.
5. **«Mi aprendizaje»:**
   - banda oscura como la de Udemy, con el h1 a 32 px y el espaciado corregido (H18);
   - la tarjeta entera es el enlace; la barra de progreso y «20 % completado» van en cifras tabulares;
   - se quitan los tres botones de ancho completo y queda «Continuar» como enlace de texto en `--acento`.

### Lote Visual 4: paneles de docente y administrador

1. **Pantallas:**
   - **Títulos:** 24px/700, con un subtítulo gris de 14 px y la acción principal a la derecha, una sola por pantalla.
   - **Fondo:** `--suelo`, con las tarjetas blancas de borde `--borde`.
2. **Tablas** (Usuarios, Auditoría, Accesos, Sesiones, Estudiantes):
   - cabecera de 12 px gris en minúscula de frase, sin banda;
   - reglas `--regla` y altura de fila de 45 px;
   - números y fechas alineados a la derecha en cifras tabulares;
   - la columna de identidad (nombre) es la más ancha y el correo se trunca con elipsis;
   - la acción va en una columna fija a la derecha (H15) y los chips no se aplastan (`nowrap`).
3. **KPI** (Resumen, Analíticas, Estado de la base):
   - **«Atención rápida»:** un contenedor dividido; las celdas con casos llevan la píldora de aviso con su número.
   - **Indicadores:** filas que terminan juntas (H16) y cifras tabulares.
4. **Filtros:**
   - **«Mis cursos» del docente:** los seis botones de contorno pasan a **un control segmentado o a pestañas subrayadas** con sus recuentos («Publicados 4»).
   - **Usuarios:** píldoras de filtro con el activo en `--acento-suave` (no relleno de acento).
   - **Selects** con borde de control 3:1.
5. **«Mis cursos» del docente:** de álbum a **lista de filas**, como el panel de instructor de Udemy:
   - miniatura de 64×36 px;
   - título y estado en píldora pálida;
   - módulos, estudiantes y valoración en cifras tabulares;
   - «Editar curso» y «Ver en el catálogo» a la derecha.
6. **`diff-cambio` (Auditoría):** se conservan la tabla, los signos «−» y «+» y el texto oculto; los colores pasan a los pares de píldora (§2.2) y las cifras a tabulares.
7. **Revisión, Reseñas, Alertas y Sesiones:**
   - **píldoras de estado y severidad** con los pares pálidos (fuera los fondos saturados y las mayúsculas);
   - **tarjetas de reseña y alerta** sin banda de color de fondo (un borde izquierdo de 3 px solo en la severidad ALTA);
   - **gráficos de ECharts** con un solo tono (`--acento`) en la serie principal y grises para el resto.

---

## 4. Riesgos y cómo se controlan

- **Hay otra sesión trabajando en este worktree.**
  - **Lo que hay ahora:** el commit `b6abfb6` y un cambio sin commitear en `layouts/panel/menu-panel.ts` que renombra «Revisión de cursos» a «Cursos» y «Alertas de seguridad» a «Alertas».
  - **El riesgo:** si se commitea, la etiqueta del menú lateral deja de coincidir con lo que buscan `07-responsive` y `12-panel-admin` («Alertas de seguridad», «Revisión de cursos» en los títulos), y el Lote Visual 1 toca ese mismo archivo.
  - **Lo que propongo:** cerrar o integrar ese trabajo antes de empezar.
- **Las capturas a página completa** muestran los elementos *sticky* en la posición del primer viewport: el riel del panel parece «cortado» a 855 px. Es un efecto de la captura, no un fallo; no lo cuento como hallazgo.
- **DM Sans aporta una dependencia de Google Fonts** (como hoy Inter). Si se prefiere no depender de la red, se puede alojar en `public/fonts/` con `preload`.
- **La valoración en las tarjetas** depende de que la API del catálogo devuelva el promedio por curso. Lo compruebo al empezar el Lote 2 y, si falta, lo propongo como cambio de backend aparte.
- **Contraste:** los pares de §2.2 están calculados. En cada lote, la E2E con axe (escritorio, 390 px y modales abiertos) es la prueba que manda.

## 5. Orden propuesto y criterio de cierre por lote

1. **Lote Visual 1** (tokens, botones, tablas, layouts, menú, pie y barra inferior): es la base de todo. Si se mezcla con otros lotes, cualquier diferencia de capturas es ambigua.
2. **Lote Visual 2** (componentes compartidos).
3. **Lote Visual 3** (estudiante y catálogo).
4. **Lote Visual 4** (paneles).

**Cierre de cada lote:**
- `ng test` y `ng build` sin avisos;
- suite E2E completa (con axe);
- `lint.mjs` de Taste sin nuevas categorías;
- capturas del «después» a 1440 y 390 junto a las del «antes»;
- crítica en el formato de §1.4 con la puntuación nueva.

## Apéndice A. Capturas del «antes»

`C:\Users\ASUSVI~1\AppData\Local\Temp\claude\C--Users-ASUS-VIVOBOOK-Documents-Programaci-n-Practicas-preprofesionales-learnity\65a6b516-a095-43d2-99fb-e7a9686d5d3f\scratchpad\antes\`
(01-inicio … 22-modal, `-escritorio` a 1440 y `-movil` a 390). La prueba que las genera está en
`…\scratchpad\zz-auditoria-visual.spec.ts`. Se copia a `e2e/tests/` para repetirla en el «después» y se borra al terminar.

## Apéndice B. Hojas de Taste

- Estilo de aplicación: `…\scratchpad\taste\app\direction.json` (`accent-ladder`, semilla 924416548).
- Direcciones de página descartadas: `…\scratchpad\taste\sitio\` (one-motif, loud-flat-poster, type-only-statement).
