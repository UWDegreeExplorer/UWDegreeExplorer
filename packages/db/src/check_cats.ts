import { db } from "./index";
import { subjectBreadth } from "./schema";

async function checkCategories() {
  const categories = await db.select().from(subjectBreadth);
  const uniqueCategories = [...new Set(categories.map(c => c.category))];
  console.log("Unique categories in DB:", uniqueCategories);
  process.exit(0);
}

checkCategories().catch(err => {
  console.error(err);
  process.exit(1);
});
