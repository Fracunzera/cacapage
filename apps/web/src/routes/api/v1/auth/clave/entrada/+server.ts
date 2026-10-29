import { error, json } from '@sveltejs/kit';
import { normalizarSeudonimo } from '$lib/cuentas/validacion';
import { gastarTiempoIgual, verificarClave } from '$lib/server/auth/claves';
import { acierto, espera, fallo, type ReglaDemora } from '$lib/server/auth/limites';
import { iniciarSesion } from '$lib/server/auth/sesiones';
import { db } from '$lib/server/db';
import { cuerpoJson, limitarPorIp } from '$lib/server/http';

const MAL = 'Seudónimo o contraseña incorrectos.';

// Demora creciente en vez de bloqueo (los seudónimos son públicos en /cacas: un
// bloqueo fijo dejaba a cualquiera sin poder entrar). Por cuenta y conexión,
// fuerte; por cuenta desde cualquier lado, con tope de un minuto para el dueño.
const POR_CONEXION: ReglaDemora = { libres: 5, baseMs: 2000, topeMs: 15 * 60_000 };
const POR_CUENTA: ReglaDemora = { libres: 20, baseMs: 1000, topeMs: 60_000 };

export const POST = async (event) => {
	limitarPorIp(event, 'clave-entrada', 20, 600_000);
	const { seudonimo, clave } = await cuerpoJson<{ seudonimo: string; clave: string }>(event);
	if (typeof seudonimo !== 'string' || typeof clave !== 'string' || clave.length > 200) error(400, MAL);
	const s = normalizarSeudonimo(seudonimo);
	let ip = 'desconocida';
	try {
		ip = event.getClientAddress();
	} catch {
		// Sin dirección (pruebas).
	}
	const claves = { conexion: `clave:${s}:${ip}`, cuenta: `clave:${s}` };
	const ms = Math.max(espera(claves.conexion), espera(claves.cuenta));
	if (ms > 0) {
		const seg = Math.ceil(ms / 1000);
		return json(
			{ message: `Muchos intentos fallidos. Esperá ${seg < 60 ? `${seg} segundos` : `${Math.ceil(seg / 60)} minutos`} o entrá con otro método.` },
			{ status: 429, headers: { 'Retry-After': String(seg) } }
		);
	}
	const fallar = () => {
		fallo(claves.conexion, POR_CONEXION);
		fallo(claves.cuenta, POR_CUENTA);
		error(400, MAL);
	};

	const [fila] = await db()`select c.id, c.seudonimo, k.huella from cuentas c join claves k on k.cuenta_id = c.id
		where lower(c.seudonimo) = ${s} and c.estado = 'activa'`;
	if (!fila) {
		await gastarTiempoIgual(clave);
		fallar();
	}
	if (!(await verificarClave(clave, fila.huella))) fallar();
	acierto(claves.conexion);
	acierto(claves.cuenta);
	await iniciarSesion(event.cookies, fila.id);
	return json({ seudonimo: fila.seudonimo });
};
