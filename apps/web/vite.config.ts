import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	// Para el lastmod de las páginas que cambian solo con un deploy (sitemap.xml).
	define: { __FECHA_BUILD__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
