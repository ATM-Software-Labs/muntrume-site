<p align="center">
  <strong>MMT Sync</strong><br/>
  Aplicación de Windows para copiar los setups de Muntrume Motorsport a la carpeta de iRacing.
</p>

<p align="center">
  <a href="https://muntru.me/app/"><b>muntru.me/app</b></a> ·
  <a href="https://muntru.me/garage/#mmt-sync">Descarga</a> ·
  <a href="docs/feature-parity.md">Paridad</a>
</p>

<p align="center">
  <img alt="Tauri" src="https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white" />
  <img alt="Rust" src="https://img.shields.io/badge/Rust-1.77+-000000?logo=rust&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white" />
</p>

---

## Qué hace

- Vincula el ordenador con muntru.me. El token queda en el Administrador de credenciales de Windows.
- Escribe solo en `setups\<coche>\MMT\<temporada>\<archivo>.sto`.
- Compara el sha256 y baja lo nuevo o lo cambiado. El borrado de retirados está apagado hasta que el piloto lo enciende.
- Deja subir un `.sto` de como máximo 1 MB a la sala de ingenieros.
- Lee `.ibt` y, en Windows, la memoria del SDK de iRacing. Solo lectura.
- Bandeja, aviso de Windows cuando entran setups, e inicio con Windows apagado por defecto.

El API es el mismo que usa la web: `https://muntrume.atrumin16.workers.dev`.

## Desarrollo

Hace falta Node 24 y Rust stable. En este árbol el frontend se puede abrir sin Windows:

```bash
cd desktop
npm ci
npm run dev
```

`npm run dev` entra en modo demostración si no está dentro de Tauri. No guarda un token en disco.

| Comando | Qué hace |
|---|---|
| `npm run check` | TypeScript estricto |
| `npm run build` | Frontend de producción |
| `cargo test --workspace` | Rutas, diff, `.ibt`, combustible |
| `cargo clippy --workspace --all-targets -- -D warnings` | Lint |
| `npm run tauri dev` | Ventana nativa |

`MMT_MOCK=1` hace que el proceso Rust no llame al API. El token de esa demostración se queda en memoria.

## Secretos y la primera release

La clave pública del actualizador ya está en `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`, id `E4305AF980B6D593`). La privada no se commitea.

En el repositorio hacen falta los secretos `TAURI_SIGNING_PRIVATE_KEY` (el contenido de `mmt-sync.key`) y `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (la contraseña de esa clave, o vacía si no tiene).

La primera release:

```bash
git tag desktop-v0.1.0
git push origin desktop-v0.1.0
```

El workflow publica el `.exe` de NSIS, el `.msi` y `latest.json`. No hay certificado de código: SmartScreen puede decir «editor desconocido».

## Límites

- Hay que probar la bandeja, el Credential Manager, el SDK y el instalador en un Windows con iRacing.
- Los overlays comparten una ventana para no multiplicar WebViews.
- Referencias, presencia y avisos de revisión esperan a los endpoints de `docs/backend-contract.md`.
- La comparación con VRS, HYMO y Grid and Go está en `docs/feature-parity.md`. La interfaz no dice que estemos a la par.

## Volver atrás

Revertir el commit y borrar la release `desktop-v*` si se llegó a publicar. La web no embebe el instalador: quitar la tarjeta del Garage es el rollback de la página.
