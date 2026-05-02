import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- GEOLOCATION LOGIC ---

interface Building {
  code: string;
  floors: string[];
  coord: [number, number];
}

interface GraphNode {
  [neighbor: string]: number;
}

interface Graph {
  [node: string]: GraphNode;
}

let buildings: Building[] = [];
let graph: Graph = {};

const WALKING_SPEED = 1.25; // m/s
const FLOOR_COST = 14; // seconds per floor

export function initGeoData() {
  try {
    const geoDir = path.join(__dirname, "../assets/geo");
    const buildingsPath = path.join(geoDir, "buildings.json");
    const pathsPath = path.join(geoDir, "paths.json");

    if (fs.existsSync(buildingsPath) && fs.existsSync(pathsPath)) {
      const buildingsData = JSON.parse(fs.readFileSync(buildingsPath, "utf-8"));
      const pathsData = JSON.parse(fs.readFileSync(pathsPath, "utf-8"));

      // Load buildings
      buildings = buildingsData.features
        .filter((f: any) => f.properties.type === "building")
        .map((f: any) => ({
          code: f.properties.building.buildingCode.toUpperCase(),
          floors: f.properties.building.floors,
          coord: f.geometry.coordinates as [number, number],
        }));

      // Build Graph
      pathsData.features.forEach((f: any) => {
        if (f.geometry.type === "LineString") {
          const coords = f.geometry.coordinates;
          for (let i = 0; i < coords.length - 1; i++) {
            const p1 = coords[i].join(",");
            const p2 = coords[i + 1].join(",");
            const dist = getDistance(coords[i], coords[i + 1]);
            const weight = dist / WALKING_SPEED;

            if (!graph[p1]) graph[p1] = {};
            if (!graph[p2]) graph[p2] = {};
            graph[p1][p2] = weight;
            graph[p2][p1] = weight;
          }
        }
      });
    }
  } catch (err) {
    console.error("Failed to initialize geo data:", err);
  }
}

function getDistance(c1: [number, number], c2: [number, number]) {
  const R = 6371000;
  const phi1 = (c1[1] * Math.PI) / 180;
  const phi2 = (c2[1] * Math.PI) / 180;
  const dphi = ((c2[1] - c1[1]) * Math.PI) / 180;
  const dlambda = ((c2[0] - c1[0]) * Math.PI) / 180;
  const a =
    Math.sin(dphi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findBestCoord(code: string, floor: string): [number, number] | null {
  const b = buildings.find((b) => b.code === code && b.floors.includes(floor));
  if (b) return b.coord;
  const bAnyFloor = buildings.find((b) => b.code === code);
  return bAnyFloor ? bAnyFloor.coord : null;
}

// Simple Dijkstra
function dijkstra(start: string, end: string): number {
  const distances: { [key: string]: number } = {};
  const visited = new Set<string>();
  const pq: [number, string][] = [[0, start]];

  distances[start] = 0;

  while (pq.length > 0) {
    pq.sort((a, b) => a[0] - b[0]);
    const [dist, current] = pq.shift()!;

    if (current === end) return dist;
    if (visited.has(current)) continue;
    visited.add(current);

    const neighbors = graph[current] || {};
    for (const neighbor in neighbors) {
      const newDist = dist + neighbors[neighbor];
      if (!distances[neighbor] || newDist < distances[neighbor]) {
        distances[neighbor] = newDist;
        pq.push([newDist, neighbor]);
      }
    }
  }
  return Infinity;
}

export function getWalkingTime(sCode: string, sFloor: string, eCode: string, eFloor: string): number {
  sCode = sCode.toUpperCase().trim();
  eCode = eCode.toUpperCase().trim();

  // Special cases for St. Jerome's / Renison / CMH
  const specials = new Set(["REN", "SJ1", "SJ2"]);
  if (specials.has(sCode) || specials.has(eCode)) {
    const other = specials.has(sCode) ? eCode : sCode;
    if (other === "CMH") return 18;
    if (["SCH", "TC", "CPH", "RCH", "DC", "E2", "E7", "E5"].includes(other)) return 12;
    return 8;
  }

  const c1 = findBestCoord(sCode, sFloor);
  const c2 = findBestCoord(eCode, eFloor);
  if (!c1 || !c2) return 9;

  try {
    const nodes = Object.keys(graph);
    const n1 = nodes.reduce((a, b) => {
      const ca = a.split(",").map(Number) as [number, number];
      const cb = b.split(",").map(Number) as [number, number];
      return getDistance(c1, ca) < getDistance(c1, cb) ? a : b;
    });
    const n2 = nodes.reduce((a, b) => {
      const ca = a.split(",").map(Number) as [number, number];
      const cb = b.split(",").map(Number) as [number, number];
      return getDistance(c2, ca) < getDistance(c2, cb) ? a : b;
    });

    const travelSeconds = dijkstra(n1, n2);
    if (travelSeconds === Infinity) return 9;

    const floorDiff = Math.abs(parseFloat(sFloor) - parseFloat(eFloor)) || 0;
    const totalSeconds = travelSeconds + floorDiff * FLOOR_COST;
    return Math.round((totalSeconds / 60) * 100) / 100;
  } catch (err) {
    return 9;
  }
}

// --- RATINGS LOGIC ---

export async function fetchUWFlowProfRatings(instructorName: string) {
  if (!instructorName || instructorName.includes("To be Announced")) {
    return { liked: 80, clear: 80, engaging: 80 };
  }

  const names = instructorName.split(",").map((n) => n.trim());
  const scores = { liked: [] as number[], clear: [] as number[], engaging: [] as number[] };

  for (const name of names) {
    // Quest usually uses "LastName, FirstName"
    let lastName = "";
    let firstName = "";
    if (name.includes(",")) {
      const parts = name.split(",");
      lastName = parts[0].trim();
      firstName = parts[1].trim().split(" ")[0]; // Get first name only
    } else {
      lastName = name.split(" ").pop() || "";
      firstName = name.split(" ")[0];
    }

    const query = `
      query getProf($name_query: String) {
        prof(where: {name: {_ilike: $name_query}}) {
          name
          rating { liked clear engaging }
        }
      }
    `;

    try {
      const res = await fetch("https://uwflow.com/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
        body: JSON.stringify({
          operationName: "getProf",
          variables: { name_query: `%${lastName}%${firstName}%` },
          query,
        }),
      });

      const data = (await res.json()) as any;
      const prof = data?.data?.prof?.[0];
      if (prof && prof.rating) {
        scores.liked.push(prof.rating.liked ? prof.rating.liked * 100 : 80);
        scores.clear.push(prof.rating.clear ? prof.rating.clear * 100 : 80);
        scores.engaging.push(prof.rating.engaging ? prof.rating.engaging * 100 : 80);
      } else {
        scores.liked.push(80); scores.clear.push(80); scores.engaging.push(80);
      }
    } catch (e) {
      scores.liked.push(80); scores.clear.push(80); scores.engaging.push(80);
    }
  }

  return {
    liked: scores.liked.reduce((a, b) => a + b, 0) / scores.liked.length,
    clear: scores.clear.reduce((a, b) => a + b, 0) / scores.clear.length,
    engaging: scores.engaging.reduce((a, b) => a + b, 0) / scores.engaging.length,
  };
}

// --- SCORING LOGIC ---

export function calculateWorkloadScore(term: string, courses: any[]) {
  const TERM_MAP: any = { Fall: 1.2, Winter: 1.5, Spring: 1.0 };
  const TIME_MAP: any = { early: 1.5, late: 1.4, regular: 1.0 };
  const SPOT_MAP: any = { online: 0.7, onsite: 1.0 };
  const TYPE_MAP: any = { LEC: 1.0, TUT: 0.6, LAB: 0.8, Other: 0.8 };
  const COMMUTE_MAP: any = { impossible: 100, high: 40, low: 5, none: 0 };

  const termType = term.split(" ")[0];
  const termCoeff = TERM_MAP[termType] || 1.2;
  let totalScore = 0;

  courses.forEach((c) => {
    const lr = c.courseRatings || { liked: 80, easy: 80, useful: 80 };
    const pr = c.profRatings || { liked: 80, clear: 80, engaging: 80 };

    const lessonScore = (100 - (lr.liked || 80)) * 2 + (100 - (lr.easy || 80)) * 1 + (100 - (lr.useful || 80)) * 0.5;
    const profScore = (100 - (pr.liked || 80)) * 2 + (100 - (pr.clear || 80)) * 1 + (100 - (pr.engaging || 80)) * 0.5;

    let comVal = 0;
    if (!c.isOnline && c.commute && c.commute.length > 0) {
      comVal = Math.max(...c.commute.map((cm: any) => COMMUTE_MAP[cm.stress] || 0));
    }

    const isEarly = c.time.includes("08:30");
    const isLate = ["18:", "19:", "20:"].some((t) => c.time.includes(t));
    const tCoeff = isEarly ? TIME_MAP.early : isLate ? TIME_MAP.late : TIME_MAP.regular;
    const sCoeff = SPOT_MAP[c.isOnline ? "online" : "onsite"];
    const typeCoeff = TYPE_MAP[c.type] || 0.8;

    const courseWorkload = tCoeff * sCoeff * typeCoeff * (comVal + lessonScore + profScore);
    c.individualWorkload = Math.round(courseWorkload * 100) / 100;
    totalScore += courseWorkload;
  });

  return Math.round(termCoeff * totalScore * 100) / 100;
}

// --- RATINGS FETCHERS ---

export async function fetchUWFlowRatings(subjectCode: string, catalogNumber: string) {
  const code = `${subjectCode}${catalogNumber}`.toLowerCase().replace(/\s+/g, '');
  const url = "https://uwflow.com/graphql";
  const query = `
    query getCourse($code: String) {
      course(where: {code: {_eq: $code}}) {
        rating {
          liked
          easy
          useful
        }
      }
    }
  `;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
      body: JSON.stringify({ operationName: "getCourse", variables: { code }, query }),
    });
    const data = (await res.json()) as any;
    return data?.data?.course?.[0]?.rating || { liked: 80, easy: 80, useful: 80 };
  } catch (e) {
    return { liked: 80, easy: 80, useful: 80 };
  }
}
