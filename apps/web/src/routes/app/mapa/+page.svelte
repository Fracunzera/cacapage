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
	import { agrupar, nombreDelLugar, type Lugar } from '$lib/lugares';
	import { LUGAR_NOMBRE_MAX, problemaNombreLugar } from '$lib/publicaciones';

	const TIPO = Object.fromEntries(TIPOS.map((t) => [t.id, t]));

	let contenedor: HTMLDivElement;
	let mapa: Mapa | null = null;
	let boveda = $state.raw<Boveda | null>(null);
	let seudonimo = $state('');
	let registros = $state<Registro[]>([]);
	/** El lugar tocado en el mapa (por su clave): sus visitas, de la más nueva a la más vieja. */
	let elegido = $state<string | null>(null);
	let conEtiquetas = false;
	let cambiando = $state(false);
	let error = $state<string | null>(null);
	let festejo = $state<number | null>(null);
	/** Editando el nombre del lugar elegido: el texto; null si no. */
	let renombrando = $state<string | null>(null);
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
	/** Un punto por lugar (mismo baño o a menos de 40 m), con cuántas veces fuiste. */
	const lugares = $derived(agrupar([...conUbicacion].sort((a, b) => (a.ocurrido_en < b.ocurrido_en ? -1 : 1))));
	const lugarElegido = $derived<Lugar<Registro> | undefined>(lugares.find((l) => l.clave === elegido));

	/** El color del lugar: lo más compartido que haya ahí. */
	const ORDEN = { privada: 0, amigos: 1, publico: 2 } as const;
	const masCompartido = (l: Lugar<Registro>) =>
		l.visitas.map(compartidaCon).reduce((a, b) => (ORDEN[b] > ORDEN[a] ? b : a), 'privada' as Con);

	function datos() {
		return {
			type: 'FeatureCollection' as const,
			features: lugares.map((l) => ({
				type: 'Feature' as const,
				geometry: { type: 'Point' as const, coordinates: [l.lon, l.lat] },
				properties: { clave: l.clave, con: masCompartido(l), veces: l.visitas.length, nombre: nombreDelLugar(l.visitas) ?? '' }
			}))
		};
	}

	$effect(() => {
		const d = datos();
		(mapa?.getSource('mias') as GeoJSONSource | undefined)?.setData(d);
	});

	function refrescar() {
		registros = boveda?.registros() ?? [];
	}

	/** Ponerle (o sacarle) el nombre a un lugar: en todas sus visitas, y a los amigos lo que ya ven. */
	async function renombrar(l: Lugar<Registro>, texto: string) {
		if (!boveda) return;
		const nombre = texto.trim().slice(0, LUGAR_NOMBRE_MAX);
		const problema = nombre ? problemaNombreLugar(nombre) : null;
		if (problema && l.visitas.some((v) => v.amigos)) {
			error = problema;
			return;
		}
		cambiando = true;
		error = null;
		const ahora = new Date().toISOString();
		const nuevas = l.visitas.map((v) => {
			const { lugar_nombre: _, ...resto } = v;
			return { ...resto, ...(nombre ? { lugar_nombre: nombre } : {}), actualizado_en: ahora };
		});
		for (const v of nuevas) await boveda.guardar(v);
		try {
			for (const v of nuevas.filter((v) => v.amigos)) await compartir(boveda, v, 'amigos', v.comentario_publico === true);
		} catch {
			error = 'El nombre quedó guardado, pero tus amigos ven el anterior: hace falta conexión. Probá de nuevo.';
		}
		renombrando = null;
		cambiando = false;
		refrescar();
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
			const { mapa: m, teselas } = await crearMapa(contenedor);
			conEtiquetas = teselas.argentina || teselas.mundo;
			m.addSource('mias', { type: 'geojson', data: datos() });
			m.addLayer({
				id: 'mias',
				type: 'circle',
				source: 'mias',
				paint: {
					// Privadas en marrón, de amigos en celeste, públicas en amarillo.
					'circle-color': ['match', ['get', 'con'], 'publico', '#f6b40e', 'amigos', '#74acdf', '#8a5632'],
					'circle-stroke-color': '#3b2314',
					'circle-stroke-width': 2.5,
					// Más grande donde fuiste más veces.
					'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, ['+', 6, ['min', 6, ['get', 'veces']]], 15, ['+', 11, ['min', 8, ['get', 'veces']]]]
				}
			});
			// El número de veces (las letras necesitan las fuentes del mapa base).
			if (conEtiquetas)
				m.addLayer({
					id: 'mias-veces',
					type: 'symbol',
					source: 'mias',
					filter: ['>', ['get', 'veces'], 1],
					layout: { 'text-field': ['to-string', ['get', 'veces']], 'text-font': ['Noto Sans Medium'], 'text-size': 13 },
					paint: { 'text-color': '#3b2314' }
				});
			if (conEtiquetas)
				m.addLayer({
					id: 'mias-nombre',
					type: 'symbol',
					source: 'mias',
					minzoom: 12,
					filter: ['!=', ['get', 'nombre'], ''],
					layout: {
						'text-field': ['get', 'nombre'],
						'text-font': ['Noto Sans Medium'],
						'text-size': 12,
						'text-offset': [0, 1.6],
						'text-anchor': 'top',
						'text-max-width': 10
					},
					paint: { 'text-color': '#3b2314', 'text-halo-color': '#fff8ec', 'text-halo-width': 1.5 }
				});
			m.on('click', 'mias', (e) => {
				elegido = (e.features?.[0]?.properties?.clave as string | undefined) ?? null;
				renombrando = null;
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

	{#if lugarElegido}
		{@const l = lugarElegido}
		{@const primera = l.visitas[0]}
		{@const nombre = nombreDelLugar(l.visitas)}
		<section class="u-hoja" aria-labelledby="ficha-mia">
			<button type="button" class="u-cerrar" aria-label="Cerrar" onclick={() => (elegido = null)}>✕</button>
			<p class="tipo">{TIPO[primera.tipo]?.icono} {TIPO[primera.tipo]?.texto}</p>
			<h2 id="ficha-mia">{nombre ?? primera.banio_nombre ?? TIPO[primera.tipo]?.texto}</h2>
			{#if renombrando === null}
				<button type="button" class="u-enlace" disabled={cambiando} onclick={() => (renombrando = nombre ?? '')}>
					✏️ {nombre ? 'Cambiar el nombre' : 'Ponerle nombre'}
				</button>
			{:else}
				<form
					class="renombrar"
					onsubmit={(e) => {
						e.preventDefault();
						void renombrar(l, renombrando ?? '');
					}}
				>
					<label class="u-campo">
						<span>Nombre del lugar</span>
						<input type="text" bind:value={renombrando} maxlength={LUGAR_NOMBRE_MAX} placeholder="Casa de la abuela, el YPF de la 3…" />
					</label>
					<p class="u-ayuda">
						🔒 Para todas tus visitas acá. Lo ves vos{l.visitas.some((v) => v.amigos) ? ' y tus amigos, en lo que les compartiste' : ''}; no va al
						mapa público. Vacío, lo saca.
					</p>
					<div class="botones-nombre">
						<button type="submit" class="u-boton sec" disabled={cambiando}>Guardar nombre</button>
						<button type="button" class="u-enlace" onclick={() => (renombrando = null)}>Cancelar</button>
					</div>
				</form>
			{/if}
			{#if l.visitas.length > 1}<p class="veces">💩 Fuiste {l.visitas.length} veces acá.</p>{/if}
			<ol class="visitas">
				{#each [...l.visitas].reverse() as r, i (r.id)}
					<li>
						<p class="cuando">
							{#if l.visitas.length > 1}<strong>{l.visitas.length - i}.ª vez</strong> ·{/if}
							{fecha(r.ocurrido_en)}{r.sin_papel ? ' · sin papel 😱' : ''}
						</p>
						{#if r.comentario}<p class="comentario">“{r.comentario}”</p>{/if}
						{#if compartidaCon(r) === 'privada'}<p class="estado">🔒 Privada: solo la ves vos.</p>{/if}
						<Compartir registro={r} {seudonimo} ocupado={cambiando} oncambiar={cambiar} />
						{#if (r.publico || r.amigos) && r.comentario_publico}
							<p class="u-ayuda">
								{comentarioOculto.has(r.id)
									? '💬 Tu anécdota quedó oculta por reportes hasta que la revisemos.'
									: '💬 Tu anécdota también se ve.'}
							</p>
						{/if}
						{#if (r.publico || r.amigos) && faltaParaTodos(visibleDesde.get(r.id))}
							<p class="u-ayuda">⏳ Por ahora solo la ves vos: {r.amigos ? 'tus amigos' : 'los demás'} la ven {faltaParaTodos(visibleDesde.get(r.id))}.</p>
						{/if}
					</li>
				{/each}
			</ol>
		</section>
	{/if}

	<p class="u-pie-mapa">
		<strong>{conUbicacion.length}</strong> con ubicación en <strong>{lugares.length}</strong> {lugares.length === 1 ? 'lugar' : 'lugares'} · 🟤 privada · 🔵 amigos · 🟡 pública · Lo ves solo vos.
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
	.renombrar {
		margin: 6px 0 10px;
	}
	.botones-nombre {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.veces {
		margin: 0 0 6px;
		font-weight: 700;
	}
	.visitas {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.visitas li {
		padding: 8px 0;
		border-top: 1px dashed var(--gris);
	}
	.estado {
		margin: 10px 0 0;
		font-weight: 600;
	}
	.u-pie-mapa strong {
		color: var(--tinta);
	}
</style>
