import { json } from '@sveltejs/kit';
import { leerSesion } from '$lib/server/auth/sesiones';
import { db } from '$lib/server/db';
import type { Publicacion } from '$lib/publicaciones';

/**
 * Las cacas públicas propias, también las que todavía no ven los demás (los
 * primeros 30 minutos), con desde cuándo las ven. Sin sesión, lista vacía.
 */
export const GET = async ({ cookies }) => {
	const sesion = await leerSesion(cookies);
	if (!sesion) return json({ publicaciones: [] });
	const filas = await db()`
		select p.id, p.numero, p.tipo, p.dia, p.banio_id, p.sin_papel, p.visible_desde,
		       coalesce(p.lat, b.lat) as lat, coalesce(p.lon, b.lon) as lon, coalesce(b.nombre, b.marca) as banio_nombre
		from publicaciones p left join osm.candidatos b on b.id = p.banio_id
		where p.cuenta_id = ${sesion.id} and (p.lat is not null or b.id is not null)
		order by p.numero desc`;
	const publicaciones: Publicacion[] = filas.map((f) => ({
		id: f.id,
		numero: Number(f.numero),
		seudonimo: sesion.seudonimo,
		tipo: f.tipo,
		dia: (f.dia as Date).toISOString().slice(0, 10),
		lat: f.lat,
		lon: f.lon,
		banio_id: f.banio_id,
		banio_nombre: f.banio_nombre ?? (f.banio_id ? 'Baño' : null),
		sin_papel: f.sin_papel,
		visible_desde: (f.visible_desde as Date).toISOString()
	}));
	return json({ publicaciones });
};
