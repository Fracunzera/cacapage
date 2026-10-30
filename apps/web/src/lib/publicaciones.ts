// Registros públicos (PRIVACY.md P-38): lo comparten el servidor y la app.
import type { Tipo } from '$lib/boveda/modelo';

/** Con quién se comparte una caca: todos (mapa de cacas) o solo amigos (P-43). */
export type Alcance = 'publico' | 'amigos';


/** Casa, laburo y lo de alguien no se pueden hacer públicos. */
export const TIPOS_PUBLICABLES: Tipo[] = ['banio_publico', 'ruta', 'naturaleza', 'otro'];
/** Esos tres, solo con amigos (que ven el punto exacto). */
export const TIPOS_SOLO_AMIGOS: Tipo[] = ['casa', 'laburo', 'casa_ajena'];

export const tipoCompartible = (tipo: string, alcance: Alcance) =>
	TIPOS_PUBLICABLES.includes(tipo as Tipo) || (alcance === 'amigos' && TIPOS_SOLO_AMIGOS.includes(tipo as Tipo));

/**
 * Un registro público aparece para los demás 30 minutos después: nadie sabe
 * dónde estás en este momento. El dueño lo ve enseguida (/publicaciones/mias).
 */
export const DEMORA_MINUTOS = 30;

/** Con estos reportes de cuentas elegibles se oculta el texto, hasta revisarlo. */
export const REPORTES_COMENTARIO = 3;
export const COMENTARIO_PUBLICO_MAX = 500;

/**
 * Por qué una anécdota no se puede publicar tal cual, o null. Sin links, mails
 * ni teléfonos: corta el spam y que alguien publique datos de otra persona.
 */
export function problemaComentarioPublico(texto: string): string | null {
	const t = texto.trim();
	if (!t) return 'La anécdota está vacía.';
	if (t.length > COMENTARIO_PUBLICO_MAX) return `Puede tener hasta ${COMENTARIO_PUBLICO_MAX} caracteres.`;
	if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(t)) return 'Para publicarla, sacale los mails.';
	if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|ar|net|org|io|me|ly|app|link)\b/i.test(t)) return 'Para publicarla, sacale los links.';
	if ((t.match(/\d/g) ?? []).length >= 7 && /\d[\d\s().-]{6,}\d/.test(t)) return 'Para publicarla, sacale los números de teléfono.';
	return null;
}

export interface Publicacion {
	id: string;
	/** "La N.º 100 del mapa público": correlativo, no cambia. null si es solo de amigos. */
	numero: number | null;
	alcance?: Alcance;
	seudonimo: string;
	tipo: Tipo;
	dia: string;
	lat: number;
	lon: number;
	banio_id: string | null;
	banio_nombre: string | null;
	sin_papel: boolean;
	/** La anécdota, si su dueño eligió mostrarla y no está oculta por reportes. */
	comentario?: string;
	/** Solo en las propias: el texto está oculto por reportes, en revisión. */
	comentario_oculto?: boolean;
	/** Solo en las propias (/publicaciones/mias): desde cuándo la ven los demás. */
	visible_desde?: string;
}

/** "en 25 min" / "en 1 min"; null si ya es visible para todos. */
export function faltaParaTodos(visibleDesde: string | undefined, ahora = Date.now()): string | null {
	if (!visibleDesde) return null;
	const min = Math.ceil((Date.parse(visibleDesde) - ahora) / 60_000);
	return min > 0 ? `en ${min} min` : null;
}
