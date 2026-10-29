import { error, json, type RequestEvent } from '@sveltejs/kit';
import { permitir } from './auth/limites';

export async function cuerpoJson<T>(event: RequestEvent): Promise<T> {
	try {
		return (await event.request.json()) as T;
	} catch {
		error(400, 'El pedido no es JSON válido.');
	}
}

/** Límite por IP; la IP solo vive en memoria (PRIVACY.md P-19). */
export function limitarPorIp(event: RequestEvent, accion: string, maximo: number, ventanaMs: number): void {
	let ip = 'desconocida';
	try {
		ip = event.getClientAddress();
	} catch {
		// Sin dirección (pruebas): se limita como un solo cliente.
	}
	if (!permitir(`${accion}:${ip}`, maximo, ventanaMs)) error(429, 'Demasiados intentos. Probá de nuevo en un rato.');
}

export const sinContenido = () => new Response(null, { status: 204 });
export const aceptado = () => json({ ok: true }, { status: 202 });
