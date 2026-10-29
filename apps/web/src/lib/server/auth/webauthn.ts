import { randomBytes, randomUUID } from 'node:crypto';
import { error } from '@sveltejs/kit';
import type { DatosAlta } from '$lib/cuentas/validacion';
import { cfg } from '../config';
import { db } from '../db';

const VIGENCIA_DESAFIO = '5 minutes';

export function exigirPasskeys(): void {
	// En el entorno de prueba las rutas de passkeys no existen (PRIVACY.md P-31).
	if (!cfg().passkeys) error(404, 'No encontrado');
}

export async function guardarDesafio(desafio: string, tipo: 'alta' | 'entrada', alta?: DatosAlta): Promise<string> {
	const id = randomUUID();
	const sql = db();
	await sql`delete from desafios_webauthn where vence_en < now()`;
	await sql`insert into desafios_webauthn (id, desafio, tipo, alta, vence_en)
		values (${id}, ${desafio}, ${tipo}, ${alta ? sql.json(alta as never) : null}, now() + ${VIGENCIA_DESAFIO}::interval)`;
	return id;
}

/** Devuelve y consume el desafío (un solo uso). */
export async function tomarDesafio(id: unknown, tipo: 'alta' | 'entrada'): Promise<{ desafio: string; alta: DatosAlta | null }> {
	if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) error(400, 'Desafío inválido.');
	const [fila] = await db()`delete from desafios_webauthn
		where id = ${id} and tipo = ${tipo} and vence_en > now() returning desafio, alta`;
	if (!fila) error(400, 'El pedido venció. Probá de nuevo.');
	return { desafio: fila.desafio, alta: fila.alta };
}

/** userID de WebAuthn: aleatorio, sin relación con el id de la cuenta. */
export const nuevoUserId = () => new Uint8Array(randomBytes(32));
