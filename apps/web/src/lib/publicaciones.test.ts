import { describe, expect, it } from 'vitest';
import { problemaComentarioPublico, problemaNombreLugar } from './publicaciones';

describe('anécdota pública', () => {
	it('acepta texto común', () => {
		expect(problemaComentarioPublico('Viento de 90 km/h para llegar. 10/10, volvería.')).toBeNull();
		expect(problemaComentarioPublico('Ruta 3, km 2600: ni un árbol en 40 km')).toBeNull();
		expect(problemaComentarioPublico('Eran las 3.30 y había 2 personas')).toBeNull();
	});

	it('rechaza links, mails y teléfonos', () => {
		expect(problemaComentarioPublico('mirá https://ejemplo.com')).toMatch(/links/);
		expect(problemaComentarioPublico('entrá a www.algo.com')).toMatch(/links/);
		expect(problemaComentarioPublico('seguime en algo.com.ar')).toMatch(/links/);
		expect(problemaComentarioPublico('escribime a juan@gmail.com')).toMatch(/mails/);
		expect(problemaComentarioPublico('llamá al 2966 15 123456')).toMatch(/teléfono/);
		expect(problemaComentarioPublico('wpp 11-4567-8901')).toMatch(/teléfono/);
	});

	it('vacía o muy larga', () => {
		expect(problemaComentarioPublico('   ')).not.toBeNull();
		expect(problemaComentarioPublico('x'.repeat(501))).not.toBeNull();
	});
});

describe('nombre del lugar', () => {
	it('un nombre común pasa; links, mails o muy largo, no', () => {
		expect(problemaNombreLugar('Casa de la abuela')).toBeNull();
		expect(problemaNombreLugar('www.algo.com')).not.toBeNull();
		expect(problemaNombreLugar('yo@algo.com')).not.toBeNull();
		expect(problemaNombreLugar('x'.repeat(61))).not.toBeNull();
		expect(problemaNombreLugar('  ')).not.toBeNull();
	});
});
