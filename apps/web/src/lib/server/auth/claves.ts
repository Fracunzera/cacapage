import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// scrypt con parámetros fuertes: cada verificación cuesta ~32 MB y decenas de
// milisegundos, para que una filtración de la base no sirva para adivinar.
const N = 2 ** 15;
const R = 8;
const P = 1;
const LARGO = 64;
const MAXMEM = 64 * 1024 * 1024;

function scrypt(clave: string, sal: Buffer, n: number, r: number, p: number): Promise<Buffer> {
	const opciones: ScryptOptions = { N: n, r, p, maxmem: MAXMEM };
	return new Promise((ok, mal) => scryptCb(clave.normalize('NFKC'), sal, LARGO, opciones, (e, k) => (e ? mal(e) : ok(k))));
}

/** Formato: scrypt$N$r$p$sal$huella (base64url). */
export async function huellaDe(clave: string): Promise<string> {
	const sal = randomBytes(16);
	const k = await scrypt(clave, sal, N, R, P);
	return ['scrypt', N, R, P, sal.toString('base64url'), k.toString('base64url')].join('$');
}

export async function verificarClave(clave: string, huella: string): Promise<boolean> {
	const [alg, n, r, p, sal, k] = huella.split('$');
	if (alg !== 'scrypt') return false;
	const esperado = Buffer.from(k, 'base64url');
	const obtenido = await scrypt(clave, Buffer.from(sal, 'base64url'), Number(n), Number(r), Number(p));
	return obtenido.length === esperado.length && timingSafeEqual(obtenido, esperado);
}

// Para que "el seudónimo no existe" tarde lo mismo que "la contraseña está mal".
let huellaFicticia: Promise<string> | null = null;
export async function gastarTiempoIgual(clave: string): Promise<void> {
	huellaFicticia ??= huellaDe(randomBytes(16).toString('hex'));
	await verificarClave(clave, await huellaFicticia);
}
