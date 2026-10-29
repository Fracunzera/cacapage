import type { RequestHandler } from './$types';
import { cfg } from '$lib/server/config';
import { ES_PRUEBA } from '$lib/server/entorno';

// /app/ no va con Disallow, a propósito: se excluye con noindex (hooks.server.ts),
// y Google tiene que poder rastrear la página para leerlo. Lo mismo en prueba,
// donde todo es noindex (DESIGN.md §15.3).
export const GET: RequestHandler = () => {
	const texto = ES_PRUEBA
		? 'User-agent: *\nAllow: /\n'
		: `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${cfg().origen}/sitemap.xml\n`;
	return new Response(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
