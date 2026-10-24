<script lang="ts">
	import { onMount } from 'svelte';
	import Opciones from '$lib/relevamiento/Opciones.svelte';
	import Logo from '$lib/ui/Logo.svelte';
	import { abrirAlmacen, type Almacen } from '$lib/relevamiento/almacen';
	import { seguirGps, type ErrorGps, type Lectura } from '$lib/relevamiento/gps';
	import {
		ACCESOS,
		CATEGORIAS,
		DESCONOCIDO,
		DIAS,
		PRECISION_MAXIMA_M,
		aRelevado,
		armarExportacion,
		fixAceptable,
		nombreArchivo,
		nuevoBorrador,
		problemas,
		type BanioRelevado,
		type Borrador,
		type Dia
	} from '$lib/relevamiento/modelo';

	const SI_NO = [
		['si', 'Sí'],
		['no', 'No'],
		[DESCONOCIDO, 'Desconocido']
	] as const;
	const CATEGORIA_OPCIONES = [...CATEGORIAS, [DESCONOCIDO, 'Desconocido']] as const;
	const ACCESO_OPCIONES = [...ACCESOS, [DESCONOCIDO, 'Desconocido']] as const;
	const MODOS_HORARIO = [
		['24h', '24 h'],
		['cerrado', 'Cerrado'],
		['rango', 'Horario'],
		[DESCONOCIDO, 'Desconocido']
	] as const;
	type ModoHorario = (typeof MODOS_HORARIO)[number][0];

	let almacen = $state.raw<Almacen | null>(null);
	let borrador = $state<Borrador | null>(null);
	let relevados = $state<BanioRelevado[]>([]);
	let lectura = $state<Lectura | null>(null);
	let errorGps = $state<ErrorGps | null>(null);
	let errorAlmacen = $state<string | null>(null);
	let aviso = $state<string | null>(null);
	let enLinea = $state(true);
	let persistente = $state<boolean | null>(null);
	let ultimaExportacion = $state<string | null>(null);
	let detenerGps: (() => void) | null = null;

	// Cola de escrituras: cada cambio se guarda en orden, sin pisarse.
	let cola: Promise<void> = Promise.resolve();
	function encolar(tarea: () => Promise<void>) {
		cola = cola.then(tarea).catch((e) => {
			errorAlmacen = `No se pudo guardar en el teléfono: ${e?.message ?? e}`;
		});
		return cola;
	}

	const faltan = $derived(borrador ? problemas(borrador) : []);

	// El GPS queda encendido todo el tiempo para que la precisión ya sea buena al
	// llegar al baño, pero la ubicación se fija solo cuando el usuario toca
	// "Fijar ubicación acá": si se fijara sola, el baño siguiente quedaría con la
	// posición del anterior (todavía estás parado ahí cuando guardás).
	const LECTURA_VIGENTE_MS = 15000;
	let ahora = $state(Date.now());
	const lecturaUsable = $derived(
		lectura !== null &&
			fixAceptable(lectura.precision_m) &&
			ahora - Date.parse(lectura.fix_en) < LECTURA_VIGENTE_MS
	);

	function iniciarGps() {
		detenerGps?.();
		lectura = null;
		errorGps = null;
		detenerGps = seguirGps(
			(l) => {
				lectura = l;
				ahora = Date.now();
				errorGps = null;
			},
			(e) => (errorGps = e)
		);
	}

	function fijarUbicacion() {
		if (!borrador || !lectura || !lecturaUsable) return;
		borrador.geom = { ...lectura };
	}

	function retomarUbicacion() {
		if (!borrador) return;
		borrador.geom = null;
	}

	function modoDe(dia: Dia): ModoHorario {
		const h = borrador!.horario[dia];
		return typeof h === 'object' ? 'rango' : h;
	}
	function elegirModo(dia: Dia, modo: ModoHorario) {
		if (!borrador || modo === modoDe(dia)) return;
		borrador.horario[dia] = modo === 'rango' ? { abre: '', cierra: '' } : modo;
	}
	function igualQueHabil(dia: Dia) {
		if (!borrador) return;
		borrador.horario[dia] = structuredClone($state.snapshot(borrador.horario.habil));
	}

	function avisar(texto: string) {
		aviso = texto;
		setTimeout(() => {
			if (aviso === texto) aviso = null;
		}, 3500);
	}

	async function guardarBanio() {
		if (!borrador || !almacen || faltan.length) return;
		const relevado = aRelevado($state.snapshot(borrador) as Borrador);
		const a = almacen;
		await encolar(() => a.confirmar(relevado));
		if (errorAlmacen) return;
		relevados = [relevado, ...relevados];
		borrador = nuevoBorrador();
		window.scrollTo({ top: 0 });
		avisar(`Guardado. Llevás ${relevados.length}.`);
	}

	async function borrarRelevado(r: BanioRelevado) {
		if (!almacen) return;
		const nombre = r.nombre ?? 'este baño';
		if (!confirm(`¿Borrar ${nombre}? No se puede deshacer.`)) return;
		const a = almacen;
		await encolar(() => a.borrar(r.id));
		if (!errorAlmacen) relevados = relevados.filter((x) => x.id !== r.id);
	}

	function exportar() {
		const datos = armarExportacion($state.snapshot(relevados) as BanioRelevado[]);
		const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = nombreArchivo();
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 10000);
		const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
		ultimaExportacion = `${datos.cantidad} baños a las ${hora}`;
		try {
			localStorage.setItem('relevamiento.ultimaExportacion', ultimaExportacion);
		} catch {
			// Solo es un recordatorio; si no se puede guardar, no pasa nada.
		}
	}

	// Cada cambio del borrador se escribe en IndexedDB en el momento.
	$effect(() => {
		if (!borrador || !almacen) return;
		const copia = $state.snapshot(borrador) as Borrador;
		const a = almacen;
		encolar(() => a.guardarBorrador(copia));
	});

	onMount(() => {
		enLinea = navigator.onLine;
		const online = () => (enLinea = true);
		const offline = () => (enLinea = false);
		const reloj = setInterval(() => (ahora = Date.now()), 2000);
		addEventListener('online', online);
		addEventListener('offline', offline);
		try {
			ultimaExportacion = localStorage.getItem('relevamiento.ultimaExportacion');
		} catch {
			ultimaExportacion = null;
		}

		(async () => {
			try {
				const a = await abrirAlmacen();
				relevados = await a.listar();
				const guardado = await a.leerBorrador();
				almacen = a;
				borrador = guardado ?? nuevoBorrador();
				iniciarGps();
			} catch (e) {
				errorAlmacen = `No se puede usar el almacenamiento del navegador: ${(e as Error)?.message ?? e}`;
			}
			try {
				persistente = (await navigator.storage?.persist?.()) ?? false;
			} catch {
				persistente = false;
			}
		})();

		return () => {
			removeEventListener('online', online);
			removeEventListener('offline', offline);
			clearInterval(reloj);
			detenerGps?.();
			almacen?.cerrar();
		};
	});

	const TEXTO_ERROR_GPS: Record<ErrorGps, string> = {
		sin_soporte: 'Este navegador no tiene GPS.',
		permiso_denegado: 'No hay permiso de ubicación. Habilitalo en los ajustes del navegador para este sitio.',
		no_disponible: 'Sin señal de GPS por ahora. Sigo intentando.'
	};
</script>

<svelte:head>
	<title>Relevamiento · cacapage</title>
</svelte:head>

<header class="tope">
	<a href="/" class="volver" aria-label="Inicio"><Logo tamanio={32} conNombre={false} /></a>
	<h1>Relevamiento</h1>
	<span class="contador" aria-live="polite">{relevados.length} guardados</span>
</header>

<main class="relevamiento">
	{#if !enLinea}
		<p class="nota">📵 Sin conexión: todo se guarda en el teléfono igual.</p>
	{/if}
	{#if persistente === false}
		<p class="nota aviso">El navegador puede borrar estos datos si se queda sin espacio. Exportá seguido.</p>
	{/if}
	{#if errorAlmacen}
		<p class="nota error" role="alert">{errorAlmacen}</p>
	{/if}

	{#if borrador}
		<section class="tarjeta gps" class:ok={borrador.geom} aria-live="polite">
			<h2><span class="paso">1</span> Dónde está</h2>
			{#if borrador.geom}
				<p class="estado">📍 Ubicación fijada · ±{Math.round(borrador.geom.precision_m)} m</p>
				<button type="button" class="secundario" onclick={retomarUbicacion}>Volver a tomar</button>
			{:else if errorGps === 'permiso_denegado' || errorGps === 'sin_soporte'}
				<p class="estado error">{TEXTO_ERROR_GPS[errorGps]}</p>
				<button type="button" class="secundario" onclick={iniciarGps}>Reintentar</button>
			{:else}
				<button type="button" class="fijar" onclick={fijarUbicacion} disabled={!lecturaUsable}>
					{#if lecturaUsable && lectura}
						📍 Fijar ubicación acá (±{Math.round(lectura.precision_m)} m)
					{:else}
						Esperando precisión de {PRECISION_MAXIMA_M} m o menos
					{/if}
				</button>
				{#if lectura && !lecturaUsable}
					<p class="estado espera">Ahora ±{Math.round(lectura.precision_m)} m. Alejate de techos y paredes altas.</p>
				{:else if !lectura}
					<p class="estado espera">Buscando GPS…</p>
				{/if}
				{#if errorGps}<p class="pista">{TEXTO_ERROR_GPS[errorGps]}</p>{/if}
				<p class="pista">Tocalo parado en la puerta del baño o del local.</p>
			{/if}
		</section>

		<section class="tarjeta">
			<h2><span class="paso">2</span> Qué lugar es</h2>
			<label class="campo">
				<span>Nombre</span>
				<input
					type="text"
					bind:value={borrador.nombre}
					placeholder="Ej.: YPF Av. San Martín"
					autocomplete="off"
					autocapitalize="words"
					enterkeyhint="done"
				/>
			</label>
			<Opciones etiqueta="Categoría" opciones={CATEGORIA_OPCIONES} bind:valor={borrador.categoria} columnas={3} />
		</section>

		<section class="tarjeta">
			<h2><span class="paso">3</span> Cómo es el baño</h2>
			<Opciones etiqueta="Acceso" opciones={ACCESO_OPCIONES} bind:valor={borrador.acceso} columnas={2} />
			<Opciones etiqueta="¿Cobra?" opciones={SI_NO} bind:valor={borrador.cobra} columnas={2} />
			<Opciones etiqueta="¿Accesible (silla de ruedas)?" opciones={SI_NO} bind:valor={borrador.accesible} columnas={2} />
			<Opciones etiqueta="¿Cambiador de bebés?" opciones={SI_NO} bind:valor={borrador.cambiador} columnas={2} />
		</section>

		<section class="tarjeta">
			<fieldset class="horario">
				<legend><span class="paso">4</span> Horario</legend>
				{#each DIAS as [dia, etiqueta] (dia)}
					<div class="dia">
						<div class="dia-titulo">
							<span>{etiqueta}</span>
							{#if dia !== 'habil'}
								<button type="button" class="enlace" onclick={() => igualQueHabil(dia)}>Igual que lun a vie</button>
							{/if}
						</div>
						<div class="modos" role="radiogroup" aria-label="Horario {etiqueta}">
							{#each MODOS_HORARIO as [modo, texto] (modo)}
								<button
									type="button"
									role="radio"
									aria-checked={modoDe(dia) === modo}
									class:elegida={modoDe(dia) === modo}
									class:desconocido={modo === DESCONOCIDO}
									onclick={() => elegirModo(dia, modo)}>{texto}</button
								>
							{/each}
						</div>
						{#if typeof borrador.horario[dia] === 'object'}
							{@const rango = borrador.horario[dia] as { abre: string; cierra: string }}
							<div class="rango">
								<label>Abre <input type="time" bind:value={rango.abre} /></label>
								<label>Cierra <input type="time" bind:value={rango.cierra} /></label>
							</div>
						{/if}
					</div>
				{/each}
			</fieldset>
		</section>
	{:else if !errorAlmacen}
		<p class="nota">Abriendo…</p>
	{/if}

	<section class="relevados">
		<h2 class="titulo-lista">Guardados ({relevados.length})</h2>
		<button type="button" class="exportar" onclick={exportar} disabled={relevados.length === 0}>
			⬇ Descargar todo ({relevados.length})
		</button>
		{#if ultimaExportacion}<p class="pista">Última descarga: {ultimaExportacion}.</p>{/if}
		{#if relevados.length === 0}
			<p class="vacio">Todavía no guardaste ningún baño. El primero es el más difícil.</p>
		{/if}
		<ul>
			{#each relevados as r (r.id)}
				<li>
					<div>
						<strong>{r.nombre ?? 'Sin nombre'}</strong>
						<span class="pista">
							{CATEGORIA_OPCIONES.find(([v]) => v === r.categoria)?.[1]} · ±{Math.round(r.geom.precision_m)} m ·
							{new Date(r.relevado_en).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
						</span>
					</div>
					<button type="button" class="borrar" onclick={() => borrarRelevado(r)} aria-label="Borrar {r.nombre ?? 'baño sin nombre'}"
						>Borrar</button
					>
				</li>
			{/each}
		</ul>
	</section>
</main>

{#if borrador}
	<footer class="barra">
		{#if aviso}<p class="aviso-ok" role="status">🎉 {aviso}</p>{/if}
		{#if faltan.length && !aviso}<p class="falta">{faltan[0]}</p>{/if}
		<button type="button" class="guardar" onclick={guardarBanio} disabled={faltan.length > 0 || !almacen}>
			Guardar baño
		</button>
	</footer>
{/if}

<style>
	.tope {
		position: sticky;
		top: 0;
		z-index: 15;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 16px;
		background: var(--sol);
		border-bottom: var(--borde);
	}
	.volver {
		display: inline-flex;
		color: inherit;
	}
	h1 {
		flex: 1;
		margin: 0;
		font-size: 22px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	.contador {
		padding: 3px 10px;
		border: 2px solid var(--tinta);
		border-radius: 999px;
		background: var(--crema);
		font-size: 14px;
		font-weight: 600;
		white-space: nowrap;
	}
	.relevamiento {
		max-width: 34rem;
		margin: 0 auto;
		padding: 16px 16px 180px;
	}
	.tarjeta {
		margin: 0 0 18px;
		padding: 16px 14px 4px;
		border: var(--borde);
		border-radius: var(--radio);
		background: var(--papel);
		box-shadow: var(--sombra);
	}
	h2,
	.horario legend {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 0 14px;
		padding: 0;
		font-size: 20px;
		font-weight: 700;
	}
	.paso {
		display: inline-grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border: 2px solid var(--tinta);
		border-radius: 50%;
		background: var(--celeste-claro);
		font-size: 15px;
	}
	.nota {
		margin: 0 0 14px;
		padding: 10px 12px;
		border: 2px solid var(--tinta);
		border-radius: 12px;
		background: var(--celeste-claro);
		font-size: 15px;
	}
	.nota.aviso {
		background: var(--sol-claro);
	}
	.nota.error {
		background: var(--rojo-claro);
		color: var(--rojo);
	}
	.gps {
		padding-bottom: 14px;
		background: var(--sol-claro);
	}
	.gps.ok {
		background: var(--mate-claro);
	}
	.estado {
		margin: 0;
		font-weight: 600;
	}
	.gps.ok .estado {
		font-size: 19px;
		color: var(--mate);
	}
	.estado.espera {
		margin-top: 4px;
	}
	.estado.error {
		color: var(--rojo);
	}
	.pista {
		margin: 6px 0 0;
		color: var(--tinta-suave);
		font-size: 14px;
	}
	button.fijar,
	button.guardar {
		display: block;
		width: 100%;
		min-height: 60px;
		border: var(--borde);
		border-radius: var(--radio);
		box-shadow: var(--sombra);
		font-size: 19px;
		font-weight: 700;
		touch-action: manipulation;
	}
	button.fijar {
		margin: 0 0 8px;
		background: var(--tinta);
		color: var(--sol);
	}
	button.fijar:disabled,
	button.guardar:disabled {
		background: var(--gris);
		color: var(--tinta);
		box-shadow: none;
		border-style: dashed;
	}
	button.fijar:active:not(:disabled),
	button.guardar:active:not(:disabled) {
		transform: translate(3px, 3px);
		box-shadow: 1px 1px 0 var(--tinta);
	}
	.campo {
		display: block;
		margin: 0 0 18px;
	}
	.campo span {
		display: block;
		margin-bottom: 8px;
		font-weight: 600;
	}
	input[type='text'],
	.rango input {
		width: 100%;
		min-height: 52px;
		padding: 10px 12px;
		border: var(--borde);
		border-radius: 12px;
		background: var(--crema);
		color: var(--tinta);
		font-size: 17px;
	}
	.horario {
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
	}
	.dia {
		margin-bottom: 14px;
	}
	.dia-titulo {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 6px;
		font-weight: 600;
	}
	.modos {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 6px;
	}
	.modos button {
		min-height: 48px;
		padding: 4px;
		border: 2px solid var(--tinta);
		border-radius: 12px;
		background: var(--papel);
		color: var(--tinta);
		font-size: 14px;
		font-weight: 500;
		touch-action: manipulation;
	}
	.modos button.desconocido {
		grid-column: 1 / -1;
		min-height: 44px;
		border-style: dashed;
		color: var(--tinta-suave);
	}
	.modos button.elegida {
		border-style: solid;
		background: var(--tinta);
		color: var(--sol);
		font-weight: 700;
	}
	.modos button.desconocido.elegida {
		background: var(--celeste-claro);
		color: var(--tinta);
		font-weight: 600;
	}
	.rango {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin-top: 8px;
	}
	.rango label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 14px;
		font-weight: 600;
	}
	button.secundario,
	button.exportar {
		min-height: 48px;
		padding: 8px 16px;
		border: var(--borde);
		border-radius: var(--radio);
		background: var(--papel);
		color: var(--tinta);
		box-shadow: var(--sombra-chica);
		font-size: 16px;
		font-weight: 700;
	}
	button.secundario {
		margin-top: 12px;
	}
	button.exportar {
		width: 100%;
		background: var(--celeste);
	}
	button.exportar:disabled {
		background: var(--gris);
		box-shadow: none;
	}
	button.enlace {
		padding: 6px 0;
		border: 0;
		background: none;
		color: var(--tinta);
		font-size: 14px;
		font-weight: 600;
		text-decoration: underline;
		text-decoration-color: var(--sol);
		text-decoration-thickness: 3px;
	}
	.titulo-lista {
		margin-top: 28px;
	}
	.vacio {
		margin: 14px 0 0;
		color: var(--tinta-suave);
	}
	ul {
		list-style: none;
		margin: 12px 0 0;
		padding: 0;
	}
	li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 10px;
		padding: 10px 12px;
		border: 2px solid var(--tinta);
		border-radius: 12px;
		background: var(--papel);
	}
	li .pista {
		display: block;
		margin: 2px 0 0;
	}
	button.borrar {
		min-height: 44px;
		padding: 6px 12px;
		border: 2px solid var(--rojo);
		border-radius: 10px;
		background: var(--papel);
		color: var(--rojo);
		font-size: 15px;
		font-weight: 600;
	}
	.barra {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 10px 16px calc(12px + env(safe-area-inset-bottom));
		background: var(--crema);
		border-top: var(--borde);
	}
	.falta,
	.aviso-ok {
		max-width: 34rem;
		margin: 0 auto 8px;
		font-size: 14px;
		font-weight: 600;
	}
	.falta {
		color: var(--tinta-suave);
	}
	.aviso-ok {
		color: var(--mate);
		font-size: 16px;
	}
	button.guardar {
		max-width: 34rem;
		margin: 0 auto;
		background: var(--mate);
		color: #fff;
	}
</style>
