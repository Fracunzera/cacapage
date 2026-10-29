import { json } from '@sveltejs/kit';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { exigirPasskeys, guardarDesafio } from '$lib/server/auth/webauthn';
import { cfg } from '$lib/server/config';
import { limitarPorIp } from '$lib/server/http';

// Passkeys descubribles: no hace falta decir quién sos antes de entrar.
export const POST = async (event) => {
	exigirPasskeys();
	limitarPorIp(event, 'passkey', 30, 60_000);
	const opciones = await generateAuthenticationOptions({ rpID: cfg().rpId, userVerification: 'preferred' });
	const desafio_id = await guardarDesafio(opciones.challenge, 'entrada');
	return json({ desafio_id, opciones });
};
