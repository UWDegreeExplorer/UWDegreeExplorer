import { db } from './packages/db/src/index.ts';
import { degreeRequirements } from './packages/db/src/schema.ts';

async function main() {
  const all = await db.select({ slug: degreeRequirements.slug, label: degreeRequirements.label }).from(degreeRequirements);
  console.log("Programs in DB:", all);
  
  for (const prog of all) {
     const [row] = await db.select().from(degreeRequirements).where({ slug: prog.slug });
     const rules = row.rules as any[];
     console.log(`Program: ${prog.slug}, First rule name: ${rules[0]?.name}`);
  }
}
main();
