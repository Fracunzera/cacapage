import type { Handle } from '@sveltejs/kit';
import { ES_PRUEBA } from '$lib/server/entorno';

/** Rutas que solo existen con ENTORNO=prueba. */
const SOLO_PRUEBA = ['/app/relevamiento'];

const BANNER_PRUEBA =
	'<p class="banner-prueba" role="status">Entorno de prueba: lo que cargues acá se borra al migrar.</p>';

export const handle: Handle = async ({ event, resolve }) => {
	const ruta = event.url.pathname;
	if (!ES_PRUEBA && SOLO_PRUEBA.some((r) => ruta === r || ruta.startsWith(r + '/'))) {
		return new Response('No encontrado', { status: 404 });
	}

	const respuesta = await resolve(event, {
		transformPageChunk: ({ html }) =>
			html
				.replace('%cacapage.robots%', ES_PRUEBA ? 'noindex, nofollow' : 'index, follow')
				.replace('%cacapage.banner%', ES_PRUEBA ? BANNER_PRUEBA : '')
	});

	// En prueba, nada se indexa (DESIGN.md §15.3). Va por cabecera porque un
	// Disallow en robots.txt impediría que Google viera el noindex.
	if (ES_PRUEBA) respuesta.headers.set('X-Robots-Tag', 'noindex, nofollow');
	respuesta.headers.set('Referrer-Policy', 'no-referrer');
	respuesta.headers.set('Permissions-Policy', 'geolocation=(self)');
	return respuesta;
};
