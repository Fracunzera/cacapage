import { error, json } from '@sveltejs/kit';
import { exigirSesion } from '$lib/server/auth/sesiones';
import { permitir } from '$lib/server/auth/limites';
import { cfg } from '$lib/server/config';
import { buscarDireccion } from '$lib/server/ubicacion';

/** Dirección → lugares posibles (Nominatim). Lo buscado no se guarda ni se loguea. */
export const GET = async ({ cookies, url }) => {
	const sesion = await exigirSesion(cookies);
	if (!permitir(`ubicacion:${sesion.id}`, 60, 3600_000)) error(429, 'Demasiadas búsquedas. Probá en un rato.');
	const q = (url.searchParams.get('q') ?? '').trim();
	if (q.length < 3 || q.length > 200) error(400, 'Escribí una dirección.');
	try {
		return json({ resultados: await buscarDireccion(q, cfg().nominatimUrl, cfg().origen) });
	} catch {
		error(502, 'El buscador de direcciones no respondió. Probá de nuevo o pegá las coordenadas.');
	}
};
