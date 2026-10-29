<script lang="ts">
	// Registrar una visita al trono (DESIGN.md §8, pasos 1-2, y §8.1).
	// Todo queda en el historial cifrado: nada de esto se publica.
	import { onMount } from 'svelte';
	import { textoDistancia } from '$lib/banios/geo';
	import { titulo } from '$lib/banios/presentar';
	import type { Banio, Catalogo } from '$lib/banios/tipos';
	import { COMENTARIO_MAX, TIPOS, type Registro, type Tipo } from '../modelo';
	import { candidatos } from '../candidatos';
	import { api, ErrorApi } from '$lib/cliente/api';
	import { enArgentina, interpretar, type Punto } from '$lib/ubicacion/interpretar';
	import { sePuedePublicar } from '../publicar';
	import ConfirmarPublico from './ConfirmarPublico.svelte';

	let {
		seudonimo,
		onguardar,
		oncancelar
	}: { seudonimo: string; onguardar: (r: Registro, publico: boolean) => Promise<void>; oncancelar: () => void } = $props();

	const EJEMPLOS = [
		'Se cortó la luz en lo mejor…',
		'El secamanos sonaba como un avión',
		'Había fila afuera',
		'Viento de 90 km/h para llegar',
		'Música funcional de los 90'
	];
	const ejemplo = EJEMPLOS[Math.floor(Math.random() * EJEMPLOS.length)];

	let tipo = $state<Tipo | null>(null);
	let ahora = $state(true);
	let cuando = $state('');
	let sinPapel = $state(false);
	let comentario = $state('');
	let ubicacion = $state<{ lat: number; lon: number; precision: number; fuente: 'gps' | 'manual'; texto?: string } | null>(null);
	// Ubicación a mano (sin GPS): dirección, coordenadas o link de un mapa.
	let aMano = $state(false);
	let textoUbicacion = $state('');
	let direcciones = $state<{ nombre: string; lat: number; lon: number }[]>([]);
	let fueraDelPais = $state(false);
	let buscando = $state(false);
	let avisoUbicacion = $state<string | null>(null);
	let cerca = $state<{ banio: Banio; distancia: number }[]>([]);
	let banioId = $state<string | null>(null);
	let guardando = $state(false);
	let publico = $state(false);
	let confirmando = $state.raw<Registro | null>(null);
	let error = $state<string | null>(null);

	const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
	onMount(() => (cuando = local(new Date())));

	const enCasa = $derived(tipo === 'casa' || tipo === 'laburo' || tipo === 'casa_ajena');
	const momento = $derived(ahora || !cuando ? new Date() : new Date(cuando));
	const enElFuturo = $derived(!ahora && momento.getTime() > Date.now() + 60_000);
	const banioElegido = $derived(enCasa ? undefined : cerca.find((c) => c.banio.id === banioId)?.banio);
	const publicable = $derived(
		tipo !== null && sePuedePublicar({ tipo, banio_id: banioElegido?.id, lat: ubicacion?.lat })
	);
	$effect(() => {
		if (!publicable) publico = false;
	});

	/** Fija la ubicación y busca los baños del catálogo que hay cerca. */
	async function fijar(p: Punto, precision: number, fuente: 'gps' | 'manual', texto?: string) {
		ubicacion = { lat: p.lat, lon: p.lon, precision, fuente, texto };
		fueraDelPais = !enArgentina(p);
		direcciones = [];
		try {
			const cat = (await (await fetch('/api/v1/banios')).json()) as Catalogo;
			const r = candidatos(cat.banios, p, precision, momento);
			cerca = r.cerca;
			banioId = enCasa ? null : r.preseleccion;
		} catch {
			cerca = [];
		}
	}

	async function cargarAMano() {
		avisoUbicacion = null;
		direcciones = [];
		let i = interpretar(textoUbicacion);
		buscando = true;
		try {
			if (i.tipo === 'corto') {
				const { url } = await api<{ url: string }>('/ubicacion/corto', { cuerpo: { url: i.url } });
				i = interpretar(url);
				if (i.tipo !== 'punto') i = { tipo: 'invalido', motivo: 'En ese link no encontramos coordenadas. Probá con las coordenadas.' };
			}
			if (i.tipo === 'punto') await fijar(i.punto, 20, 'manual', i.origen === 'enlace' ? 'desde un link' : 'por coordenadas');
			else if (i.tipo === 'invalido') avisoUbicacion = i.motivo;
			else {
				const { resultados } = await api<{ resultados: typeof direcciones }>(`/ubicacion/buscar?q=${encodeURIComponent(i.texto)}`);
				direcciones = resultados;
				if (!resultados.length) avisoUbicacion = 'No encontramos esa dirección. Probá con calle, número y ciudad.';
			}
		} catch (e) {
			avisoUbicacion = e instanceof ErrorApi ? e.message : 'No se pudo cargar la ubicación.';
		} finally {
			buscando = false;
		}
	}

	function cambiarUbicacion() {
		ubicacion = null;
		cerca = [];
		banioId = null;
		fueraDelPais = false;
	}

	function ubicar() {
		if (!('geolocation' in navigator)) {
			avisoUbicacion = 'Este navegador no puede darte la ubicación.';
			return;
		}
		buscando = true;
		avisoUbicacion = null;
		navigator.geolocation.getCurrentPosition(
			async (p) => {
				await fijar({ lat: p.coords.latitude, lon: p.coords.longitude }, Math.round(p.coords.accuracy), 'gps');
				buscando = false;
			},
			() => {
				buscando = false;
				avisoUbicacion = 'No pudimos saber dónde estás. Podés escribir la dirección o guardar sin ubicación.';
			},
			{ enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
		);
	}

	function elegirBanio(id: string | null) {
		banioId = id;
		if (id && (!tipo || enCasa)) tipo = 'banio_publico';
	}

	function armar(): Registro | null {
		if (!tipo || enElFuturo) return null;
		const elegido = banioElegido;
		return {
			id: crypto.randomUUID(),
			ocurrido_en: momento.toISOString(),
			tipo,
			actualizado_en: new Date().toISOString(),
			...(ubicacion
				? { lat: ubicacion.lat, lon: ubicacion.lon, precision_m: ubicacion.precision, fuente_ubicacion: ubicacion.fuente }
				: {}),
			...(elegido && !enCasa ? { banio_id: elegido.id, banio_nombre: titulo(elegido) } : {}),
			...(sinPapel ? { sin_papel: true } : {}),
			...(comentario.trim() ? { comentario: comentario.trim().slice(0, COMENTARIO_MAX) } : {})
		};
	}

	function pedirGuardar() {
		const r = armar();
		if (!r) return;
		if (publico) confirmando = r;
		else void guardar(r, false);
	}

	async function guardar(r: Registro, comoPublico: boolean) {
		confirmando = null;
		guardando = true;
		error = null;
		try {
			await onguardar(r, comoPublico);
		} catch {
			error = 'No se pudo guardar. Probá de nuevo.';
			guardando = false;
		}
	}
</script>

<section class="u-tarjeta registrar" aria-labelledby="titulo-registrar">
	<h2 id="titulo-registrar">¿Dónde fue?</h2>
	<div class="tipos" role="radiogroup" aria-label="Dónde fue">
		{#each TIPOS as t (t.id)}
			<button type="button" role="radio" aria-checked={tipo === t.id} class="tipo" onclick={() => (tipo = t.id)}>
				<span class="icono" aria-hidden="true">{t.icono}</span>{t.texto}
			</button>
		{/each}
	</div>

	<fieldset class="cuando">
		<legend>¿Cuándo?</legend>
		<label class="u-check"><input type="radio" name="cuando" checked={ahora} onchange={() => (ahora = true)} /> Recién</label>
		<label class="u-check"><input type="radio" name="cuando" checked={!ahora} onchange={() => (ahora = false)} /> Fue antes</label>
		{#if !ahora}
			<input type="datetime-local" class="fecha" bind:value={cuando} max={local(new Date())} aria-label="Fecha y hora" />
			{#if enElFuturo}<p class="u-error">Todavía no pasó.</p>{/if}
		{/if}
	</fieldset>

	{#if !ubicacion}
		<div class="como-ubicar">
			<button type="button" class="u-boton sec ubicar" onclick={ubicar} disabled={buscando}>
				{buscando && !aMano ? 'Buscando…' : '📍 Usar mi ubicación'}
			</button>
			<button type="button" class="u-boton sec ubicar" aria-pressed={aMano} onclick={() => (aMano = !aMano)}>
				✍️ Escribirla
			</button>
		</div>
		{#if aMano}
			<form
				class="a-mano"
				onsubmit={(e) => {
					e.preventDefault();
					void cargarAMano();
				}}
			>
				<label class="u-campo">
					<span>Dirección, coordenadas o link de un mapa</span>
					<input
						type="text"
						bind:value={textoUbicacion}
						autocomplete="off"
						enterkeyhint="search"
						placeholder="Zapiola 50, Río Gallegos · -51.62, -69.22 · maps.app.goo.gl/…"
					/>
				</label>
				<button type="submit" class="u-boton sec buscar" disabled={buscando || !textoUbicacion.trim()}>
					{buscando ? 'Buscando…' : 'Buscar'}
				</button>
			</form>
			{#if direcciones.length}
				<fieldset class="banios">
					<legend>¿Cuál de estas?</legend>
					{#each direcciones as d, i (i)}
						<button type="button" class="banio direccion" onclick={() => fijar(d, 50, 'manual', `en ${d.nombre}`)}>
							<span class="nombre">{d.nombre}</span>
						</button>
					{/each}
				</fieldset>
			{/if}
		{/if}
		<p class="u-ayuda">
			Opcional. Queda cifrada en tu historial: solo la ves vos.{#if aMano}
				Las direcciones y los links cortos se buscan a través de nuestro servidor, sin guardarlos.{/if}
		</p>
		{#if avisoUbicacion}<p class="u-ayuda aviso" role="status">{avisoUbicacion}</p>{/if}
	{:else}
		<p class="u-ayuda">
			📍 {ubicacion.fuente === 'gps' ? `Ubicación guardada (±${ubicacion.precision} m)` : `Ubicación cargada ${ubicacion.texto}`}.
			Solo la ves vos.
			<button type="button" class="u-enlace cambiar" onclick={cambiarUbicacion}>Cambiar</button>
		</p>
		{#if fueraDelPais}<p class="u-ayuda aviso">Ojo: ese lugar queda fuera de la Argentina.</p>{/if}
		{#if cerca.length && !enCasa}
			<fieldset class="banios">
				<legend>¿En cuál?</legend>
				{#each cerca as c (c.banio.id)}
					<label class="banio">
						<input type="radio" name="banio" checked={banioId === c.banio.id} onchange={() => elegirBanio(c.banio.id)} />
						<span class="nombre">{titulo(c.banio)}</span>
						<span class="dist">{textoDistancia(c.distancia)}</span>
					</label>
				{/each}
				<label class="banio">
					<input type="radio" name="banio" checked={banioId === null} onchange={() => elegirBanio(null)} />
					<span class="nombre">Ninguno de estos</span>
				</label>
			</fieldset>
		{/if}
	{/if}

	<label class="u-check papel"><input type="checkbox" bind:checked={sinPapel} /> No había papel 😱</label>

	<label class="anecdota">
		<span>¿Alguna anécdota?</span>
		<textarea bind:value={comentario} maxlength={COMENTARIO_MAX} rows="2" placeholder={ejemplo}></textarea>
		<span class="pie-anecdota"><span>🔒 Solo lo ves vos</span><span>{comentario.length}/{COMENTARIO_MAX}</span></span>
	</label>

	{#if tipo && !enCasa}
		<label class="u-check publico">
			<input type="checkbox" bind:checked={publico} disabled={!publicable} />
			<span>
				🌎 Sumarla al mapa público de cacas
				{#if !publicable}<small>Necesita la ubicación.</small>{/if}
			</span>
		</label>
	{/if}

	<button type="button" class="u-boton" disabled={!tipo || guardando || enElFuturo} onclick={pedirGuardar}>
		{guardando ? 'Guardando…' : tipo ? 'Guardar' : 'Elegí dónde fue'}
	</button>
	<button type="button" class="u-enlace" onclick={oncancelar}>Cancelar</button>
	{#if error}<p class="u-error" role="alert">{error}</p>{/if}
</section>

{#if confirmando}
	{@const r = confirmando}
	<ConfirmarPublico
		registro={r}
		{seudonimo}
		onsi={() => guardar(r, true)}
		onno={() => {
			confirmando = null;
			publico = false;
		}}
	/>
{/if}

<style>
	h2 {
		margin: 0 0 12px;
		font-size: 22px;
	}
	.tipos {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 8rem), 1fr));
		gap: 8px;
		margin-bottom: 14px;
	}
	.tipo {
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 52px;
		padding: 8px;
		border: 2px solid var(--tinta);
		border-radius: 12px;
		background: var(--crema);
		color: var(--tinta);
		font-size: 15px;
		font-weight: 600;
		line-height: 1.15;
		text-align: left;
		cursor: pointer;
	}
	.tipo[aria-checked='true'] {
		background: var(--tinta);
		color: var(--sol);
	}
	.icono {
		font-size: 20px;
	}
	fieldset {
		margin: 0 0 12px;
		padding: 0;
		border: 0;
	}
	legend {
		margin-bottom: 6px;
		font-weight: 700;
	}
	.cuando {
		display: flex;
		flex-wrap: wrap;
		gap: 0 18px;
	}
	.cuando .u-check {
		margin-bottom: 6px;
	}
	.fecha {
		width: 100%;
		min-height: 48px;
		padding: 8px 10px;
		border: var(--borde);
		border-radius: 12px;
		background: var(--crema);
		color: var(--tinta);
		font-family: inherit;
		font-size: 16px;
	}
	.ubicar {
		margin-top: 0;
		min-height: 48px;
		font-size: 16px;
	}
	.banio {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding: 6px 10px;
		margin-bottom: 6px;
		border: 2px solid var(--tinta);
		border-radius: 12px;
		background: var(--crema);
	}
	.banio input {
		width: 20px;
		height: 20px;
		margin: 0;
		accent-color: var(--tinta);
	}
	.banio .nombre {
		flex: 1;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.banio .dist {
		color: var(--tinta-suave);
		font-size: 14px;
	}
	.como-ubicar {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.como-ubicar .u-boton {
		padding: 8px 6px;
	}
	.como-ubicar .u-boton[aria-pressed='true'] {
		background: var(--sol-claro);
	}
	.a-mano {
		margin-top: 12px;
	}
	.a-mano .u-campo {
		margin-bottom: 0;
	}
	.buscar {
		margin-top: 8px;
		min-height: 44px;
		font-size: 16px;
	}
	.direccion {
		width: 100%;
		color: var(--tinta);
		font-family: inherit;
		font-size: 15px;
		text-align: left;
		cursor: pointer;
	}
	.aviso {
		color: var(--rojo);
	}
	.cambiar {
		margin-left: 6px;
		font-size: 14px;
	}
	.papel {
		margin-top: 12px;
	}
	.publico small {
		display: block;
		color: var(--tinta-suave);
		font-size: 13px;
	}
	.anecdota {
		display: block;
		margin: 4px 0 6px;
	}
	.anecdota > span:first-child {
		display: block;
		margin-bottom: 6px;
		font-weight: 700;
	}
	textarea {
		width: 100%;
		padding: 10px 12px;
		border: var(--borde);
		border-radius: 12px;
		background: var(--crema);
		color: var(--tinta);
		font-family: inherit;
		font-size: 16px;
		resize: vertical;
	}
	.pie-anecdota {
		display: flex;
		justify-content: space-between;
		color: var(--tinta-suave);
		font-size: 13px;
	}
</style>
