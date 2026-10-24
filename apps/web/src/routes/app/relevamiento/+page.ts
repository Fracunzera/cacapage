// Solo en el navegador: GPS, IndexedDB y descarga de archivos no existen en el
// servidor. Sin load de servidor en el árbol, para que arranque sin conexión.
export const ssr = false;
export const prerender = false;
