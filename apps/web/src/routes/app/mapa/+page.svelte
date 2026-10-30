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
	import { compartidaCon, compartir, type Compartir as Con } from '$lib/boveda/publicar';
	import Compartir from '$lib/boveda/ui/Compartir.svelte';
	import { faltaParaTodos, type Publicacion } from '$lib/publicaciones';
	import Celebracion from '$lib/boveda/ui/Celebracion.svelte';

	const TIPO = Object.fromEntries(TIPOS.map((t) => [t.id, t]));

	let contenedor: HTMLDivElement;
	let mapa: Mapa | null = null;
	let boveda = $state.raw<Boveda | null>(null);
	let seudonimo = $state('');
	let registros = $state<Registro[]>([]);
	let elegido = $state<Registro | null>(null);
	let cambiando = $state(false);
	let error = $state<string | null>(null);
	let festejo = $state<number | null>(null);
	/** Desde cuándo ven los demás cada caca pública propia. */
	let visibleDesde = $state(new Map<string, string>());
	/** Cacas públicas propias cuya anécdota está oculta por reportes. */
	let comentarioOculto = $state(new Set<string>());

	async function cargarMias() {
		const r = await fetch('/api/v1/publicaciones/mias').catch(() => null);
		if (!r?.ok) return;
		const { publicaciones } = (await r.json()) as { publicaciones: Publicacion[] };
		visibleDesde = new Map(publicaciones.map((p) => [p.id, p.visible_desde ?? '']));
		comentarioOculto = new Set(publicaciones.filter((p) => p.comentario_oculto).map((p) => p.id));
	}

	const conUbicacion = $derived(registros.filter((r) => r.lat !== undefined && r.lon !== undefined));

	function datos() {
		return {
			type: 'FeatureCollection' as const,
			features: conUbicacion.map((r) => ({
				type: 'Feature' as const,
				geometry: { type: 'Point' as const, coordinates: [r.lon!, r.lat!] },
				properties: { id: r.id, con: compartidaCon(r) }
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

	async function cambiar(r: Registro, con: Con, conComentario: boolean) {
		if (!boveda) return;
		cambiando = true;
		error = null;
		try {
			const numero = await compartir(boveda, r, con, conComentario);
			if (numero) festejo = numero;
			await cargarMias();
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
			void cargarMias();
			const { mapa: m } = await crearMapa(contenedor);
			m.addSource('mias', { type: 'geojson', data: datos() });
			m.addLayer({
				id: 'mias',
				type: 'circle',
				source: 'mias',
				paint: {
					// Privadas en marrón; públicas en amarillo.
					// Privadas en marrón, de amigos en celeste, públicas en amarillo.
					'circle-color': ['match', ['get', 'con'], 'publico', '#f6b40e', 'amigos', '#74acdf', '#8a5632'],
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
			{#if compartidaCon(r) === 'privada'}<p class="estado">🔒 Privada: solo la ves vos.</p>{/if}
			<Compartir registro={r} {seudonimo} ocupado={cambiando} oncambiar={cambiar} />
			{#if r.publico || r.amigos}
				{#if r.comentario_publico}
					<p class="u-ayuda">
						{comentarioOculto.has(r.id)
							? '💬 Tu anécdota quedó oculta por reportes hasta que la revisemos.'
							: '💬 Tu anécdota también se ve en el mapa.'}
					</p>
				{/if}
				{#if faltaParaTodos(visibleDesde.get(r.id))}
					<p class="u-ayuda">⏳ Por ahora solo la ves vos: {r.amigos ? 'tus amigos' : 'los demás'} la ven {faltaParaTodos(visibleDesde.get(r.id))}.</p>
				{/if}
			{/if}
		</section>
	{/if}

	<p class="u-pie-mapa">
		<strong>{conUbicacion.length}</strong> con ubicación · 🟤 privada · 🔵 amigos · 🟡 pública · Este mapa lo ves solo vos.
	</p>
</div>

{#if festejo}
	<Celebracion novedad={{ tipo: 'publica', numero: festejo }} oncerrar={() => (festejo = null)} />
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
	.u-pie-mapa strong {
		color: var(--tinta);
	}
</style>
