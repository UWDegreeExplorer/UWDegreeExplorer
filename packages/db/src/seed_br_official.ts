import { db } from "./index";
import { subjectBreadth } from "./schema";
import { eq } from "drizzle-orm";

const DATA = {
  "Humanities": [
    "CHINA", "CLAS", "CMW", "COMMST", "CROAT", "DAC", "DUTCH", "EASIA", "ENGL", "FINE", 
    "FR", "GER", "GRK", "HIST", "HUMSC", "ITAL", "ITALST", "JAPAN", "JS", "KOREA", 
    "LAT", "MEDVL", "MUSIC", "PHIL", "PORT", "RCS", "REES", "RUSS", "SI", "SPAN", 
    "THPERF", "VCULT"
  ],
  "Pure Sciences": [
    "BIOL", "CHEM", "EARTH", "PHYS", "SCI"
  ],
  "Pure and Applied Sciences": [
    "BIOL", "CHEM", "EARTH", "ENVS", "ERS", "HEALTH", "KIN", "MNS", "PHYS", "PLAN", "SCI"
  ],
  "Social Sciences": [
    "AFM", "ANTH", "APPLS", "ARBUS", "BET", "BUS", "COMM", "ECON", "ENBUS", "GEOG", 
    "GSJ", "HRM", "INDEV", "INDG", "INTST", "LS", "MSE", "PACS", "PSCI", "PSYCH", 
    "REC", "SDS", "SRF", "SOC", "SOCWK", "STV"
  ]
};

async function seedCorrectBR() {
  console.log("Clearing old BR data...");
  await db.delete(subjectBreadth);

  console.log("Seeding new BR data...");
  const records = [];
  for (const [category, subjects] of Object.entries(DATA)) {
    for (const subjectCode of subjects) {
      records.push({
        subjectCode,
        category
      });
    }
  }

  await db.insert(subjectBreadth).values(records);
  console.log(`Seeded ${records.length} records across 4 categories.`);
  process.exit(0);
}

seedCorrectBR().catch(err => {
  console.error(err);
  process.exit(1);
});
