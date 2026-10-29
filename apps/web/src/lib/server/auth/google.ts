// Entrar con Google por OpenID Connect, todo del lado del servidor (PRIVACY.md
// P-39): sin scripts de Google en la página, solo el permiso `openid` (ni mail
// ni nombre), con PKCE, `state` y `nonce`.
import { createHash } from 'node:crypto';
import { error, type Cookies } from '@sveltejs/kit';
import { cfg } from '../config';
import { tokenAleatorio } from './cripto';
import type { DatosAlta } from '$lib/cuentas/validacion';

export const COOKIE_GOOGLE = '__Host-google';
const EMISORES = ['https://accounts.google.com', 'accounts.google.com'];

export type ModoGoogle = 'entrar' | 'alta' | 'vincular';

interface Pendiente {
	state: string;
	nonce: string;
	verificador: string;
	modo: ModoGoogle;
	alta?: DatosAlta;
	/** Para vincular: la cuenta que lo pidió. */
	cuenta?: string;
}

export function exigirGoogle() {
	const g = cfg().google;
	if (!g) error(503, 'Entrar con Google no está disponible.');
	return g;
}

export const urlVuelta = () => `${cfg().origen}/api/v1/auth/google/vuelta`;

/** Arma la URL de Google y guarda lo necesario para verificar la vuelta (10 minutos). */
export function iniciar(cookies: Cookies, modo: ModoGoogle, extra: Pick<Pendiente, 'alta' | 'cuenta'> = {}): string {
	const g = exigirGoogle();
	const p: Pendiente = { state: tokenAleatorio(), nonce: tokenAleatorio(), verificador: tokenAleatorio(48), modo, ...extra };
	// SameSite=Lax: vuelve con la redirección de Google (navegación de primer nivel).
	cookies.set(COOKIE_GOOGLE, Buffer.from(JSON.stringify(p)).toString('base64url'), {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: 600
	});
	const u = new URL(g.urlAutorizacion);
	u.search = new URLSearchParams({
		client_id: g.clientId,
		redirect_uri: urlVuelta(),
		response_type: 'code',
		scope: 'openid',
		state: p.state,
		nonce: p.nonce,
		code_challenge: createHash('sha256').update(p.verificador).digest('base64url'),
		code_challenge_method: 'S256',
		prompt: 'select_account'
	}).toString();
	return u.toString();
}

export function leerPendiente(cookies: Cookies): Pendiente | null {
	const v = cookies.get(COOKIE_GOOGLE);
	cookies.delete(COOKIE_GOOGLE, { path: '/', secure: true });
	if (!v) return null;
	try {
		return JSON.parse(Buffer.from(v, 'base64url').toString()) as Pendiente;
	} catch {
		return null;
	}
}

/**
 * Canjea el código y devuelve el `sub` (identificador de la cuenta de Google).
 * El id_token llega directo del endpoint de Google por TLS, así que alcanza con
 * validar emisor, audiencia, vencimiento y nonce (OIDC Core §3.1.3.7, punto 6).
 */
export async function canjear(codigo: string, p: Pendiente): Promise<string> {
	const g = exigirGoogle();
	const r = await fetch(g.urlToken, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			code: codigo,
			redirect_uri: urlVuelta(),
			client_id: g.clientId,
			client_secret: g.clientSecret,
			code_verifier: p.verificador
		}),
		signal: AbortSignal.timeout(15_000)
	});
	if (!r.ok) throw new Error(`token: HTTP ${r.status}`);
	const { id_token } = (await r.json()) as { id_token?: string };
	const partes = id_token?.split('.');
	if (!partes || partes.length !== 3) throw new Error('sin id_token');
	const c = JSON.parse(Buffer.from(partes[1], 'base64url').toString()) as Record<string, unknown>;
	const audiencias = Array.isArray(c.aud) ? c.aud : [c.aud];
	if (!EMISORES.includes(String(c.iss))) throw new Error('emisor inválido');
	if (!audiencias.includes(g.clientId)) throw new Error('audiencia inválida');
	if (typeof c.exp !== 'number' || c.exp * 1000 < Date.now() - 60_000) throw new Error('token vencido');
	if (c.nonce !== p.nonce) throw new Error('nonce inválido');
	if (typeof c.sub !== 'string' || !c.sub) throw new Error('sin sub');
	return c.sub;
}
