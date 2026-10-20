import { z } from 'zod';
import { idRuta } from '../../shared/http/esquemas.js';

export const idContenidoRuta = z.object({ id: idRuta }).transform(({ id }) => id);
