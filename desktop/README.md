<p align="center">
  <strong>MMT Sync v0.6.5 · Muntrume Motorsport</strong><br/>
  Centro de mando nativo en Rust + Tauri v2 para Windows: sincronización SHA-256 de setups <code>.sto</code>, Overlays 60 Hz y análisis de telemetría <code>.ibt</code> para iRacing.
</p>

<p align="center">
  <a href="https://muntru.me/app/"><b>muntru.me/app</b></a> ·
  <a href="https://muntru.me/overlay/">Simulador HUD</a> ·
  <a href="https://muntru.me/garage/">Setup Vault</a> ·
  <a href="docs/feature-parity.md">Arquitectura y Paridad</a>
</p>

<p align="center">
  <img alt="Versión" src="https://img.shields.io/badge/versi%C3%B3n-0.6.5-10B981" />
  <img alt="Tauri" src="https://img.shields.io/badge/Tauri-2.0-24C8DB?logo=tauri&logoColor=white" />
  <img alt="Rust" src="https://img.shields.io/badge/Rust-1.77+-000000?logo=rust&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white" />
</p>

---

## Módulos Principales

- **Centro de Mando & Vinculación Segura:** Vincula el ordenador con `muntru.me` mediante OAuth Device Flow. El token se almacena cifrado en el **Administrador de credenciales de Windows** (nunca en texto plano).
- **Sincronización Diferencial SHA-256:** Descarga únicamente los reglajes `.sto` nuevos o modificados en `Documents\iRacing\setups\<coche>\MMT\<temporada>\`, filtrando automáticamente las series Fixed.
- **Overlays Flotantes 60 Hz (`FILE_MAP_READ`):** Ventana única transparente `Always-On-Top` y `Click-Through` con 9 widgets modulares (Standings multiclase, Relative, Mapa GPS Catmull-Rom, Pedales + FFB, Radar 360°, Calculadora de Combustible, Neumáticos, Delta y Spotter).
- **Puente Local (`127.0.0.1:38421`) y Protocolo `mmtsync://`:** Permite activar los overlays, desbloquear el modo edición (`F9`) o lanzar una sincronización directamente desde [muntru.me](https://muntru.me) o [muntru.me/app/](https://muntru.me/app/).
- **Analizador Local `.ibt` y Diagnóstico de Hardware:** Parseo de telemetría de iRacing en disco sin subir datos privados, calculadora de estrategia con envío `IRSDK_BROADCAST_MSG` de auto-repostaje e inspección sin parpadeos (`CREATE_NO_WINDOW`) de periféricos DirectInput y audio XAudio2.

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
