# packages/core

Lógica compartida entre cliente y servidor, sin dependencias de DOM ni de base
de datos:

- Generalización temporal: franja horaria, semana ISO, tipo de día (hábil,
  sábado, domingo/feriado). Zona horaria fija `America/Argentina/Rio_Gallegos`.
- Pipeline de anonimización del lado cliente (DESIGN.md §6): chequeo de zonas
  privadas, candidatos de lugar, detección de domicilio.
- Esquemas de validación de los payloads de la API (el servidor valida con los
  mismos esquemas que usa el cliente para armar el lote).
- Evaluación de logros contra el historial privado.

Sin implementar.
