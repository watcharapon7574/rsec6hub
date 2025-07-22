-- เพิ่มคอลัมน์สำหรับเก็บสรุปเนื้อหาเอกสาร
ALTER TABLE memos 
ADD COLUMN document_summary TEXT;

-- เพิ่มคอมเมนต์อธิบายคอลัมน์
COMMENT ON COLUMN memos.document_summary IS 'สรุปเนื้อหาของเอกสาร เพื่อให้ผู้ลงนามเข้าใจเบื้องต้น';

-- สร้าง RPC function สำหรับอัปเดต document summary
CREATE OR REPLACE FUNCTION update_memo_summary(memo_id UUID, summary TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE memos 
  SET document_summary = summary,
      updated_at = NOW()
  WHERE id = memo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
