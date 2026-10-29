// Puntajes y reportes de baños: lo comparten el servidor y la app.

/** Con esta cantidad de cuentas distintas que lo reportan, el baño sale del mapa. */
export const REPORTES_PARA_OCULTAR = 15;

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
	/** Si quien pregunta entró: para ofrecer puntuar o pedir que entre. */
	con_sesion: boolean;
}
