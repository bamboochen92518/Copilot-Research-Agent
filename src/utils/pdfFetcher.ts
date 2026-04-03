import axios from 'axios';
import logger from './logger';

// pdf-parse is a CJS-only package with no reliable ESM/TS call signature.
// Using require() is the safest interop path and matches what the package docs recommend.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (
  buffer: Buffer,
  options?: Record<string, unknown>,
) => Promise<{ text: string }>;

/**
 * Downloads a PDF from the given URL and extracts its plain text.
 * Returns null if the URL is missing, the download fails, or the PDF cannot be parsed.
 * Always resolves (never throws) so callers can gracefully fall back to the abstract.
 */
export async function fetchPdfText(pdfUrl: string | undefined): Promise<string | null> {
  if (!pdfUrl) return null;

  try {
    const response = await axios.get<ArrayBuffer>(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: 20_000,
      headers: {
        // Polite identification; some servers block unknown agents
        'User-Agent': 'CopilotResearchAgent/1.0 (academic-paper-bot)',
      },
      maxContentLength: 10 * 1024 * 1024, // 10 MB cap
    });

    const buffer = Buffer.from(response.data);
    const result = await pdfParse(buffer);

    const text = result.text.replace(/\s+/g, ' ').trim();
    if (!text) return null;

    logger.debug(`Extracted ${text.length} chars from PDF: ${pdfUrl}`);
    return text;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`PDF fetch/parse failed (falling back to abstract): ${msg}`, { url: pdfUrl });
    return null;
  }
}
