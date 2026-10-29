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
