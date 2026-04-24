import { db, postsTable } from "../packages/db/src/index.ts";
import { eq } from "drizzle-orm";

async function main() {
  const allPosts = await db.select().from(postsTable);
  console.log("All posts:", JSON.stringify(allPosts, null, 2));
  process.exit(0);
}

main().catch(console.error);
