// Utilidades para fijar la FORMA de las respuestas (claves y orden, tipos) y detectar fugas.

/** Forma recursiva: objetos con sus claves EN ORDEN, arrays por el primer elemento, primitivos por tipo. */
export function forma(v: unknown): unknown {
  if (v === null) return 'null';
  if (Array.isArray(v)) return v.length === 0 ? ['vacío'] : [forma(v[0])];
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, forma(x)]));
  return typeof v;
}

/** Solo las claves, en orden, de un objeto (primer nivel). */
export function claves(v: unknown): string[] {
  return Object.keys(v as object);
}

/** Reemplaza fechas ISO por <fecha> y ids por marcadores estables (según el mapa), para deepStrictEqual. */
export function normalizar(v: unknown, ids: Map<number, string> = new Map(), claveId = false): unknown {
  if (Array.isArray(v)) return v.map((x) => normalizar(x, ids, claveId));
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, normalizar(x, ids, k === 'id' || k.endsWith('Id'))]));
  }
  if (typeof v === 'number' && claveId && ids.has(v)) return ids.get(v);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v)) return '<fecha>';
  return v;
}

/** Recorre el JSON buscando claves o valores que delaten rutas físicas o secretos. Devuelve los hallazgos. */
export function sinRutasPrivadas(v: unknown, camino = '$'): string[] {
  const malos: string[] = [];
  if (Array.isArray(v)) v.forEach((x, i) => malos.push(...sinRutasPrivadas(x, `${camino}[${i}]`)));
  else if (v !== null && typeof v === 'object') {
    for (const [k, x] of Object.entries(v as object)) {
      if (/^(ruta|hash|contrasena_hash|contrasenaHash|password)$/i.test(k)) malos.push(`${camino}.${k}`);
      malos.push(...sinRutasPrivadas(x, `${camino}.${k}`));
    }
  } else if (typeof v === 'string' && /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf/i.test(v)) {
    malos.push(`${camino}=${v}`);
  }
  return malos;
}

/**
 * Normaliza con conocimiento del camino (p. ej. `items[].categoria.id`): `resolver(camino, valor)` devuelve el
 * marcador para ese número o undefined si se deja igual. Las fechas ISO pasan a `<fecha>` y la marca a `<marca>`.
 */
export function normalizarConCamino(
  v: unknown,
  resolver: (camino: string, valor: number) => string | undefined,
  marca: string,
  camino = '',
): unknown {
  if (Array.isArray(v)) return v.map((x) => normalizarConCamino(x, resolver, marca, `${camino}[]`));
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as object).map(([k, x]) => [k, normalizarConCamino(x, resolver, marca, camino ? `${camino}.${k}` : k)]),
    );
  }
  if (typeof v === 'number') return resolver(camino, v) ?? v;
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v)) return '<fecha>';
    return v.split(marca).join('<marca>');
  }
  return v;
}
