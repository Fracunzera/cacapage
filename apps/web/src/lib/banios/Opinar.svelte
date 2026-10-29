<script lang="ts">
	// Puntaje (1 a 5 rollos) y reporte de un baño, en su ficha del mapa.
	import { api, ErrorApi } from '$lib/cliente/api';
	import { MOTIVOS, type Motivo, type Opiniones } from '$lib/opiniones';

	let { banioId }: { banioId: string } = $props();

	let datos = $state<Opiniones | null>(null);
	const conSesion = $derived(datos?.con_sesion ?? null);
	let reportando = $state(false);
	let motivo = $state<Motivo | null>(null);
	let ocupado = $state(false);
	let aviso = $state<string | null>(null);
	let error = $state<string | null>(null);

	async function cargar(id: string) {
		datos = null;
		reportando = false;
		aviso = null;
		error = null;
		try {
			datos = await api<Opiniones>(`/banios/${id}/opiniones`);
		} catch {
			datos = { promedio: null, cantidad: 0, mio: null, reportado: false, en_revision: null, con_sesion: false };
		}
	}

	$effect(() => {
		void cargar(banioId);
	});

	async function puntuar(n: number) {
		ocupado = true;
		error = null;
		try {
			await api(`/banios/${banioId}/puntaje`, { metodo: 'PUT', cuerpo: { puntaje: n } });
			await cargar(banioId);
		} catch (e) {
			error = e instanceof ErrorApi ? e.message : 'No se pudo guardar.';
		} finally {
			ocupado = false;
		}
	}

	async function reportar() {
		if (!motivo) return;
		ocupado = true;
		error = null;
		try {
			await api(`/banios/${banioId}/reporte`, { cuerpo: { motivo } });
			reportando = false;
			await cargar(banioId);
			aviso = 'Gracias. Cuando varias personas reportan lo mismo, lo revisamos.';
		} catch (e) {
			error = e instanceof ErrorApi ? e.message : 'No se pudo reportar.';
		} finally {
			ocupado = false;
		}
	}

	const rollos = (n: number) => `${n} ${n === 1 ? 'rollo' : 'rollos'}`;
</script>

<div class="opinar">
	{#if datos?.en_revision}
		<p class="revision" role="status">
			⚠️ <strong>En revisión:</strong> varias personas reportaron que
			{MOTIVOS.find((m) => m.id === datos?.en_revision)?.texto.toLowerCase()}. Puede que la info no esté al día.
		</p>
	{/if}
	<p class="promedio">
		{#if datos?.cantidad}
			🧻 <strong>{datos.promedio?.toFixed(1).replace('.', ',')}</strong> de 5 · {datos.cantidad}
			{datos.cantidad === 1 ? 'voto' : 'votos'}
		{:else if datos}
			🧻 Todavía nadie lo puntuó.
		{/if}
	</p>

	{#if conSesion}
		<div class="estrellas" role="group" aria-label="Tu puntaje">
			{#each [1, 2, 3, 4, 5] as n (n)}
				<button
					type="button"
					class="rollo"
					class:lleno={(datos?.mio ?? 0) >= n}
					aria-label={rollos(n)}
					aria-pressed={datos?.mio === n}
					disabled={ocupado}
					onclick={() => puntuar(n)}>🧻</button
				>
			{/each}
			<span class="u-ayuda">{datos?.mio ? `Le pusiste ${rollos(datos.mio)}` : '¿Qué tal es?'}</span>
		</div>

		{#if aviso}
			<p class="u-ok" role="status">{aviso}</p>
		{:else if datos?.reportado}
			<p class="u-ayuda">🚩 Ya lo reportaste.</p>
		{:else if reportando}
			<fieldset class="motivos">
				<legend>¿Qué pasa con este baño?</legend>
				{#each MOTIVOS as m (m.id)}
					<label class="u-check"><input type="radio" name="motivo" value={m.id} bind:group={motivo} /> {m.texto}</label>
				{/each}
				<div class="acciones">
					<button type="button" class="u-boton peligro" disabled={!motivo || ocupado} onclick={reportar}>Reportar</button>
					<button type="button" class="u-enlace" onclick={() => (reportando = false)}>Cancelar</button>
				</div>
			</fieldset>
		{:else}
			<button type="button" class="u-enlace reportar" onclick={() => (reportando = true)}>🚩 Reportar un problema</button>
		{/if}
	{:else if conSesion === false}
		<p class="u-ayuda"><a href="/app/entrar?modo=entrar">Entrá</a> para puntuarlo o reportarlo.</p>
	{/if}
	{#if error}<p class="u-error" role="alert">{error}</p>{/if}
</div>

<style>
	.opinar {
		margin: 8px 0;
		padding: 8px 0;
		border-top: 2px dashed var(--gris);
		border-bottom: 2px dashed var(--gris);
	}
	.revision {
		margin: 0 0 8px;
		padding: 6px 10px;
		border: 2px solid var(--rojo);
		border-radius: 10px;
		background: var(--rojo-claro);
		font-size: 15px;
	}
	.promedio {
		margin: 0 0 6px;
		font-size: 15px;
	}
	.estrellas {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
	}
	.rollo {
		width: 44px;
		height: 44px;
		padding: 0;
		border: 2px solid var(--tinta);
		border-radius: 10px;
		background: var(--crema);
		font-size: 22px;
		filter: grayscale(1);
		opacity: 0.55;
		cursor: pointer;
	}
	.rollo.lleno {
		background: var(--sol-claro);
		filter: none;
		opacity: 1;
	}
	.estrellas .u-ayuda {
		margin: 0 0 0 6px;
	}
	.reportar {
		margin-top: 4px;
		font-size: 14px;
	}
	.motivos {
		margin: 8px 0 0;
		padding: 0;
		border: 0;
	}
	legend {
		margin-bottom: 6px;
		font-weight: 700;
	}
	.acciones {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.acciones .u-boton {
		width: auto;
		min-height: 44px;
		margin: 0;
		font-size: 16px;
	}
	a {
		color: var(--tinta);
		font-weight: 700;
	}
</style>
