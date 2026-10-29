// Hacer pública o privada una caca (PRIVACY.md P-38). Requiere conexión: el
// cambio se hace primero en el servidor y después se anota en el historial.
import { api } from '$lib/cliente/api';
import { TIPOS_PUBLICABLES } from '$lib/publicaciones';
import type { Boveda } from './boveda';
import type { Registro } from './modelo';

/** Casa, laburo y lo de alguien nunca; el resto, si se sabe dónde fue. */
export function sePuedePublicar(r: Pick<Registro, 'tipo' | 'banio_id' | 'lat'>): boolean {
	return TIPOS_PUBLICABLES.includes(r.tipo) && (r.banio_id !== undefined || r.lat !== undefined);
}

/** Día en la hora del celular: lo único del momento que se publica. */
export function diaLocal(iso: string): string {
	const d = new Date(iso);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Devuelve el número en el mapa público al publicar; null al despublicar. */
export async function cambiarPublico(boveda: Boveda, r: Registro, publico: boolean): Promise<number | null> {
	let numero: number | null = null;
	if (publico) {
		if (!sePuedePublicar(r)) throw new Error('Este registro no se puede hacer público');
		({ numero } = await api<{ numero: number }>(`/publicaciones/${r.id}`, {
			metodo: 'PUT',
			cuerpo: {
				tipo: r.tipo,
				dia: diaLocal(r.ocurrido_en),
				...(r.banio_id ? { banio_id: r.banio_id } : { lat: r.lat, lon: r.lon }),
				sin_papel: r.sin_papel === true
			}
		}));
	} else {
		await api(`/publicaciones/${r.id}`, { metodo: 'DELETE' });
	}
	const { publico: _, numero_publico: __, ...resto } = r;
	await boveda.guardar({
		...resto,
		...(publico ? { publico: true, ...(numero ? { numero_publico: numero } : {}) } : {}),
		actualizado_en: new Date().toISOString()
	});
	return numero;
}
