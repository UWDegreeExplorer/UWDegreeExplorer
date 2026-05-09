import { readFileSync } from 'fs';
import { parsePdfText } from './apps/api/src/utils/pdfParser.ts';

async function main() {
  const buf = readFileSync('/Users/kaius/Project/UWDegreeExplorer/apps/web/src/features/planner/SSR_TSRPT.pdf');
  try {
    const text = await parsePdfText(buf);
    console.log("--- Extracted Text ---");
    console.log(text);
    console.log("----------------------");
    
    // The same regex as in planner.ts
    const regex = /\b([A-Z]{2,10})\s+(\d{1,3}[A-Z]?)\b/g;
    let match;
    const coursesFound = [];
    while ((match = regex.exec(text)) !== null) {
      coursesFound.push(`${match[1]} ${match[2]}`);
    }
    console.log("Courses found:", coursesFound);
  } catch (e) {
    console.error("Error:", e);
  }
}
main();
