import type { RequestHandler } from './$types';
import { VERSION_PRIVACIDAD, VERSION_TERMINOS } from '$lib/cuentas/validacion';
import { cfg } from '$lib/server/config';
import { db } from '$lib/server/db';

/** La fecha que trae la versión del texto legal ("…-2026-10-30e" → 2026-10-30). */
const fechaDe = (version: string) => /(\d{4}-\d{2}(?:-\d{2})?)/.exec(version)?.[1] ?? __FECHA_BUILD__;
const dia = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : __FECHA_BUILD__);

/** Páginas públicas, con su última modificación. */
export const GET: RequestHandler = async () => {
	const sql = db();
	const [osm] = await sql`select max(empezada_en) as fecha from osm.importaciones where estado = 'ok'`;
	const [pub] = await sql`select max(visible_desde) as fecha from publicaciones where visible_desde <= now()`;
	const paginas: [string, string][] = [
		['/', __FECHA_BUILD__],
		['/mapa', dia(osm?.fecha)],
		['/cacas', dia(pub?.fecha)],
		['/privacidad', fechaDe(VERSION_PRIVACIDAD)],
		['/terminos', fechaDe(VERSION_TERMINOS)]
	];
	const origen = cfg().origen;
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paginas.map(([ruta, fecha]) => `\t<url><loc>${origen}${ruta}</loc><lastmod>${fecha}</lastmod></url>`).join('\n')}
</urlset>
`;
	return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
