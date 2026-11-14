/**
 * MMT Sync — G-Force Meter Plugin Script
 * Receives telemetry frame from parent window postMessage or WebSocket
 */

const gDot = document.getElementById("gDot");
const gLat = document.getElementById("gLat");
const gLon = document.getElementById("gLon");
const gTotal = document.getElementById("gTotal");

let lastSpeedKmh = 0;
let lastTime = Date.now();

function handleTelemetry(data) {
  if (!data || !data.inputs) return;

  const now = Date.now();
  const dt = Math.max(0.016, (now - lastTime) / 1000);
  lastTime = now;

  // 1. Calculate longitudinal G from speed delta (accel / brake)
  const currentSpeedMs = (data.inputs.speedKmh || 0) / 3.6;
  const prevSpeedMs = lastSpeedKmh / 3.6;
  lastSpeedKmh = data.inputs.speedKmh || 0;

  const accelMs2 = (currentSpeedMs - prevSpeedMs) / dt;
  let lonG = accelMs2 / 9.80665;
  // Clamp longitudinal G to [-3.5, 3.0]
  lonG = Math.max(-3.5, Math.min(3.0, lonG));

  // 2. Calculate lateral G from steering angle and speed
  const steerRad = (data.inputs.steeringDeg || 0) * (Math.PI / 180);
  const yawRateEst = (steerRad * currentSpeedMs) / 2.7; // 2.7m wheelbase approx
  let latG = (currentSpeedMs * yawRateEst) / 9.80665;
  // Clamp lateral G to [-3.5, 3.5]
  latG = Math.max(-3.5, Math.min(3.5, latG));

  const totalG = Math.sqrt(lonG * lonG + latG * latG);

  // 3. Update DOM (center is 50%, 50%)
  // Range is ±2.5G for full radius
  const maxG = 2.5;
  const pxX = 50 + (latG / maxG) * 42;
  const pxY = 50 - (lonG / maxG) * 42;

  if (gDot) {
    gDot.style.left = `${Math.max(8, Math.min(92, pxX))}%`;
    gDot.style.top = `${Math.max(8, Math.min(92, pxY))}%`;
  }

  if (gLat) gLat.textContent = (latG >= 0 ? "+" : "") + latG.toFixed(2);
  if (gLon) gLon.textContent = (lonG >= 0 ? "+" : "") + lonG.toFixed(2);
  if (gTotal) gTotal.textContent = `${totalG.toFixed(1)}G`;
}

// Listen to postMessage from parent MMT Sync overlay window
window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "mmt_telemetry_frame") {
    handleTelemetry(event.data);
  }
});

// Optionally connect to local WebSocket on localhost:9090
try {
  const ws = new WebSocket("ws://localhost:9090");
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data && data.type === "mmt_telemetry_frame") {
        handleTelemetry(data);
      }
    } catch {}
  };
} catch {}
