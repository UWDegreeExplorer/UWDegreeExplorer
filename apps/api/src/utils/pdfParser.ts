import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pdf = require('pdf-parse');
if (typeof pdf !== 'function' && pdf.default) {
  pdf = pdf.default;
}

/**
 * Extracts text from a PDF buffer using pdf-parse.
 * Using createRequire to safely load the CommonJS pdf-parse module in an ESM environment,
 * bypassing TypeScript's default export resolution issues.
 */
export async function parsePdfText(buffer: Buffer): Promise<string> {
  try {
    // pdf-parse options
    const options = {
      // Custom pagerender to ensure we get spaces between items and consistent ordering
      pagerender: (pageData: any) => {
        return pageData.getTextContent().then((textContent: any) => {
          let lastY, text = '';
          
          // Sort items by vertical position (top to bottom) and then horizontal position (left to right)
          const items = textContent.items.sort((a: any, b: any) => {
            if (Math.abs(a.transform[5] - b.transform[5]) > 2) {
              return b.transform[5] - a.transform[5]; // Top to bottom
            }
            return a.transform[4] - b.transform[4]; // Left to right
          });

          for (let item of items) {
            if (lastY !== item.transform[5] || !lastY) {
              text += '\n';
            }
            text += item.str + ' ';
            lastY = item.transform[5];
          }
          return text;
        });
      }
    };

    const data = await pdf(buffer, options);
    return data.text;
  } catch (error) {
    console.error("PDF Parsing Detailed Error:", error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}
