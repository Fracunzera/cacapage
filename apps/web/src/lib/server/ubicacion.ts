// Ubicaciones cargadas a mano (PRIVACY.md P-41): seguir links cortos de Google
// Maps y buscar direcciones en Nominatim (OpenStreetMap). Lo hace el servidor
// para que el celular no hable con terceros (P-16). Lo que se busca no se guarda
// ni se escribe en logs: es una ubicación.

/** A dónde puede llevar la redirección de un link corto. Nada más: no es un proxy. */
const HOSTS_PERMITIDOS = /^(maps\.app\.goo\.gl|goo\.gl|(www\.|maps\.)?google\.com(\.ar)?)$/;
/** Los únicos que se piden: los acortadores. El link largo ya trae lo que hace falta. */
const HOSTS_CORTOS = /^(maps\.app\.goo\.gl|goo\.gl)$/;

export class EnlaceNoSoportado extends Error {}

/**
 * Sigue las redirecciones del acortador (hasta 5) sin bajar páginas y devuelve
 * el link largo. A Google Maps no se le pide nada: según desde dónde se lo pida,
 * redirige a la página de cookies y se perdería el link.
 */
export async function seguirCorto(url: string, f: typeof fetch = fetch): Promise<string> {
	let actual = new URL(url);
	for (let i = 0; i < 6; i++) {
		if (actual.protocol !== 'https:' || !HOSTS_PERMITIDOS.test(actual.hostname)) throw new EnlaceNoSoportado();
		if (!HOSTS_CORTOS.test(actual.hostname)) return actual.href;
		const r = await f(actual.href, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(8000) });
		const destino = r.headers.get('location');
		await r.body?.cancel();
		if (r.status < 300 || r.status >= 400 || !destino) throw new EnlaceNoSoportado();
		actual = new URL(destino, actual);
	}
	throw new EnlaceNoSoportado();
}

export interface Resultado {
	/** "Santa Fe 848 · Río Gallegos, Santa Cruz" */
	nombre: string;
	lat: number;
	lon: number;
	/** Con la altura exacta; si no, es la calle (o el barrio) y hay que ajustar el punto. */
	exacta: boolean;
}

// Nominatim pide como mucho un pedido por segundo (política de uso de OSMF).
let ultimo = 0;
async function turno() {
	const espera = ultimo + 1100 - Date.now();
	ultimo = Math.max(Date.now(), ultimo + 1100);
	if (espera > 0) await new Promise((r) => setTimeout(r, espera));
}

interface Lugar {
	display_name: string;
	lat: string;
	lon: string;
	name?: string;
	address?: Record<string, string>;
}

/** "Santa Fe 848, Río Gallegos" → calle "848 Santa Fe" y ciudad "Río Gallegos". */
export function separar(q: string): { calle: string; ciudad: string } | null {
	const [primera, ...resto] = q.split(',').map((t) => t.trim());
	const ciudad = resto.filter(Boolean).join(', ');
	if (!primera || !ciudad || !/\p{L}/u.test(primera)) return null;
	const m = /^(.*\p{L}.*?)\s+(\d+\s*[a-z]?)$/iu.exec(primera);
	return { calle: m ? `${m[2]} ${m[1]}` : primera, ciudad };
}

function presentar(d: Lugar): Resultado {
	const a = d.address ?? {};
	const calle = a.road ?? a.pedestrian ?? a.footway ?? a.path;
	const ciudad = (a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality ?? a.county)?.replace(/^Municipio de /, '');
	const lugar = calle ? [calle, a.house_number].filter(Boolean).join(' ') : (d.name ?? d.display_name.split(', ')[0]);
	const donde = [a.suburb ?? a.neighbourhood ?? a.quarter, ciudad, a.state ?? a.country].filter((x) => x && x !== lugar);
	return {
		nombre: donde.length ? `${lugar} · ${[...new Set(donde)].join(', ')}` : d.display_name.split(', ').slice(0, 4).join(', '),
		lat: Number(d.lat),
		lon: Number(d.lon),
		exacta: Boolean(a.house_number) || !calle
	};
}

export async function buscarDireccion(q: string, url: string, origen: string, f: typeof fetch = fetch): Promise<Resultado[]> {
	const pedir = async (params: Record<string, string>) => {
		await turno();
		const u = new URL(url);
		u.search = new URLSearchParams({ ...params, format: 'jsonv2', addressdetails: '1', limit: '10', 'accept-language': 'es' }).toString();
		const r = await f(u, {
			headers: { 'user-agent': `DondeCague/1.0 (+${origen}; dondecague@gmail.com)`, referer: origen },
			signal: AbortSignal.timeout(10_000)
		});
		if (!r.ok) throw new Error(`Nominatim: HTTP ${r.status}`);
		return (await r.json()) as Lugar[];
	};
	// "Calle número, ciudad": primero por partes. Si no, en texto libre se confunde
	// (con "Santa Fe 848, Río Gallegos" encuentra la calle Río Gallegos de Roldán).
	const partes = separar(q);
	let datos = partes ? await pedir({ street: partes.calle, city: partes.ciudad }) : [];
	if (!datos.length) datos = await pedir({ q });
	// La misma calle viene en varios tramos: uno por calle y barrio alcanza.
	const vistos = new Set<string>();
	return datos
		.map(presentar)
		.filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lon))
		.filter((d) => !vistos.has(d.nombre) && vistos.add(d.nombre))
		.slice(0, 6);
}
