import { error, json } from '@sveltejs/kit';
import { exigirSesion } from '$lib/server/auth/sesiones';
import { permitir } from '$lib/server/auth/limites';
import { cuerpoJson } from '$lib/server/http';
import { EnlaceNoSoportado, seguirCorto } from '$lib/server/ubicacion';

/** Link corto de Google Maps → link largo (con las coordenadas). No se guarda ni se loguea. */
export const POST = async (event) => {
	const sesion = await exigirSesion(event.cookies);
	if (!permitir(`ubicacion:${sesion.id}`, 60, 3600_000)) error(429, 'Demasiados pedidos. Probá en un rato.');
	const { url } = await cuerpoJson<{ url: string }>(event);
	if (typeof url !== 'string' || url.length > 300) error(400, 'Link inválido.');
	try {
		return json({ url: await seguirCorto(url) });
	} catch (e) {
		if (e instanceof EnlaceNoSoportado || e instanceof TypeError) error(400, 'Ese link no se pudo abrir. Probá con las coordenadas.');
		error(502, 'No pudimos abrir el link. Probá de nuevo o pegá las coordenadas.');
	}
};
