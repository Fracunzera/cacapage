import { json } from '@sveltejs/kit';
import { leerSesion } from '$lib/server/auth/sesiones';
import { db } from '$lib/server/db';
import { exigirBanio } from '$lib/server/opiniones';
import type { Opiniones } from '$lib/opiniones';

/** Promedio y cantidad de puntajes (sin quién), y con sesión, lo propio. */
export const GET = async ({ params, cookies }) => {
	await exigirBanio(params.id);
	const sesion = await leerSesion(cookies);
	const sql = db();
	const [p] = await sql`select avg(puntaje)::float as promedio, count(*)::int as cantidad
		from banio_puntajes where banio_id = ${params.id}`;
	let mio: number | null = null;
	let reportado = false;
	if (sesion) {
		const [m] = await sql`select puntaje from banio_puntajes where banio_id = ${params.id} and cuenta_id = ${sesion.id}`;
		const [r] = await sql`select 1 from banio_reportes where banio_id = ${params.id} and cuenta_id = ${sesion.id}`;
		mio = m?.puntaje ?? null;
		reportado = Boolean(r);
	}
	const datos: Opiniones = { promedio: p.promedio === null ? null : Math.round(p.promedio * 10) / 10, cantidad: p.cantidad, mio, reportado, con_sesion: sesion !== null };
	return json(datos);
};
