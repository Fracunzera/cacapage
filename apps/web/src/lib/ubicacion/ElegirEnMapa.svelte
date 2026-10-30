<script lang="ts">
	// Elegir el punto a mano en un mapa: se mueve el mapa hasta que el pin del
	// centro quede donde fue. Para cuando la dirección no tiene la altura en el
	// mapa (queda en algún lugar de la calle) o se prefiere marcarlo directo.
	import { onMount } from 'svelte';
	import type { Map as Mapa } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { crearMapa } from '$lib/banios/crearMapa';
	import type { Punto } from './interpretar';

	let {
		inicio,
		ayuda,
		onelegir,
		oncancelar
	}: {
		/** Dónde arranca; sin esto, la Argentina entera. */
		inicio?: Punto & { zoom: number };
		ayuda: string;
		onelegir: (p: Punto) => void;
		oncancelar: () => void;
	} = $props();

	let contenedor: HTMLDivElement;
	let mapa = $state.raw<Mapa | null>(null);
	let zoom = $state(0);
	let error = $state(false);

	onMount(() => {
		let vivo = true;
		crearMapa(contenedor)
			.then(({ mapa: m }) => {
				if (!vivo) return m.remove();
				if (inicio) m.jumpTo({ center: [inicio.lon, inicio.lat], zoom: inicio.zoom });
				zoom = m.getZoom();
				m.on('zoomend', () => (zoom = m.getZoom()));
				mapa = m;
			})
			.catch(() => (error = true));
		return () => {
			vivo = false;
			mapa?.remove();
		};
	});

	function usar() {
		if (!mapa) return;
		const c = mapa.getCenter();
		// Seis decimales: ~10 cm, más que suficiente.
		onelegir({ lat: Math.round(c.lat * 1e6) / 1e6, lon: Math.round(c.lng * 1e6) / 1e6 });
	}
</script>

<div class="elegir">
	<p class="u-ayuda">{ayuda}</p>
	<div class="lienzo" bind:this={contenedor}>
		<span class="pin" aria-hidden="true">📍</span>
		{#if error}<p class="u-error aviso">No se pudo cargar el mapa.</p>{/if}
	</div>
	{#if mapa && zoom < 14}<p class="u-ayuda">Acercate más para marcar el lugar justo.</p>{/if}
	<div class="botones">
		<button type="button" class="u-boton" disabled={!mapa || zoom < 14} onclick={usar}>Usar este punto</button>
		<button type="button" class="u-enlace" onclick={oncancelar}>Cancelar</button>
	</div>
</div>

<style>
	.elegir {
		margin: 8px 0;
	}
	.lienzo {
		position: relative;
		height: 320px;
		border: 2px solid var(--tinta);
		border-radius: 12px;
		overflow: hidden;
	}
	.pin {
		position: absolute;
		z-index: 2;
		left: 50%;
		top: 50%;
		/* La punta del pin, justo en el centro. */
		transform: translate(-50%, -100%);
		font-size: 34px;
		line-height: 1;
		pointer-events: none;
	}
	.aviso {
		position: absolute;
		z-index: 2;
		inset: 12px 12px auto;
		margin: 0;
	}
	.botones {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-top: 8px;
	}
</style>
