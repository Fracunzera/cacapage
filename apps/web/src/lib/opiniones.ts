// Puntajes y reportes de baños: lo comparten el servidor y la app.

/**
 * Con esta cantidad de cuentas elegibles distintas que lo reportan, el baño
 * queda "en revisión" (sigue en el mapa, con aviso). Ocultarlo es a mano.
 */
export const REPORTES_PARA_REVISION = 15;
/** Cuenta elegible para que su reporte cuente: antigüedad y que haya registrado algo. */
export const ANTIGUEDAD_MINIMA_DIAS = 7;

export const MOTIVOS = [
	{ id: 'no_existe', texto: 'No existe o cerró' },
	{ id: 'no_publico', texto: 'No es de uso público' },
	{ id: 'mal_ubicado', texto: 'Está mal ubicado' },
	{ id: 'otro', texto: 'Otro problema' }
] as const;
export type Motivo = (typeof MOTIVOS)[number]['id'];

export interface Opiniones {
	promedio: number | null;
	cantidad: number;
	/** Solo con sesión: lo que puso esta cuenta. */
	mio: number | null;
	reportado: boolean;
	/** Con 15 reportes elegibles: el motivo más reportado. */
	en_revision: Motivo | null;
	/** Si quien pregunta entró: para ofrecer puntuar o pedir que entre. */
	con_sesion: boolean;
}
