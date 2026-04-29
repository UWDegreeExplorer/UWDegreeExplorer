import { db } from "./index";
import { programs } from "./schema/planner";
import fs from "fs";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = path.join(__dirname, "../data/uwaterloo_programs_list.csv");

async function seed() {
  console.log("Reading CSV from:", csvPath);
  if (!fs.existsSync(csvPath)) {
    console.error("CSV file not found!");
    return;
  }

  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split("\n");
  
  const data = [];
  let idCounter = 1000;

  // Skip header (line 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Use a regex to correctly split CSV while respecting quotes
    // Matches: category, programName
    const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    
    if (!parts || parts.length < 2) {
      // Fallback for lines that might fail regex (very rare in this CSV)
      continue;
    }

    const category = parts[0].replace(/^"|"$/g, "").trim();
    const name = parts[1].replace(/^"|"$/g, "").trim();

    data.push({
      id: (idCounter++).toString(),
      name,
      category,
    });
  }

  console.log(`Parsed ${data.length} programs. Starting database insertion...`);

  const chunkSize = 100;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    await db.insert(programs).values(chunk).onConflictDoNothing();
    console.log(`Inserted programs ${i} to ${Math.min(i + chunkSize, data.length)}`);
  }

  console.log("Seeding finished successfully!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
