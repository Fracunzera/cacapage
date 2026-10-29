import { describe, expect, it } from 'vitest';
import { candidatos, esNoche, radioBusqueda } from './candidatos';
import type { Banio } from '$lib/banios/tipos';

const b = (id: string, lat: number): Banio => ({
	id,
	categoria: 'banio',
	existencia: 'confirmado',
	nombre: null,
	marca: null,
	lat,
	lon: -69.22,
	atributos: {},
	modificado: null
});
const yo = { lat: -51.62, lon: -69.22 };
const DIA = new Date('2026-10-29T14:00:00');
const banios = [b('lejos', -51.623), b('cerca', -51.6202), b('medio', -51.6208)]; // ~330 m, ~22 m, ~89 m

describe('candidatos', () => {
	it('ordena por distancia y corta por radio', () => {
		const r = candidatos(banios, yo, 10, DIA);
		expect(r.cerca.map((c) => c.banio.id)).toEqual(['cerca', 'medio']);
		expect(r.preseleccion).toBe('cerca');
	});

	it('no preselecciona con mala precisión ni de noche', () => {
		expect(candidatos(banios, yo, 45, DIA).preseleccion).toBeNull();
		expect(candidatos(banios, yo, 10, new Date('2026-10-29T23:30:00')).preseleccion).toBeNull();
		expect(esNoche(new Date('2026-10-29T05:59:00'))).toBe(true);
		expect(esNoche(new Date('2026-10-29T06:00:00'))).toBe(false);
	});

	it('el radio crece con la imprecisión, hasta 150 m', () => {
		expect(radioBusqueda(5)).toBe(100);
		expect(radioBusqueda(200)).toBe(150);
	});
});
