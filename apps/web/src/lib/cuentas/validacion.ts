// Reglas compartidas entre el navegador y el servidor.

export const SEUDONIMO_MIN = 3;
export const SEUDONIMO_MAX = 24;
const PATRON = /^[a-z0-9_]+$/;
const RESERVADOS = new Set([
	'admin',
	'administrador',
	'root',
	'soporte',
	'moderador',
	'moderacion',
	'sistema',
	'dondecague',
	'donde_cague',
	'anonimo',
	'prueba',
	'null',
	'undefined'
]);

export const VERSION_TERMINOS = 'terminos-borrador-2026-10';
export const VERSION_PRIVACIDAD = 'privacidad-borrador-2026-10-30l';

export function normalizarSeudonimo(s: string): string {
	return s.trim().toLowerCase();
}

/** null si es válido; si no, el motivo para mostrarle al usuario. */
export function problemaSeudonimo(s: string): string | null {
	const n = normalizarSeudonimo(s);
	if (n.length < SEUDONIMO_MIN || n.length > SEUDONIMO_MAX)
		return `Tiene que tener entre ${SEUDONIMO_MIN} y ${SEUDONIMO_MAX} caracteres.`;
	if (!PATRON.test(n)) return 'Solo letras sin acento, números y guion bajo.';
	if (RESERVADOS.has(n)) return 'Ese seudónimo está reservado.';
	return null;
}

export function normalizarMail(m: string): string {
	return m.trim().toLowerCase();
}

export function mailValido(m: string): boolean {
	const n = normalizarMail(m);
	return n.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n);
}

export interface DatosAlta {
	seudonimo: string;
	mayor_de_edad: boolean;
	acepta_terminos: boolean;
}

/** Valida los datos de alta; devuelve el motivo del primer problema o null. */
export function problemaAlta(a: Partial<DatosAlta> | undefined): string | null {
	if (!a) return 'Faltan los datos de la cuenta.';
	const p = problemaSeudonimo(a.seudonimo ?? '');
	if (p) return p;
	if (a.mayor_de_edad !== true) return 'Por ahora es solo para mayores de 18.';
	if (a.acepta_terminos !== true) return 'Tenés que aceptar los términos y la política de privacidad.';
	return null;
}

export const CLAVE_MIN = 10;
export const CLAVE_MAX = 200;
const CLAVES_COMUNES = new Set([
	'1234567890',
	'12345678910',
	'0123456789',
	'qwertyuiop',
	'contraseña',
	'contrasena',
	'contraseña123',
	'password123',
	'passwordpassword',
	'1111111111',
	'aaaaaaaaaa',
	'dondecague',
	'dondecague123',
	'argentina1',
	'riogallegos'
]);

/** null si la contraseña sirve; si no, el motivo. */
export function problemaClave(clave: string, seudonimo = ''): string | null {
	if (clave.length < CLAVE_MIN) return `Tiene que tener al menos ${CLAVE_MIN} caracteres.`;
	if (clave.length > CLAVE_MAX) return `Puede tener hasta ${CLAVE_MAX} caracteres.`;
	const n = clave.toLowerCase();
	if (CLAVES_COMUNES.has(n) || /^(.)\1+$/.test(n)) return 'Es demasiado fácil de adivinar.';
	if (seudonimo && n.includes(normalizarSeudonimo(seudonimo))) return 'No puede contener tu seudónimo.';
	return null;
}
