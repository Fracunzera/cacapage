<script lang="ts">
	import { onMount } from 'svelte';
	import type { Map as Mapa, GeoJSONSource, MapGeoJSONFeature } from 'maplibre-gl';
	import type { FeatureCollection, Point } from 'geojson';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import urlTrabajador from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url';
	import Logo from '$lib/ui/Logo.svelte';
	import { ARGENTINA, estiloBase } from '$lib/banios/estilo';
	import { cumple, frescura, lineas, procedencia, titulo, VIDA_MESES } from '$lib/banios/presentar';
	import { NOMBRE_CATEGORIA, type Banio, type Catalogo } from '$lib/banios/tipos';
	import type { Publicacion } from '$lib/publicaciones';
	import Opinar from '$lib/banios/Opinar.svelte';

	type Filtro = 'gratis' | 'accesible' | 'cambiador';
	const FILTROS: { id: Filtro; texto: string }[] = [
		{ id: 'gratis', texto: 'Gratis' },
		{ id: 'accesible', texto: '♿ Accesible' },
		{ id: 'cambiador', texto: '🚼 Cambiador' }
	];

	let contenedor: HTMLDivElement;
	let mapa: Mapa | null = null;
	let catalogo = $state<Catalogo | null>(null);
	let porId = new Map<string, Banio>();
	let filtros = $state<Filtro[]>([]);
	let elegido = $state<Banio | null>(null);
	let sinMapaBase = $state(false);
	let aviso = $state<string | null>(null);
	let yo = $state<{ lat: number; lon: number } | null>(null);
	let buscando = $state(false);
	/** Visitas que la gente eligió hacer públicas, por baño (P-38). */
	let visitas = $state(new Map<string, Publicacion[]>());

	const visibles = $derived(
		(catalogo?.banios ?? []).filter((b) => filtros.every((f) => cumple(b, f)))
	);

	function distanciaM(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
		const r = Math.PI / 180;
		const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
		const y = (b.lat - a.lat) * r;
		return Math.sqrt(x * x + y * y) * 6_371_000;
	}
	const cercanos = $derived(
		yo
			? visibles
					.map((b) => ({ b, d: distanciaM(yo!, b) }))
					.sort((p, q) => p.d - q.d)
					.slice(0, 3)
			: []
	);
	const distancia = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`);

	function geojson(banios: Banio[]): FeatureCollection {
		return {
			type: 'FeatureCollection',
			features: banios.map((b) => ({
				type: 'Feature',
				id: undefined,
				geometry: { type: 'Point', coordinates: [b.lon, b.lat] },
				properties: {
					id: b.id,
					probable: b.existencia === 'probable',
					// Existencia vencida (DESIGN.md §10.3): se dibuja apagado.
					viejo: frescura(b.modificado, VIDA_MESES.existencia) === 'vencido'
				}
			}))
		};
	}

	$effect(() => {
		const datos = geojson(visibles);
		(mapa?.getSource('banios') as GeoJSONSource | undefined)?.setData(datos);
	});

	$effect(() => {
		const punto = yo;
		(mapa?.getSource('yo') as GeoJSONSource | undefined)?.setData({
			type: 'FeatureCollection',
			features: punto ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [punto.lon, punto.lat] } }] : []
		});
	});

	$effect(() => {
		const id = elegido?.id ?? '';
		mapa?.setFilter('elegido', ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], id]]);
	});

	function alternar(f: Filtro) {
		filtros = filtros.includes(f) ? filtros.filter((x) => x !== f) : [...filtros, f];
	}

	function elegir(b: Banio) {
		elegido = b;
		// El punto queda arriba de la ficha, no tapado por ella.
		mapa?.easeTo({
			center: [b.lon, b.lat],
			zoom: Math.max(mapa.getZoom(), 15),
			padding: { top: 0, left: 0, right: 0, bottom: Math.round(contenedor.clientHeight * 0.45) }
		});
	}

	function cercaMio() {
		if (!('geolocation' in navigator)) {
			aviso = 'Este navegador no puede darte la ubicación.';
			return;
		}
		buscando = true;
		aviso = null;
		navigator.geolocation.getCurrentPosition(
			(p) => {
				buscando = false;
				yo = { lat: p.coords.latitude, lon: p.coords.longitude };
				mapa?.flyTo({ center: [yo.lon, yo.lat], zoom: 14 });
			},
			() => {
				buscando = false;
				aviso = 'No pudimos saber dónde estás. Fijate que el navegador tenga permiso de ubicación.';
			},
			{ enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
		);
	}

	onMount(() => {
		let vivo = true;
		fetch('/api/v1/publicaciones')
			.then((r) => (r.ok ? (r.json() as Promise<{ publicaciones: Publicacion[] }>) : { publicaciones: [] }))
			.then(({ publicaciones }) => {
				const m = new Map<string, Publicacion[]>();
				for (const p of publicaciones) if (p.banio_id) m.set(p.banio_id, [...(m.get(p.banio_id) ?? []), p]);
				visitas = m;
			})
			.catch(() => {});
		(async () => {
			const [{ default: maplibregl }, { Protocol }, respuesta, teselas] = await Promise.all([
				import('maplibre-gl/dist/maplibre-gl-csp.js'),
				import('pmtiles'),
				fetch('/api/v1/banios'),
				fetch('/tiles/argentina.pmtiles', { headers: { range: 'bytes=0-0' } }).then((r) => r.ok, () => false)
			]);
			if (!vivo) return;
			catalogo = respuesta.ok ? ((await respuesta.json()) as Catalogo) : { osm_base: null, importado_en: null, atribucion: '', banios: [] };
			porId = new Map(catalogo.banios.map((b) => [b.id, b]));
			sinMapaBase = !teselas;

			maplibregl.setWorkerUrl(urlTrabajador);
			maplibregl.addProtocol('pmtiles', new Protocol().tile);
			const m = new maplibregl.Map({
				container: contenedor,
				style: estiloBase(location.origin, teselas),
				bounds: ARGENTINA,
				maxBounds: [
					[-90, -60],
					[-40, -15]
				],
				attributionControl: { compact: true },
				locale: {
					'NavigationControl.ZoomIn': 'Acercar',
					'NavigationControl.ZoomOut': 'Alejar',
					'NavigationControl.ResetBearing': 'Apuntar al norte',
					'AttributionControl.ToggleAttribution': 'Créditos'
				}
			});
			m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
			m.on('load', () => {
				m.addSource('banios', {
					type: 'geojson',
					data: geojson(visibles),
					cluster: true,
					clusterMaxZoom: 12,
					clusterRadius: 44,
					attribution: 'Baños: © <a href="https://www.openstreetmap.org/copyright">colaboradores de OpenStreetMap</a> (ODbL)'
				});
				m.addSource('yo', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
				m.addLayer({
					id: 'grupos',
					type: 'circle',
					source: 'banios',
					filter: ['has', 'point_count'],
					paint: {
						'circle-color': '#f6b40e',
						'circle-stroke-color': '#3b2314',
						'circle-stroke-width': 2.5,
						'circle-radius': ['step', ['get', 'point_count'], 14, 20, 18, 100, 23, 500, 28]
					}
				});
				m.addLayer({
					id: 'grupos-n',
					type: 'symbol',
					source: 'banios',
					filter: ['has', 'point_count'],
					layout: teselas
						? { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Medium'], 'text-size': 13 }
						: {},
					paint: { 'text-color': '#3b2314' }
				});
				m.addLayer({
					id: 'banio',
					type: 'circle',
					source: 'banios',
					filter: ['!', ['has', 'point_count']],
					paint: {
						// Lleno: confirmado. Hueco: probable (DESIGN.md §10.4).
						'circle-color': ['case', ['get', 'probable'], '#ffffff', '#74acdf'],
						'circle-stroke-color': ['case', ['get', 'probable'], '#74acdf', '#3b2314'],
						'circle-stroke-width': ['case', ['get', 'probable'], 3, 2.5],
						'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 6, 15, 10],
						'circle-opacity': ['case', ['get', 'viejo'], 0.55, 1],
						'circle-stroke-opacity': ['case', ['get', 'viejo'], 0.55, 1]
					}
				});
				m.addLayer(
					{
						id: 'elegido',
						type: 'circle',
						source: 'banios',
						filter: ['==', ['get', 'id'], ''],
						paint: {
							'circle-color': 'rgba(0,0,0,0)',
							'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 11, 15, 16],
							'circle-stroke-color': '#3b2314',
							'circle-stroke-width': 3
						}
					},
					'banio'
				);
				m.addLayer({
					id: 'yo',
					type: 'circle',
					source: 'yo',
					paint: { 'circle-color': '#c8372d', 'circle-radius': 8, 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 }
				});
				m.on('click', 'banio', (e) => {
					const id = (e.features?.[0] as MapGeoJSONFeature | undefined)?.properties?.id as string | undefined;
					const b = id ? porId.get(id) : undefined;
					if (b) elegir(b);
				});
				m.on('click', 'grupos', async (e) => {
					const f = e.features?.[0];
					if (!f) return;
					const zoom = await (m.getSource('banios') as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id);
					m.easeTo({ center: (f.geometry as Point).coordinates as [number, number], zoom });
				});
				for (const capa of ['banio', 'grupos']) {
					m.on('mouseenter', capa, () => (m.getCanvas().style.cursor = 'pointer'));
					m.on('mouseleave', capa, () => (m.getCanvas().style.cursor = ''));
				}
				mapa = m;
			});
		})().catch(() => {
			aviso = 'No se pudo cargar el mapa. Probá recargar la página.';
		});
		return () => {
			vivo = false;
			mapa?.remove();
		};
	});

	const fechaDatos = $derived(
		catalogo?.osm_base
			? new Date(catalogo.osm_base).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
			: null
	);
</script>

<svelte:head>
	<title>Mapa de baños de la Argentina · Dónde Cagué</title>
	<meta
		name="description"
		content="Baños públicos, de estaciones de servicio, terminales y shoppings de toda la Argentina. Cuáles son gratis, accesibles o tienen cambiador."
	/>
</svelte:head>

<div class="pantalla-mapa">
	<header class="u-tope">
		<a href="/" aria-label="Inicio"><Logo tamanio={32} conNombre={false} /></a>
		<h1>Baños</h1>
		<button type="button" class="cerca" onclick={cercaMio} disabled={buscando}>
			{buscando ? 'Buscando…' : '📍 Cerca mío'}
		</button>
	</header>

	<div class="filtros" role="group" aria-label="Filtros">
		{#each FILTROS as f (f.id)}
			<button type="button" class="chip" aria-pressed={filtros.includes(f.id)} onclick={() => alternar(f.id)}>{f.texto}</button>
		{/each}
	</div>

	<div class="lienzo" bind:this={contenedor}>
		{#if aviso}<p class="aviso u-error" role="alert">{aviso}</p>{/if}
		{#if catalogo && catalogo.banios.length === 0}
			<p class="aviso u-tarjeta">Estamos trayendo los baños de OpenStreetMap. Volvé en un rato.</p>
		{/if}
	</div>

	{#if elegido}
		{@const b = elegido}
		<section class="ficha" aria-labelledby="ficha-titulo">
			<button type="button" class="cerrar" aria-label="Cerrar" onclick={() => (elegido = null)}>✕</button>
			<p class="categoria">{NOMBRE_CATEGORIA[b.categoria]}{b.marca && b.nombre !== b.marca ? ` · ${b.marca}` : ''}</p>
			<h2 id="ficha-titulo">{titulo(b)}</h2>
			{#if b.existencia === 'probable'}
				<p class="probable">Suele haber baño, pero nadie lo confirmó todavía.</p>
			{/if}
			{#if b.atributos.direccion || b.atributos.localidad}
				<p class="direccion">{[b.atributos.direccion, b.atributos.localidad].filter(Boolean).join(', ')}</p>
			{/if}
			<ul>
				{#each lineas(b) as l (l.clave)}
					<li class={l.frescura}>
						<span aria-hidden="true">{l.icono}</span>
						{l.texto}{#if l.frescura !== 'vigente'}<small> · {l.frescura === 'dudoso' ? 'puede haber cambiado' : 'dato viejo'}</small>{/if}
					</li>
				{:else}
					<li class="vacio">Todavía no sabemos si es gratis, accesible o tiene cambiador.</li>
				{/each}
			</ul>
			{#if visitas.get(b.id)?.length}
				{@const v = visitas.get(b.id)!}
				<p class="visitas">
					💩 {v.length === 1 ? '1 visita pública' : `${v.length} visitas públicas`}:
					{[...new Set(v.map((x) => '@' + x.seudonimo))].slice(0, 5).join(', ')}{new Set(v.map((x) => x.seudonimo)).size > 5 ? ' y más' : ''}
					<a href="/cacas">ver</a>
				</p>
			{/if}
			<Opinar
				banioId={b.id}
				onoculto={() => {
					// Salió del mapa por reportes: se saca ya, sin esperar al catálogo nuevo.
					if (catalogo) catalogo = { ...catalogo, banios: catalogo.banios.filter((x) => x.id !== b.id) };
					elegido = null;
				}}
			/>
			<p class="fuente">{procedencia(b)}</p>
			<div class="acciones">
				<a
					class="u-boton"
					href={`https://www.openstreetmap.org/directions?to=${b.lat}%2C${b.lon}#map=17/${b.lat}/${b.lon}`}
					target="_blank"
					rel="noopener noreferrer">Cómo llegar</a
				>
			</div>
		</section>
	{:else if cercanos.length}
		<section class="ficha cercanos" aria-label="Los más cercanos">
			<button type="button" class="cerrar" aria-label="Cerrar" onclick={() => (yo = null)}>✕</button>
			<h2>Los más cercanos</h2>
			<ol>
				{#each cercanos as { b, d } (b.id)}
					<li>
						<button type="button" onclick={() => elegir(b)}>
							<span class="nombre">{titulo(b)}</span>
							<span class="dist">{distancia(d)}</span>
						</button>
					</li>
				{/each}
			</ol>
			<p class="fuente">Tu ubicación no sale de tu celular.</p>
		</section>
	{/if}

	{#if catalogo}
		<p class="pie" aria-live="polite">
			<strong>{visibles.length.toLocaleString('es-AR')} baños</strong>
			{#if fechaDatos}· datos de OpenStreetMap al {fechaDatos}{/if}
			{#if sinMapaBase}· mapa base sin cargar todavía{/if}
		</p>
	{/if}
</div>

<style>
	:global(body:has(.pantalla-mapa)) {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		overflow: hidden;
	}
	.pantalla-mapa {
		position: relative;
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
	}
	.cerca {
		min-height: 40px;
		padding: 6px 12px;
		border: var(--borde);
		border-radius: 999px;
		background: var(--papel);
		color: var(--tinta);
		font-size: 15px;
		font-weight: 700;
		box-shadow: var(--sombra-chica);
		cursor: pointer;
	}
	.filtros {
		display: flex;
		gap: 8px;
		align-items: center;
		padding: 8px 16px;
		overflow-x: auto;
		background: var(--crema);
		border-bottom: 2px solid var(--tinta);
	}
	.chip {
		flex: none;
		min-height: 36px;
		padding: 4px 12px;
		border: 2px solid var(--tinta);
		border-radius: 999px;
		background: var(--papel);
		color: var(--tinta);
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
	}
	.chip[aria-pressed='true'] {
		background: var(--tinta);
		color: var(--sol);
	}
		.lienzo {
		position: relative;
		flex: 1;
		min-height: 0;
	}
	.aviso {
		position: absolute;
		z-index: 2;
		top: 12px;
		left: 16px;
		right: 16px;
		margin: 0;
	}
	.ficha {
		position: absolute;
		z-index: 3;
		left: 8px;
		right: 8px;
		bottom: 8px;
		max-height: 60%;
		overflow-y: auto;
		margin: 0 auto;
		max-width: 30rem;
		padding: 16px 16px 14px;
		border: var(--borde);
		border-radius: var(--radio);
		background: var(--papel);
		box-shadow: var(--sombra);
	}
	.cerrar {
		float: right;
		width: 36px;
		height: 36px;
		border: 2px solid var(--tinta);
		border-radius: 50%;
		background: var(--crema);
		color: var(--tinta);
		font-size: 16px;
		cursor: pointer;
	}
	.categoria {
		margin: 0;
		color: var(--tinta-suave);
		font-size: 14px;
		font-weight: 600;
	}
	h2 {
		margin: 2px 0 6px;
		font-size: 22px;
		line-height: 1.15;
		overflow-wrap: anywhere;
	}
	.probable {
		margin: 0 0 8px;
		padding: 6px 10px;
		border-radius: 10px;
		background: var(--celeste-claro);
		font-size: 15px;
	}
	.direccion {
		margin: 0 0 8px;
		font-size: 15px;
	}
	ul,
	ol {
		margin: 0 0 8px;
		padding: 0;
		list-style: none;
	}
	li {
		margin: 0 0 4px;
	}
	li.dudoso {
		color: var(--tinta-suave);
	}
	li.vencido {
		color: var(--tinta-suave);
		text-decoration: line-through;
		text-decoration-color: var(--gris);
	}
	li.vacio {
		color: var(--tinta-suave);
		font-size: 15px;
	}
	small {
		font-size: 13px;
		text-decoration: none;
	}
	.visitas {
		margin: 0 0 6px;
		padding: 6px 10px;
		border-radius: 10px;
		background: var(--sol-claro);
		font-size: 15px;
		overflow-wrap: anywhere;
	}
	.visitas a {
		color: var(--tinta);
		font-weight: 700;
	}
	.fuente {
		margin: 0;
		color: var(--tinta-suave);
		font-size: 13px;
	}
	.acciones .u-boton {
		min-height: 48px;
		font-size: 17px;
	}
	.cercanos li button {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		width: 100%;
		min-height: 44px;
		padding: 8px 10px;
		border: 2px solid var(--tinta);
		border-radius: 12px;
		background: var(--crema);
		color: var(--tinta);
		font-size: 16px;
		text-align: left;
		cursor: pointer;
	}
	.cercanos .nombre {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.cercanos .dist {
		flex: none;
	}
	.pie {
		margin: 0;
		padding: 5px 16px calc(5px + env(safe-area-inset-bottom));
		background: var(--crema);
		border-top: 2px solid var(--tinta);
		color: var(--tinta-suave);
		font-size: 13px;
	}
	.pie strong {
		color: var(--tinta);
	}
</style>
