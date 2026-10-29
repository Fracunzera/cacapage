// Registros públicos (PRIVACY.md P-38): lo comparten el servidor y la app.
import type { Tipo } from '$lib/boveda/modelo';

/** Casa, laburo y lo de alguien no se pueden hacer públicos. */
export const TIPOS_PUBLICABLES: Tipo[] = ['banio_publico', 'ruta', 'naturaleza', 'otro'];

/**
 * Un registro público aparece para los demás 30 minutos después: nadie sabe
 * dónde estás en este momento. El dueño lo ve enseguida (/publicaciones/mias).
 */
export const DEMORA_MINUTOS = 30;

export interface Publicacion {
	id: string;
	/** "La N.º 100 del mapa público": correlativo, no cambia. */
	numero: number;
	seudonimo: string;
	tipo: Tipo;
	dia: string;
	lat: number;
	lon: number;
	banio_id: string | null;
	banio_nombre: string | null;
	sin_papel: boolean;
	/** Solo en las propias (/publicaciones/mias): desde cuándo la ven los demás. */
	visible_desde?: string;
}

/** "en 25 min" / "en 1 min"; null si ya es visible para todos. */
export function faltaParaTodos(visibleDesde: string | undefined, ahora = Date.now()): string | null {
	if (!visibleDesde) return null;
	const min = Math.ceil((Date.parse(visibleDesde) - ahora) / 60_000);
	return min > 0 ? `en ${min} min` : null;
}
