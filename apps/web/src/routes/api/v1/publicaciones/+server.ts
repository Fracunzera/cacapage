import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { Publicacion } from '$lib/publicaciones';

/** Mapa público de cacas: lo que cada uno eligió publicar, del último año. */
export const GET = async () => {
	const filas = await db()`
		select p.id, p.numero, c.seudonimo, p.tipo, p.dia, p.banio_id, p.sin_papel,
		       coalesce(p.lat, b.lat) as lat, coalesce(p.lon, b.lon) as lon,
		       coalesce(b.nombre, b.marca) as banio_nombre, b.categoria
		from publicaciones p
		join cuentas c on c.id = p.cuenta_id and c.estado = 'activa'
		left join osm.candidatos b on b.id = p.banio_id
		where p.visible_desde <= now() and p.dia > current_date - 365
		  and (p.lat is not null or b.id is not null)
		  and (p.banio_id is null or not exists (select 1 from banios_ocultos o where o.banio_id = p.banio_id))
		order by p.dia desc
		limit 20000`;
	const publicaciones: Publicacion[] = filas.map((f) => ({
		id: f.id,
		numero: Number(f.numero),
		seudonimo: f.seudonimo,
		tipo: f.tipo,
		dia: (f.dia as Date).toISOString().slice(0, 10),
		lat: f.lat,
		lon: f.lon,
		banio_id: f.banio_id,
		banio_nombre: f.banio_nombre ?? (f.banio_id ? 'Baño' : null),
		sin_papel: f.sin_papel
	}));
	return json({ publicaciones }, { headers: { 'Cache-Control': 'public, max-age=300' } });
};
