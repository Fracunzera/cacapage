import type { RequestHandler } from './$types';
import { catalogo } from '$lib/server/osm/catalogo';

/** Catálogo público de baños (DESIGN.md §12.3). Sin cookies ni datos de usuarios. */
export const GET: RequestHandler = async ({ request }) => {
	const c = await catalogo();
	const cabeceras: Record<string, string> = {
		'Content-Type': 'application/json; charset=utf-8',
		'Cache-Control': 'public, max-age=3600',
		ETag: c.etag,
		Vary: 'Accept-Encoding'
	};
	if (request.headers.get('if-none-match') === c.etag) return new Response(null, { status: 304, headers: cabeceras });
	if (/\bgzip\b/.test(request.headers.get('accept-encoding') ?? ''))
		return new Response(new Uint8Array(c.gzip), { headers: { ...cabeceras, 'Content-Encoding': 'gzip' } });
	return new Response(new Uint8Array(c.cuerpo), { headers: cabeceras });
};
