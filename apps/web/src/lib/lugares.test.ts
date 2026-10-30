import { describe, expect, it } from 'vitest';
import { agrupar, nombreCerca, nombreDelLugar, vecesPorVisita } from './lugares';

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

describe('nombre del lugar', () => {
	const r = (lat: number, lugar_nombre: string | undefined, ocurrido_en: string, banio_id?: string) => ({ lat, lon: -69.22, lugar_nombre, ocurrido_en, banio_id });

	it('el de la visita más reciente que tenga uno', () => {
		expect(nombreDelLugar([r(-51.62, 'Viejo', '2026-01-01'), r(-51.62, 'Nuevo', '2026-02-01'), r(-51.62, undefined, '2026-03-01')])).toBe('Nuevo');
		expect(nombreDelLugar([r(-51.62, undefined, '2026-01-01')])).toBeUndefined();
	});

	it('se propone en el mismo lugar (a menos de 40 m o el mismo baño), no más lejos', () => {
		const antes = [r(-51.62, 'Casa de la abuela', '2026-01-01'), r(-51.7, 'YPF de la 3', '2026-01-01', 'n1')];
		expect(nombreCerca(antes, { lat: -51.6202, lon: -69.22 })).toBe('Casa de la abuela');
		expect(nombreCerca(antes, { lat: -51.625, lon: -69.22 })).toBeUndefined();
		expect(nombreCerca(antes, { lat: -51.69, lon: -69.22, banio_id: 'n1' })).toBe('YPF de la 3');
		expect(nombreCerca(antes, { lat: -51.6202, lon: -69.22, banio_id: 'n9' })).toBeUndefined();
		expect(nombreCerca(antes, {})).toBeUndefined();
	});
});
