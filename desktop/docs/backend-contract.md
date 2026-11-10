# Endpoints que el worker todavía tiene que publicar

La app ya llama a los de vinculación, manifiesto, descarga, subida y sesión descritos en el primer contrato. Estos son los añadidos. Hasta que existan, el interruptor correspondiente nace apagado. El modo demostración no los llama.

Base: `https://muntrume.atrumin16.workers.dev`. Autorización: `Authorization: Bearer <token>` guardado en el Administrador de credenciales.

## Manifiesto, campos opcionales

`GET /api/desktop/manifest` puede añadir, sin romper a quien no los envíe:

```json
{
  "generated_at": "2026-11-10T12:00:00Z",
  "season": "26S4",
  "current_week": 9,
  "setups": [
    {
      "id": "42",
      "car": "Ferrari 296 GT3",
      "car_folder": "ferrari296gt3",
      "track": "Spa",
      "season": "26S4",
      "week": 9,
      "type": "Race",
      "filename": "spa_race.sto",
      "sha256": "<64 hex>",
      "size": 48000,
      "updated_at": "2026-11-10T12:00:00Z",
      "notes": "texto corto o null",
      "guide": "texto de guía o null"
    }
  ]
}
```

Si `current_week` o `week` no vienen, la app agrupa por circuito y no supone la semana.

## Vueltas de referencia

`POST /api/desktop/reference-laps`

Cuerpo `multipart/form-data`:

- `file`: bytes gzip de un JSON de una sola vuelta. Máximo 2 MB ya comprimido. No es un `.ibt`.
- `car`: nombre visible
- `car_folder`: carpeta iRacing
- `track`: circuito

El JSON interior:

```json
{
  "number": 3,
  "samples": [
    {"t": 0, "dist": 0, "speed": 0, "throttle": 0, "brake": 0, "gear": 1, "steering": 0, "lat": null, "lon": null, "vx": null, "vy": null}
  ]
}
```

Respuesta `202`:

```json
{ "id": "lap_123", "status": "stored" }
```

`GET /api/desktop/reference-laps?car_folder=ferrari296gt3&track=Spa`

```json
{ "laps": [{ "id": "lap_123", "pilot": { "slug": "albertot", "name": "Alberto Trujillo" }, "car": "Ferrari 296 GT3", "track": "Spa", "created_at": "2026-11-10T12:00:00Z", "bytes": 12000 }] }
```

`GET /api/desktop/reference-laps/:id` devuelve el mismo gzip, con `Content-Type: application/gzip`.

## Aviso de revisión

`GET /api/desktop/reviews?since=2026-11-10T12:00:00Z`

```json
{ "items": [{ "id": "setup_42", "filename": "spa_race.sto", "status": "approved", "at": "2026-11-10T12:05:00Z" }] }
```

`status` es `approved` o `rejected`. La app solo notifica. No publica el archivo.

## Presencia

No hay un contrato público para leer la sala del paddock con el token de escritorio. No se llama al websocket actual. Si se quiere la lista de pilotos conectados, haría falta algo explícito, por ejemplo `GET /api/desktop/presence` → `{ "pilots": [{ "slug": "albertot", "name": "Alberto Trujillo" }] }`, y documentar que ese token puede usarlo. Hasta entonces el módulo queda apagado y vacío.
