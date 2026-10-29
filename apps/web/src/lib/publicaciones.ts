// Registros públicos (PRIVACY.md P-38): lo comparten el servidor y la app.
import type { Tipo } from '$lib/boveda/modelo';

/** Casa, laburo y lo de alguien no se pueden hacer públicos. */
export const TIPOS_PUBLICABLES: Tipo[] = ['banio_publico', 'ruta', 'naturaleza', 'otro'];

/** Un registro público aparece unas horas después: nadie sabe dónde estás ahora. */
export const DEMORA_HORAS = 2;

export interface Publicacion {
	id: string;
	seudonimo: string;
	tipo: Tipo;
	dia: string;
	lat: number;
	lon: number;
	banio_id: string | null;
	banio_nombre: string | null;
	sin_papel: boolean;
}
