/** Baja un archivo generado en el celular (nada pasa por el servidor). */
export function descargar(nombre: string, contenido: string, tipo = 'application/json') {
	const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
	const a = document.createElement('a');
	a.href = url;
	a.download = nombre;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
