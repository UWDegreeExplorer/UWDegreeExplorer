import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Cleanly extracts text from a PDF buffer using Mozilla's pdf.js.
 * This replaces the buggy pdf-parse library.
 */
export async function parsePdfText(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
  });
  
  const pdf = await loadingTask.promise;
  let fullText = "";
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Sort items by vertical position (top to bottom) and then horizontal position (left to right)
    // transform[5] is vertical (y), transform[4] is horizontal (x)
    const items = (textContent.items as any[]).sort((a, b) => {
      if (Math.abs(a.transform[5] - b.transform[5]) > 2) {
        return b.transform[5] - a.transform[5]; // Top to bottom
      }
      return a.transform[4] - b.transform[4]; // Left to right
    });

    const pageText = items
      .map((item: any) => item.str)
      .join(" ");
    fullText += pageText + "\n";
  }
  
  return fullText;
}
