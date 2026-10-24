# packages/vault

Cifrado de la capa privada con WebCrypto (DESIGN.md §5.2, PRIVACY.md P-03):

- Generación de la llave de bóveda (AES-GCM 256) en el dispositivo.
- Envoltura de la llave con PRF de passkey (cuando el autenticador lo soporte)
  y con código de recuperación.
- Paginado mensual con padding a tamaño fijo, para no revelar cuántos registros
  hay.

Sin implementar.
