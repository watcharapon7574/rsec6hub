import { describe, it, expect } from 'vitest';
import { RAILWAY_PDF_API } from './railwayFetch';

describe('railwayFetch', () => {
  it('RAILWAY_PDF_API constant is correct', () => {
    expect(RAILWAY_PDF_API).toBe('https://pdf-memo-docx-production-25de.up.railway.app');
  });

  it('RAILWAY_PDF_API does not have trailing slash', () => {
    expect(RAILWAY_PDF_API.endsWith('/')).toBe(false);
  });
});
