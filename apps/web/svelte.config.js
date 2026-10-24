import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		// Sin orígenes de terceros (PRIVACY.md P-16). SvelteKit agrega los hashes
		// de sus propios scripts en línea.
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				// Única excepción: el estilo del anunciador de navegación que SvelteKit
				// inserta para lectores de pantalla (write_root.js). Va por hash, no
				// con 'unsafe-inline'. Si cambia con una versión de SvelteKit, la prueba
				// e2e lo detecta como error de consola.
				'style-src': ['self', 'unsafe-hashes', 'sha256-S8qMpvofolR8Mpjy4kQvEm7m1q8clzU4dfDH0AmvZjo='],
				'img-src': ['self', 'data:'],
				'connect-src': ['self'],
				'worker-src': ['self'],
				'manifest-src': ['self'],
				'base-uri': ['self'],
				'form-action': ['self'],
				'frame-ancestors': ['none']
			}
		}
	}
};

export default config;
