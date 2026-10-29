import type { Handle, ServerInit } from '@sveltejs/kit';
import { building } from '$app/environment';
import { migrar } from '$lib/server/db';
import { ES_PRUEBA } from '$lib/server/entorno';
import { cfg } from '$lib/server/config';
import { programarImportacion } from '$lib/server/osm/importar';

// Al arrancar: validar la configuración (falla si falta algo) y migrar la base.
export const init: ServerInit = async () => {
	if (building) return;
	const config = cfg();
	const aplicadas = await migrar();
	if (aplicadas.length) console.log(`Migraciones aplicadas: ${aplicadas.join(', ')}`);
	if (config.osm.importar) programarImportacion(config.osm.servidores, ES_PRUEBA ? 10 * 60_000 : 10_000);
};

/** Rutas que solo existen con ENTORNO=prueba. */
const SOLO_PRUEBA = ['/app/relevamiento'];

const BANNER_PRUEBA =
	'<p class="banner-prueba" role="status">Entorno de prueba: lo que cargues acá se borra al migrar.</p>';

export const handle: Handle = async ({ event, resolve }) => {
	const ruta = event.url.pathname;
	if (!ES_PRUEBA && SOLO_PRUEBA.some((r) => ruta === r || ruta.startsWith(r + '/'))) {
		return new Response('No encontrado', { status: 404 });
	}

	// La app (cuenta, historial) no se indexa; las páginas públicas sí, salvo en prueba.
	const privada = ruta === '/app' || ruta.startsWith('/app/');
	const noIndexar = ES_PRUEBA || privada;
	const respuesta = await resolve(event, {
		transformPageChunk: ({ html }) =>
			html
				.replace('%cacapage.robots%', noIndexar ? 'noindex, nofollow' : 'index, follow')
				.replace('%cacapage.banner%', ES_PRUEBA ? BANNER_PRUEBA : '')
	});

	// En prueba, nada se indexa (DESIGN.md §15.3). Va por cabecera porque un
	// Disallow en robots.txt impediría que Google viera el noindex.
	if (noIndexar || ruta.startsWith('/api/')) respuesta.headers.set('X-Robots-Tag', 'noindex, nofollow');
	respuesta.headers.set('Referrer-Policy', 'no-referrer');
	// El catálogo de baños es público y cacheable: lo define su propio endpoint.
	if (ruta.startsWith('/api/') && !respuesta.headers.has('Cache-Control')) respuesta.headers.set('Cache-Control', 'no-store');
	respuesta.headers.set('Permissions-Policy', 'geolocation=(self)');
	return respuesta;
};
