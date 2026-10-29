<script lang="ts">
	// Primera vez en este celular: crear el historial cifrado (y su código de
	// recuperación) o abrir el que ya existe con el código (PRIVACY.md P-03).
	import { onMount } from 'svelte';
	import { api, ErrorApi } from '$lib/cliente/api';
	import { codigoCompleto, desenvolver, envolver, generarCodigo, generarSecreto, normalizarCodigo, type Envuelta } from '../cripto';
	import type { Boveda } from '../boveda';
	import { descargar } from './descargar';

	let { boveda, seudonimo, onlista }: { boveda: Boveda; seudonimo: string; onlista: () => void } = $props();

	type Paso = 'cargando' | 'crear' | 'recuperar' | 'perdido';
	let paso = $state<Paso>('cargando');
	let envuelta: Envuelta | null = null;
	let secreto = generarSecreto();
	let codigo = $state(generarCodigo());
	let guardado = $state(false);
	let ingresado = $state('');
	let ocupado = $state(false);
	let error = $state<string | null>(null);
	let copiado = $state(false);

	onMount(revisar);

	async function revisar() {
		paso = 'cargando';
		error = null;
		try {
			const { llaves } = await api<{ llaves: (Envuelta & { metodo: string })[] }>('/boveda/llaves');
			envuelta = llaves.find((l) => l.metodo === 'recuperacion') ?? null;
			paso = envuelta ? 'recuperar' : 'crear';
		} catch (e) {
			error = e instanceof ErrorApi ? e.message : 'No se pudo cargar.';
		}
	}

	async function copiar() {
		try {
			await navigator.clipboard.writeText(codigo);
			copiado = true;
		} catch {
			copiado = false;
		}
	}

	function bajarCodigo() {
		descargar(
			`dondecague-codigo-${seudonimo}.txt`,
			`Código de recuperación de Dónde Cagué (@${seudonimo})\n\n${codigo}\n\nSin este código, tu historial no se puede abrir en otro celular. Nadie más lo tiene: ni nosotros.\n`,
			'text/plain'
		);
	}

	async function crear() {
		ocupado = true;
		error = null;
		try {
			const e = await envolver(secreto, codigo);
			await api('/boveda/llaves', { metodo: 'PUT', cuerpo: { metodo: 'recuperacion', ...e, crear: true } });
			await boveda.instalar(secreto);
			onlista();
		} catch (e) {
			if (e instanceof ErrorApi && e.estado === 409) await revisar();
			else error = e instanceof ErrorApi ? e.message : 'No se pudo crear el historial.';
		} finally {
			ocupado = false;
		}
	}

	async function abrir() {
		if (!envuelta) return;
		ocupado = true;
		error = null;
		try {
			const s = await desenvolver(envuelta, ingresado);
			if (!s) {
				error = 'Ese código no es. Fijate que esté completo.';
				return;
			}
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
			secreto = generarSecreto();
			codigo = generarCodigo();
			guardado = false;
			paso = 'crear';
		} catch (e) {
			error = e instanceof ErrorApi ? e.message : 'No se pudo.';
		} finally {
			ocupado = false;
		}
	}
</script>

{#if paso === 'cargando'}
	{#if !error}<p>Cargando…</p>{/if}
{:else if paso === 'crear'}
	<section class="u-tarjeta">
		<h2>Tu código de recuperación</h2>
		<p>
			Tu historial se guarda <strong>cifrado</strong>: ni nosotros podemos leerlo. Para abrirlo en otro celular, o si
			se borran los datos del navegador, vas a necesitar este código.
		</p>
		<p class="codigo" aria-label="Código de recuperación">{codigo}</p>
		<div class="botones">
			<button type="button" class="u-boton sec" onclick={copiar}>{copiado ? '¡Copiado!' : 'Copiar'}</button>
			<button type="button" class="u-boton sec" onclick={bajarCodigo}>Descargar</button>
		</div>
		<p class="u-ayuda">Guardalo donde guardás tus contraseñas, o sacale una captura. Si lo perdés, nadie lo puede recuperar.</p>
		<label class="u-check">
			<input type="checkbox" bind:checked={guardado} />
			<span>Ya lo guardé en un lugar seguro</span>
		</label>
		<button type="button" class="u-boton" disabled={!guardado || ocupado} onclick={crear}>
			{ocupado ? 'Creando…' : 'Listo, empezar'}
		</button>
	</section>
{:else if paso === 'recuperar'}
	<section class="u-tarjeta">
		<h2>Abrí tu historial</h2>
		<p>Ya tenés un historial guardado. Para verlo en este celular, ingresá tu código de recuperación.</p>
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
		<button type="button" class="u-boton" disabled={!codigoCompleto(ingresado) || ocupado} onclick={abrir}>
			{ocupado ? 'Abriendo…' : 'Abrir mi historial'}
		</button>
		<button type="button" class="u-enlace" onclick={() => (paso = 'perdido')}>Perdí el código</button>
	</section>
{:else}
	<section class="u-tarjeta">
		<h2>¿Empezar de cero?</h2>
		<p>
			Sin el código, tu historial no se puede abrir: está cifrado y no tenemos copia de la llave. Podés empezar uno
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
	.codigo {
		margin: 14px 0;
		padding: 14px 10px;
		border: 2px dashed var(--tinta);
		border-radius: 12px;
		background: var(--sol-claro);
		font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
		font-size: 19px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-align: center;
		overflow-wrap: anywhere;
		user-select: all;
	}
	.botones {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin-bottom: 10px;
	}
	.botones .u-boton {
		margin: 0;
		min-height: 48px;
		font-size: 16px;
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
