export interface Punto {
	lat: number;
	lon: number;
}

/** Distancia en metros (aproximación plana; sobra para cientos de metros). */
export function distanciaM(a: Punto, b: Punto): number {
	const r = Math.PI / 180;
	const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
	const y = (b.lat - a.lat) * r;
	return Math.sqrt(x * x + y * y) * 6_371_000;
}

export const textoDistancia = (m: number) =>
	m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
