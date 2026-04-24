import { db, postsTable } from "../../packages/db/src/index.ts";
import { eq, and, isNull } from "drizzle-orm";

async function main() {
  const suspiciousPosts = await db.select().from(postsTable).where(
    and(eq(postsTable.isAnonymous, true), isNull(postsTable.authorId))
  );
  console.log("Anonymous posts with NULL authorId:", JSON.stringify(suspiciousPosts, null, 2));
  
  const allAnonymous = await db.select().from(postsTable).where(
    eq(postsTable.isAnonymous, true)
  );
  console.log("All anonymous posts:", JSON.stringify(allAnonymous, null, 2));
  
  process.exit(0);
}

main().catch(console.error);
