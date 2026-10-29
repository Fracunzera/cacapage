import { error, json } from '@sveltejs/kit';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { normalizarSeudonimo, problemaAlta, type DatosAlta } from '$lib/cuentas/validacion';
import { seudonimoLibre } from '$lib/server/auth/cuentas';
import { exigirPasskeys, guardarDesafio, nuevoUserId } from '$lib/server/auth/webauthn';
import { cfg } from '$lib/server/config';
import { cuerpoJson, limitarPorIp } from '$lib/server/http';

export const POST = async (event) => {
	exigirPasskeys();
	limitarPorIp(event, 'passkey', 30, 60_000);
	const alta = await cuerpoJson<DatosAlta>(event);
	const problema = problemaAlta(alta);
	if (problema) error(400, problema);
	if (!(await seudonimoLibre(alta.seudonimo))) error(409, 'Ese seudónimo ya está tomado.');

	const seudonimo = normalizarSeudonimo(alta.seudonimo);
	const opciones = await generateRegistrationOptions({
		rpName: cfg().rpNombre,
		rpID: cfg().rpId,
		userName: seudonimo,
		userDisplayName: seudonimo,
		userID: nuevoUserId(),
		attestationType: 'none',
		authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
		// PRF permite derivar la llave de la bóveda desde la passkey (PRIVACY.md P-03).
		extensions: { prf: {} } as never
	});
	const desafio_id = await guardarDesafio(opciones.challenge, 'alta', {
		seudonimo,
		mayor_de_edad: true,
		acepta_terminos: true
	});
	return json({ desafio_id, opciones });
};
