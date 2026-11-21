import { AppError } from '../../../shared/http/app-error.js';

export const TAMANO_PARTE = 1024 * 1024;
export const MAX_VIDEO = 100 * TAMANO_PARTE;
type Leer = (inicio: number, longitud: number) => Promise<Buffer>;
interface Caja {
  tipo: string;
  cuerpo: number;
  fin: number;
}
const invalido = () =>
  new AppError(415, 'Selecciona un MP4 con una pista de vídeo H.264.', 'TIPO_NO_ADMITIDO');

/** Recorre la estructura ISO BMFF por desplazamientos sin cargar la grabación completa en memoria. */
export async function validarMp4(tamano: number, leer: Leer): Promise<void> {
  let visitas = 0;
  async function cajas(inicio: number, fin: number) {
    const cajas: Caja[] = [];
    while (inicio < fin) {
      if (++visitas > 8192 || fin - inicio < 8) throw invalido();
      const h = await leer(inicio, Math.min(16, fin - inicio));
      const tipo = h.toString('latin1', 4, 8);
      let n = h.readUInt32BE(0),
        cabecera = 8;
      if (n === 0) n = fin - inicio;
      if (n === 1) {
        if (h.length < 16) throw invalido();
        n = Number(h.readBigUInt64BE(8));
        cabecera = 16;
      }
      if (!Number.isSafeInteger(n) || n < cabecera || inicio + n > fin) throw invalido();
      cajas.push({ tipo, cuerpo: inicio + cabecera, fin: inicio + n });
      inicio += n;
    }
    return cajas;
  }
  const raiz = await cajas(0, tamano);
  const ftyp = raiz[0],
    moov = raiz.find((c) => c.tipo === 'moov');
  if (
    ftyp?.tipo !== 'ftyp' ||
    ftyp.fin - ftyp.cuerpo < 8 ||
    !moov ||
    !raiz.some((c) => c.tipo === 'mdat' && c.fin > c.cuerpo)
  )
    throw invalido();
  for (const trak of (await cajas(moov.cuerpo, moov.fin)).filter((c) => c.tipo === 'trak')) {
    const mdia = (await cajas(trak.cuerpo, trak.fin)).find((c) => c.tipo === 'mdia');
    if (!mdia) continue;
    const contenido = await cajas(mdia.cuerpo, mdia.fin);
    const h = contenido.find((c) => c.tipo === 'hdlr'),
      minf = contenido.find((c) => c.tipo === 'minf');
    if (!h || !minf || h.fin - h.cuerpo < 12 || (await leer(h.cuerpo + 8, 4)).toString() !== 'vide') continue;
    const stbl = (await cajas(minf.cuerpo, minf.fin)).find((c) => c.tipo === 'stbl');
    if (!stbl) continue;
    const stsd = (await cajas(stbl.cuerpo, stbl.fin)).find((c) => c.tipo === 'stsd');
    if (!stsd || stsd.fin - stsd.cuerpo < 16) continue;
    const entradas = await cajas(stsd.cuerpo + 8, stsd.fin);
    for (const v of entradas.filter((c) => ['avc1', 'avc3'].includes(c.tipo) && c.fin - c.cuerpo >= 86)) {
      const extension = await cajas(v.cuerpo + 78, v.fin);
      if (extension.some((c) => c.tipo === 'avcC' && c.fin - c.cuerpo >= 7)) return;
    }
  }
  throw invalido();
}

export function rangoVideo(cabecera: string, tamano: number): { inicio: number; fin: number } | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(cabecera);
  if (!m || !(m[1] || m[2])) return null;
  const inicio = m[1] ? Number(m[1]) : Math.max(0, tamano - Number(m[2]));
  const fin = m[1] && m[2] ? Math.min(tamano - 1, Number(m[2])) : tamano - 1;
  if (!Number.isSafeInteger(inicio) || !Number.isSafeInteger(fin) || inicio >= tamano || inicio > fin)
    return null;
  return { inicio, fin: Math.min(fin, inicio + TAMANO_PARTE - 1) };
}
