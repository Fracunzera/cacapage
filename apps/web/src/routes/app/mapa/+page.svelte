<script lang="ts">
	// Mi mapa: dónde hiciste, desde tu historial cifrado. Se arma en el celular;
	// al servidor no llega nada salvo lo que elijas hacer público (P-38).
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { Map as Mapa, GeoJSONSource } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import Logo from '$lib/ui/Logo.svelte';
	import { api, ErrorApi } from '$lib/cliente/api';
	import { crearMapa, encuadrar } from '$lib/banios/crearMapa';
	import { Boveda } from '$lib/boveda/boveda';
	import { TIPOS, type Registro } from '$lib/boveda/modelo';
	import { cambiarPublico, sePuedePublicar } from '$lib/boveda/publicar';
	import ConfirmarPublico from '$lib/boveda/ui/ConfirmarPublico.svelte';

	const TIPO = Object.fromEntries(TIPOS.map((t) => [t.id, t]));

	let contenedor: HTMLDivElement;
	let mapa: Mapa | null = null;
	let boveda = $state.raw<Boveda | null>(null);
	let seudonimo = $state('');
	let registros = $state<Registro[]>([]);
	let elegido = $state<Registro | null>(null);
	let confirmando = $state(false);
	let cambiando = $state(false);
	let error = $state<string | null>(null);

	const conUbicacion = $derived(registros.filter((r) => r.lat !== undefined && r.lon !== undefined));

	function datos() {
		return {
			type: 'FeatureCollection' as const,
			features: conUbicacion.map((r) => ({
				type: 'Feature' as const,
				geometry: { type: 'Point' as const, coordinates: [r.lon!, r.lat!] },
				properties: { id: r.id, publico: r.publico === true }
			}))
		};
	}

	$effect(() => {
		const d = datos();
		(mapa?.getSource('mias') as GeoJSONSource | undefined)?.setData(d);
	});

	function refrescar() {
		registros = boveda?.registros() ?? [];
		if (elegido) elegido = registros.find((r) => r.id === elegido!.id) ?? null;
	}

	async function cambiar(publico: boolean) {
		if (!boveda || !elegido) return;
		confirmando = false;
		cambiando = true;
		error = null;
		try {
			await cambiarPublico(boveda, elegido, publico);
		} catch (e) {
			error = e instanceof ErrorApi && e.estado === 0 ? 'Hace falta conexión para cambiarlo.' : 'No se pudo cambiar.';
		}
		cambiando = false;
		refrescar();
	}

	onMount(() => {
		(async () => {
			try {
				({ seudonimo } = await api<{ seudonimo: string }>('/cuenta'));
			} catch (e) {
				if (e instanceof ErrorApi && e.estado === 401) return goto('/app/entrar?modo=entrar');
				error = 'No se pudo cargar la cuenta.';
				return;
			}
			boveda = await Boveda.abrir(seudonimo);
			if (!boveda.tieneLlaves) return goto('/app');
			refrescar();
			const { mapa: m } = await crearMapa(contenedor);
			m.addSource('mias', { type: 'geojson', data: datos() });
			m.addLayer({
				id: 'mias',
				type: 'circle',
				source: 'mias',
				paint: {
					// Privadas en marrón; públicas en amarillo.
					'circle-color': ['case', ['get', 'publico'], '#f6b40e', '#8a5632'],
					'circle-stroke-color': '#3b2314',
					'circle-stroke-width': 2.5,
					'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 6, 15, 11]
				}
			});
			m.on('click', 'mias', (e) => {
				const id = e.features?.[0]?.properties?.id as string | undefined;
				elegido = registros.find((r) => r.id === id) ?? null;
			});
			m.on('mouseenter', 'mias', () => (m.getCanvas().style.cursor = 'pointer'));
			m.on('mouseleave', 'mias', () => (m.getCanvas().style.cursor = ''));
			encuadrar(m, conUbicacion as { lat: number; lon: number }[]);
			mapa = m;
			await boveda.sincronizar().catch(() => false);
			refrescar();
		})().catch(() => (error = 'No se pudo cargar el mapa.'));
		return () => {
			mapa?.remove();
			boveda?.cerrar();
		};
	});

	const fecha = (iso: string) =>
		new Date(iso).toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false });
</script>

<svelte:head>
	<title>Mi mapa · Dónde Cagué</title>
</svelte:head>

<div class="u-pantalla-mapa">
	<header class="u-tope">
		<a href="/app" aria-label="Volver a mi trono"><Logo tamanio={32} conNombre={false} /></a>
		<h1>Mi mapa</h1>
		<a class="otro" href="/cacas">🌎 Público</a>
	</header>

	<div class="u-lienzo" bind:this={contenedor}>
		{#if boveda && !conUbicacion.length}
			<p class="aviso u-tarjeta">
				Todavía no tenés cacas con ubicación. Al registrar, tocá "📍 Agregar ubicación" y van a aparecer acá.
			</p>
		{/if}
		{#if error}<p class="aviso u-error" role="alert">{error}</p>{/if}
	</div>

	{#if elegido}
		{@const r = elegido}
		<section class="u-hoja" aria-labelledby="ficha-mia">
			<button type="button" class="u-cerrar" aria-label="Cerrar" onclick={() => (elegido = null)}>✕</button>
			<p class="tipo">{TIPO[r.tipo]?.icono} {TIPO[r.tipo]?.texto}</p>
			<h2 id="ficha-mia">{r.banio_nombre ?? TIPO[r.tipo]?.texto}</h2>
			<p class="cuando">{fecha(r.ocurrido_en)}{r.sin_papel ? ' · sin papel 😱' : ''}</p>
			{#if r.comentario}<p class="comentario">“{r.comentario}”</p>{/if}
			{#if r.publico}
				<p class="estado publica">🌎 Pública: está en el mapa de cacas.</p>
				<button type="button" class="u-boton sec" disabled={cambiando} onclick={() => cambiar(false)}>🔒 Hacerla privada</button>
			{:else}
				<p class="estado">🔒 Privada: solo la ves vos.</p>
				{#if sePuedePublicar(r)}
					<button type="button" class="u-boton sec" disabled={cambiando} onclick={() => (confirmando = true)}>🌎 Hacerla pública</button>
				{:else}
					<p class="u-ayuda">Lo de casa, el laburo o lo de alguien no se puede hacer público.</p>
				{/if}
			{/if}
		</section>
	{/if}

	<p class="u-pie-mapa">
		<strong>{conUbicacion.length}</strong> con ubicación · 🟤 privada · 🟡 pública · Este mapa lo ves solo vos.
	</p>
</div>

{#if confirmando && elegido}
	<ConfirmarPublico registro={elegido} {seudonimo} onsi={() => cambiar(true)} onno={() => (confirmando = false)} />
{/if}

<style>
	.otro {
		padding: 6px 12px;
		border: 2px solid var(--tinta);
		border-radius: 999px;
		background: var(--papel);
		color: var(--tinta);
		font-size: 15px;
		font-weight: 700;
		text-decoration: none;
	}
	.aviso {
		position: absolute;
		z-index: 2;
		top: 12px;
		left: 16px;
		right: 16px;
		margin: 0;
	}
	.tipo,
	.cuando {
		margin: 0;
		color: var(--tinta-suave);
		font-size: 14px;
		font-weight: 600;
	}
	h2 {
		margin: 2px 0 4px;
		font-size: 22px;
		overflow-wrap: anywhere;
	}
	.comentario {
		margin: 8px 0 0;
		font-style: italic;
	}
	.estado {
		margin: 10px 0 0;
		font-weight: 600;
	}
	.publica {
		color: var(--mate);
	}
	.u-boton {
		min-height: 48px;
		font-size: 17px;
	}
	.u-pie-mapa strong {
		color: var(--tinta);
	}
</style>
