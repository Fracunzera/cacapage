// Cargar una ubicación a mano, sin GPS: coordenadas o un link de un mapa.
// Se interpreta en el celular; solo los links cortos (maps.app.goo.gl) y las
// direcciones pasan por el servidor (PRIVACY.md P-41).

export interface Punto {
	lat: number;
	lon: number;
}

export type Interpretacion =
	| { tipo: 'punto'; punto: Punto; origen: 'coordenadas' | 'enlace' }
	/** Link corto: hay que seguir la redirección (lo hace el servidor). */
	| { tipo: 'corto'; url: string }
	/** Ni coordenadas ni link, o un link que solo trae una dirección: se busca. */
	| { tipo: 'direccion'; texto: string }
	| { tipo: 'invalido'; motivo: string };

/** Hosts de links cortos que el servidor sabe seguir. */
export const HOSTS_CORTOS = ['maps.app.goo.gl', 'goo.gl'];

const valido = (lat: number, lon: number) =>
	Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);

const NUM = String.raw`[-+−]?\d{1,3}(?:\.\d+)?`;

function par(a: string, b: string): Punto | null {
	const n = (s: string) => Number(s.replace('−', '-').replace('+', ''));
	const lat = n(a);
	const lon = n(b);
	return valido(lat, lon) ? { lat, lon } : null;
}

/** "-51.62, -69.22", "-51.62 -69.22", "-51,62; -69,22" (coma decimal con ; o espacio). */
function decimales(t: string): Punto | null {
	let m = new RegExp(`^(${NUM})\\s*[,;\\s]\\s*(${NUM})$`).exec(t);
	if (m) return par(m[1], m[2]);
	m = /^([-+−]?\d{1,3},\d+)\s*[;\s]\s*([-+−]?\d{1,3},\d+)$/.exec(t);
	if (m) return par(m[1].replace(',', '.'), m[2].replace(',', '.'));
	return null;
}

/** 51°37'12.3"S 69°13'4"O (acepta O/W para oeste, E para este, y ′ ″). */
function gms(t: string): Punto | null {
	const parte = String.raw`(\d{1,3})\s*°\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*['′]\s*)?(?:(\d{1,2}(?:[.,]\d+)?)\s*(?:"|″|''|′′)\s*)?([NSEOW])`;
	const m = new RegExp(`^${parte}[\\s,;]*${parte}$`, 'i').exec(t);
	if (!m) return null;
	const a = (g: string, mi?: string, s?: string, h?: string) => {
		const v = Number(g) + Number((mi ?? '0').replace(',', '.')) / 60 + Number((s ?? '0').replace(',', '.')) / 3600;
		return /[SOW]/i.test(h ?? '') ? -v : v;
	};
	let x = { v: a(m[1], m[2], m[3], m[4]), h: m[4].toUpperCase() };
	let y = { v: a(m[5], m[6], m[7], m[8]), h: m[8].toUpperCase() };
	if (/[EOW]/.test(x.h)) [x, y] = [y, x];
	if (!/[NS]/.test(x.h) || !/[EOW]/.test(y.h)) return null;
	return valido(x.v, y.v) ? { lat: x.v, lon: y.v } : null;
}

/** Coordenadas dentro de un link de Google Maps, OpenStreetMap, Apple Maps o Waze. */
function deEnlace(u: URL): Punto | null {
	const todo = decodeURIComponent(u.href);
	// Google: el pin del lugar (!3d…!4d…) es más preciso que el centro de la vista (@…).
	let m = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(todo);
	if (m) return par(m[1], m[2]);
	for (const clave of ['q', 'query', 'll', 'destination', 'daddr', 'center', 'sll']) {
		const v = u.searchParams.get(clave);
		const p = v && new RegExp(`^\\s*(${NUM})\\s*,\\s*(${NUM})`).exec(v);
		if (p) return par(p[1], p[2]);
	}
	const mlat = u.searchParams.get('mlat');
	const mlon = u.searchParams.get('mlon');
	if (mlat && mlon) return par(mlat, mlon);
	m = /#map=\d+(?:\.\d+)?\/(-?\d+\.\d+)\/(-?\d+\.\d+)/.exec(todo);
	if (m) return par(m[1], m[2]);
	m = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(todo);
	if (m) return par(m[1], m[2]);
	return null;
}

/**
 * Un link sin coordenadas pero con la dirección escrita (Google comparte así las
 * direcciones: ?q=Santa+Fe+848,+Río+Gallegos o /maps/place/Santa+Fe+848/…).
 */
function direccionDeEnlace(u: URL): string | null {
	const limpiar = (t: string) => t.replace(/\+/g, ' ').replace(/\s+/g, ' ').trim();
	const conLetras = (t: string | null) => (t && /\p{L}{2,}/u.test(t) ? limpiar(t) : null);
	const m = /\/maps\/(?:place|search)\/([^/@?]+)/.exec(u.pathname);
	if (m) {
		let t: string | null = null;
		try {
			t = decodeURIComponent(m[1].replace(/\+/g, ' '));
		} catch {
			// Mal codificado.
		}
		if (conLetras(t)) return conLetras(t);
	}
	for (const clave of ['q', 'query', 'address', 'daddr', 'destination'])
		if (conLetras(u.searchParams.get(clave))) return conLetras(u.searchParams.get(clave));
	return null;
}

export function interpretar(entrada: string): Interpretacion {
	const t = entrada.trim().replace(/\s+/g, ' ');
	if (!t) return { tipo: 'invalido', motivo: 'Escribí una dirección, unas coordenadas o pegá un link.' };

	const geo = /^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i.exec(t);
	if (geo) {
		const p = par(geo[1], geo[2]);
		return p ? { tipo: 'punto', punto: p, origen: 'enlace' } : { tipo: 'invalido', motivo: 'Esas coordenadas no existen.' };
	}

	// Un link (puede venir con texto alrededor, como cuando se comparte desde el celular).
	const enlace = /https?:\/\/\S+/i.exec(t)?.[0];
	if (enlace) {
		let u: URL;
		try {
			u = new URL(enlace);
		} catch {
			return { tipo: 'invalido', motivo: 'Ese link no se entiende.' };
		}
		const p = deEnlace(u);
		if (p) return { tipo: 'punto', punto: p, origen: 'enlace' };
		if (HOSTS_CORTOS.includes(u.hostname)) return { tipo: 'corto', url: u.href };
		const texto = direccionDeEnlace(u);
		if (texto) return { tipo: 'direccion', texto };
		return { tipo: 'invalido', motivo: 'En ese link no encontramos coordenadas. Probá con el link de "Compartir" del mapa, o con las coordenadas.' };
	}

	const p = decimales(t) ?? gms(t);
	if (p) return { tipo: 'punto', punto: p, origen: 'coordenadas' };
	// Parece un par de números pero no vale: mejor avisar que buscarlo como dirección.
	if (/^[-+−\d.,;\s°'"′″NSEOW]+$/i.test(t) && /\d/.test(t) && !/[a-z]{3,}/i.test(t))
		return { tipo: 'invalido', motivo: 'Esas coordenadas no se entienden. Ejemplo: -51.62, -69.22' };
	return { tipo: 'direccion', texto: t };
}

/** Aproximadamente la Argentina continental, Malvinas y la Antártida cercana. */
export const enArgentina = (p: Punto) => p.lat >= -56 && p.lat <= -21 && p.lon >= -74 && p.lon <= -53;
