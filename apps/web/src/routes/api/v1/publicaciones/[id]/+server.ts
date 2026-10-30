import { error, json } from '@sveltejs/kit';
import { exigirSesion } from '$lib/server/auth/sesiones';
import { permitir } from '$lib/server/auth/limites';
import { db } from '$lib/server/db';
import { cuerpoJson, sinContenido } from '$lib/server/http';
import { DEMORA_MINUTOS, problemaComentarioPublico, TIPOS_PUBLICABLES } from '$lib/publicaciones';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const red = (n: number) => Math.round(n * 1e4) / 1e4;

/**
 * Hacer público un registro (PRIVACY.md P-38). Solo lo que el usuario eligió:
 * tipo, día, y el baño o un punto redondeado a ~11 m. Nunca casa, laburo ni lo
 * de alguien. Los demás la ven 30 minutos después; el dueño, enseguida.
 */
export const PUT = async (event) => {
	const sesion = await exigirSesion(event.cookies);
	const id = event.params.id;
	if (!UUID.test(id)) error(400, 'Registro inválido.');
	if (!permitir(`publicar:${sesion.id}`, 60, 24 * 3600_000)) error(429, 'Publicaste muchas cosas hoy. Probá mañana.');
	const c = await cuerpoJson<{
		tipo: string;
		dia: string;
		banio_id?: string;
		lat?: number;
		lon?: number;
		sin_papel?: boolean;
		comentario?: string;
		alcance?: string;
	}>(event);
	// Sin valor por defecto: un alcance que falta es un error, no "pública".
	const alcance = c.alcance;
	if (alcance !== 'publico' && alcance !== 'amigos') error(400, 'Falta con quién compartirla.');
	if (!TIPOS_PUBLICABLES.includes(c.tipo as never)) error(400, 'Lo de casa, el laburo o lo de alguien no se puede hacer público.');
	if (typeof c.dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.dia) || isNaN(Date.parse(c.dia))) error(400, 'Día inválido.');
	if (Date.parse(c.dia) > Date.now() + 36 * 3600_000) error(400, 'Ese día todavía no pasó.');

	// La anécdota, solo si el dueño eligió mostrarla (P-42).
	let comentario: string | null = null;
	if (c.comentario !== undefined && c.comentario !== null) {
		if (typeof c.comentario !== 'string') error(400, 'Anécdota inválida.');
		const problema = problemaComentarioPublico(c.comentario);
		if (problema) error(400, problema);
		comentario = c.comentario.trim();
	}

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
	// En una transacción y no con "on conflict": así el número del mapa público
	// se pide solo cuando hace falta (pasa a pública y no tenía), sin gastar números.
	const fila = await sql.begin(async (tx) => {
		const [actual] = await tx`select cuenta_id from publicaciones where id = ${id} for update`;
		if (actual && actual.cuenta_id !== sesion.id) return null;
		if (!actual) {
			const [nueva] = await tx`
				insert into publicaciones (id, cuenta_id, tipo, banio_id, lat, lon, dia, sin_papel, comentario, alcance, numero, visible_desde)
				values (${id}, ${sesion.id}, ${c.tipo}, ${banio}, ${lat}, ${lon}, ${c.dia}, ${c.sin_papel === true}, ${comentario}, ${alcance},
				        case when ${alcance} = 'publico' then nextval('publicaciones_numero') end,
				        now() + make_interval(mins => ${DEMORA_MINUTOS}))
				returning numero`;
			return nueva;
		}
		const [cambiada] = await tx`
			update publicaciones set tipo = ${c.tipo}, banio_id = ${banio}, lat = ${lat}, lon = ${lon}, dia = ${c.dia},
				sin_papel = ${c.sin_papel === true},
				-- Un texto nuevo vuelve a empezar sin reportes; el mismo, conserva su estado.
				comentario_oculto = comentario_oculto and comentario is not distinct from ${comentario},
				comentario = ${comentario},
				alcance = ${alcance},
				-- Pasar a pública le da número si no tenía; el número no se pierde.
				numero = coalesce(numero, case when ${alcance} = 'publico' then nextval('publicaciones_numero') end)
			where id = ${id}
			returning numero`;
		return cambiada;
	});
	if (!fila) error(409, 'Ese registro no es tuyo.');
	return json({ ok: true, numero: alcance === 'publico' ? Number(fila.numero) : null });
};

/** Despublicar: se borra en el acto. */
export const DELETE = async ({ cookies, params }) => {
	const sesion = await exigirSesion(cookies);
	if (!UUID.test(params.id)) error(400, 'Registro inválido.');
	await db()`delete from publicaciones where id = ${params.id} and cuenta_id = ${sesion.id}`;
	return sinContenido();
};
