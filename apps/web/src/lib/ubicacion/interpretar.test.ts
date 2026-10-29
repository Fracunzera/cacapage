import { describe, expect, it } from 'vitest';
import { enArgentina, interpretar } from './interpretar';

const punto = (t: string) => {
	const r = interpretar(t);
	if (r.tipo !== 'punto') throw new Error(`${t} → ${JSON.stringify(r)}`);
	return [Math.round(r.punto.lat * 1e4) / 1e4, Math.round(r.punto.lon * 1e4) / 1e4];
};

describe('coordenadas', () => {
	it.each([
		['-51.62, -69.22', [-51.62, -69.22]],
		['-51.62 -69.22', [-51.62, -69.22]],
		['  -51.6201,-69.2203 ', [-51.6201, -69.2203]],
		['-51,62; -69,22', [-51.62, -69.22]],
		['-51,62 -69,22', [-51.62, -69.22]],
		['−34.6037, −58.3816', [-34.6037, -58.3816]],
		[`51°37'12"S 69°13'12"O`, [-51.62, -69.22]],
		[`51° 37' 12" S, 69° 13' 12" W`, [-51.62, -69.22]],
		[`69°13'12"W 51°37'12"S`, [-51.62, -69.22]],
		['34°36′13″S 58°22′54″O', [-34.6036, -58.3817]],
		['geo:-51.62,-69.22?z=17', [-51.62, -69.22]]
	])('%s', (t, esperado) => expect(punto(t)).toEqual(esperado));

	it('rechaza lo que no existe', () => {
		expect(interpretar('-151.62, -69.22').tipo).toBe('invalido');
		expect(interpretar('0, 0').tipo).toBe('invalido');
		expect(interpretar('').tipo).toBe('invalido');
	});
});

describe('links', () => {
	it.each([
		// Google Maps: el pin del lugar gana sobre el centro de la vista.
		['https://www.google.com/maps/place/YPF/@-51.6201,-69.2203,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d-51.6205!4d-69.2207', [-51.6205, -69.2207]],
		['https://www.google.com/maps/@-51.6201,-69.2203,15z', [-51.6201, -69.2203]],
		['https://www.google.com/maps?q=-51.62,-69.22', [-51.62, -69.22]],
		['https://maps.google.com/?q=-51.62%2C-69.22&z=16', [-51.62, -69.22]],
		['https://www.google.com/maps/search/?api=1&query=-51.62,-69.22', [-51.62, -69.22]],
		['https://www.google.com/maps/dir/?api=1&destination=-51.62,-69.22', [-51.62, -69.22]],
		['https://www.openstreetmap.org/?mlat=-51.62&mlon=-69.22#map=17/-51.6/-69.2', [-51.62, -69.22]],
		['https://www.openstreetmap.org/#map=17/-51.62/-69.22', [-51.62, -69.22]],
		['https://maps.apple.com/?ll=-51.62,-69.22&q=Pin', [-51.62, -69.22]],
		['https://waze.com/ul?ll=-51.62%2C-69.22&navigate=yes', [-51.62, -69.22]],
		['Mirá dónde estoy: https://www.google.com/maps?q=-51.62,-69.22 ¡vení!', [-51.62, -69.22]]
	])('%s', (t, esperado) => expect(punto(t)).toEqual(esperado));

	it('los links cortos de Google los sigue el servidor', () => {
		expect(interpretar('https://maps.app.goo.gl/AbC123xyz')).toEqual({ tipo: 'corto', url: 'https://maps.app.goo.gl/AbC123xyz' });
	});

	it('un link sin coordenadas: avisa', () => {
		expect(interpretar('https://www.google.com/maps/place/Rio+Gallegos').tipo).toBe('invalido');
		expect(interpretar('https://ejemplo.com/hola').tipo).toBe('invalido');
	});
});

describe('direcciones', () => {
	it('lo demás se busca como dirección', () => {
		expect(interpretar('Av. Kirchner 1200, Río Gallegos')).toEqual({ tipo: 'direccion', texto: 'Av. Kirchner 1200, Río Gallegos' });
		expect(interpretar('Zapiola 50').tipo).toBe('direccion');
	});

	it('enArgentina', () => {
		expect(enArgentina({ lat: -51.62, lon: -69.22 })).toBe(true);
		expect(enArgentina({ lat: 40.4, lon: -3.7 })).toBe(false);
	});
});
