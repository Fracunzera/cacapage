import type { Cookies } from '@sveltejs/kit';
import { db } from '../db';
import { hashToken, tokenAleatorio } from './cripto';

// __Host-: solo este host, Secure, Path=/ y sin Domain. Ningún otro subdominio
// puede leerla ni pisarla (DESIGN.md §15.2).
export const COOKIE_SESION = '__Host-sesion';
const DURACION_DIAS = 30;
const REAUTENTICACION_MIN = 5;

export interface CuentaSesion {
	id: string;
	seudonimo: string;
	reautenticada: boolean;
}

export async function iniciarSesion(cookies: Cookies, cuentaId: string): Promise<void> {
	const token = tokenAleatorio();
	await db()`delete from sesiones where vence_en < now()`;
	await db()`insert into sesiones (id_hash, cuenta_id, vence_en, reautenticada_hasta)
		values (${hashToken(token)}, ${cuentaId}, now() + ${DURACION_DIAS + ' days'}::interval,
		        now() + ${REAUTENTICACION_MIN + ' minutes'}::interval)`;
	cookies.set(COOKIE_SESION, token, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: DURACION_DIAS * 86400
	});
}

export async function leerSesion(cookies: Cookies): Promise<CuentaSesion | null> {
	const token = cookies.get(COOKIE_SESION);
	if (!token) return null;
	const [fila] = await db()`
		select c.id, c.seudonimo, s.reautenticada_hasta > now() as reautenticada
		from sesiones s join cuentas c on c.id = s.cuenta_id
		where s.id_hash = ${hashToken(token)} and s.vence_en > now() and c.estado = 'activa'`;
	return fila ? { id: fila.id, seudonimo: fila.seudonimo, reautenticada: fila.reautenticada } : null;
}

export async function cerrarSesion(cookies: Cookies): Promise<void> {
	const token = cookies.get(COOKIE_SESION);
	if (token) await db()`delete from sesiones where id_hash = ${hashToken(token)}`;
	cookies.delete(COOKIE_SESION, { path: '/', secure: true });
}
