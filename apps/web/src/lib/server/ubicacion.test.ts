import { describe, expect, it, vi } from 'vitest';
import { buscarDireccion, EnlaceNoSoportado, seguirCorto } from './ubicacion';

const redir = (destino: string) => new Response(null, { status: 302, headers: { location: destino } });

describe('seguirCorto', () => {
	it('sigue las redirecciones hasta el link largo de Google', async () => {
		const f = vi
			.fn()
			.mockResolvedValueOnce(redir('https://www.google.com/maps/place/x/@-51.62,-69.22,17z'))
			.mockResolvedValueOnce(new Response('ok', { status: 200 }));
		expect(await seguirCorto('https://maps.app.goo.gl/abc', f)).toBe('https://www.google.com/maps/place/x/@-51.62,-69.22,17z');
		expect(f.mock.calls[0][1].redirect).toBe('manual');
	});

	it('no va a otros sitios (no es un proxy)', async () => {
		const f = vi.fn().mockResolvedValueOnce(redir('https://malo.example/robar'));
		await expect(seguirCorto('https://maps.app.goo.gl/abc', f)).rejects.toThrow(EnlaceNoSoportado);
		expect(f).toHaveBeenCalledTimes(1);
		await expect(seguirCorto('http://maps.app.goo.gl/abc', f)).rejects.toThrow(EnlaceNoSoportado);
		await expect(seguirCorto('https://127.0.0.1/x', f)).rejects.toThrow(EnlaceNoSoportado);
	});

	it('corta los bucles de redirecciones', async () => {
		const f = vi.fn().mockImplementation(async () => redir('https://maps.app.goo.gl/otra'));
		await expect(seguirCorto('https://maps.app.goo.gl/abc', f)).rejects.toThrow(EnlaceNoSoportado);
		expect(f).toHaveBeenCalledTimes(6);
	});
});

describe('buscarDireccion', () => {
	it('pide a Nominatim en todo el mundo, en castellano, con identificación', async () => {
		const f = vi.fn().mockResolvedValue(
			Response.json([{ display_name: 'Zapiola 50, Río Gallegos, Santa Cruz, Z9400, Argentina', lat: '-51.62', lon: '-69.22' }])
		);
		const r = await buscarDireccion('Zapiola 50, Río Gallegos', 'https://nominatim.example/search', 'https://dondecague.com.ar', f);
		expect(r).toEqual([{ nombre: 'Zapiola 50, Río Gallegos, Santa Cruz, Z9400', lat: -51.62, lon: -69.22 }]);
		const [url, init] = f.mock.calls[0];
		expect(url.searchParams.has('countrycodes')).toBe(false);
		expect(url.searchParams.get('accept-language')).toBe('es');
		expect(init.headers['user-agent']).toContain('DondeCague');
	});
});
