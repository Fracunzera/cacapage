// Límites de intentos en memoria del proceso: no se guardan en la base ni en
// logs (PRIVACY.md P-19). Se reinician si se reinicia el servidor.

const ventanas = new Map<string, { desde: number; cuenta: number }>();

/** true si todavía se permite; suma el intento. */
export function permitir(clave: string, maximo: number, ventanaMs: number): boolean {
	const ahora = Date.now();
	const v = ventanas.get(clave);
	if (!v || ahora - v.desde > ventanaMs) {
		ventanas.set(clave, { desde: ahora, cuenta: 1 });
		return true;
	}
	v.cuenta++;
	return v.cuenta <= maximo;
}

// Limpieza periódica para que el mapa no crezca sin límite.
setInterval(() => {
	const ahora = Date.now();
	for (const [k, v] of ventanas) if (ahora - v.desde > 24 * 3600_000) ventanas.delete(k);
}, 3600_000).unref?.();

/**
 * Demora creciente: los primeros `libres` fallos no esperan; después, cada
 * fallo duplica la espera (desde `baseMs`) hasta `topeMs`. Un acierto la borra;
 * sin fallos durante un día, se olvida. A diferencia de un bloqueo fijo, el
 * peor caso para el dueño legítimo está acotado por `topeMs`.
 */
export interface ReglaDemora {
	libres: number;
	baseMs: number;
	topeMs: number;
}

const fallos = new Map<string, { n: number; hasta: number; ultimo: number }>();

/** Milisegundos que faltan para poder intentar de nuevo (0: ya se puede). */
export function espera(clave: string, ahora = Date.now()): number {
	const f = fallos.get(clave);
	if (!f) return 0;
	if (ahora - f.ultimo > 24 * 3600_000) {
		fallos.delete(clave);
		return 0;
	}
	return Math.max(0, f.hasta - ahora);
}

export function fallo(clave: string, regla: ReglaDemora, ahora = Date.now()): void {
	const f = fallos.get(clave) ?? { n: 0, hasta: 0, ultimo: ahora };
	f.n++;
	f.ultimo = ahora;
	const exceso = f.n - regla.libres;
	f.hasta = exceso > 0 ? ahora + Math.min(regla.topeMs, regla.baseMs * 2 ** (exceso - 1)) : 0;
	fallos.set(clave, f);
}

export function acierto(clave: string): void {
	fallos.delete(clave);
}

setInterval(() => {
	const ahora = Date.now();
	for (const [k, f] of fallos) if (ahora - f.ultimo > 24 * 3600_000) fallos.delete(k);
}, 3600_000).unref?.();
