import { error, type Cookies } from '@sveltejs/kit';
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

export const PEDIR_REAUTENTICACION = 'Por seguridad, volvé a entrar (hace menos de 5 minutos) para cambiar cómo entrás a tu cuenta.';

/**
 * La sesión, y además que se haya entrado hace menos de 5 minutos: para lo que
 * permitiría quedarse con la cuenta (cambiar o quitar formas de entrar) o
 * borrarla. Con la custodia del historial (P-40), una sesión robada no alcanza.
 */
export async function exigirReautenticacion(cookies: Cookies): Promise<CuentaSesion> {
	const s = await exigirSesion(cookies);
	if (!s.reautenticada) error(403, PEDIR_REAUTENTICACION);
	return s;
}

/** La sesión o un 401. */
export async function exigirSesion(cookies: Cookies): Promise<CuentaSesion> {
	const s = await leerSesion(cookies);
	if (!s) error(401, 'No hay sesión.');
	return s;
}
