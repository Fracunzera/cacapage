import { describe, expect, it } from 'vitest';
import { agrupar, vecesPorVisita } from './lugares';

const v = (id: string, lat: number, lon: number, fecha: string, banio_id?: string) => ({ id, lat, lon, fecha, banio_id });

describe('lugares', () => {
	it('mismo baño, aunque el punto sea distinto, es el mismo lugar', () => {
		const l = agrupar([v('a', -51.62, -69.22, '1', 'n1'), v('b', -51.63, -69.23, '2', 'n1')]);
		expect(l).toHaveLength(1);
		expect(l[0].visitas.map((x) => x.id)).toEqual(['a', 'b']);
	});

	it('sin baño: a menos de 40 m es el mismo lugar; más lejos, otro', () => {
		const l = agrupar([v('a', -51.62, -69.22, '1'), v('b', -51.6202, -69.22, '2'), v('c', -51.621, -69.22, '3')]);
		expect(l.map((x) => x.visitas.map((y) => y.id))).toEqual([['a', 'b'], ['c']]);
	});

	it('sin ubicación queda afuera', () => {
		expect(agrupar([{ id: 'x', lat: undefined, lon: undefined }])).toEqual([]);
	});

	it('el número de vez va en orden cronológico', () => {
		const r = vecesPorVisita([v('tercera', -51.62, -69.22, '2026-03'), v('primera', -51.62, -69.22, '2026-01'), v('segunda', -51.6201, -69.22, '2026-02'), v('sola', -40, -60, '2026-01')], (x) => x.fecha);
		expect(r.get('primera')).toEqual({ vez: 1, total: 3 });
		expect(r.get('tercera')).toEqual({ vez: 3, total: 3 });
		expect(r.get('sola')).toEqual({ vez: 1, total: 1 });
	});
});
