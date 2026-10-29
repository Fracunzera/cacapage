<script lang="ts">
	import type { Snippet } from 'svelte';
	import Logo from './Logo.svelte';
	import Seo from './Seo.svelte';
	let {
		titulo,
		descripcion,
		ruta,
		version,
		children
	}: { titulo: string; descripcion: string; ruta: string; version: string; children: Snippet } = $props();
</script>

<Seo titulo="{titulo} · Dónde Cagué" {descripcion} {ruta} />

<header class="u-tope">
	<a href="/" aria-label="Inicio"><Logo tamanio={32} conNombre={false} /></a>
	<h1>{titulo}</h1>
</header>

<main class="u-pagina legal">
	<p class="borrador">
		<strong>Borrador ({version}).</strong> Este texto todavía no fue revisado por un abogado y puede cambiar antes del
		lanzamiento. Si cambia, te lo vamos a pedir aceptar de nuevo.
	</p>
	{@render children()}
</main>

<style>
	.legal {
		max-width: 40rem;
		line-height: 1.55;
	}
	.legal :global(h2) {
		margin: 28px 0 8px;
		font-size: 21px;
	}
	.legal :global(li) {
		margin-bottom: 6px;
	}
	.borrador {
		padding: 12px 14px;
		border: var(--borde);
		border-radius: var(--radio);
		background: var(--sol-claro);
	}
</style>
