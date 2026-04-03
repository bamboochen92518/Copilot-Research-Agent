// jest.mock calls are hoisted before imports by Jest's transform, so the factories
// run before pdfFetcher.ts is loaded and capture the mock functions correctly.
jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('pdf-parse', () => jest.fn());

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import axios from 'axios';
import { fetchPdfText } from '../../src/utils/pdfFetcher';

// Typed references to the mocked functions
const axiosGet = axios.get as jest.Mock;
const pdfParseMock = jest.requireMock<jest.Mock>('pdf-parse');

// ─── fetchPdfText ─────────────────────────────────────────────────────────────

describe('fetchPdfText', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null immediately when pdfUrl is undefined', async () => {
    const result = await fetchPdfText(undefined);

    expect(result).toBeNull();
    expect(axiosGet).not.toHaveBeenCalled();
  });

  it('downloads the PDF and returns extracted plain text', async () => {
    const fakeData = Buffer.from('fake pdf bytes');
    axiosGet.mockResolvedValue({ data: fakeData });
    pdfParseMock.mockResolvedValue({ text: '  Hello   World  ' });

    const result = await fetchPdfText('https://example.com/paper.pdf');

    expect(result).toBe('Hello World');
    expect(axiosGet).toHaveBeenCalledWith(
      'https://example.com/paper.pdf',
      expect.objectContaining({ responseType: 'arraybuffer', timeout: 20_000 }),
    );
    expect(pdfParseMock).toHaveBeenCalledWith(
      expect.any(Buffer),
      /* no extra options asserted */
    );
  });

  it('returns null when axios.get throws a network error', async () => {
    axiosGet.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await fetchPdfText('https://example.com/paper.pdf');

    expect(result).toBeNull();
  });

  it('returns null when pdf-parse throws on a malformed PDF', async () => {
    axiosGet.mockResolvedValue({ data: Buffer.from('not a pdf') });
    pdfParseMock.mockRejectedValue(new Error('Invalid PDF structure'));

    const result = await fetchPdfText('https://example.com/paper.pdf');

    expect(result).toBeNull();
  });

  it('returns null when extracted text is empty after whitespace normalisation', async () => {
    axiosGet.mockResolvedValue({ data: Buffer.from('blank') });
    pdfParseMock.mockResolvedValue({ text: '   \n\n\t   \r\n   ' });

    const result = await fetchPdfText('https://example.com/paper.pdf');

    expect(result).toBeNull();
  });

  it('includes the User-Agent header in the request', async () => {
    axiosGet.mockResolvedValue({ data: Buffer.from('x') });
    pdfParseMock.mockResolvedValue({ text: 'content' });

    await fetchPdfText('https://example.com/paper.pdf');

    expect(axiosGet).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'User-Agent': expect.stringContaining('CopilotResearchAgent') }),
      }),
    );
  });
});
