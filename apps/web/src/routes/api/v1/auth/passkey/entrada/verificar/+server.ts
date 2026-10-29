import { error, json } from '@sveltejs/kit';
import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from '@simplewebauthn/server';
import { iniciarSesion } from '$lib/server/auth/sesiones';
import { exigirPasskeys, tomarDesafio } from '$lib/server/auth/webauthn';
import { cfg } from '$lib/server/config';
import { db } from '$lib/server/db';
import { cuerpoJson, limitarPorIp } from '$lib/server/http';

export const POST = async (event) => {
	exigirPasskeys();
	limitarPorIp(event, 'passkey', 30, 60_000);
	const { desafio_id, respuesta } = await cuerpoJson<{ desafio_id: string; respuesta: AuthenticationResponseJSON }>(event);
	const { desafio } = await tomarDesafio(desafio_id, 'entrada');
	const sql = db();
	const [cred] = await sql`
		select p.id, p.cuenta_id, p.credencial_id, p.clave_publica, p.contador_firma, p.transportes, c.seudonimo
		from credenciales_passkey p join cuentas c on c.id = p.cuenta_id
		where p.credencial_id = ${String(respuesta?.id ?? '')} and c.estado = 'activa'`;
	if (!cred) error(400, 'No conocemos esa passkey. ¿Creaste la cuenta en este sitio?');

	let verificacion;
	try {
		verificacion = await verifyAuthenticationResponse({
			response: respuesta,
			expectedChallenge: desafio,
			expectedOrigin: cfg().origen,
			expectedRPID: cfg().rpId,
			credential: {
				id: cred.credencial_id,
				publicKey: new Uint8Array(cred.clave_publica),
				counter: Number(cred.contador_firma),
				transports: cred.transportes
			},
			requireUserVerification: false
		});
	} catch {
		error(400, 'No se pudo verificar la passkey.');
	}
	if (!verificacion.verified) error(400, 'No se pudo verificar la passkey.');
	await sql`update credenciales_passkey set contador_firma = ${verificacion.authenticationInfo.newCounter} where id = ${cred.id}`;
	await iniciarSesion(event.cookies, cred.cuenta_id);
	return json({ seudonimo: cred.seudonimo });
};
