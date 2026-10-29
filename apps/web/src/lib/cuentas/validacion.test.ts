import { describe, expect, it } from 'vitest';
import { mailValido, problemaAlta, problemaSeudonimo } from './validacion';

describe('seudónimo', () => {
	it('acepta letras, números y guion bajo, en minúsculas', () => {
		expect(problemaSeudonimo('Trono_Patagonico')).toBeNull();
		expect(problemaSeudonimo('caca123')).toBeNull();
	});
	it('rechaza largo, acentos, espacios y reservados', () => {
		expect(problemaSeudonimo('ab')).not.toBeNull();
		expect(problemaSeudonimo('a'.repeat(25))).not.toBeNull();
		expect(problemaSeudonimo('cagué')).not.toBeNull();
		expect(problemaSeudonimo('juan perez')).not.toBeNull();
		expect(problemaSeudonimo('Admin')).not.toBeNull();
	});
});

describe('alta', () => {
	const ok = { seudonimo: 'trono', mayor_de_edad: true, acepta_terminos: true };
	it('exige mayoría de edad y aceptar los términos', () => {
		expect(problemaAlta(ok)).toBeNull();
		expect(problemaAlta({ ...ok, mayor_de_edad: false })).not.toBeNull();
		expect(problemaAlta({ ...ok, acepta_terminos: false })).not.toBeNull();
		expect(problemaAlta(undefined)).not.toBeNull();
	});
});

describe('mail', () => {
	it('valida la forma básica', () => {
		expect(mailValido(' Vos@Ejemplo.com ')).toBe(true);
		expect(mailValido('vos@ejemplo')).toBe(false);
		expect(mailValido('sin arroba.com')).toBe(false);
	});
});

import { problemaClave } from './validacion';

describe('contraseña', () => {
	it('exige largo mínimo y rechaza las obvias', () => {
		expect(problemaClave('corta')).not.toBeNull();
		expect(problemaClave('1234567890')).not.toBeNull();
		expect(problemaClave('aaaaaaaaaaaa')).not.toBeNull();
		expect(problemaClave('mi trono patagónico')).toBeNull();
	});
	it('no puede contener el seudónimo', () => {
		expect(problemaClave('trono_123456', 'Trono_123')).not.toBeNull();
	});
});
