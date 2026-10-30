<script lang="ts">
	// Amigos (PRIVACY.md P-43): invitar con un link, ver lo que compartieron
	// (solo amigos, 30 días, y lo público) y sacar amigos.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { Map as Mapa, GeoJSONSource } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import Logo from '$lib/ui/Logo.svelte';
	import { api, ErrorApi } from '$lib/cliente/api';
	import { crearMapa, encuadrar } from '$lib/banios/crearMapa';
	import { TIPOS } from '$lib/boveda/modelo';
	import { DIAS_AMIGOS, type Publicacion } from '$lib/publicaciones';
	import { agrupar, vecesPorVisita } from '$lib/lugares';

	const TIPO = Object.fromEntries(TIPOS.map((t) => [t.id, t]));

	let amigos = $state<{ seudonimo: string; desde: string }[] | null>(null);
	let cacas = $state<Publicacion[]>([]);
	let link = $state<string | null>(null);
	let diasLink = $state(7);
	let copiado = $state(false);
	let error = $state<string | null>(null);
	let contenedor = $state<HTMLDivElement>();
	let mapa: Mapa | null = null;

	/** "4.ª vez acá" de cada amigo, contando solo lo que te compartió. */
	const veces = $derived.by(() => {
		const r = new Map<string, { vez: number; total: number }>();
		for (const s of new Set(cacas.map((p) => p.seudonimo)))
			for (const [id, v] of vecesPorVisita(
				cacas.filter((p) => p.seudonimo === s),
				(p) => p.dia
			))
				r.set(id, v);
		return r;
	});

	const dia = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });

	async function cargar() {
		const [a, c] = await Promise.all([
			api<{ amigos: { seudonimo: string; desde: string }[] }>('/amigos'),
			api<{ publicaciones: Publicacion[] }>('/amigos/cacas')
		]);
		amigos = a.amigos;
		cacas = c.publicaciones;
		(mapa?.getSource('amigos') as GeoJSONSource | undefined)?.setData(datos());
	}

	/** Un punto por lugar, con cuántas cacas (de todos tus amigos) hay ahí. */
	function datos() {
		return {
			type: 'FeatureCollection' as const,
			features: agrupar(cacas).map((l) => ({
				type: 'Feature' as const,
				geometry: { type: 'Point' as const, coordinates: [l.lon, l.lat] },
				properties: { id: l.visitas[0].id, veces: l.visitas.length }
			}))
		};
	}

	onMount(() => {
		(async () => {
			try {
				await cargar();
			} catch (e) {
				if (e instanceof ErrorApi && e.estado === 401) return goto('/app/entrar?modo=entrar');
				error = 'No se pudo cargar.';
			}
		})();
		return () => mapa?.remove();
	});

	// El mapa se arma cuando hay algo para mostrar (y su contenedor existe).
	$effect(() => {
		if (!contenedor || mapa || !cacas.length) return;
		const c = contenedor;
		void crearMapa(c).then(({ mapa: m, teselas }) => {
			m.addSource('amigos', { type: 'geojson', data: datos() });
			m.addLayer({
				id: 'amigos',
				type: 'circle',
				source: 'amigos',
				paint: {
					'circle-color': '#74acdf',
					'circle-stroke-color': '#3b2314',
					'circle-stroke-width': 2.5,
					'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, ['+', 6, ['min', 6, ['get', 'veces']]], 15, ['+', 11, ['min', 8, ['get', 'veces']]]]
				}
			});
			if (teselas.argentina || teselas.mundo)
				m.addLayer({
					id: 'amigos-veces',
					type: 'symbol',
					source: 'amigos',
					filter: ['>', ['get', 'veces'], 1],
					layout: { 'text-field': ['to-string', ['get', 'veces']], 'text-font': ['Noto Sans Medium'], 'text-size': 13 },
					paint: { 'text-color': '#3b2314' }
				});
			m.on('click', 'amigos', (e) => {
				const id = e.features?.[0]?.properties?.id as string | undefined;
				document.getElementById(`caca-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			});
			encuadrar(m, cacas);
			mapa = m;
		});
	});

	async function invitar() {
		error = null;
		try {
			const r = await api<{ token: string; dias: number }>('/amigos/invitacion', { cuerpo: {} });
			// El token va en el fragmento (#): no viaja al servidor al abrir el link ni queda en logs.
			link = `${location.origin}/app/amigos/unirme#${r.token}`;
			diasLink = r.dias;
			copiado = false;
		} catch (e) {
			error = e instanceof ErrorApi ? e.message : 'No se pudo crear el link.';
		}
	}

	async function compartirLink() {
		if (!link) return;
		const texto = 'Sumate a mis amigos en Dónde Cagué 💩';
		if (navigator.share) {
			try {
				await navigator.share({ title: 'Dónde Cagué', text: texto, url: link });
				return;
			} catch {
				// Cancelado: queda copiar.
			}
		}
		try {
			await navigator.clipboard.writeText(`${texto}: ${link}`);
			copiado = true;
		} catch {
			copiado = false;
		}
	}

	async function anular() {
		await api('/amigos/invitacion', { metodo: 'DELETE' }).catch(() => {});
		link = null;
	}

	async function sacar(seudonimo: string) {
		if (!confirm(`¿Sacar a @${seudonimo} de tus amigos? Dejan de ver lo que comparten entre ustedes.`)) return;
		await api(`/amigos/${encodeURIComponent(seudonimo)}`, { metodo: 'DELETE' }).catch(() => {});
		await cargar();
	}
</script>

<svelte:head>
	<title>Amigos · Dónde Cagué</title>
</svelte:head>

<header class="u-tope">
	<a href="/app" aria-label="Volver a mi trono"><Logo tamanio={32} conNombre={false} /></a>
	<h1>Amigos</h1>
</header>

<main class="u-pagina">
	<section class="u-tarjeta invitar">
		<h2>Invitá a tus amigos</h2>
		{#if link}
			<p class="link" aria-label="Link de invitación">{link}</p>
			<button type="button" class="u-boton" onclick={compartirLink}>{copiado ? '¡Copiado!' : 'Mandarlo por WhatsApp o copiarlo'}</button>
			<p class="u-ayuda">
				Vale {diasLink} días y sirve para varias personas: quien lo abra con su cuenta queda como amigo tuyo. Si creás uno
				nuevo, este deja de andar.
				<button type="button" class="u-enlace" onclick={anular}>Anular este link</button>
			</p>
		{:else}
			<p>Con un link: quien lo abre con su cuenta queda como amigo de los dos lados. Nadie te puede agregar sin tu link.</p>
			<button type="button" class="u-boton" onclick={invitar}>Crear link de invitación</button>
		{/if}
	</section>

	{#if amigos !== null}
		<section class="compartido">
			<h2>Lo que compartieron</h2>
			{#if cacas.length}
				<div class="mapa-amigos" bind:this={contenedor}></div>
				<ul class="feed">
					{#each cacas as p (p.id)}
						<li id={`caca-${p.id}`}>
							<strong>@{p.seudonimo}</strong>
							<span>
								{TIPO[p.tipo]?.icono}
								{p.banio_nombre ?? TIPO[p.tipo]?.texto.toLowerCase()} · {dia(p.dia)}{p.sin_papel ? ' · sin papel 😱' : ''} ·
								{p.alcance === 'amigos' ? '👥 solo amigos' : '🌎 pública'}
							</span>
							{#if (veces.get(p.id)?.total ?? 1) > 1}
								<span class="vez">💩 {veces.get(p.id)?.vez}.ª vez de @{p.seudonimo} acá</span>
							{/if}
							{#if p.comentario}<q>{p.comentario}</q>{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="u-ayuda">
					Todavía nada. Cuando tus amigos compartan una caca ("👥 Mis amigos" al registrar), aparece acá durante {DIAS_AMIGOS} días.
				</p>
			{/if}
		</section>

		<section class="u-tarjeta lista">
			<h2>Tus amigos ({amigos.length})</h2>
			{#if amigos.length}
				<ul>
					{#each amigos as a (a.seudonimo)}
						<li>
							<span>@{a.seudonimo}</span>
							<button type="button" class="u-enlace sacar" onclick={() => sacar(a.seudonimo)}>Sacar</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="u-ayuda">Todavía no tenés amigos acá. Mandales tu link.</p>
			{/if}
		</section>
	{:else if !error}
		<p>Cargando…</p>
	{/if}
	{#if error}<p class="u-error" role="alert">{error}</p>{/if}
</main>

<style>
	h2 {
		margin: 0 0 10px;
		font-size: 20px;
	}
	p {
		margin: 0 0 8px;
	}
	.invitar {
		background: var(--celeste-claro);
	}
	.link {
		padding: 8px 10px;
		border: 2px dashed var(--tinta);
		border-radius: 10px;
		background: var(--papel);
		font-size: 14px;
		overflow-wrap: anywhere;
		user-select: all;
	}
	.compartido {
		margin-bottom: 18px;
	}
	.mapa-amigos {
		height: 260px;
		margin-bottom: 12px;
		border: var(--borde);
		border-radius: var(--radio);
		overflow: hidden;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.feed li {
		display: flex;
		flex-direction: column;
		margin-bottom: 8px;
		padding: 8px 12px;
		border: 2px solid var(--tinta);
		border-radius: 12px;
		background: var(--papel);
		overflow-wrap: anywhere;
	}
	.feed span {
		color: var(--tinta-suave);
		font-size: 14px;
	}
	.feed .vez {
		color: var(--tinta);
		font-weight: 600;
	}
	.feed q {
		margin-top: 4px;
		font-style: italic;
	}
	.lista li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 6px 0;
		border-bottom: 1px dashed var(--gris);
	}
	.sacar {
		color: var(--rojo);
		font-size: 14px;
	}
</style>
