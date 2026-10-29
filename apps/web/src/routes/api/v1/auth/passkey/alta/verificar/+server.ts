import { error, json } from '@sveltejs/kit';
import { verifyRegistrationResponse, type RegistrationResponseJSON } from '@simplewebauthn/server';
import { randomUUID } from 'node:crypto';
import { crearCuenta, SeudonimoTomado } from '$lib/server/auth/cuentas';
import { iniciarSesion } from '$lib/server/auth/sesiones';
import { exigirPasskeys, tomarDesafio } from '$lib/server/auth/webauthn';
import { cfg } from '$lib/server/config';
import { db } from '$lib/server/db';
import { cuerpoJson, limitarPorIp } from '$lib/server/http';

export const POST = async (event) => {
	exigirPasskeys();
	limitarPorIp(event, 'passkey', 30, 60_000);
	const { desafio_id, respuesta } = await cuerpoJson<{ desafio_id: string; respuesta: RegistrationResponseJSON }>(event);
	const { desafio, alta } = await tomarDesafio(desafio_id, 'alta');
	if (!alta) error(400, 'Desafío inválido.');

	let verificacion;
	try {
		verificacion = await verifyRegistrationResponse({
			response: respuesta,
			expectedChallenge: desafio,
			expectedOrigin: cfg().origen,
			expectedRPID: cfg().rpId,
			requireUserVerification: false
		});
	} catch {
		error(400, 'No se pudo verificar la passkey.');
	}
	if (!verificacion.verified) error(400, 'No se pudo verificar la passkey.');
	const { credential } = verificacion.registrationInfo;
	const prf = (respuesta.clientExtensionResults as { prf?: { enabled?: boolean } })?.prf?.enabled === true;

	let cuentaId: string;
	try {
		cuentaId = await db().begin(async (tx) => {
			const id = await crearCuenta(tx, alta);
			await tx`insert into credenciales_passkey (id, cuenta_id, credencial_id, clave_publica, contador_firma, transportes, soporta_prf)
				values (${randomUUID()}, ${id}, ${credential.id}, ${Buffer.from(credential.publicKey)}, ${credential.counter},
				        ${credential.transports ?? []}, ${prf})`;
			return id;
		});
	} catch (e) {
		if (e instanceof SeudonimoTomado) error(409, 'Ese seudónimo lo tomaron recién. Elegí otro.');
		throw e;
	}
	await iniciarSesion(event.cookies, cuentaId);
	return json({ seudonimo: alta.seudonimo });
};
