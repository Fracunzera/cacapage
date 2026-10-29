// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	/** YYYY-MM-DD del build (vite.config.ts). */
	const __FECHA_BUILD__: string;
	namespace App {}
}

export {};
