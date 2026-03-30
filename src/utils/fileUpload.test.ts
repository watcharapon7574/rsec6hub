import { describe, it, expect } from 'vitest';
import { extractPdfUrl } from './fileUpload';

describe('extractPdfUrl', () => {
  // === Valid URLs ===

  it('HTTPS URL → return as-is', () => {
    const url = 'https://storage.supabase.co/bucket/file.pdf';
    expect(extractPdfUrl(url)).toBe(url);
  });

  it('HTTP URL → return as-is', () => {
    const url = 'http://example.com/file.pdf';
    expect(extractPdfUrl(url)).toBe(url);
  });

  it('URL with query params → return as-is', () => {
    const url = 'https://storage.supabase.co/bucket/file.pdf?token=abc123';
    expect(extractPdfUrl(url)).toBe(url);
  });

  // === JSON string ===

  it('JSON string with url field → extract URL', () => {
    const json = JSON.stringify({ url: 'https://example.com/file.pdf' });
    expect(extractPdfUrl(json)).toBe('https://example.com/file.pdf');
  });

  it('JSON string without url field → null', () => {
    const json = JSON.stringify({ path: '/some/path' });
    expect(extractPdfUrl(json)).toBe(null);
  });

  // === Falsy values ===

  it('null → null', () => {
    expect(extractPdfUrl(null)).toBe(null);
  });

  it('undefined → null', () => {
    expect(extractPdfUrl(undefined)).toBe(null);
  });

  it('empty string → null', () => {
    expect(extractPdfUrl('')).toBe(null);
  });

  // === Malformed inputs ===

  it('relative path → null', () => {
    expect(extractPdfUrl('/bucket/file.pdf')).toBe(null);
  });

  it('plain text (not URL, not JSON) → null', () => {
    expect(extractPdfUrl('just some text')).toBe(null);
  });

  it('number as string → null', () => {
    expect(extractPdfUrl('12345')).toBe(null);
  });
});
