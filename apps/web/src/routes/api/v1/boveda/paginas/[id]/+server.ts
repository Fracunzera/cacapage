import { error, json } from '@sveltejs/kit';
import { exigirSesion } from '$lib/server/auth/sesiones';
import { db } from '$lib/server/db';
import { cuerpoJson, sinContenido } from '$lib/server/http';

const MAXIMO_BYTES = 512 * 1024;
const ID = /^[A-Za-z0-9_-]{16,64}$/;

function bytes(v: unknown, nombre: string, max: number): Buffer {
	if (typeof v !== 'string' || !/^[A-Za-z0-9_-]*$/.test(v)) error(400, `${nombre} inválido.`);
	const b = Buffer.from(v, 'base64url');
	if (b.length === 0 || b.length > max) error(400, `${nombre} con tamaño inválido.`);
	return b;
}

/**
 * Guarda una página cifrada con concurrencia optimista: si otro dispositivo la
 * cambió (version_esperada distinta), 409 y el cliente mezcla y reintenta.
 */
export const PUT = async (event) => {
	const sesion = await exigirSesion(event.cookies);
	const id = event.params.id;
	if (!ID.test(id)) error(400, 'Página inválida.');
	const c = await cuerpoJson<{ nonce: string; cifrado: string; version_esperada: number }>(event);
	const nonce = bytes(c.nonce, 'nonce', 12);
	const cifrado = bytes(c.cifrado, 'cifrado', MAXIMO_BYTES);
	const esperada = Number(c.version_esperada);
	if (!Number.isInteger(esperada) || esperada < 0) error(400, 'version_esperada inválida.');

	const sql = db();
	const resultado = await sql.begin(async (tx) => {
		const [actual] = await tx`select version from boveda_paginas
			where cuenta_id = ${sesion.id} and pagina_id = ${id} for update`;
		const versionActual = actual ? actual.version : 0;
		if (versionActual !== esperada) return { conflicto: true, version: versionActual };
		const [fila] = await tx`
			insert into boveda_paginas (cuenta_id, pagina_id, version, nonce, cifrado)
			values (${sesion.id}, ${id}, ${esperada + 1}, ${nonce}, ${cifrado})
			on conflict (cuenta_id, pagina_id) do update
				set version = excluded.version, nonce = excluded.nonce, cifrado = excluded.cifrado,
				    seq = nextval('boveda_seq')
			returning version, seq`;
		// Días activos, para la elegibilidad (DESIGN.md §9.3): a lo sumo uno por día.
		await tx`update cuentas set dias_activos = least(dias_activos + 1, 32767), ultimo_dia_activo = current_date
			where id = ${sesion.id} and (ultimo_dia_activo is null or ultimo_dia_activo < current_date)`;
		return { conflicto: false, version: fila.version, seq: Number(fila.seq) };
	});
	if (resultado.conflicto) return json({ message: 'La página cambió en otro dispositivo.', version: resultado.version }, { status: 409 });
	return json({ version: resultado.version, seq: resultado.seq });
};

export const DELETE = async ({ cookies, params }) => {
	const sesion = await exigirSesion(cookies);
	if (!ID.test(params.id)) error(400, 'Página inválida.');
	await db()`delete from boveda_paginas where cuenta_id = ${sesion.id} and pagina_id = ${params.id}`;
	return sinContenido();
};
