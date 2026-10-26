/**
 * Valida una URL de YouTube y extrae
 * exclusivamente el identificador del video.
 */
export function idYoutube(valor: string): string | null {
  let url: URL;

  try {
    url = new URL(valor);
  } catch {
    return null;
  }

  // Solo HTTPS y sin credenciales ni puertos personalizados.
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port
  ) {
    return null;
  }

  const host = url.hostname.toLowerCase();

  let id: string | null = null;

  // Enlaces cortos: https://youtu.be/VIDEO_ID
  if (host === 'youtu.be') {
    const partes = url.pathname.split('/').filter(Boolean);

    if (partes.length === 1) {
      id = partes[0] ?? null;
    }
  }

  // Dominios oficiales de YouTube.
  else if (
    host === 'youtube.com' ||
    host === 'www.youtube.com' ||
    host === 'm.youtube.com'
  ) {
    // https://www.youtube.com/watch?v=VIDEO_ID
    if (url.pathname === '/watch') {
      id = url.searchParams.get('v');
    } else {
      const partes = url.pathname.split('/').filter(Boolean);

      // Shorts, embeds y directos.
      if (
        partes.length === 2 &&
        ['shorts', 'embed', 'live'].includes(partes[0]!)
      ) {
        id = partes[1] ?? null;
      }
    }
  }

  // Los identificadores de YouTube tienen 11 caracteres.
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
    return null;
  }

  return id;
}

/**
 * Construye la URL del reproductor desde un host fijo.
 * Nunca utiliza directamente la URL enviada por el usuario.
 */
export function reproductorYoutube(id: string): string {
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) {
    throw new TypeError('ID YouTube inválido.');
  }

  return `https://www.youtube-nocookie.com/embed/${id}`;
}