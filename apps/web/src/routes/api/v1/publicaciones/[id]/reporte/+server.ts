import { error, json } from '@sveltejs/kit';
import { exigirSesion } from '$lib/server/auth/sesiones';
import { permitir } from '$lib/server/auth/limites';
import { db } from '$lib/server/db';
import { ANTIGUEDAD_MINIMA_DIAS } from '$lib/opiniones';
import { REPORTES_COMENTARIO } from '$lib/publicaciones';

/**
 * Reportar la anécdota de una caca pública; uno por cuenta, no la propia. Con 3
 * reportes de cuentas elegibles (7 días o más y algún día con registros) se
 * oculta el texto, no el punto, hasta revisarlo a mano (docs/despliegue.md).
 */
export const POST = async ({ params, cookies }) => {
	const sesion = await exigirSesion(cookies);
	if (!/^[0-9a-f-]{36}$/.test(params.id)) error(400, 'Inválido.');
	if (!permitir(`reporte-comentario:${sesion.id}`, 30, 24 * 3600_000)) error(429, 'Reportaste mucho hoy. Probá mañana.');
	const oculto = await db().begin(async (tx) => {
		const [p] = await tx`select cuenta_id, comentario from publicaciones where id = ${params.id} for update`;
		if (!p?.comentario) error(404, 'No hay comentario para reportar.');
		if (p.cuenta_id === sesion.id) error(400, 'No podés reportar tu propio comentario.');
		await tx`insert into comentario_reportes (publicacion_id, cuenta_id) values (${params.id}, ${sesion.id}) on conflict do nothing`;
		const [{ n }] = await tx`select count(*)::int as n from comentario_reportes r join cuentas c on c.id = r.cuenta_id
			where r.publicacion_id = ${params.id} and c.estado = 'activa' and c.dias_activos >= 1
			  and c.creada_en <= current_date - ${ANTIGUEDAD_MINIMA_DIAS}::int`;
		if (n < REPORTES_COMENTARIO) return false;
		await tx`update publicaciones set comentario_oculto = true where id = ${params.id}`;
		return true;
	});
	return json({ ok: true, oculto });
};
