import { error, json } from '@sveltejs/kit';
import { exigirSesion } from '$lib/server/auth/sesiones';
import { permitir } from '$lib/server/auth/limites';
import { db } from '$lib/server/db';
import { cuerpoJson, sinContenido } from '$lib/server/http';
import { DEMORA_HORAS, TIPOS_PUBLICABLES } from '$lib/publicaciones';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const red = (n: number) => Math.round(n * 1e4) / 1e4;

/**
 * Hacer público un registro (PRIVACY.md P-38). Solo lo que el usuario eligió:
 * tipo, día, y el baño o un punto redondeado a ~11 m. Nunca casa, laburo ni lo
 * de alguien. Aparece en el mapa unas horas después.
 */
export const PUT = async (event) => {
	const sesion = await exigirSesion(event.cookies);
	const id = event.params.id;
	if (!UUID.test(id)) error(400, 'Registro inválido.');
	if (!permitir(`publicar:${sesion.id}`, 60, 24 * 3600_000)) error(429, 'Publicaste muchas cosas hoy. Probá mañana.');
	const c = await cuerpoJson<{ tipo: string; dia: string; banio_id?: string; lat?: number; lon?: number; sin_papel?: boolean }>(event);
	if (!TIPOS_PUBLICABLES.includes(c.tipo as never)) error(400, 'Lo de casa, el laburo o lo de alguien no se puede hacer público.');
	if (typeof c.dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.dia) || isNaN(Date.parse(c.dia))) error(400, 'Día inválido.');
	if (Date.parse(c.dia) > Date.now() + 36 * 3600_000) error(400, 'Ese día todavía no pasó.');

	const sql = db();
	let banio: string | null = null;
	let lat: number | null = null;
	let lon: number | null = null;
	if (c.banio_id) {
		if (typeof c.banio_id !== 'string' || !/^[nwr]\d+$/.test(c.banio_id)) error(400, 'Baño inválido.');
		const [b] = await sql`select 1 from osm.candidatos c where id = ${c.banio_id}
			and not exists (select 1 from banios_ocultos o where o.banio_id = c.id)`;
		if (!b) error(400, 'Ese baño no está en el mapa.');
		banio = c.banio_id;
	} else {
		if (typeof c.lat !== 'number' || typeof c.lon !== 'number' || Math.abs(c.lat) > 90 || Math.abs(c.lon) > 180)
			error(400, 'Para hacerlo público hace falta la ubicación.');
		lat = red(c.lat);
		lon = red(c.lon);
	}
	const [fila] = await sql`
		insert into publicaciones (id, cuenta_id, tipo, banio_id, lat, lon, dia, sin_papel, visible_desde)
		values (${id}, ${sesion.id}, ${c.tipo}, ${banio}, ${lat}, ${lon}, ${c.dia}, ${c.sin_papel === true},
		        now() + make_interval(hours => ${DEMORA_HORAS}))
		on conflict (id) do update set tipo = excluded.tipo, banio_id = excluded.banio_id, lat = excluded.lat,
			lon = excluded.lon, dia = excluded.dia, sin_papel = excluded.sin_papel
		where publicaciones.cuenta_id = ${sesion.id}
		returning numero`;
	if (!fila) error(409, 'Ese registro no es tuyo.');
	return json({ ok: true, numero: Number(fila.numero) });
};

/** Despublicar: se borra en el acto. */
export const DELETE = async ({ cookies, params }) => {
	const sesion = await exigirSesion(cookies);
	if (!UUID.test(params.id)) error(400, 'Registro inválido.');
	await db()`delete from publicaciones where id = ${params.id} and cuenta_id = ${sesion.id}`;
	return sinContenido();
};
