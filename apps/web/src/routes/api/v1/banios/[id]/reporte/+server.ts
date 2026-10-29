import { error, json } from '@sveltejs/kit';
import { exigirSesion } from '$lib/server/auth/sesiones';
import { permitir } from '$lib/server/auth/limites';
import { db } from '$lib/server/db';
import { cuerpoJson } from '$lib/server/http';
import { exigirBanio } from '$lib/server/opiniones';
import { MOTIVOS, REPORTES_PARA_OCULTAR } from '$lib/opiniones';

/**
 * Reportar un baño; uno por cuenta. Con 15 cuentas distintas, sale del mapa
 * (y no vuelve con la importación de OSM). Se cuenta dentro de la misma
 * transacción, con el baño bloqueado, para que dos reportes juntos no se pisen.
 */
export const POST = async (event) => {
	const sesion = await exigirSesion(event.cookies);
	const id = event.params.id;
	await exigirBanio(id);
	if (!permitir(`reporte:${sesion.id}`, 30, 24 * 3600_000)) error(429, 'Reportaste muchos baños hoy. Probá mañana.');
	const { motivo } = await cuerpoJson<{ motivo: string }>(event);
	if (!MOTIVOS.some((m) => m.id === motivo)) error(400, 'Motivo inválido.');
	const oculto = await db().begin(async (tx) => {
		await tx`select pg_advisory_xact_lock(hashtext(${'reporte:' + id}))`;
		await tx`insert into banio_reportes (banio_id, cuenta_id, motivo) values (${id}, ${sesion.id}, ${motivo})
			on conflict (banio_id, cuenta_id) do update set motivo = excluded.motivo`;
		const [{ n }] = await tx`select count(*)::int as n from banio_reportes where banio_id = ${id}`;
		if (n < REPORTES_PARA_OCULTAR) return false;
		await tx`insert into banios_ocultos (banio_id, reportes) values (${id}, ${n}) on conflict do nothing`;
		return true;
	});
	return json({ ok: true, oculto });
};
