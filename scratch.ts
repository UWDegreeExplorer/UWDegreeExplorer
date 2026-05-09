import { readFileSync } from 'fs';
import { parsePdfText } from './apps/api/src/utils/pdfParser.ts';

async function main() {
  const buf = readFileSync('/Users/kaius/Project/UWDegreeExplorer/SSR_TSRPT.pdf');
  try {
    const text = await parsePdfText(buf);
    console.log("Extracted text length:", text.length);
    console.log("Preview:", text.substring(0, 500));
    
    const regex = /([A-Z]{2,10})\s+(\d{3}[A-Z]?)/g;
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
