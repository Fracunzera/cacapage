import { error, json } from '@sveltejs/kit';
import { exigirSesion } from '$lib/server/auth/sesiones';
import { db } from '$lib/server/db';
import { cuerpoJson, sinContenido } from '$lib/server/http';

// Por página. En base64 (~342 KB) entra en el límite de cuerpo de adapter-node (512 KB).
const MAXIMO_BYTES = 256 * 1024;
/**
 * Tope por cuenta. Con páginas mensuales de 4 KB, 500 páginas son más de 40
 * años de historial: el tope solo frena el abuso (usar la bóveda de disco).
 */
const MAXIMO_PAGINAS = 500;
const MAXIMO_TOTAL_BYTES = 10 * 1024 * 1024;
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
		// Bloquea la cuenta: dos PUT en paralelo no pueden pasar juntos el tope.
		await tx`select 1 from cuentas where id = ${sesion.id} for update`;
		const [actual] = await tx`select version from boveda_paginas
			where cuenta_id = ${sesion.id} and pagina_id = ${id} for update`;
		const versionActual = actual ? actual.version : 0;
		if (versionActual !== esperada) return { conflicto: true, version: versionActual };
		const [uso] = await tx`select count(*)::int as paginas, coalesce(sum(octet_length(cifrado)), 0)::bigint as bytes
			from boveda_paginas where cuenta_id = ${sesion.id} and pagina_id <> ${id}`;
		if (uso.paginas + 1 > MAXIMO_PAGINAS)
			return { lleno: `Tu historial llegó al máximo de ${MAXIMO_PAGINAS} páginas. Escribinos a dondecague@gmail.com.` };
		if (Number(uso.bytes) + cifrado.length > MAXIMO_TOTAL_BYTES)
			return { lleno: 'Tu historial llegó al máximo de 10 MB. Escribinos a dondecague@gmail.com.' };
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
	if ('lleno' in resultado) error(413, resultado.lleno!);
	if (resultado.conflicto) return json({ message: 'La página cambió en otro dispositivo.', version: resultado.version }, { status: 409 });
	return json({ version: resultado.version, seq: resultado.seq });
};

export const DELETE = async ({ cookies, params }) => {
	const sesion = await exigirSesion(cookies);
	if (!ID.test(params.id)) error(400, 'Página inválida.');
	await db()`delete from boveda_paginas where cuenta_id = ${sesion.id} and pagina_id = ${params.id}`;
	return sinContenido();
};
