import { describe, expect, it } from 'vitest';
import { estiloBase, ZOOM_DETALLE } from './estilo';

const O = 'https://dondecague.com.ar';

describe('estilo del mapa base', () => {
	it('mundo de fondo y Argentina encima desde el zoom 9', () => {
		const e = estiloBase(O, { argentina: true, mundo: true });
		expect(Object.keys(e.sources)).toEqual(['mundo', 'argentina']);
		const ids = e.layers.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
		const mundo = e.layers.filter((c) => 'source' in c && c.source === 'mundo');
		const ar = e.layers.filter((c) => 'source' in c && c.source === 'argentina');
		expect(mundo.length).toBeGreaterThan(10);
		expect(ar.length).toBeGreaterThan(10);
		// Todas las de la Argentina van después de las del mundo, y desde el zoom 9.
		expect(e.layers.findIndex((c) => 'source' in c && c.source === 'argentina')).toBeGreaterThan(
			e.layers.findLastIndex((c) => 'source' in c && c.source === 'mundo')
		);
		expect(ar.every((c) => (c.minzoom ?? 0) >= ZOOM_DETALLE)).toBe(true);
		// Un solo fondo: el de la Argentina taparía el mundo.
		expect(e.layers.filter((c) => c.type === 'background')).toHaveLength(1);
	});

	it('solo Argentina, como antes', () => {
		const e = estiloBase(O, { argentina: true, mundo: false });
		expect(Object.keys(e.sources)).toEqual(['argentina']);
		expect(e.layers.every((c) => !('source' in c) || c.source === 'argentina')).toBe(true);
		expect(e.layers.some((c) => (c.minzoom ?? 0) >= ZOOM_DETALLE && c.type === 'fill')).toBe(false);
	});

	it('solo mundo', () => {
		expect(Object.keys(estiloBase(O, { argentina: false, mundo: true }).sources)).toEqual(['mundo']);
	});

	it('sin teselas, fondo liso', () => {
		const e = estiloBase(O, { argentina: false, mundo: false });
		expect(e.sources).toEqual({});
		expect(e.layers.map((c) => c.type)).toEqual(['background']);
	});

	it('todo desde nuestro dominio', () => {
		const e = estiloBase(O, { argentina: true, mundo: true });
		expect(JSON.stringify(e.sources)).toContain(`pmtiles://${O}/tiles/mundo.pmtiles`);
		expect(e.glyphs?.startsWith(O)).toBe(true);
	});
});
