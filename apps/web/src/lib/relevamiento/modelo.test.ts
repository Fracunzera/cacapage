import { describe, expect, it } from 'vitest';
import {
	DESCONOCIDO,
	PRECISION_MAXIMA_M,
	aRelevado,
	armarExportacion,
	fixAceptable,
	nombreArchivo,
	nuevoBorrador,
	problemas
} from './modelo';

const fix = (precision_m: number) => ({ lat: -51.62, lon: -69.21, precision_m, fix_en: '2026-10-25T12:00:00.000Z' });

describe('borrador', () => {
	it('arranca con todo en "desconocido" y sin ubicación', () => {
		const b = nuevoBorrador(new Date('2026-10-25T12:00:00Z'), 'id-1');
		expect(b.geom).toBeNull();
		for (const v of [b.categoria, b.acceso, b.cobra, b.accesible, b.cambiador]) expect(v).toBe(DESCONOCIDO);
		expect(b.horario).toEqual({ habil: DESCONOCIDO, sabado: DESCONOCIDO, domingo_feriado: DESCONOCIDO });
	});
});

describe('precisión', () => {
	it(`acepta hasta ${PRECISION_MAXIMA_M} m inclusive y nada peor`, () => {
		expect(fixAceptable(5)).toBe(true);
		expect(fixAceptable(30)).toBe(true);
		expect(fixAceptable(30.1)).toBe(false);
		expect(fixAceptable(NaN)).toBe(false);
	});

	it('no deja guardar sin ubicación ni con ubicación imprecisa', () => {
		const b = nuevoBorrador();
		expect(problemas(b)).toHaveLength(1);
		b.geom = fix(45);
		expect(problemas(b)).toHaveLength(1);
		b.geom = fix(12);
		expect(problemas(b)).toEqual([]);
	});
});

describe('horario', () => {
	it('exige apertura y cierre cuando se elige un rango', () => {
		const b = nuevoBorrador();
		b.geom = fix(10);
		b.horario.sabado = { abre: '08:00', cierra: '' };
		expect(problemas(b)).toHaveLength(1);
		b.horario.sabado = { abre: '08:00', cierra: '22:30' };
		expect(problemas(b)).toEqual([]);
	});
});

describe('registro relevado', () => {
	it('sale con procedencia gps_campo, también en la geometría', () => {
		const b = nuevoBorrador(new Date(), 'id-2');
		b.geom = fix(8);
		b.nombre = '  YPF Av. San Martín ';
		b.categoria = 'estacion_servicio';
		b.cobra = 'no';
		b.horario.habil = '24h';
		const r = aRelevado(b, new Date('2026-10-25T13:00:00Z'));
		expect(r.procedencia).toBe('gps_campo');
		expect(r.geom.geom_procedencia).toBe('gps_campo');
		expect(r.nombre).toBe('YPF Av. San Martín');
		expect(r.atributos.horario.habil).toBe('24h');
		expect(r.atributos.horario.sabado).toBe(DESCONOCIDO);
	});

	it('sin nombre queda null, no texto vacío', () => {
		const b = nuevoBorrador();
		b.geom = fix(8);
		expect(aRelevado(b).nombre).toBeNull();
	});

	it('se niega a convertir un borrador incompleto', () => {
		expect(() => aRelevado(nuevoBorrador())).toThrow();
	});
});

describe('exportación', () => {
	it('arma el archivo con todo lo acumulado, en orden de relevamiento', () => {
		const a = aRelevado({ ...nuevoBorrador(new Date(), 'a'), geom: fix(5) }, new Date('2026-10-25T15:00:00Z'));
		const b = aRelevado({ ...nuevoBorrador(new Date(), 'b'), geom: fix(5) }, new Date('2026-10-25T14:00:00Z'));
		const e = armarExportacion([a, b], new Date('2026-10-25T16:00:00Z'));
		expect(e.formato).toBe('cacapage-recorrida');
		expect(e.procedencia).toBe('gps_campo');
		expect(e.cantidad).toBe(2);
		expect(e.banios.map((x) => x.id)).toEqual(['b', 'a']);
	});

	it('nombra el archivo recorrida-YYYY-MM-DD.json con la fecha local', () => {
		expect(nombreArchivo(new Date(2026, 9, 5, 23, 50))).toBe('recorrida-2026-10-05.json');
	});
});
