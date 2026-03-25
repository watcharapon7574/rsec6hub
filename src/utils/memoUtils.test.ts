import { describe, it, expect } from 'vitest';
import {
  getDocumentManageRoute,
  getDocumentEditRoute,
  isPDFUploadMemo,
} from './memoUtils';

describe('isPDFUploadMemo', () => {
  it('pdf_upload memo → true', () => {
    expect(isPDFUploadMemo({ form_data: { type: 'pdf_upload' } })).toBe(true);
  });

  it('create_memo → false', () => {
    expect(isPDFUploadMemo({ form_data: {} })).toBe(false);
  });
});

describe('getDocumentManageRoute', () => {
  it('doc_receive → pdf-receive-manage', () => {
    const memo = { __source_table: 'doc_receive' };
    expect(getDocumentManageRoute(memo, 'abc')).toBe('/pdf-receive-manage/abc');
  });

  it('pdf_upload memo → pdf-document-manage', () => {
    const memo = { form_data: { type: 'pdf_upload' } };
    expect(getDocumentManageRoute(memo, 'abc')).toBe('/pdf-document-manage/abc');
  });

  it('create_memo → document-manage', () => {
    const memo = { form_data: {} };
    expect(getDocumentManageRoute(memo, 'abc')).toBe('/document-manage/abc');
  });
});

describe('getDocumentEditRoute', () => {
  it('doc_receive rejected → create-doc-receive?edit=', () => {
    const memo = { __source_table: 'doc_receive', status: 'rejected' };
    expect(getDocumentEditRoute(memo, 'abc')).toBe('/create-doc-receive?edit=abc');
  });

  it('doc_receive ไม่ rejected → edit-doc-receive', () => {
    const memo = { __source_table: 'doc_receive', status: 'pending' };
    expect(getDocumentEditRoute(memo, 'abc')).toBe('/edit-doc-receive/abc');
  });

  it('memo ปกติ → create-memo?edit=', () => {
    const memo = { form_data: {} };
    expect(getDocumentEditRoute(memo, 'abc')).toBe('/create-memo?edit=abc');
  });
});
