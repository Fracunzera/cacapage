// Custodia de la llave de la bóveda (PRIVACY.md P-40). La llave de custodia sale
// de PIMIENTA_MAIL, que vive en el .env y no en la base: un volcado o un backup
// de la base solos no alcanzan para leer historiales. Con el servidor entero, sí.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { cfg } from './config';

let llave: Buffer | null = null;
const llaveCustodia = () =>
	(llave ??= Buffer.from(hkdfSync('sha256', cfg().pimientaMail, 'dondecague', 'boveda-custodia-v1', 32)));

/** AES-256-GCM, atado a la cuenta (AAD): no se puede pasar a otra. */
export function sellar(secreto: Buffer, cuentaId: string): Buffer {
	const nonce = randomBytes(12);
	const c = createCipheriv('aes-256-gcm', llaveCustodia(), nonce);
	c.setAAD(Buffer.from(cuentaId));
	return Buffer.concat([nonce, c.update(secreto), c.final(), c.getAuthTag()]);
}

export function abrir(sellado: Buffer, cuentaId: string): Buffer {
	const d = createDecipheriv('aes-256-gcm', llaveCustodia(), sellado.subarray(0, 12));
	d.setAAD(Buffer.from(cuentaId));
	d.setAuthTag(sellado.subarray(sellado.length - 16));
	return Buffer.concat([d.update(sellado.subarray(12, sellado.length - 16)), d.final()]);
}
