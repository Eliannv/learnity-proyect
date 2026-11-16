/**
 * PDF 1.4 mínimo, sin dependencias: texto en Helvetica (WinAnsi), A4, con saltos de página.
 * Basta para los apuntes del catálogo; pdf.js y los visores del navegador lo abren sin avisos.
 */

export interface SeccionPdf {
  titulo: string;
  parrafos?: string[];
  vinetas?: string[];
}

export interface DocumentoPdf {
  titulo: string;
  curso: string;
  autor: string;
  resumen?: string;
  secciones: SeccionPdf[];
}

// Caracteres de WinAnsi que no coinciden con Latin-1.
const WIN_ANSI: Record<string, number> = {
  '€': 0x80, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99,
};

function aWinAnsi(texto: string): number[] {
  const bytes: number[] = [];
  for (const ch of texto.normalize('NFC')) {
    const especial = WIN_ANSI[ch];
    const code = ch.codePointAt(0)!;
    if (especial !== undefined) bytes.push(especial);
    else if (code >= 0x20 && code < 0x7f) bytes.push(code);
    else if (code >= 0xa0 && code <= 0xff) bytes.push(code);
    else if (ch === '→') bytes.push(...[0x2d, 0x3e]); // ->
    else if (ch === '≤') bytes.push(...[0x3c, 0x3d]);
    else if (ch === '≥') bytes.push(...[0x3e, 0x3d]);
    else bytes.push(0x3f); // ?
  }
  return bytes;
}

/** Cadena literal PDF «(...)» con los paréntesis y la barra invertida escapados. */
function literal(texto: string): Buffer {
  const salida: number[] = [0x28];
  for (const b of aWinAnsi(texto)) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) salida.push(0x5c);
    salida.push(b);
  }
  salida.push(0x29);
  return Buffer.from(salida);
}

/** Corte por palabras a un ancho aproximado en caracteres (Helvetica ≈ 0,5 em por carácter). */
function ajustar(texto: string, max: number): string[] {
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    if (actual && (actual.length + 1 + palabra.length) > max) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = actual ? `${actual} ${palabra}` : palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

interface Linea { texto: string; fuente: 'F1' | 'F2'; tam: number; antes: number; sangria?: number }

const ANCHO = 595;
const ALTO = 842;
const MARGEN_X = 56;
const MARGEN_SUP = 72;
const MARGEN_INF = 64;

function maquetar(doc: DocumentoPdf): Linea[] {
  const lineas: Linea[] = [];
  ajustar(doc.titulo, 52).forEach((t, i) => lineas.push({ texto: t, fuente: 'F2', tam: 17, antes: i === 0 ? 0 : 21 }));
  lineas.push({ texto: `${doc.curso} · ${doc.autor}`, fuente: 'F1', tam: 9.5, antes: 20 });
  if (doc.resumen) {
    ajustar(doc.resumen, 92).forEach((t, i) => lineas.push({ texto: t, fuente: 'F1', tam: 10.5, antes: i === 0 ? 24 : 14.5 }));
  }
  for (const s of doc.secciones) {
    ajustar(s.titulo, 70).forEach((t, i) => lineas.push({ texto: t, fuente: 'F2', tam: 12.5, antes: i === 0 ? 26 : 16 }));
    for (const p of s.parrafos ?? []) {
      ajustar(p, 92).forEach((t, i) => lineas.push({ texto: t, fuente: 'F1', tam: 10.5, antes: i === 0 ? 17 : 14.5 }));
    }
    for (const v of s.vinetas ?? []) {
      ajustar(v, 86).forEach((t, i) =>
        lineas.push({ texto: i === 0 ? `•  ${t}` : t, fuente: 'F1', tam: 10.5, antes: i === 0 ? 16 : 14.5, sangria: i === 0 ? 8 : 20 }));
    }
  }
  return lineas;
}

function paginar(lineas: Linea[]): Linea[][] {
  const paginas: Linea[][] = [[]];
  let y = ALTO - MARGEN_SUP;
  for (const l of lineas) {
    const pagina = paginas.at(-1)!;
    const salto = pagina.length === 0 ? 0 : l.antes;
    if (y - salto < MARGEN_INF) {
      paginas.push([{ ...l, antes: 0 }]);
      y = ALTO - MARGEN_SUP;
      continue;
    }
    y -= salto;
    pagina.push(pagina.length === 0 ? { ...l, antes: 0 } : l);
  }
  return paginas;
}

function contenidoPagina(lineas: Linea[], n: number, total: number, doc: DocumentoPdf): Buffer {
  const partes: Buffer[] = [];
  const op = (s: string) => partes.push(Buffer.from(s, 'latin1'));
  let y = ALTO - MARGEN_SUP;
  // Franja superior con el nombre de la plataforma.
  op(`0.31 0.27 0.9 rg ${MARGEN_X} ${ALTO - 44} 40 3 re f\n`);
  op(`BT /F2 9 Tf 0.35 0.35 0.4 rg ${MARGEN_X + 48} ${ALTO - 46} Td `); partes.push(literal('Learnity · Material del curso')); op(' Tj ET\n');
  for (const l of lineas) {
    y -= l.antes;
    const color = l.fuente === 'F2' ? '0.08 0.08 0.12' : '0.18 0.18 0.22';
    op(`BT /${l.fuente} ${l.tam} Tf ${color} rg ${MARGEN_X + (l.sangria ?? 0)} ${y.toFixed(1)} Td `);
    partes.push(literal(l.texto));
    op(' Tj ET\n');
  }
  op(`0.85 0.85 0.88 RG 0.6 w ${MARGEN_X} 46 m ${ANCHO - MARGEN_X} 46 l S\n`);
  op(`BT /F1 8.5 Tf 0.45 0.45 0.5 rg ${MARGEN_X} 32 Td `); partes.push(literal(doc.titulo.slice(0, 80))); op(' Tj ET\n');
  op(`BT /F1 8.5 Tf 0.45 0.45 0.5 rg ${ANCHO - MARGEN_X - 60} 32 Td `); partes.push(literal(`Página ${n} de ${total}`)); op(' Tj ET\n');
  return Buffer.concat(partes);
}

export function crearPdf(doc: DocumentoPdf): Buffer {
  const paginas = paginar(maquetar(doc));
  const objetos: Buffer[] = [];
  const idPaginas = 2;
  const primerObjPagina = 6;
  const kids = paginas.map((_, i) => `${primerObjPagina + i * 2} 0 R`).join(' ');

  objetos[1] = Buffer.from(`<< /Type /Catalog /Pages ${idPaginas} 0 R >>`, 'latin1');
  objetos[2] = Buffer.from(`<< /Type /Pages /Kids [${kids}] /Count ${paginas.length} >>`, 'latin1');
  objetos[3] = Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', 'latin1');
  objetos[4] = Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>', 'latin1');
  objetos[5] = Buffer.concat([
    Buffer.from('<< /Title ', 'latin1'), literal(doc.titulo),
    Buffer.from(' /Author ', 'latin1'), literal(doc.autor),
    Buffer.from(' /Producer (Learnity) >>', 'latin1'),
  ]);
  paginas.forEach((lineas, i) => {
    const idPagina = primerObjPagina + i * 2;
    const flujo = contenidoPagina(lineas, i + 1, paginas.length, doc);
    objetos[idPagina] = Buffer.from(
      `<< /Type /Page /Parent ${idPaginas} 0 R /MediaBox [0 0 ${ANCHO} ${ALTO}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${idPagina + 1} 0 R >>`, 'latin1');
    objetos[idPagina + 1] = Buffer.concat([
      Buffer.from(`<< /Length ${flujo.length} >>\nstream\n`, 'latin1'), flujo, Buffer.from('\nendstream', 'latin1'),
    ]);
  });

  const partes: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  let desplazamiento = partes[0]!.length;
  const offsets: number[] = [];
  for (let id = 1; id < objetos.length; id++) {
    const cuerpo = Buffer.concat([Buffer.from(`${id} 0 obj\n`, 'latin1'), objetos[id]!, Buffer.from('\nendobj\n', 'latin1')]);
    offsets[id] = desplazamiento;
    partes.push(cuerpo);
    desplazamiento += cuerpo.length;
  }
  const xref = [`xref\n0 ${objetos.length}\n`, '0000000000 65535 f \n'];
  for (let id = 1; id < objetos.length; id++) xref.push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  partes.push(Buffer.from(xref.join(''), 'latin1'));
  partes.push(Buffer.from(`trailer\n<< /Size ${objetos.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${desplazamiento}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(partes);
}
