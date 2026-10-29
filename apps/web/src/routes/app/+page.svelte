<script lang="ts">
	// Inicio de la cuenta: registrar, historial y medallas. Todo se descifra y se
	// calcula en el celular (PRIVACY.md P-03, DESIGN.md §17).
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Logo from '$lib/ui/Logo.svelte';
	import { api, ErrorApi } from '$lib/cliente/api';
	import { Boveda } from '$lib/boveda/boveda';
	import { faltanParaLaProxima, LOGROS, nombreMedalla, type Novedad, type PaginaGeneral, type Registro } from '$lib/boveda/modelo';
	import Configurar from '$lib/boveda/ui/Configurar.svelte';
	import Registrar from '$lib/boveda/ui/Registrar.svelte';
	import Historial from '$lib/boveda/ui/Historial.svelte';
	import Celebracion from '$lib/boveda/ui/Celebracion.svelte';
	import { descargar } from '$lib/boveda/ui/descargar';
	import { cambiarPublico } from '$lib/boveda/publicar';

	type Estado = 'cargando' | 'configurar' | 'lista';
	let estado = $state<Estado>('cargando');
	let seudonimo = $state('');
	let boveda = $state.raw<Boveda | null>(null);
	let registros = $state<Registro[]>([]);
	let general = $state<PaginaGeneral | null>(null);
	let pendientes = $state(0);
	let registrando = $state(false);
	let novedades = $state<Novedad[]>([]);
	let error = $state<string | null>(null);

	function refrescar() {
		if (!boveda) return;
		registros = boveda.registros();
		general = boveda.general();
		pendientes = boveda.pendientes;
	}

	async function sincronizar() {
		if (!boveda) return;
		try {
			await boveda.sincronizar();
		} catch (e) {
			if (e instanceof ErrorApi && e.estado === 401) return goto('/app/entrar?modo=entrar');
			error =
				e instanceof ErrorApi && e.estado === 413
					? e.message
					: 'No se pudo sincronizar el historial. Lo de este celular está a salvo.';
		}
		refrescar();
	}

	onMount(() => {
		(async () => {
			try {
				({ seudonimo } = await api<{ seudonimo: string }>('/cuenta'));
			} catch (e) {
				if (e instanceof ErrorApi && e.estado === 401) return goto('/app/entrar?modo=entrar');
				error = e instanceof ErrorApi ? e.message : 'No se pudo cargar la cuenta.';
				return;
			}
			boveda = await Boveda.abrir(seudonimo);
			if (!boveda.tieneLlaves) {
				estado = 'configurar';
				return;
			}
			refrescar();
			estado = 'lista';
			await sincronizar();
		})();
		const alVolver = () => void sincronizar();
		addEventListener('online', alVolver);
		return () => {
			removeEventListener('online', alVolver);
			boveda?.cerrar();
		};
	});

	async function guardar(r: Registro, publico: boolean) {
		const nuevas = await boveda!.guardar(r);
		registrando = false;
		if (publico) await publicar(r, true);
		refrescar();
		novedades = nuevas;
		scrollTo({ top: 0 });
	}

	async function publicar(r: Registro, publico: boolean) {
		error = null;
		try {
			await cambiarPublico(boveda!, r, publico);
		} catch (e) {
			error =
				e instanceof ErrorApi && e.estado === 0
					? 'Para cambiar si es pública hace falta conexión. Quedó como estaba.'
					: e instanceof ErrorApi
						? e.message
						: 'No se pudo cambiar. Probá de nuevo.';
		}
		refrescar();
	}

	async function borrar(r: Registro) {
		error = null;
		if (r.publico) {
			// Primero se saca del mapa público; sin conexión, no se borra.
			try {
				await cambiarPublico(boveda!, r, false);
			} catch {
				error = 'Esta caca es pública: para borrarla hace falta conexión.';
				return;
			}
		}
		await boveda!.borrar(r);
		refrescar();
	}

	function exportar() {
		const fecha = new Date().toISOString().slice(0, 10);
		descargar(
			`dondecague-historial-${fecha}.json`,
			JSON.stringify(
				{
					exportado_en: new Date().toISOString(),
					seudonimo,
					registros,
					medallas: general?.medallas.map((m) => ({ ...m, nombre: nombreMedalla(m.numero) })),
					logros: general?.logros
				},
				null,
				2
			)
		);
	}

	const total = $derived(registros.length);
	const logrosGanados = $derived(LOGROS.filter((l) => general?.logros.some((g) => g.id === l.id)));
</script>

<svelte:head>
	<title>Mi trono · Dónde Cagué</title>
</svelte:head>

<header class="u-tope">
	<a href="/" aria-label="Inicio"><Logo tamanio={32} conNombre={false} /></a>
	<h1>Mi trono</h1>
	<a class="cuenta" href="/app/cuenta" aria-label="Mi cuenta">⚙️</a>
</header>

<main class="u-pagina">
	{#if estado === 'cargando'}
		{#if !error}<p>Cargando…</p>{/if}
	{:else if estado === 'configurar' && boveda}
		<Configurar
			{boveda}
			{seudonimo}
			onlista={() => {
				refrescar();
				estado = 'lista';
			}}
		/>
	{:else if registrando}
		<Registrar {seudonimo} onguardar={guardar} oncancelar={() => (registrando = false)} />
	{:else}
		<section class="u-tarjeta resumen">
			<p class="hola">@{seudonimo}</p>
			<p class="numero"><strong>{total}</strong> {total === 1 ? 'visita' : 'visitas'} al trono</p>
			<p class="u-ayuda">
				{#if total === 0}Tu primera visita tiene premio.{:else}Te {faltanParaLaProxima(total) === 1 ? 'falta 1' : `faltan ${faltanParaLaProxima(total)}`} para la próxima medalla.{/if}
			</p>
			<button type="button" class="u-boton registrar" onclick={() => (registrando = true)}>💩 Registrar</button>
			<div class="mapas">
				<a class="u-boton sec" href="/app/mapa">🗺️ Mi mapa</a>
				<a class="u-boton sec" href="/cacas">🌎 Mapa de cacas</a>
			</div>
			{#if pendientes}
				<p class="u-ayuda pendiente">⏳ Guardado en este celular; se sube cuando haya conexión.</p>
			{/if}
		</section>

		{#if general && (general.medallas.length || logrosGanados.length)}
			<section class="u-tarjeta vitrina">
				<h2>Vitrina</h2>
				<ul>
					{#each logrosGanados as l (l.id)}
						<li><span aria-hidden="true">🚽</span> <span><strong>{l.nombre}</strong><small>{l.descripcion}</small></span></li>
					{/each}
					{#each [...general.medallas].reverse() as m (m.numero)}
						<li>
							<span aria-hidden="true">🏅</span>
							<span><strong>{nombreMedalla(m.numero)}</strong><small>{m.numero * 5} visitas</small></span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section class="historial">
			<h2>Historial</h2>
			<Historial {registros} {seudonimo} onborrar={borrar} onpublico={publicar} />
		</section>

		<section class="pie">
			<p class="u-ayuda">🔒 Tu historial viaja y se guarda cifrado. Vuelve solo cuando entrás con tu cuenta, desde cualquier celular.</p>
			{#if total}<button type="button" class="u-enlace" onclick={exportar}>Descargar mi historial</button>{/if}
		</section>
	{/if}
	{#if error}<p class="u-error" role="alert">{error}</p>{/if}
</main>

{#if novedades.length}
	<Celebracion novedad={novedades[0]} oncerrar={() => (novedades = novedades.slice(1))} />
{/if}

<style>
	.cuenta {
		font-size: 24px;
		text-decoration: none;
	}
	h2 {
		margin: 0 0 10px;
		font-size: 20px;
	}
	.resumen {
		background: var(--celeste-claro);
	}
	.hola {
		margin: 0;
		color: var(--tinta-suave);
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.numero {
		margin: 0;
		font-size: 22px;
	}
	.numero strong {
		font-size: 44px;
	}
	.registrar {
		min-height: 64px;
		font-size: 22px;
	}
	.mapas {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.mapas .u-boton {
		min-height: 48px;
		padding: 10px 8px;
		font-size: 16px;
	}
	.pendiente {
		margin-top: 10px;
	}
	.vitrina {
		background: var(--sol-claro);
	}
	.vitrina ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.vitrina li {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		margin-bottom: 10px;
		font-size: 17px;
	}
	.vitrina li > span:first-child {
		font-size: 24px;
	}
	.vitrina li span:last-child {
		display: flex;
		flex-direction: column;
	}
	.vitrina small {
		color: var(--tinta-suave);
		font-size: 14px;
	}
	.historial h2 {
		margin-top: 8px;
	}
	.pie {
		margin-top: 24px;
	}
</style>
