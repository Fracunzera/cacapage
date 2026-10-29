<script lang="ts">
	// Abrir el historial en este celular (PRIVACY.md P-40): la llave vuelve sola
	// con la sesión, entres con el método que entres. El código de recuperación
	// queda solo para los historiales que se crearon con él, una última vez.
	import { onMount } from 'svelte';
	import { api, ErrorApi } from '$lib/cliente/api';
	import { b64, codigoCompleto, deB64, desenvolver, generarSecreto, normalizarCodigo, type Envuelta } from '../cripto';
	import type { Boveda } from '../boveda';

	let { boveda, onlista }: { boveda: Boveda; seudonimo: string; onlista: () => void } = $props();

	type Paso = 'cargando' | 'recuperar' | 'perdido';
	let paso = $state<Paso>('cargando');
	let envuelta: Envuelta | null = null;
	let ingresado = $state('');
	let ocupado = $state(false);
	let error = $state<string | null>(null);

	onMount(() => void abrirSolo());

	/** Custodia → abre; historial viejo con código → lo pide; sin nada → crea uno. */
	async function abrirSolo(intentos = 2): Promise<void> {
		paso = 'cargando';
		error = null;
		try {
			const { secreto } = await api<{ secreto: string | null }>('/boveda/custodia');
			if (secreto) {
				await boveda.instalar(deB64(secreto));
				await boveda.sincronizar();
				onlista();
				return;
			}
		} catch (e) {
			error = e instanceof ErrorApi ? e.message : 'No se pudo abrir el historial.';
			return;
		}
		try {
			const { llaves } = await api<{ llaves: (Envuelta & { metodo: string })[] }>('/boveda/llaves');
			envuelta = llaves.find((l) => l.metodo === 'recuperacion') ?? null;
			if (envuelta) {
				paso = 'recuperar';
				return;
			}
			const secreto = generarSecreto();
			await api('/boveda/custodia', { metodo: 'PUT', cuerpo: { secreto: b64(secreto), crear: true } });
			await boveda.instalar(secreto);
			onlista();
		} catch (e) {
			// Otro celular lo creó recién: se abre el suyo.
			if (e instanceof ErrorApi && e.estado === 409 && intentos > 0) return abrirSolo(intentos - 1);
			error = e instanceof ErrorApi ? e.message : 'No se pudo crear el historial.';
		}
	}

	async function abrirConCodigo() {
		if (!envuelta) return;
		ocupado = true;
		error = null;
		try {
			const s = await desenvolver(envuelta, ingresado);
			if (!s) {
				error = 'Ese código no es. Fijate que esté completo.';
				return;
			}
			// Pasa a custodia: es la última vez que se pide el código.
			await api('/boveda/custodia', { metodo: 'PUT', cuerpo: { secreto: b64(s) } }).catch((e) => {
				if (!(e instanceof ErrorApi && e.estado === 409)) throw e;
			});
			await boveda.instalar(s);
			await boveda.sincronizar();
			onlista();
		} catch (e) {
			error = e instanceof ErrorApi ? e.message : 'No se pudo abrir el historial.';
		} finally {
			ocupado = false;
		}
	}

	async function empezarDeCero() {
		ocupado = true;
		error = null;
		try {
			await api('/boveda', { metodo: 'DELETE' });
			await abrirSolo();
		} catch (e) {
			error = e instanceof ErrorApi ? e.message : 'No se pudo.';
		} finally {
			ocupado = false;
		}
	}
</script>

{#if paso === 'cargando'}
	{#if !error}<p>Abriendo tu historial…</p>{/if}
{:else if paso === 'recuperar'}
	<section class="u-tarjeta">
		<h2>Abrí tu historial</h2>
		<p>
			Tu historial se creó con un código de recuperación. Ponelo <strong>una última vez</strong>: después se abre solo
			cada vez que entrás.
		</p>
		<label class="u-campo">
			<span>Código</span>
			<input
				type="text"
				class="entrada-codigo"
				bind:value={ingresado}
				onblur={() => (ingresado = normalizarCodigo(ingresado))}
				autocomplete="off"
				autocapitalize="characters"
				spellcheck="false"
				placeholder="XXXX-XXXX-XXXX-…"
			/>
		</label>
		<button type="button" class="u-boton" disabled={!codigoCompleto(ingresado) || ocupado} onclick={abrirConCodigo}>
			{ocupado ? 'Abriendo…' : 'Abrir mi historial'}
		</button>
		<button type="button" class="u-enlace" onclick={() => (paso = 'perdido')}>Perdí el código</button>
	</section>
{:else}
	<section class="u-tarjeta">
		<h2>¿Empezar de cero?</h2>
		<p>
			Sin el código, ese historial no se puede abrir: se creó antes de que guardáramos la llave. Podés empezar uno
			nuevo, pero <strong>el anterior se borra para siempre</strong>, con sus medallas y sus cacas públicas.
		</p>
		<button type="button" class="u-boton peligro" disabled={ocupado} onclick={empezarDeCero}>Borrar y empezar de cero</button>
		<button type="button" class="u-enlace" onclick={() => (paso = 'recuperar')}>Mejor busco el código</button>
		{#if error?.includes('volvé a entrar')}
			<p class="u-ayuda"><a href="/app/entrar?modo=entrar">Volver a entrar</a> y probar otra vez.</p>
		{/if}
	</section>
{/if}
{#if error}<p class="u-error" role="alert">{error}</p>{/if}

<style>
	h2 {
		margin: 0 0 10px;
		font-size: 22px;
	}
	p {
		margin: 0 0 10px;
	}
	.entrada-codigo {
		font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	a {
		color: var(--tinta);
		font-weight: 600;
	}
</style>
