/**
 * Resume un User-Agent en "Navegador versión · Sistema" para la tabla de accesos. El texto completo se muestra
 * aparte (title); aquí solo se reconoce lo habitual y lo demás queda como "Otro navegador".
 */
export function resumirNavegador(agente: string | null | undefined): string {
  if (!agente) return 'Desconocido';
  const navegador =
    coincide(agente, /Edg\/(\d+)/, 'Edge') ??
    coincide(agente, /OPR\/(\d+)/, 'Opera') ??
    coincide(agente, /Firefox\/(\d+)/, 'Firefox') ??
    coincide(agente, /Chrome\/(\d+)/, 'Chrome') ??
    coincide(agente, /Version\/(\d+)[^ ]* (?:Mobile\/\S+ )?Safari/, 'Safari') ??
    (/\b(curl|node|undici|python|postman)/i.exec(agente)?.[1]?.toLowerCase() ?? 'Otro navegador');
  const sistema =
    /Windows/.test(agente) ? 'Windows' :
    /Android/.test(agente) ? 'Android' :
    /iPhone|iPad|iPod/.test(agente) ? 'iOS' :
    /Mac OS X|Macintosh/.test(agente) ? 'macOS' :
    /Linux/.test(agente) ? 'Linux' : '';
  return sistema ? `${navegador} · ${sistema}` : navegador;
}

function coincide(agente: string, patron: RegExp, nombre: string): string | null {
  const version = patron.exec(agente)?.[1];
  return version ? `${nombre} ${version}` : null;
}
