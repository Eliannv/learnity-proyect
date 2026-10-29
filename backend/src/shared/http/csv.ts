// CSV para abrir en Excel: BOM UTF-8 (tildes correctas), separador «;» (Excel en español usa la coma
// como separador decimal) y fin de línea CRLF.

type Celda = string | number | null | undefined;

/**
 * Una celda que empieza con =, +, -, @, tabulador o retorno de carro se ejecutaría como fórmula al abrir
 * el archivo (inyección CSV, CWE-1236): se antepone un apóstrofo para que Excel la trate como texto.
 * Los números se escriben tal cual, para que se puedan sumar y ordenar.
 */
function celda(valor: Celda): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return String(valor);
  const texto = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[;"\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

export function aCsv(encabezados: readonly string[], filas: readonly (readonly Celda[])[]): string {
  return `﻿${[encabezados, ...filas].map((fila) => fila.map(celda).join(';')).join('\r\n')}\r\n`;
}

/** Nombre de archivo seguro para Content-Disposition: sin tildes, comillas ni separadores. */
export function nombreArchivo(base: string, extension: string): string {
  const limpio = base.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 60);
  return `${limpio || 'archivo'}.${extension}`;
}
