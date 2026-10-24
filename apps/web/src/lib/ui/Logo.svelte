<script lang="ts">
	// Mascota y nombre. Dibujo propio, sin recursos de terceros.
	let { tamanio = 40, conNombre = true }: { tamanio?: number; conNombre?: boolean } = $props();
</script>

<span class="logo">
	<svg width={tamanio} height={tamanio} viewBox="0 0 64 64" aria-hidden="true">
		<g stroke="#3b2314" stroke-width="2.6" stroke-linejoin="round">
			<ellipse cx="32" cy="50" rx="24" ry="9.5" fill="#8a5632" />
			<ellipse cx="32" cy="38" rx="18" ry="8.5" fill="#9b6339" />
			<ellipse cx="32" cy="27" rx="12" ry="7" fill="#a86e42" />
			<path d="M31 9c7 5 6 12 1 14c-4-2-6-8-1-14z" fill="#a86e42" />
		</g>
		<circle cx="26" cy="37" r="3.6" fill="#fff" stroke="#3b2314" stroke-width="1.6" />
		<circle cx="38" cy="37" r="3.6" fill="#fff" stroke="#3b2314" stroke-width="1.6" />
		<circle cx="26.8" cy="37.6" r="1.7" fill="#3b2314" />
		<circle cx="38.8" cy="37.6" r="1.7" fill="#3b2314" />
		<path d="M26.5 45.5c3.5 3 7.5 3 11 0" fill="none" stroke="#3b2314" stroke-width="2.4" stroke-linecap="round" />
		<ellipse cx="21" cy="44" rx="2.6" ry="1.5" fill="#f08a7e" />
		<ellipse cx="43" cy="44" rx="2.6" ry="1.5" fill="#f08a7e" />
	</svg>
	{#if conNombre}<span class="nombre">cacapage</span>{/if}
</span>

<style>
	.logo {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.nombre {
		font-weight: 700;
		font-size: 22px;
		letter-spacing: -0.02em;
	}
</style>
