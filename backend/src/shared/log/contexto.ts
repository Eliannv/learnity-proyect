import { AsyncLocalStorage } from 'node:async_hooks';

/** Contexto de la petición en curso. Lo abre el middleware `correlacion` y lo lee `registrarEvento`. */
interface ContextoPeticion {
  idPeticion: string;
}

const almacen = new AsyncLocalStorage<ContextoPeticion>();

export function conContextoPeticion<T>(idPeticion: string, trabajo: () => T): T {
  return almacen.run({ idPeticion }, trabajo);
}

export function idPeticionActual(): string | undefined {
  return almacen.getStore()?.idPeticion;
}
