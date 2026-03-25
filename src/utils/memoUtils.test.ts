import { describe, it, expect } from 'vitest';
import {
  getMemoSourceType,
  getDocumentManageRoute,
  getDocumentEditRoute,
  isPDFUploadMemo,
  isCreateMemoForm,
} from './memoUtils';

describe('getMemoSourceType', () => {
  it('form_data.type = pdf_upload → pdf_upload', () => {
    expect(getMemoSourceType({ form_data: { type: 'pdf_upload' } })).toBe('pdf_upload');
  });

  it('form_data ว่าง → create_memo', () => {
    expect(getMemoSourceType({ form_data: {} })).toBe('create_memo');
  });

  it('ไม่มี form_data → create_memo', () => {
    expect(getMemoSourceType({})).toBe('create_memo');
  });

  it('null → create_memo', () => {
    expect(getMemoSourceType(null)).toBe('create_memo');
  });

  it('undefined → create_memo', () => {
    expect(getMemoSourceType(undefined)).toBe('create_memo');
  });
});

describe('isPDFUploadMemo / isCreateMemoForm', () => {
  it('pdf_upload memo', () => {
    const memo = { form_data: { type: 'pdf_upload' } };
    expect(isPDFUploadMemo(memo)).toBe(true);
    expect(isCreateMemoForm(memo)).toBe(false);
  });

  it('create_memo form', () => {
    const memo = { form_data: {} };
    expect(isPDFUploadMemo(memo)).toBe(false);
    expect(isCreateMemoForm(memo)).toBe(true);
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
