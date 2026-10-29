import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { normalizarSeudonimo, VERSION_PRIVACIDAD, VERSION_TERMINOS, type DatosAlta } from '$lib/cuentas/validacion';
import { db } from '../db';

export async function seudonimoLibre(seudonimo: string): Promise<boolean> {
	const [fila] = await db()`select 1 from cuentas where lower(seudonimo) = ${normalizarSeudonimo(seudonimo)}`;
	return !fila;
}

export class SeudonimoTomado extends Error {}

/** Crea la cuenta con sus consentimientos dentro de la transacción dada. */
export async function crearCuenta(tx: postgres.TransactionSql, alta: DatosAlta): Promise<string> {
	const id = randomUUID();
	try {
		await tx`insert into cuentas (id, seudonimo, mayor_de_edad)
			values (${id}, ${normalizarSeudonimo(alta.seudonimo)}, ${alta.mayor_de_edad})`;
	} catch (e) {
		if ((e as { code?: string }).code === '23505') throw new SeudonimoTomado();
		throw e;
	}
	await tx`insert into consentimientos (cuenta_id, tipo, version_texto) values
		(${id}, 'terminos', ${VERSION_TERMINOS}), (${id}, 'privacidad', ${VERSION_PRIVACIDAD})`;
	return id;
}
