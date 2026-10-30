/** Tamaño en bytes en la unidad más cómoda (1 KB = 1024 bytes), con un decimal desde los MB. */
export function formatearBytes(bytes: number): string {
  const unidades = ['bytes', 'KB', 'MB', 'GB', 'TB'];
  let valor = bytes;
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024;
    i++;
  }
  const texto = i >= 2 ? valor.toLocaleString('es', { maximumFractionDigits: 1 }) : Math.round(valor).toLocaleString('es');
  return `${texto} ${unidades[i]}`;
}

/** Tiempo transcurrido desde `desde` como «3 d 4 h», «5 h 12 min» o «8 min». */
export function tiempoEnLinea(desde: string, ahora = Date.now()): string {
  const minutos = Math.max(0, Math.floor((ahora - new Date(desde).getTime()) / 60_000));
  const dias = Math.floor(minutos / 1440);
  const horas = Math.floor((minutos % 1440) / 60);
  if (dias) return `${dias} d ${horas} h`;
  if (horas) return `${horas} h ${minutos % 60} min`;
  return `${minutos} min`;
}
