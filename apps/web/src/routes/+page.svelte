<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>cacapage</title>
</svelte:head>

<main class="inicio">
	<h1>cacapage</h1>
	<p>Todavía no hay nada para ver acá.</p>
	{#if data.esPrueba}
		<p><a href="/app/relevamiento">Relevamiento de baños</a></p>
	{/if}
</main>

<style>
	.inicio {
		max-width: 32rem;
		margin: 0 auto;
		padding: 24px 16px;
	}
</style>
