import { execSync } from 'node:child_process';
import fs from 'node:fs';

const DRIVERS = [
  {
    slug: "albertot",
    dorsal: "#1",
    name: "Alberto T",
    fullName: "Alberto Trujillo",
    cust_id: "993381",
    irating: 3900,
    license: "A 4.99",
    country: "Spain",
    flag: "🇪🇸",
    flag_code: "ES",
    helmet_url: "https://muntrume.atrumin16.workers.dev/api/helmet?custId=993381",
    fav_category: "GT3 Endurance",
    most_used: { car: "Porsche 911 GT3 R (992)", pct: 42 },
    fav_car: "Porsche 911 GT3 R (992)",
    is_founder: true,
    status: "Activo"
  },
  {
    slug: "mateob",
    dorsal: "#2",
    name: "Mateo B",
    fullName: "Mateo Berbis",
    cust_id: "1134615",
    irating: 2534,
    license: "B 3.20",
    country: "Spain",
    flag: "🇪🇸",
    flag_code: "ES",
    helmet_url: "https://muntrume.atrumin16.workers.dev/api/helmet?custId=1134615",
    fav_category: "GT3",
    most_used: { car: "Ferrari 296 GT3", pct: 38 },
    fav_car: "Ferrari 296 GT3",
    is_founder: false,
    status: "Activo"
  },
  {
    slug: "eduardoc",
    dorsal: "#3",
    name: "Eduardo C",
    fullName: "Eduardo C",
    cust_id: "1076585",
    irating: 3100,
    license: "A 2.80",
    country: "Costa Rica",
    flag: "🇨🇷",
    flag_code: "CR",
    helmet_url: "https://muntrume.atrumin16.workers.dev/api/helmet?custId=1076585",
    fav_category: "GTP",
    most_used: { car: "Aston Martin Valkyrie GTP", pct: 45 },
    fav_car: "Aston Martin Valkyrie GTP",
    is_founder: false,
    status: "Activo"
  },
  {
    slug: "juanluc",
    dorsal: "#4",
    name: "Juanlu C",
    fullName: "Juanlu",
    cust_id: null,
    irating: null,
    license: null,
    country: "Spain",
    flag: "🇪🇸",
    flag_code: "ES",
    helmet_url: null,
    fav_category: "Monoplazas",
    most_used: null,
    fav_car: "Super Formula Lights",
    is_founder: true,
    status: "En el Paddock"
  }
];

const json = JSON.stringify(DRIVERS).replace(/'/g, "''");
const now = new Date().toISOString();

const sql = `
INSERT INTO driver_stats (id, data, updated_at) VALUES ('live_drivers', '${json}', '${now}')
ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at;

INSERT INTO driver_stats (id, data, updated_at) VALUES ('all', '${json}', '${now}')
ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at;
`;

fs.writeFileSync('scripts/seed_drivers.sql', sql.trim(), 'utf-8');
console.log('Generated scripts/seed_drivers.sql');
