import { db } from "./index";
import { subjectBreadth } from "./schema";

async function checkCategories() {
  const all = await db.select().from(subjectBreadth);
  const counts: Record<string, number> = {};
  all.forEach(c => {
    if (c.category) {
      counts[c.category] = (counts[c.category] || 0) + 1;
    }
  });
  console.log("Category counts:", counts);
  process.exit(0);
}

checkCategories().catch(err => {
  console.error(err);
  process.exit(1);
});
