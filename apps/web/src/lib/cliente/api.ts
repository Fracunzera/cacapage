// Cliente de la API. URL base configurable para la app nativa futura
// (DESIGN.md §14.2 R2); en la web es el mismo origen.
const BASE = '/api/v1';

export class ErrorApi extends Error {
	constructor(
		public estado: number,
		mensaje: string
	) {
		super(mensaje);
	}
}

export async function api<T = unknown>(ruta: string, opciones: { metodo?: string; cuerpo?: unknown } = {}): Promise<T> {
	let r: Response;
	try {
		r = await fetch(BASE + ruta, {
			method: opciones.metodo ?? (opciones.cuerpo === undefined ? 'GET' : 'POST'),
			headers: opciones.cuerpo === undefined ? undefined : { 'Content-Type': 'application/json' },
			body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
			credentials: 'same-origin'
		});
	} catch {
		throw new ErrorApi(0, 'Sin conexión. Para entrar o crear la cuenta hace falta internet.');
	}
	if (r.status === 204) return undefined as T;
	const datos = await r.json().catch(() => ({}));
	if (!r.ok) throw new ErrorApi(r.status, (datos as { message?: string }).message ?? 'Algo salió mal. Probá de nuevo.');
	return datos as T;
}
