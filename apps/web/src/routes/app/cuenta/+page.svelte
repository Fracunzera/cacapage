<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Logo from '$lib/ui/Logo.svelte';
	import { api, ErrorApi } from '$lib/cliente/api';

	interface Cuenta {
		seudonimo: string;
		creada_en: string;
		metodos: { passkeys: number; mail: boolean };
		reautenticada: boolean;
	}

	let cuenta = $state<Cuenta | null>(null);
	let error = $state<string | null>(null);
	let borrando = $state(false);
	let confirmacion = $state('');
	let pidiendoBorrar = $state(false);

	onMount(async () => {
		try {
			cuenta = await api<Cuenta>('/cuenta');
		} catch (e) {
			if (e instanceof ErrorApi && e.estado === 401) await goto('/app/entrar?modo=entrar');
			else error = e instanceof ErrorApi ? e.message : 'No se pudo cargar la cuenta.';
		}
	});

	async function salir() {
		await api('/auth/salir', { cuerpo: {} }).catch(() => {});
		await goto('/');
	}

	async function borrar() {
		borrando = true;
		error = null;
		try {
			await api('/cuenta', { metodo: 'DELETE' });
			await goto('/?cuenta=borrada');
		} catch (e) {
			error = e instanceof ErrorApi ? e.message : 'No se pudo borrar la cuenta.';
		} finally {
			borrando = false;
		}
	}

	const fecha = (iso: string) =>
		new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
</script>

<svelte:head>
	<title>Mi cuenta · Dónde Cagué</title>
</svelte:head>

<header class="u-tope">
	<a href="/" aria-label="Inicio"><Logo tamanio={32} conNombre={false} /></a>
	<h1>Mi cuenta</h1>
</header>

<main class="u-pagina">
	{#if cuenta}
		<section class="u-tarjeta saludo">
			<p class="hola">Hola,</p>
			<p class="seudonimo">@{cuenta.seudonimo}</p>
			<p class="u-ayuda">En el trono desde el {fecha(cuenta.creada_en)}.</p>
		</section>

		<section class="u-tarjeta">
			<h2>Cómo entrás</h2>
			<ul>
				{#if cuenta.metodos.passkeys}<li>🔑 Passkey ({cuenta.metodos.passkeys})</li>{/if}
				{#if cuenta.metodos.mail}<li>✉️ Link por mail (tu mail no se guarda: solo una huella para reconocerlo)</li>{/if}
			</ul>
			<button type="button" class="u-boton sec" onclick={salir}>Salir</button>
		</section>

		<section class="u-tarjeta pronto">
			<h2>Muy pronto</h2>
			<p>Registrar, tu historial y las medallas llegan en la próxima versión.</p>
		</section>

		<section class="u-tarjeta">
			<h2>Borrar la cuenta</h2>
			{#if !pidiendoBorrar}
				<p>Se borra todo, en el acto y para siempre.</p>
				<button type="button" class="u-boton peligro" onclick={() => (pidiendoBorrar = true)}>Borrar mi cuenta</button>
			{:else}
				<label class="u-campo">
					<span>Escribí <strong>{cuenta.seudonimo}</strong> para confirmar</span>
					<input type="text" bind:value={confirmacion} autocomplete="off" autocapitalize="none" />
				</label>
				<button
					type="button"
					class="u-boton peligro"
					disabled={confirmacion.trim().toLowerCase() !== cuenta.seudonimo || borrando}
					onclick={borrar}>{borrando ? 'Borrando…' : 'Borrar para siempre'}</button
				>
				{#if !cuenta.reautenticada}
					<p class="u-ayuda">
						Por seguridad hay que haber entrado hace menos de 5 minutos.
						<a href="/app/entrar?modo=entrar">Volver a entrar</a>.
					</p>
				{/if}
				<button type="button" class="u-enlace" onclick={() => (pidiendoBorrar = false)}>Mejor no</button>
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
	.saludo {
		background: var(--celeste-claro);
	}
	.hola {
		margin: 0;
		font-size: 18px;
	}
	.seudonimo {
		margin: 0 0 4px;
		font-size: 32px;
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	ul {
		margin: 0 0 4px;
		padding-left: 0;
		list-style: none;
	}
	li {
		margin-bottom: 6px;
	}
	.pronto {
		background: var(--sol-claro);
	}
	a {
		color: var(--tinta);
		font-weight: 600;
	}
</style>
