# MMT Sync — SDK Abierto de Plugins y Widgets Comunitarios

Bienvenido al sistema de extensiones y plugins abiertos de **MMT Sync**. Puedes crear cualquier overlay (tacómetro, fuerzas G, radar avanzado, radar de lluvia, etc.) en HTML, CSS y JavaScript estándar sin recompilar la aplicación principal.

---

## 🚀 Cómo crear un nuevo widget en 3 pasos (< 10 minutos)

### 1. Crea una carpeta para tu plugin
Dentro del directorio `plugins/`, crea una subcarpeta con el nombre de tu widget (ejemplo: `plugins/mi-nuevo-widget/`).

### 2. Define tu `manifest.json`
Crea el archivo `plugins/mi-nuevo-widget/manifest.json`:
```json
{
  "id": "mi-nuevo-widget",
  "name": "Mi Widget Comunitario",
  "version": "1.0.0",
  "author": "Tu Nombre o Alias",
  "description": "Breve descripción de lo que muestra el widget.",
  "entry": "index.html",
  "width": 200,
  "height": 120,
  "defaultPosition": { "x": 600, "y": 400 }
}
```

### 3. Conecta los datos de telemetría en `script.js`
Tu widget recibe automáticamente los datos de telemetría a 60 Hz mediante eventos nativos `postMessage` o mediante WebSocket en `ws://localhost:9090`:

```javascript
window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "mmt_telemetry_frame") {
    const frame = event.data;
    console.log("Velocidad:", frame.inputs.speedKmh);
    console.log("Gas:", frame.inputs.throttle);
    console.log("Freno:", frame.inputs.brake);
    console.log("Marcha:", frame.inputs.gear);
    console.log("Combustible restante:", frame.fuel.remainingL);
  }
});
```

---

## 📡 Esquema del Frame de Telemetría (`mmt_telemetry_frame`)

El frame emitido por MMT Sync incluye:
- `timestamp`: Marca de tiempo en milisegundos.
- `camCarIdx` / `playerCarIdx`: Índice del coche enfocado y del jugador.
- `onPitRoad`: Booleano (`true` en boxes, `false` en pista).
- `car`: `{ path, screenName, number }`
- `track`: `{ name, config, category }`
- `session`: `{ type, activeLap, flags }`
- `inputs`: `{ throttle, brake, clutch, steeringDeg, speedKmh, gear, rpm }`
- `fuel`: `{ remainingL, avgBurn, lapsRemaining, fuelToAdd }`
- `relative`: Lista de coches ±4 con delta, número, clase y piloto.
- `leaderboard`: Top 10 con posiciones, intervalos y mejor vuelta.

¡Consulta la plantilla incluida en `plugins/example-gforce-meter/` para un ejemplo 100% funcional!
