// Compartir una caca: privada, solo con amigos (P-43) o pública (P-38).
// Requiere conexión: el cambio se hace primero en el servidor y después se
// anota en el historial.
import { api } from '$lib/cliente/api';
import { TIPOS_PUBLICABLES, type Alcance } from '$lib/publicaciones';
import type { Boveda } from './boveda';
import type { Registro } from './modelo';

export type Compartir = 'privada' | Alcance;

/** Casa, laburo y lo de alguien nunca; el resto, si se sabe dónde fue. */
export function sePuedePublicar(r: Pick<Registro, 'tipo' | 'banio_id' | 'lat'>): boolean {
	return TIPOS_PUBLICABLES.includes(r.tipo) && (r.banio_id !== undefined || r.lat !== undefined);
}

export const compartidaCon = (r: Pick<Registro, 'publico' | 'amigos'>): Compartir =>
	r.publico ? 'publico' : r.amigos ? 'amigos' : 'privada';

/** Día en la hora del celular: lo único del momento que se publica. */
export function diaLocal(iso: string): string {
	const d = new Date(iso);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Cambia con quién se comparte. Devuelve el número en el mapa público si queda
 * pública; null si no. conComentario: mostrar también la anécdota (P-42).
 */
export async function compartir(boveda: Boveda, r: Registro, con: Compartir, conComentario = false): Promise<number | null> {
	let numero: number | null = null;
	if (con !== 'privada') {
		if (!sePuedePublicar(r)) throw new Error('Este registro no se puede compartir');
		({ numero } = await api<{ numero: number | null }>(`/publicaciones/${r.id}`, {
			metodo: 'PUT',
			cuerpo: {
				tipo: r.tipo,
				dia: diaLocal(r.ocurrido_en),
				...(r.banio_id ? { banio_id: r.banio_id } : { lat: r.lat, lon: r.lon }),
				sin_papel: r.sin_papel === true,
				alcance: con,
				...(conComentario && r.comentario ? { comentario: r.comentario } : {})
			}
		}));
	} else {
		await api(`/publicaciones/${r.id}`, { metodo: 'DELETE' });
	}
	const { publico: _, amigos: __, numero_publico: ___, comentario_publico: ____, ...resto } = r;
	const anecdota = con !== 'privada' && conComentario && r.comentario ? { comentario_publico: true as const } : {};
	await boveda.guardar({
		...resto,
		...(con === 'publico' ? { publico: true, ...(numero ? { numero_publico: numero } : {}) } : {}),
		...(con === 'amigos' ? { amigos: true } : {}),
		...anecdota,
		actualizado_en: new Date().toISOString()
	});
	return numero;
}
