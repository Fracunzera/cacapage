<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Logo from '$lib/ui/Logo.svelte';
	import { api, ErrorApi } from '$lib/cliente/api';

	// El token viene en el fragmento (#): no viaja al servidor al abrir el link,
	// no queda en logs ni en el Referer. Se canjea recién al tocar "Entrar", para
	// que los escáneres de links de los proveedores de mail no lo quemen.
	let token = $state('');
	let ocupado = $state(false);
	let error = $state<string | null>(null);

	onMount(() => {
		token = location.hash.slice(1);
		history.replaceState(null, '', location.pathname);
	});

	async function entrar() {
		ocupado = true;
		error = null;
		try {
			await api('/auth/mail/canjear', { cuerpo: { token } });
			await goto('/app');
		} catch (e) {
			error = e instanceof ErrorApi ? e.message : 'Algo salió mal. Probá de nuevo.';
		} finally {
			ocupado = false;
		}
	}
</script>

<svelte:head>
	<title>Entrar · Dónde Cagué</title>
</svelte:head>

<header class="u-tope">
	<a href="/" aria-label="Inicio"><Logo tamanio={32} conNombre={false} /></a>
	<h1>Entrar</h1>
</header>

<main class="u-pagina">
	<section class="u-tarjeta">
		{#if token}
			<h2>¡Ya casi!</h2>
			<p>Tocá el botón para terminar de entrar.</p>
			<button type="button" class="u-boton" disabled={ocupado} onclick={entrar}>{ocupado ? 'Entrando…' : 'Entrar'}</button>
		{:else}
			<h2>Este link no sirve</h2>
			<p>Pedí uno nuevo desde la pantalla de entrada.</p>
			<a class="u-boton" href="/app/entrar?modo=entrar">Ir a entrar</a>
		{/if}
		{#if error}<p class="u-error" role="alert">{error}</p>{/if}
	</section>
</main>

<style>
	h2 {
		margin: 0 0 8px;
		font-size: 22px;
	}
	p {
		margin: 0 0 8px;
	}
</style>
