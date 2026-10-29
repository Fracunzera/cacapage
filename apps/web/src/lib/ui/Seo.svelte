<script lang="ts">
	// Título, descripción, canonical, Open Graph y Twitter Card de una página
	// pública. El origen sale del pedido (ORIGIN = ORIGEN_PUBLICO): nada de
	// dominios escritos a mano (DESIGN.md §15.1).
	import { page } from '$app/state';

	let { titulo, descripcion, ruta }: { titulo: string; descripcion: string; ruta: string } = $props();

	const url = $derived(page.url.origin + ruta);
	const imagen = $derived(page.url.origin + '/og.png');
</script>

<svelte:head>
	<title>{titulo}</title>
	<meta name="description" content={descripcion} />
	<link rel="canonical" href={url} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Dónde Cagué" />
	<meta property="og:locale" content="es_AR" />
	<meta property="og:title" content={titulo} />
	<meta property="og:description" content={descripcion} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={imagen} />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="Dónde Cagué: ¿Dónde cagaste hoy? Registrá, juntá medallas y encontrá baños en toda la Argentina." />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={titulo} />
	<meta name="twitter:description" content={descripcion} />
	<meta name="twitter:image" content={imagen} />
</svelte:head>
