import type { NextFunction, Request, Response } from 'express';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const UMBRAL_BYTES = 1024;

/**
 * Comprime las respuestas JSON grandes (`catálogo`, `temarios`, `analíticas`, `auditoría`) con Gzip o Brotli
 * cuando el cliente lo acepta (`Accept-Encoding`) y el cuerpo supera 1 KB, reduciendo el peso de transferencia
 * entre el backend y el cliente sin tocar binarios ya comprimidos (imágenes y PDFs).
 */
export function comprimirRespuestas(req: Request, res: Response, next: NextFunction): void {
  const enviarOriginal = res.send.bind(res);

  res.send = function enviarComprimido(cuerpo?: unknown): Response {
    if (
      req.method === 'HEAD' ||
      res.headersSent ||
      res.getHeader('Content-Encoding') ||
      (typeof cuerpo !== 'string' && !Buffer.isBuffer(cuerpo))
    ) {
      return enviarOriginal(cuerpo);
    }

    const tipo = String(res.getHeader('Content-Type') ?? '');
    if (!tipo.includes('application/json') && !tipo.includes('text/')) {
      return enviarOriginal(cuerpo);
    }

    res.vary('Accept-Encoding');

    const buffer = typeof cuerpo === 'string' ? Buffer.from(cuerpo, 'utf8') : cuerpo;
    if (buffer.byteLength < UMBRAL_BYTES) {
      return enviarOriginal(cuerpo);
    }

    const acepta = String(req.headers['accept-encoding'] ?? '');
    if (/\bgzip\b/i.test(acepta)) {
      const comprimido = gzipSync(buffer, { level: constants.Z_DEFAULT_COMPRESSION });
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Length', String(comprimido.byteLength));
      return enviarOriginal(comprimido);
    }
    if (/\bbr\b/i.test(acepta)) {
      const comprimido = brotliCompressSync(buffer, {
        params: { [constants.BROTLI_PARAM_QUALITY]: 4 },
      });
      res.setHeader('Content-Encoding', 'br');
      res.setHeader('Content-Length', String(comprimido.byteLength));
      return enviarOriginal(comprimido);
    }

    return enviarOriginal(cuerpo);
  };

  next();
}
