// Ubicaciones cargadas a mano (PRIVACY.md P-41): seguir links cortos de Google
// Maps y buscar direcciones en Nominatim (OpenStreetMap). Lo hace el servidor
// para que el celular no hable con terceros (P-16). Lo que se busca no se guarda
// ni se escribe en logs: es una ubicación.

/** A dónde puede llevar la redirección de un link corto. Nada más: no es un proxy. */
const HOSTS_PERMITIDOS = /^(maps\.app\.goo\.gl|goo\.gl|(www\.|maps\.)?google\.com(\.ar)?)$/;

export class EnlaceNoSoportado extends Error {}

/** Sigue hasta 5 redirecciones sin bajar las páginas; devuelve la URL final. */
export async function seguirCorto(url: string, f: typeof fetch = fetch): Promise<string> {
	let actual = new URL(url);
	for (let i = 0; i < 6; i++) {
		if (actual.protocol !== 'https:' || !HOSTS_PERMITIDOS.test(actual.hostname)) throw new EnlaceNoSoportado();
		const r = await f(actual.href, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(8000) });
		const destino = r.headers.get('location');
		await r.body?.cancel();
		if (r.status < 300 || r.status >= 400 || !destino) return actual.href;
		actual = new URL(destino, actual);
	}
	throw new EnlaceNoSoportado();
}

export interface Resultado {
	nombre: string;
	lat: number;
	lon: number;
}

// Nominatim pide como mucho un pedido por segundo (política de uso de OSMF).
let ultimo = 0;
async function turno() {
	const espera = ultimo + 1100 - Date.now();
	ultimo = Math.max(Date.now(), ultimo + 1100);
	if (espera > 0) await new Promise((r) => setTimeout(r, espera));
}

export async function buscarDireccion(q: string, url: string, origen: string, f: typeof fetch = fetch): Promise<Resultado[]> {
	await turno();
	const u = new URL(url);
	u.search = new URLSearchParams({ q, format: 'jsonv2', countrycodes: 'ar', limit: '5', 'accept-language': 'es' }).toString();
	const r = await f(u, {
		headers: { 'user-agent': `DondeCague/1.0 (+${origen}; dondecague@gmail.com)`, referer: origen },
		signal: AbortSignal.timeout(10_000)
	});
	if (!r.ok) throw new Error(`Nominatim: HTTP ${r.status}`);
	const datos = (await r.json()) as { display_name: string; lat: string; lon: string }[];
	return datos
		.map((d) => ({ nombre: d.display_name.split(', ').slice(0, 4).join(', '), lat: Number(d.lat), lon: Number(d.lon) }))
		.filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lon));
}
