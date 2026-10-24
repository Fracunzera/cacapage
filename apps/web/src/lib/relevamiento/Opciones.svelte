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
		font-weight: 700;
		margin-bottom: 8px;
		padding: 0;
	}
	.opciones {
		display: grid;
		gap: 8px;
	}
	.col-2 {
		grid-template-columns: repeat(2, 1fr);
	}
	.col-3 {
		grid-template-columns: repeat(3, 1fr);
	}
	.col-4 {
		grid-template-columns: repeat(4, 1fr);
	}
	button {
		min-height: 52px;
		padding: 6px 8px;
		border: 2px solid var(--borde);
		border-radius: 12px;
		background: #fff;
		color: var(--texto);
		font: inherit;
		font-size: 16px;
		line-height: 1.15;
		touch-action: manipulation;
	}
	button.desconocido {
		color: var(--suave);
	}
	button.elegida {
		border-color: var(--marca);
		background: var(--marca);
		color: #fff;
		font-weight: 700;
	}
</style>
