import { error, json } from '@sveltejs/kit';
import { exigirSesion } from '$lib/server/auth/sesiones';
import { permitir } from '$lib/server/auth/limites';
import { db } from '$lib/server/db';
import { cuerpoJson } from '$lib/server/http';
import { exigirBanio } from '$lib/server/opiniones';
import { ANTIGUEDAD_MINIMA_DIAS, MOTIVOS, REPORTES_PARA_REVISION } from '$lib/opiniones';

/**
 * Reportar un baño; uno por cuenta. Se guardan todos, pero solo cuentan los de
 * cuentas con 7 días o más que registraron algo (dias_activos ≥ 1). Con 15 de
 * esos, el baño queda "en revisión": sigue en el mapa, con aviso. Nada se oculta
 * solo: ocultarlo es a mano, después de revisar (docs/despliegue.md). Se cuenta
 * dentro de la misma transacción, con el baño bloqueado.
 */
export const POST = async (event) => {
	const sesion = await exigirSesion(event.cookies);
	const id = event.params.id;
	await exigirBanio(id);
	if (!permitir(`reporte:${sesion.id}`, 30, 24 * 3600_000)) error(429, 'Reportaste muchos baños hoy. Probá mañana.');
	const { motivo } = await cuerpoJson<{ motivo: string }>(event);
	if (!MOTIVOS.some((m) => m.id === motivo)) error(400, 'Motivo inválido.');
	const enRevision = await db().begin(async (tx) => {
		await tx`select pg_advisory_xact_lock(hashtext(${'reporte:' + id}))`;
		await tx`insert into banio_reportes (banio_id, cuenta_id, motivo) values (${id}, ${sesion.id}, ${motivo})
			on conflict (banio_id, cuenta_id) do update set motivo = excluded.motivo`;
		const [{ n }] = await tx`select count(*)::int as n from banio_reportes r join cuentas c on c.id = r.cuenta_id
			where r.banio_id = ${id} and c.estado = 'activa' and c.dias_activos >= 1
			  and c.creada_en <= current_date - ${ANTIGUEDAD_MINIMA_DIAS}::int`;
		if (n < REPORTES_PARA_REVISION) return false;
		await tx`insert into banios_en_revision (banio_id, reportes) values (${id}, ${n})
			on conflict (banio_id) do update set reportes = excluded.reportes`;
		return true;
	});
	return json({ ok: true, en_revision: enRevision });
};
