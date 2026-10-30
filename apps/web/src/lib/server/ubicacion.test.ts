import { describe, expect, it, vi } from 'vitest';
import { buscarDireccion, EnlaceNoSoportado, seguirCorto, separar } from './ubicacion';

const redir = (destino: string) => new Response(null, { status: 302, headers: { location: destino } });

describe('seguirCorto', () => {
	it('sigue las redirecciones del acortador; a Google Maps no le pide nada', async () => {
		const f = vi
			.fn()
			.mockResolvedValueOnce(redir('https://goo.gl/maps/xyz'))
			.mockResolvedValueOnce(redir('https://www.google.com/maps/place/x/@-51.62,-69.22,17z'));
		expect(await seguirCorto('https://maps.app.goo.gl/abc', f)).toBe('https://www.google.com/maps/place/x/@-51.62,-69.22,17z');
		expect(f).toHaveBeenCalledTimes(2);
		expect(f.mock.calls[0][1].redirect).toBe('manual');
	});

	it('un link corto que no redirige: no se pudo abrir', async () => {
		const f = vi.fn().mockResolvedValueOnce(new Response('no existe', { status: 404 }));
		await expect(seguirCorto('https://maps.app.goo.gl/abc', f)).rejects.toThrow(EnlaceNoSoportado);
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

describe('separar', () => {
	it('calle y número por un lado, ciudad por el otro', () => {
		expect(separar('Santa Fe 848, Río Gallegos')).toEqual({ calle: '848 Santa Fe', ciudad: 'Río Gallegos' });
		expect(separar('Av. 9 de Julio 1000, CABA, Argentina')).toEqual({ calle: '1000 Av. 9 de Julio', ciudad: 'CABA, Argentina' });
		expect(separar('Zapiola, Río Gallegos')).toEqual({ calle: 'Zapiola', ciudad: 'Río Gallegos' });
		expect(separar('Santa Fe 848')).toBeNull();
	});
});

describe('buscarDireccion', () => {
	const lugar = (road: string, house_number: string | undefined, city: string, lat: string) => ({
		display_name: `${road}, ${city}, Argentina`,
		lat,
		lon: '-69.22',
		address: { road, house_number, suburb: 'Centro', city, state: 'Santa Cruz', country: 'Argentina' }
	});

	it('busca por partes, en todo el mundo, en castellano, con identificación; muestra la ciudad', async () => {
		const f = vi.fn().mockResolvedValue(Response.json([lugar('Zapiola', '50', 'Río Gallegos', '-51.62')]));
		const r = await buscarDireccion('Zapiola 50, Río Gallegos', 'https://nominatim.example/search', 'https://dondecague.com.ar', f);
		expect(r).toEqual([{ nombre: 'Zapiola 50 · Centro, Río Gallegos, Santa Cruz', lat: -51.62, lon: -69.22, exacta: true }]);
		const [url, init] = f.mock.calls[0];
		expect(url.searchParams.get('street')).toBe('50 Zapiola');
		expect(url.searchParams.get('city')).toBe('Río Gallegos');
		expect(url.searchParams.has('countrycodes')).toBe(false);
		expect(url.searchParams.get('accept-language')).toBe('es');
		expect(init.headers['user-agent']).toContain('DondeCague');
	});

	it('sin resultados por partes, prueba en texto libre; la calle sin altura no es exacta y sus tramos no se repiten', async () => {
		const f = vi
			.fn()
			.mockResolvedValueOnce(Response.json([]))
			.mockResolvedValueOnce(Response.json([lugar('Santa Fe', undefined, 'Río Gallegos', '-51.62'), lugar('Santa Fe', undefined, 'Río Gallegos', '-51.63')]));
		const r = await buscarDireccion('Santa Fe 848, Río Gallegos', 'https://nominatim.example/search', 'https://dondecague.com.ar', f);
		expect(r).toEqual([{ nombre: 'Santa Fe · Centro, Río Gallegos, Santa Cruz', lat: -51.62, lon: -69.22, exacta: false }]);
		expect(f.mock.calls[1][0].searchParams.get('q')).toBe('Santa Fe 848, Río Gallegos');
	});
});
