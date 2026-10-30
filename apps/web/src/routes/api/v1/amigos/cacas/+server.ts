import { json } from '@sveltejs/kit';
import { exigirSesion } from '$lib/server/auth/sesiones';
import { db } from '$lib/server/db';
import { DIAS_AMIGOS, type Publicacion } from '$lib/publicaciones';

/**
 * Lo que compartieron mis amigos: lo de "solo amigos" de los últimos 30 días
 * (P-21) y lo público del último año. Con la misma demora que el mapa público.
 */
export const GET = async ({ cookies }) => {
	const sesion = await exigirSesion(cookies);
	const filas = await db()`
		select p.id, p.numero, p.alcance, c.seudonimo, p.tipo, p.dia, p.banio_id, p.sin_papel,
		       case when p.comentario_oculto then null else p.comentario end as comentario,
		       coalesce(p.lat, b.lat) as lat, coalesce(p.lon, b.lon) as lon, coalesce(b.nombre, b.marca) as banio_nombre
		from amistades a
		join publicaciones p on p.cuenta_id = case when a.cuenta_a = ${sesion.id} then a.cuenta_b else a.cuenta_a end
		join cuentas c on c.id = p.cuenta_id and c.estado = 'activa'
		left join osm.candidatos b on b.id = p.banio_id
		where (a.cuenta_a = ${sesion.id} or a.cuenta_b = ${sesion.id})
		  and p.visible_desde <= now()
		  and p.dia > current_date - case when p.alcance = 'amigos' then ${DIAS_AMIGOS}::int else 365 end
		  and (p.lat is not null or b.id is not null)
		order by p.visible_desde desc
		limit 2000`;
	const publicaciones: Publicacion[] = filas.map((f) => ({
		id: f.id,
		numero: f.numero === null ? null : Number(f.numero),
		alcance: f.alcance,
		seudonimo: f.seudonimo,
		tipo: f.tipo,
		dia: (f.dia as Date).toISOString().slice(0, 10),
		lat: f.lat,
		lon: f.lon,
		banio_id: f.banio_id,
		banio_nombre: f.banio_nombre ?? (f.banio_id ? 'Baño' : null),
		sin_papel: f.sin_papel,
		...(f.comentario ? { comentario: f.comentario } : {})
	}));
	return json({ publicaciones });
};
