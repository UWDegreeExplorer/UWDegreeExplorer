import { db, usersTable } from "./index";
import bcrypt from "bcryptjs";

const chineseNames = [
  { display: "张伟", user: "zhangwei" },
  { display: "王芳", user: "wangfang" },
  { display: "李静", user: "lijing" },
  { display: "刘洋", user: "liuyang" },
  { display: "陈洁", user: "chenjie" },
  { display: "赵敏", user: "zhaomin" },
  { display: "周强", user: "zhouqiang" },
  { display: "徐磊", user: "xulei" },
  { display: "孙悦", user: "sunyue" },
  { display: "朱军", user: "zhujun" },
];

async function seed() {
  console.log("Seeding test users...");
  const passwordHash = await bcrypt.hash("password123", 10);

  for (const name of chineseNames) {
    try {
      await db.insert(usersTable).values({
        username: name.user,
        displayName: name.display,
        email: `${name.user}@example.com`,
        passwordHash,
        status: "active",
      });
      console.log(`Created user: ${name.display} (${name.user})`);
    } catch (e: any) {
      if (e.code === '23505') {
        console.log(`User ${name.user} already exists, skipping.`);
      } else {
        console.error(`Error creating user ${name.user}:`, e);
      }
    }
  }
  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
