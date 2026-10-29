import { error, json } from '@sveltejs/kit';
import { normalizarSeudonimo, problemaAlta, type DatosAlta } from '$lib/cuentas/validacion';
import { seudonimoLibre } from '$lib/server/auth/cuentas';
import { iniciar, type ModoGoogle } from '$lib/server/auth/google';
import { leerSesion, PEDIR_REAUTENTICACION } from '$lib/server/auth/sesiones';
import { cuerpoJson, limitarPorIp } from '$lib/server/http';

/** Devuelve la URL de Google a la que tiene que ir el navegador. */
export const POST = async (event) => {
	limitarPorIp(event, 'google', 30, 600_000);
	const { modo, alta } = await cuerpoJson<{ modo: ModoGoogle; alta?: DatosAlta }>(event);
	if (modo === 'alta') {
		const problema = alta ? problemaAlta(alta) : 'Faltan los datos de la cuenta.';
		if (problema) error(400, problema);
		if (!(await seudonimoLibre(alta!.seudonimo))) error(409, 'Ese seudónimo ya está tomado.');
		const datos: DatosAlta = { seudonimo: normalizarSeudonimo(alta!.seudonimo), mayor_de_edad: true, acepta_terminos: true };
		return json({ url: iniciar(event.cookies, 'alta', { alta: datos }) });
	}
	if (modo === 'vincular') {
		const sesion = await leerSesion(event.cookies);
		if (!sesion) error(401, 'No hay sesión.');
		if (!sesion.reautenticada) error(403, PEDIR_REAUTENTICACION);
		return json({ url: iniciar(event.cookies, 'vincular', { cuenta: sesion.id }) });
	}
	if (modo !== 'entrar') error(400, 'Modo inválido.');
	return json({ url: iniciar(event.cookies, 'entrar') });
};
