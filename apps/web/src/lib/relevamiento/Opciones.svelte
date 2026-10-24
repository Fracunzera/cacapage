<script lang="ts" generics="T extends string">
	// Grupo de botones grandes de opción única: más rápido que un <select> con
	// una mano y sin tener que abrir nada.
	let {
		etiqueta,
		opciones,
		valor = $bindable(),
		columnas = 3
	}: {
		etiqueta: string;
		opciones: readonly (readonly [T, string])[];
		valor: T;
		columnas?: 2 | 3 | 4;
	} = $props();
</script>

<fieldset class="grupo">
	<legend>{etiqueta}</legend>
	<div class="opciones col-{columnas}" role="radiogroup" aria-label={etiqueta}>
		{#each opciones as [v, texto] (v)}
			<button
				type="button"
				role="radio"
				aria-checked={valor === v}
				class:elegida={valor === v}
				class:desconocido={v === 'desconocido'}
				onclick={() => (valor = v)}
			>
				{texto}
			</button>
		{/each}
	</div>
</fieldset>

<style>
	.grupo {
		border: 0;
		margin: 0 0 18px;
		padding: 0;
		min-width: 0;
	}
	legend {
		margin-bottom: 8px;
		padding: 0;
		font-weight: 600;
	}
	.opciones {
		display: grid;
		gap: 8px;
	}
	.col-2 {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.col-3 {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.col-4 {
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}
	button {
		min-height: 52px;
		padding: 4px;
		border: 2px solid var(--tinta);
		border-radius: 12px;
		background: var(--papel);
		color: var(--tinta);
		font-size: 14.5px;
		font-weight: 500;
		line-height: 1.15;
		overflow-wrap: break-word;
		touch-action: manipulation;
	}
	/* "Desconocido" ocupa su propia fila: se distingue de las respuestas y nunca
	   se corta en pantallas angostas. */
	button.desconocido {
		grid-column: 1 / -1;
		min-height: 46px;
		border-style: dashed;
		color: var(--tinta-suave);
	}
	/* Celulares muy angostos: tres columnas no entran sin cortar palabras. */
	@media (max-width: 340px) {
		.col-3 {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	button.elegida {
		background: var(--tinta);
		color: var(--sol);
		font-weight: 700;
		border-style: solid;
		box-shadow: 2px 2px 0 var(--sol);
	}
	/* Elegido por defecto: suave, para que resalten las respuestas reales. */
	button.desconocido.elegida {
		border-style: solid;
		background: var(--celeste-claro);
		color: var(--tinta);
		box-shadow: none;
		font-weight: 600;
	}
</style>
