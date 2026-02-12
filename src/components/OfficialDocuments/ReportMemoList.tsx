import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { Eye, FileCheck, Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, RotateCcw, CheckCircle } from 'lucide-react';
import { formatThaiDateShort } from '@/utils/dateUtils';

interface ReportMemoListProps {
  reportMemos: any[];
  onRefresh?: () => void;
  defaultCollapsed?: boolean;
}

const ReportMemoList: React.FC<ReportMemoListProps> = ({
  reportMemos = [],
  onRefresh,
  defaultCollapsed = false
}) => {
  const navigate = useNavigate();

  // State สำหรับ collapsible
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // State สำหรับการค้นหาและเรียง
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // State สำหรับ pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter and sort memos
  const filteredAndSortedMemos = useMemo(() => {
    let filtered = [...reportMemos];

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(memo =>
        memo.subject?.toLowerCase().includes(search) ||
        memo.author_name?.toLowerCase().includes(search) ||
        memo.doc_number?.toLowerCase().includes(search)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'subject':
          aValue = a.subject || '';
          bValue = b.subject || '';
          break;
        case 'doc_number':
          aValue = a.doc_number || '';
          bValue = b.doc_number || '';
          break;
        case 'created_at':
          aValue = new Date(a.created_at || 0).getTime();
          bValue = new Date(b.created_at || 0).getTime();
          break;
        case 'updated_at':
        default:
          aValue = new Date(a.updated_at || a.created_at || 0).getTime();
          bValue = new Date(b.updated_at || b.created_at || 0).getTime();
          break;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      } else {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
    });

    return filtered;
  }, [reportMemos, searchTerm, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedMemos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredAndSortedMemos.slice(startIndex, endIndex);

  // Reset page when data changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy, sortOrder, reportMemos.length]);

  // Handle view document
  const handleView = (memo: any) => {
    navigate('/document-detail', {
      state: {
        documentId: memo.id,
        documentType: 'memo'
      }
    });
  };

  // ถ้าไม่มี report memos ไม่ต้องแสดง
  if (!reportMemos.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader
        className={`bg-emerald-700 py-3 px-4 cursor-pointer hover:bg-emerald-800 transition-all ${isCollapsed ? 'rounded-lg' : 'rounded-t-lg'}`}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <FileCheck className="h-4 w-4 text-emerald-100" />
          เอกสารรายงานผล
          <Badge variant="secondary" className="ml-auto bg-emerald-800 text-white font-semibold px-2 py-1 rounded-full">
            {filteredAndSortedMemos.length > 0 ? `${filteredAndSortedMemos.length} รายการ` : 'ไม่มีเอกสาร'}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onRefresh?.(); }}
            disabled={!onRefresh}
            className="ml-2 p-1 h-8 w-8 text-white/70 hover:text-white disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <div className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-white/10 transition-colors">
            {isCollapsed ? (
              <ChevronDown className="h-5 w-5 text-white/70" />
            ) : (
              <ChevronUp className="h-5 w-5 text-white/70" />
            )}
          </div>
        </CardTitle>
        <div className="text-sm text-emerald-100 font-normal mt-1">
          {isCollapsed ? 'คลิกเพื่อแสดงรายการ' : 'รายงานผลที่ผ่านการลงนามเรียบร้อยแล้ว'}
        </div>
      </CardHeader>

      {!isCollapsed && (
        <>
          {/* ส่วนค้นหาและกรอง */}
          <div className="bg-card border-b border-border px-3 py-2">
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-foreground" />
                <Input
                  placeholder="ค้นหาเรื่อง, ผู้รายงาน..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-7 pr-3 py-1 text-xs h-8 border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 focus:border-emerald-500 focus:ring-emerald-500 focus:ring-1"
                />
              </div>

              <div className="w-24">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-8 text-xs border-border focus:border-emerald-500">
                    <SelectValue placeholder="เรียง" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updated_at">ล่าสุด</SelectItem>
                    <SelectItem value="created_at">วันที่สร้าง</SelectItem>
                    <SelectItem value="subject">ชื่อ</SelectItem>
                    <SelectItem value="doc_number">เลขที่</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="h-8 w-8 p-0 border-border hover:border-emerald-500 hover:text-emerald-700 dark:text-emerald-400"
                title={sortOrder === 'asc' ? 'เรียงจากน้อยไปมาก' : 'เรียงจากมากไปน้อย'}
              >
                <span className="text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
              </Button>

              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm('')}
                  className="h-8 w-8 p-0 text-foreground hover:text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                  title="ล้างตัวกรอง"
                >
                  <span className="text-sm">×</span>
                </Button>
              )}
            </div>

            {searchTerm && (
              <div className="text-[10px] text-foreground mt-1 text-center">
                แสดง {filteredAndSortedMemos.length} จาก {reportMemos.length} รายการ
              </div>
            )}
          </div>

          <CardContent className="p-3">
            <div className="flex flex-col gap-2">
              {currentPageData.length > 0 ? (
                currentPageData.map((memo) => (
                  <div
                    key={memo.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 border rounded-lg px-2 sm:px-3 py-2 shadow-sm transition group min-w-0 bg-muted dark:bg-background/80 border-border hover:bg-accent dark:hover:bg-card/80"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <FileCheck className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                      <span
                        className="font-medium truncate max-w-[120px] sm:max-w-[200px] sm:text-base text-sm text-emerald-700 dark:text-emerald-300 group-hover:text-emerald-800"
                        title={memo.subject}
                      >
                        {memo.subject}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {(memo.author_name || '-').split(' ')[0]}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatThaiDateShort(memo.created_at)}
                      </span>
                      {memo.doc_number && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          #{memo.doc_number.split('/')[0]}
                        </span>
                      )}
                      {/* Status Badge - always completed */}
                      <span
                        style={{
                          background: '#16a34a',
                          color: '#fff',
                          borderRadius: '9999px',
                          padding: '2px 8px',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          lineHeight: 1
                        }}
                      >
                        <CheckCircle className="h-3 w-3" />
                        เสร็จสิ้น
                      </span>
                    </div>

                    {/* Action Button */}
                    <div className="flex gap-1 ml-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 flex items-center gap-1 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                        onClick={() => handleView(memo)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-emerald-300">
                  <FileCheck className="h-8 w-8 mx-auto mb-2 text-emerald-300" />
                  <p className="text-sm">ไม่พบเอกสารรายงานผล</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 mt-3 -mx-3 -mb-3 rounded-b-lg">
                <div className="text-xs text-muted-foreground">
                  แสดง {startIndex + 1}-{Math.min(endIndex, filteredAndSortedMemos.length)} จาก {filteredAndSortedMemos.length} รายการ
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 border-emerald-300 dark:border-emerald-800"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <span className="text-xs text-muted-foreground px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 border-emerald-300 dark:border-emerald-800"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </>
      )}
    </Card>
  );
};

export default ReportMemoList;
