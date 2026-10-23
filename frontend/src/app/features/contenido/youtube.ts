/** Tipos del reproductor, no de la API REST. No sustituyen OpenAPI. */
export interface PosicionYoutube {
  readonly leccionId: number;
  readonly videoId: string;
  readonly segundos: number;
  readonly motivo: 'intervalo' | 'pausa' | 'oculto' | 'salida';
}

export type ResultadoEnlaceYoutube =
  | { readonly valido: true; readonly videoId: string; readonly enlaceCanonico: string }
  | { readonly valido: false; readonly mensaje: string };

export function esIdYoutube(valor: unknown): valor is string {
  return typeof valor === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(valor);
}

/** Solo valida el formato. La existencia y los permisos los determina YouTube. */
export function validarEnlaceYoutube(valor: string): ResultadoEnlaceYoutube {
  const enlace = valor.trim();
  const invalido: ResultadoEnlaceYoutube = {
    valido: false,
    mensaje: 'Pega un enlace HTTPS de YouTube a un vídeo, no un canal ni una lista.',
  };
  if (!enlace) return { valido: false, mensaje: 'Escribe el enlace del vídeo de YouTube.' };
  if (/[<>]/.test(enlace)) {
    return { valido: false, mensaje: 'Pega el enlace del vídeo. No se admite código HTML ni iframe.' };
  }
  if (enlace.length > 2048 || /[\s\u0000-\u001f\u007f]/.test(enlace)) return invalido;

  let url: URL;
  try {
    url = new URL(enlace);
  } catch {
    return invalido;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return invalido;

  let id: string | null = null;
  if (url.hostname === 'youtu.be') {
    id = /^\/([a-zA-Z0-9_-]{11})\/?$/.exec(url.pathname)?.[1] ?? null;
  } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
    if (url.pathname === '/watch' && url.searchParams.getAll('v').length === 1) {
      id = url.searchParams.get('v');
    } else {
      id = /^\/(?:shorts|embed|live)\/([a-zA-Z0-9_-]{11})\/?$/.exec(url.pathname)?.[1] ?? null;
    }
  }
  if (!esIdYoutube(id)) return invalido;
  return { valido: true, videoId: id, enlaceCanonico: `https://www.youtube.com/watch?v=${id}` };
}

export function segundosSeguros(valor: number): number {
  return Number.isFinite(valor) && valor >= 0 ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(valor)) : 0;
}

export function tiempoYoutube(segundos: number): string {
  const total = segundosSeguros(segundos);
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const resto = String(total % 60).padStart(2, '0');
  return horas ? `${horas}:${String(minutos).padStart(2, '0')}:${resto}` : `${minutos}:${resto}`;
}

export function mensajeErrorYoutube(codigo: number): string {
  switch (codigo) {
    case 2: return 'El identificador del vídeo no es válido.';
    case 5: return 'El navegador no pudo reproducir el vídeo. Prueba recargar o usar otro navegador.';
    case 100: return 'El vídeo ya no está disponible o es privado. Comunícalo al docente.';
    case 101:
    case 150: return 'El propietario del vídeo impide reproducirlo dentro de Learnity. Comunícalo al docente.';
    case 153: return 'YouTube no pudo identificar este sitio. Reintenta o comunica el problema al docente.';
    default: return 'No se pudo reproducir el vídeo. Comprueba tu conexión y vuelve a intentarlo.';
  }
}
