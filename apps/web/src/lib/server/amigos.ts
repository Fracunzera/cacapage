// Amistades (PRIVACY.md P-43): mutuas, una fila por par con cuenta_a < cuenta_b.
import type postgres from 'postgres';

export const par = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x]);

/** Ids de las cuentas amigas de `cuentaId`. */
export function amigosDe(sql: postgres.Sql, cuentaId: string) {
	return sql`
		select case when cuenta_a = ${cuentaId} then cuenta_b else cuenta_a end as id, desde
		from amistades where cuenta_a = ${cuentaId} or cuenta_b = ${cuentaId}`;
}

/** Tope de amigos por cuenta. */
export const MAXIMO_AMIGOS = 500;
/** Un link de invitación dura una semana y sirve para varias personas. */
export const DIAS_INVITACION = 7;
