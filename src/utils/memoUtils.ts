// Utility functions for memo operations

/**
 * Determines if a memo was created from PDF upload or from create memo form
 * @param memo - The memo object with form_data
 * @returns 'pdf_upload' | 'create_memo'
 */
export const getMemoSourceType = (memo: any): 'pdf_upload' | 'create_memo' => {
  // Check if form_data exists and has type field
  if (memo?.form_data && typeof memo.form_data === 'object') {
    // If form_data has type field set to 'pdf_upload'
    if (memo.form_data.type === 'pdf_upload') {
      return 'pdf_upload';
    }
  }
  
  // Default to create_memo for backwards compatibility and standard memo forms
  return 'create_memo';
};

/**
 * Gets the appropriate document management route based on memo source
 * @param memo - The memo object
 * @param memoId - The memo ID
 * @returns The route path for document management
 */
export const getDocumentManageRoute = (memo: any, memoId: string): string => {
  // Check if this is from doc_receive table (marked with __source_table)
  if (memo?.__source_table === 'doc_receive') {
    return `/pdf-receive-manage/${memoId}`;
  }

  const sourceType = getMemoSourceType(memo);

  if (sourceType === 'pdf_upload') {
    return `/pdf-document-manage/${memoId}`;
  }

  return `/document-manage/${memoId}`;
};

/**
 * Checks if memo is from PDF upload
 * @param memo - The memo object
 * @returns boolean
 */
export const isPDFUploadMemo = (memo: any): boolean => {
  return getMemoSourceType(memo) === 'pdf_upload';
};

/**
 * Checks if memo is from create memo form
 * @param memo - The memo object
 * @returns boolean
 */
export const isCreateMemoForm = (memo: any): boolean => {
  return getMemoSourceType(memo) === 'create_memo';
};

/**
 * Gets the appropriate edit route based on memo source
 * @param memo - The memo object
 * @param memoId - The memo ID
 * @returns The route path for editing the document
 */
export const getDocumentEditRoute = (memo: any, memoId: string): string => {
  // Check if this is from doc_receive table (marked with __source_table)
  if (memo?.__source_table === 'doc_receive') {
    // ถ้าถูกตีกลับ → ไปหน้า re-upload เพื่อ reset status/signer_order
    if (memo.status === 'rejected') {
      return `/create-doc-receive?edit=${memoId}`;
    }
    return `/edit-doc-receive/${memoId}`;
  }

  // For regular memos, use the create-memo page with edit parameter
  return `/create-memo?edit=${memoId}`;
};