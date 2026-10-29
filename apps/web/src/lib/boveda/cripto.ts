// Cifrado de la bóveda en el dispositivo (DESIGN.md §6.2, PRIVACY.md P-03 y P-04).
// El servidor recibe solo bytes cifrados con identificadores opacos y la llave
// envuelta con el código de recuperación. El código y la llave nunca salen del celular.

const texto = new TextEncoder();
const VERSION = 'dondecague-boveda-v1';

/** Las páginas se rellenan hasta el múltiplo de 4 KB siguiente (P-04). */
export const BLOQUE = 4096;
/** Iteraciones de PBKDF2. El código tiene 128 bits: el KDF lento es un extra. */
export const ITERACIONES = 310_000;

export interface Llaves {
	cifrado: CryptoKey;
	paginas: CryptoKey;
}

export function b64(bytes: Uint8Array): string {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function deB64(s: string): Uint8Array<ArrayBuffer> {
	const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

const azar = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** Secreto de la bóveda: 32 bytes al azar, de donde salen las dos llaves. */
export const generarSecreto = () => azar(32);

/** Llaves no exportables: ni un script inyectado puede sacarlas en crudo. */
export async function derivarLlaves(secreto: Uint8Array<ArrayBuffer>): Promise<Llaves> {
	const base = await crypto.subtle.importKey('raw', secreto, 'HKDF', false, ['deriveKey']);
	const hkdf = (info: string) => ({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: texto.encode(`${VERSION}/${info}`) });
	return {
		cifrado: await crypto.subtle.deriveKey(hkdf('cifrado'), base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']),
		paginas: await crypto.subtle.deriveKey(hkdf('paginas'), base, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign'])
	};
}

/** Id opaco de una página: HMAC del nombre ("2026-10", "general"). El servidor no sabe qué mes es. */
export async function idPagina(llaves: Llaves, nombre: string): Promise<string> {
	const firma = new Uint8Array(await crypto.subtle.sign('HMAC', llaves.paginas, texto.encode(nombre)));
	return b64(firma.slice(0, 18));
}

export async function cifrarPagina(llaves: Llaves, contenido: unknown): Promise<{ nonce: string; cifrado: string }> {
	const plano = texto.encode(JSON.stringify(contenido));
	// Relleno con espacios: JSON.parse los ignora al final.
	const relleno = new Uint8Array(Math.ceil((plano.length + 1) / BLOQUE) * BLOQUE).fill(0x20);
	relleno.set(plano);
	const nonce = azar(12);
	const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: texto.encode(VERSION) }, llaves.cifrado, relleno);
	return { nonce: b64(nonce), cifrado: b64(new Uint8Array(cifrado)) };
}

export async function descifrarPagina<T>(llaves: Llaves, nonce: string, cifrado: string): Promise<T> {
	const plano = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: deB64(nonce), additionalData: texto.encode(VERSION) },
		llaves.cifrado,
		deB64(cifrado)
	);
	return JSON.parse(new TextDecoder().decode(plano)) as T;
}

// Código de recuperación: 128 bits en base32 de Crockford, de a 4 letras.
const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generarCodigo(): string {
	const bytes = azar(16);
	let bits = 0;
	let acumulado = 0;
	let s = '';
	for (const b of bytes) {
		acumulado = (acumulado << 8) | b;
		bits += 8;
		while (bits >= 5) {
			s += ALFABETO[(acumulado >> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits) s += ALFABETO[(acumulado << (5 - bits)) & 31];
	return s.match(/.{1,4}/g)!.join('-');
}

/** Acepta minúsculas, espacios y las letras que se confunden (O→0, I/L→1). */
export function normalizarCodigo(c: string): string {
	const limpio = c
		.toUpperCase()
		.replace(/O/g, '0')
		.replace(/[IL]/g, '1')
		.replace(/U/g, 'V')
		.replace(/[^0-9A-Z]/g, '');
	return limpio.match(/.{1,4}/g)?.join('-') ?? '';
}

export const codigoCompleto = (c: string) => normalizarCodigo(c).replace(/-/g, '').length === 26;

export interface Envuelta {
	envuelta: string;
	parametros: { v: 1; kdf: 'PBKDF2-SHA256'; it: number; sal: string };
}

async function llaveDeCodigo(codigo: string, sal: Uint8Array<ArrayBuffer>, it: number): Promise<CryptoKey> {
	const base = await crypto.subtle.importKey('raw', texto.encode(normalizarCodigo(codigo)), 'PBKDF2', false, ['deriveKey']);
	return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: it }, base, { name: 'AES-GCM', length: 256 }, false, [
		'encrypt',
		'decrypt'
	]);
}

export async function envolver(secreto: Uint8Array<ArrayBuffer>, codigo: string, it = ITERACIONES): Promise<Envuelta> {
	const sal = azar(16);
	const nonce = azar(12);
	const llave = await llaveDeCodigo(codigo, sal, it);
	const c = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: texto.encode(VERSION) }, llave, secreto));
	const junto = new Uint8Array(12 + c.length);
	junto.set(nonce);
	junto.set(c, 12);
	return { envuelta: b64(junto), parametros: { v: 1, kdf: 'PBKDF2-SHA256', it, sal: b64(sal) } };
}

/** null si el código no es el correcto. */
export async function desenvolver(e: Envuelta, codigo: string): Promise<Uint8Array<ArrayBuffer> | null> {
	const junto = deB64(e.envuelta);
	const llave = await llaveDeCodigo(codigo, deB64(e.parametros.sal), e.parametros.it);
	try {
		const plano = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: junto.slice(0, 12), additionalData: texto.encode(VERSION) },
			llave,
			junto.slice(12)
		);
		return new Uint8Array(plano);
	} catch {
		return null;
	}
}
