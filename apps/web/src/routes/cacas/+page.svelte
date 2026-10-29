<script lang="ts">
	// Mapa público de cacas: solo lo que cada persona eligió publicar (P-38),
	// con su seudónimo y el día. Nunca la hora, ni casa, laburo o lo de alguien.
	import { onMount } from 'svelte';
	import type { Map as Mapa, GeoJSONSource, MapGeoJSONFeature } from 'maplibre-gl';
	import type { Point } from 'geojson';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import Logo from '$lib/ui/Logo.svelte';
	import Seo from '$lib/ui/Seo.svelte';
	import { crearMapa } from '$lib/banios/crearMapa';
	import { TIPOS, type Tipo } from '$lib/boveda/modelo';
	import { faltaParaTodos, type Publicacion } from '$lib/publicaciones';

	const TIPO = Object.fromEntries(TIPOS.map((t) => [t.id, t]));
	type Filtro = 'todas' | Tipo;
	const FILTROS: { id: Filtro; texto: string }[] = [
		{ id: 'todas', texto: 'Todas' },
		{ id: 'naturaleza', texto: '🌳 Al aire libre' },
		{ id: 'ruta', texto: '🛣️ En la ruta' },
		{ id: 'banio_publico', texto: '🚻 En baños' },
		{ id: 'otro', texto: '❓ Otras' }
	];
	const COLOR: Record<string, string> = { naturaleza: '#4f7a28', ruta: '#f6b40e', banio_publico: '#74acdf', otro: '#c8372d' };

	let contenedor: HTMLDivElement;
	let mapa: Mapa | null = null;
	let todas = $state<Publicacion[]>([]);
	let cargado = $state(false);
	let filtro = $state<Filtro>('todas');
	let elegidas = $state<Publicacion[]>([]);
	let error = $state<string | null>(null);

	const visibles = $derived(filtro === 'todas' ? todas : todas.filter((p) => p.tipo === filtro));
	const personas = $derived(new Set(visibles.map((p) => p.seudonimo)).size);

	function datos(lista: Publicacion[]) {
		return {
			type: 'FeatureCollection' as const,
			features: lista.map((p) => ({
				type: 'Feature' as const,
				geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
				properties: { id: p.id, color: COLOR[p.tipo] ?? '#8a5632', pendiente: faltaParaTodos(p.visible_desde) !== null }
			}))
		};
	}

	$effect(() => {
		const d = datos(visibles);
		(mapa?.getSource('cacas') as GeoJSONSource | undefined)?.setData(d);
	});

	const porId = $derived(new Map(todas.map((p) => [p.id, p])));

	onMount(() => {
		(async () => {
			const lista = (url: string) =>
				fetch(url)
					.then((r) => (r.ok ? (r.json() as Promise<{ publicaciones: Publicacion[] }>) : { publicaciones: [] }))
					.then((d) => d.publicaciones, () => [] as Publicacion[]);
			// Las propias que los demás todavía no ven (primeros 30 minutos): solo para su dueño.
			const [publicas, mias, { mapa: m }] = await Promise.all([
				lista('/api/v1/publicaciones'),
				lista('/api/v1/publicaciones/mias'),
				crearMapa(contenedor)
			]);
			const yaEstan = new Set(publicas.map((p) => p.id));
			todas = [...mias.filter((p) => !yaEstan.has(p.id) && faltaParaTodos(p.visible_desde)), ...publicas];
			cargado = true;
			m.addSource('cacas', { type: 'geojson', data: datos(visibles), cluster: true, clusterMaxZoom: 15, clusterRadius: 40 });
			m.addLayer({
				id: 'grupos',
				type: 'circle',
				source: 'cacas',
				filter: ['has', 'point_count'],
				paint: {
					'circle-color': '#8a5632',
					'circle-stroke-color': '#3b2314',
					'circle-stroke-width': 2.5,
					'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 50, 23, 200, 28]
				}
			});
			m.addLayer({
				id: 'grupos-n',
				type: 'symbol',
				source: 'cacas',
				filter: ['has', 'point_count'],
				layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Medium'], 'text-size': 13 },
				paint: { 'text-color': '#ffffff' }
			});
			m.addLayer({
				id: 'caca',
				type: 'circle',
				source: 'cacas',
				filter: ['!', ['has', 'point_count']],
				paint: {
					'circle-color': ['get', 'color'],
					// Las propias que todavía no ven los demás, con borde amarillo.
					'circle-stroke-color': ['case', ['get', 'pendiente'], '#f6b40e', '#3b2314'],
					'circle-stroke-width': ['case', ['get', 'pendiente'], 4, 2.5],
					'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 6, 15, 11]
				}
			});
			m.on('click', 'caca', (e) => {
				elegidas = (e.features ?? []).map((f) => porId.get(f.properties.id as string)).filter((p): p is Publicacion => !!p);
			});
			m.on('click', 'grupos', async (e) => {
				const f = e.features?.[0] as MapGeoJSONFeature | undefined;
				if (!f) return;
				const fuente = m.getSource('cacas') as GeoJSONSource;
				const zoom = await fuente.getClusterExpansionZoom(f.properties.cluster_id);
				// Varias en el mismo lugar (un baño): ya no se separan, se listan.
				if (zoom > 15 || m.getZoom() >= 15) {
					const hojas = await fuente.getClusterLeaves(f.properties.cluster_id, 50, 0);
					elegidas = hojas.map((h) => porId.get(h.properties?.id as string)).filter((p): p is Publicacion => !!p);
				} else m.easeTo({ center: (f.geometry as Point).coordinates as [number, number], zoom });
			});
			for (const capa of ['caca', 'grupos']) {
				m.on('mouseenter', capa, () => (m.getCanvas().style.cursor = 'pointer'));
				m.on('mouseleave', capa, () => (m.getCanvas().style.cursor = ''));
			}
			mapa = m;
		})().catch(() => (error = 'No se pudo cargar el mapa. Probá recargar.'));
		return () => mapa?.remove();
	});

	const dia = (d: string) =>
		new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
</script>

<Seo
	titulo="Mapa de cacas · Dónde Cagué"
	descripcion="Dónde hizo la gente, en toda la Argentina: los baños, la ruta y los lugares más insólitos. Solo lo que cada uno eligió mostrar."
	ruta="/cacas"
/>

<div class="u-pantalla-mapa">
	<header class="u-tope">
		<a href="/" aria-label="Inicio"><Logo tamanio={32} conNombre={false} /></a>
		<h1>Mapa de cacas</h1>
		<a class="otro" href="/mapa">🚻 Baños</a>
	</header>

	<div class="u-filtros" role="group" aria-label="Filtros">
		{#each FILTROS as f (f.id)}
			<button type="button" class="u-chip" aria-pressed={filtro === f.id} onclick={() => (filtro = f.id)}>{f.texto}</button>
		{/each}
	</div>

	<div class="u-lienzo" bind:this={contenedor}>
		{#if cargado && !todas.length}
			<p class="aviso u-tarjeta">
				Todavía nadie hizo pública una caca. ¿La primera? Registrá una y tocá "🌎 Sumarla al mapa público".
				<a href="/app">Ir a registrar</a>
			</p>
		{/if}
		{#if error}<p class="aviso u-error" role="alert">{error}</p>{/if}
	</div>

	{#if elegidas.length}
		<section class="u-hoja" aria-label="Cacas en este lugar">
			<button type="button" class="u-cerrar" aria-label="Cerrar" onclick={() => (elegidas = [])}>✕</button>
			{#if elegidas[0].banio_nombre}
				<p class="lugar">🚻 {elegidas[0].banio_nombre}</p>
			{/if}
			<ul>
				{#each elegidas as p (p.id)}
					<li>
						<strong>@{p.seudonimo} <span class="numero">· N.º {p.numero.toLocaleString('es-AR')}</span></strong>
						<span>{TIPO[p.tipo]?.icono} {p.banio_id ? 'en el baño' : TIPO[p.tipo]?.texto.toLowerCase()} · {dia(p.dia)}{p.sin_papel ? ' · sin papel 😱' : ''}</span>
						{#if faltaParaTodos(p.visible_desde)}
							<span class="pendiente">⏳ Por ahora solo la ves vos: los demás la ven {faltaParaTodos(p.visible_desde)}.</span>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<p class="u-pie-mapa">
		{#if cargado}<strong>{visibles.length}</strong> {visibles.length === 1 ? 'caca pública' : 'cacas públicas'} de
			<strong>{personas}</strong> {personas === 1 ? 'persona' : 'personas'}<span aria-hidden="true"> · </span>{/if}Solo lo que
		cada uno eligió mostrar, sin la hora.
	</p>
</div>

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
		white-space: nowrap;
	}
	.aviso {
		position: absolute;
		z-index: 2;
		top: 12px;
		left: 16px;
		right: 16px;
		margin: 0;
	}
	.aviso a {
		color: var(--tinta);
		font-weight: 700;
	}
	.lugar {
		margin: 0 0 8px;
		font-size: 18px;
		font-weight: 700;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		flex-direction: column;
		margin-bottom: 10px;
		overflow-wrap: anywhere;
	}
	.pendiente {
		margin-top: 2px;
		color: var(--tinta);
		font-weight: 600;
	}
	.numero {
		color: var(--tinta-suave);
		font-weight: 600;
	}
	li span {
		color: var(--tinta-suave);
		font-size: 15px;
	}
	.u-pie-mapa strong {
		color: var(--tinta);
	}
</style>
