import { distanciaM, type Punto } from '$lib/banios/geo';
import type { Banio } from '$lib/banios/tipos';

/** Radio de búsqueda según la precisión (DESIGN.md §8, paso 5). */
export const radioBusqueda = (precision: number) => Math.min(150, Math.max(60, 2 * Math.max(precision, 50)));

/** Entre las 20 y las 6 no se preselecciona nada (PRIVACY.md P-29). */
export const esNoche = (d: Date) => d.getHours() >= 20 || d.getHours() < 6;

/**
 * Baños del catálogo cerca de donde estás, del más cercano al más lejano. Se
 * calcula en el celular: la ubicación no sale (P-01). Preselección solo con un
 * baño a menos de 40 m, precisión de 30 m o mejor y de día (P-05, P-29).
 */
export function candidatos(banios: Banio[], yo: Punto, precision: number, cuando: Date) {
	const radio = radioBusqueda(precision);
	const cerca = banios
		.map((b) => ({ banio: b, distancia: distanciaM(yo, b) }))
		.filter((c) => c.distancia <= radio)
		.sort((a, b) => a.distancia - b.distancia)
		.slice(0, 6);
	const preseleccion = cerca[0] && cerca[0].distancia < 40 && precision <= 30 && !esNoche(cuando) ? cerca[0].banio.id : null;
	return { cerca, preseleccion };
}
