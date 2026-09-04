// Deterministic demo dataset — store/zone/tariff-model values are the real
// ones found in the audited spreadsheet; the transactions themselves are
// synthetic (seeded RNG) so the app is fully explorable before sync exists.

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260831);
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function randAmount(min: number, max: number) {
  return Math.round(rand() * (max - min) + min);
}

export const ZONES = [
  "DISTRITO FEDERAL Y MEXICO",
  "NORTE",
  "OCCIDENTE",
  "SURESTE",
  "BAJIO",
];

export const STORES = [
  { store_number: "6200", store_ext_id: "27156", name: "Bulevares del Lago", model: "M99", state: "Estado de México" },
  { store_number: "1579", store_ext_id: "2983", name: "Calle De Los Pinos", model: "M99", state: "Estado de México" },
  { store_number: "5768", store_ext_id: "2136", name: "Ciudad Labor", model: "M99", state: "Estado de México" },
  { store_number: "5013", store_ext_id: "27157", name: "BA Colina de Monte Bello", model: "M99", state: "Estado de México" },
  { store_number: "1930", store_ext_id: "2137", name: "El Oro", model: "M99", state: "Estado de México" },
  { store_number: "3870", store_ext_id: "2961", name: "Morelia", model: "M99", state: "Michoacán" },
  { store_number: "5827", store_ext_id: "2963", name: "Morelia Este", model: "M99", state: "Michoacán" },
  { store_number: "1179", store_ext_id: "2956", name: "BA Morelia Norte", model: "M99", state: "Michoacán" },
  { store_number: "3772", store_ext_id: "2081", name: "Plaza Atizapan", model: "M109", state: "Estado de México" },
  { store_number: "1428", store_ext_id: "3196", name: "San Mateo Atenco", model: "M99", state: "Estado de México" },
  { store_number: "5843", store_ext_id: "17993", name: "Bodega Uruapan", model: "M109", state: "Michoacán" },
  { store_number: "2457", store_ext_id: "7119", name: "Altamirar Sur", model: "M109", state: "Tamaulipas" },
  { store_number: "2591", store_ext_id: "7117", name: "Tampico", model: "M109", state: "Tamaulipas" },
  { store_number: "2586", store_ext_id: "6742", name: "Rodolfo Elias Calles", model: "M119", state: "Sonora" },
  { store_number: "3669", store_ext_id: "2975", name: "BA Naranjos", model: "M119", state: "Veracruz" },
].map((s, i) => ({ ...s, id: `store-${i + 1}`, zone: pick(ZONES) }));

const FIRST_NAMES = [
  "Daniela", "Laura", "Eduardo", "Mirna", "Cesar", "Yajaira", "Jorge",
  "Victor", "Norberto", "Yamilet", "German", "Ramses", "Daniel", "Yenni",
  "Marilu", "Miguel", "Perla", "Fernando", "Gustavo", "Veronica",
];
const LAST_NAMES = [
  "Perez Garduno", "Hidalgo Sevilla", "Hernandez Ortiz", "Mejia Rincon",
  "Moreno Guzman", "Mendoza Toriz", "Martinez Merino", "Pena Zavala",
  "Fragoso Jimenez", "Sosa Munguia", "Bravo Meneses", "Gonzalez Lopez",
  "Serna Patlan", "Enriquez", "Diaz Rodriguez", "Aguinaga Cruz",
];

export const USERS = Array.from({ length: 42 }).map((_, i) => {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  return {
    id: `user-${i + 1}`,
    phone: `52${randInt(2100000000, 2999999999)}`,
    full_name: `${first} ${last} Zubale`,
    email: `${first.toLowerCase()}.${last.toLowerCase().split(" ")[0]}${i}@gmail.com`,
    store: pick(STORES),
  };
});

export interface MockTxn {
  id: string;
  date: Date;
  user: (typeof USERS)[number];
  store: (typeof STORES)[number];
  generated: number;
  submitted: number;
  paid: number;
  status: "GENERADO" | "ENVIADO_A_FINANZAS" | "PAGADO" | "PENDIENTE" | "RECHAZADO" | "EN_PROCESO";
}

const DAYS = 60;
const today = new Date("2026-08-31T00:00:00Z");

export const TRANSACTIONS: MockTxn[] = Array.from({ length: 1400 }).map((_, i) => {
  const user = pick(USERS);
  const store = user.store;
  const daysAgo = randInt(0, DAYS);
  const date = new Date(today);
  date.setDate(date.getDate() - daysAgo);

  const generated = randAmount(80, 180);
  const roll = rand();
  let status: MockTxn["status"];
  let submitted = 0;
  let paid = 0;

  if (roll < 0.06) {
    status = "GENERADO";
  } else if (roll < 0.14) {
    status = "PENDIENTE";
  } else if (roll < 0.18) {
    status = "RECHAZADO";
    submitted = generated;
  } else if (roll < 0.24) {
    status = "EN_PROCESO";
    submitted = generated;
  } else if (roll < 0.42) {
    status = "ENVIADO_A_FINANZAS";
    submitted = generated;
  } else {
    status = "PAGADO";
    submitted = generated;
    paid = generated;
  }

  return {
    id: `txn-${i + 1}`,
    date,
    user,
    store,
    generated,
    submitted,
    paid,
    status,
  };
});

const BONUS_TYPOS = [
  "Bonus - Training",
  "Bonus - BUA Bonus Capacitación",
  "Supervisor Payment - Expediter",
  "Weekends Bonus (F/S/S)",
  "Reimbursement - Parking",
  "Motorcycle Bonus",
  "Movement Bonus (Clustering)",
];
const BONUS_AREAS = ["Ops", "Supply", "Growth"];

export interface MockBonus {
  id: string;
  date: Date;
  user: (typeof USERS)[number];
  store: (typeof STORES)[number];
  area: string;
  typo: string;
  amount: number;
  paymentChecked: boolean;
}

export const BONUSES: MockBonus[] = Array.from({ length: 180 }).map((_, i) => {
  const user = pick(USERS);
  const daysAgo = randInt(0, DAYS);
  const date = new Date(today);
  date.setDate(date.getDate() - daysAgo);

  return {
    id: `bonus-${i + 1}`,
    date,
    user,
    store: user.store,
    area: pick(BONUS_AREAS),
    typo: pick(BONUS_TYPOS),
    amount: randAmount(100, 1500),
    paymentChecked: rand() > 0.2,
  };
});

const ORDER_STATUSES = [
  { value: "DELIVERED", weight: 0.86 },
  { value: "CANCELLED", weight: 0.06 },
  { value: "IN_PROGRESS", weight: 0.05 },
  { value: "LATE", weight: 0.03 },
] as const;

function pickWeighted<T extends { weight: number }>(options: readonly T[]): T {
  const roll = rand();
  let acc = 0;
  for (const opt of options) {
    acc += opt.weight;
    if (roll <= acc) return opt;
  }
  return options[options.length - 1];
}

const SLOTS = [
  "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00", "12:00 - 13:00",
  "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00", "16:00 - 17:00",
  "17:00 - 18:00", "18:00 - 19:00", "19:00 - 20:00",
];

export interface MockOrder {
  id: string;
  orderId: string;
  date: Date;
  slot: string;
  status: string;
  onTime: boolean | null;
  isLate: boolean;
  distanceKm: number;
  linesRequested: number;
  user: (typeof USERS)[number];
  store: (typeof STORES)[number];
}

const ORDER_DAYS = 90;

export const ORDERS: MockOrder[] = Array.from({ length: 5200 }).map((_, i) => {
  const user = pick(USERS);
  const store = user.store;
  const daysAgo = randInt(0, ORDER_DAYS);
  const date = new Date(today);
  date.setDate(date.getDate() - daysAgo);

  const status = pickWeighted(ORDER_STATUSES).value;
  const isLate = status === "LATE" || (status === "DELIVERED" && rand() < 0.08);
  const onTime = status === "DELIVERED" && !isLate;

  return {
    id: `order-${i + 1}`,
    orderId: `75926${randInt(10000000, 99999999)}`,
    date,
    slot: pick(SLOTS),
    status,
    onTime,
    isLate,
    distanceKm: Math.round((rand() * 9 + 0.3) * 100) / 100,
    linesRequested: randInt(1, 60),
    user,
    store,
  };
});

export function totalsForPeriod(days: number) {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);
  const rows = TRANSACTIONS.filter((t) => t.date >= cutoff);

  return {
    generated: rows.reduce((s, r) => s + r.generated, 0),
    submitted: rows.reduce((s, r) => s + r.submitted, 0),
    paid: rows.reduce((s, r) => s + r.paid, 0),
    count: rows.length,
    rows,
  };
}
