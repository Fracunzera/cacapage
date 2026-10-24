import { ES_PRUEBA } from '$lib/server/entorno';

// Load de servidor solo para la página de inicio. Las rutas /app/* no tienen
// ningún load de servidor en su árbol (DESIGN.md §14.2 R1): si lo tuvieran, el
// relevamiento no podría arrancar sin conexión.
export const load = () => ({ esPrueba: ES_PRUEBA });
