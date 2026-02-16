import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2, ExternalLink, ChevronLeft, ChevronRight,
  Save, X, Pencil, ArrowUpDown, Search, FileText, PenLine, Hash, FileSpreadsheet, CalendarRange
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export interface RegisterEntry {
  source_id: string;
  source_type: 'memo' | 'doc_receive' | 'manual';
  register_number: number;
  doc_reference: string;
  doc_date: string;
  from_org: string;
  to_person: string;
  subject: string;
  action_taken: string;
  remarks: string;
  extra_id: string | null;
  doc_number: string | null;
}

interface RegisterTableProps {
  viewName: 'register_internal_view' | 'register_external_view';
  onDataChange?: () => void;
}

const ITEMS_PER_PAGE = 20;
const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

type SourceFilter = 'all' | 'memo' | 'doc_receive' | 'manual';

const RegisterTable: React.FC<RegisterTableProps> = ({
  viewName,
  onDataChange,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState<RegisterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortAsc, setSortAsc] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ action_taken: '', remarks: '' });
  const [saving, setSaving] = useState(false);

  // Year filter
  const currentBuddhistYear = new Date().getFullYear() + 543;
  const [selectedYear, setSelectedYear] = useState(currentBuddhistYear);
  const yearShort = selectedYear.toString().slice(-2);

  // Month range filter (0 = ทั้งปี, 1-12 = ม.ค.-ธ.ค.)
  const [monthFrom, setMonthFrom] = useState(0);
  const [monthTo, setMonthTo] = useState(0);

  const isInternal = viewName === 'register_internal_view';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows, error } = await (supabase as any)
        .from(viewName)
        .select('*')
        .like('doc_number', `%/${yearShort}`)
        .order('register_number', { ascending: false });

      if (error) throw error;
      setData((rows as RegisterEntry[]) || []);
    } catch (err: any) {
      console.error('Error fetching register data:', err);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลดข้อมูลทะเบียนได้',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [viewName, yearShort, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Stats
  const stats = useMemo(() => {
    const systemType = isInternal ? 'memo' : 'doc_receive';
    const fromSystem = data.filter((d) => d.source_type === systemType).length;
    const manual = data.filter((d) => d.source_type === 'manual').length;
    return { total: data.length, fromSystem, manual };
  }, [data, isInternal]);

  // Filter + sort
  const filteredData = useMemo(() => {
    let result = data;

    if (sourceFilter !== 'all') {
      result = result.filter((item) => item.source_type === sourceFilter);
    }

    // Month range filter
    if (monthFrom > 0) {
      const mTo = monthTo > 0 ? monthTo : monthFrom;
      result = result.filter((item) => {
        if (!item.doc_date) return false;
        const month = new Date(item.doc_date).getMonth() + 1; // 1-12
        return month >= monthFrom && month <= mTo;
      });
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (item) =>
          item.subject?.toLowerCase().includes(q) ||
          item.from_org?.toLowerCase().includes(q) ||
          item.doc_reference?.toLowerCase().includes(q) ||
          item.doc_number?.toLowerCase().includes(q) ||
          String(item.register_number).includes(q)
      );
    }

    return [...result].sort((a, b) =>
      sortAsc
        ? a.register_number - b.register_number
        : b.register_number - a.register_number
    );
  }, [data, searchTerm, sortAsc, sourceFilter, monthFrom, monthTo]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentData = filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedYear, sourceFilter, monthFrom, monthTo]);

  const formatThaiDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
    });
  };

  const startEdit = (entry: RegisterEntry) => {
    const editKey = entry.extra_id || entry.source_id;
    setEditingId(editKey);
    setEditValues({
      action_taken: entry.action_taken || '',
      remarks: entry.remarks || '',
    });
  };

  const saveEdit = async (entry: RegisterEntry) => {
    setSaving(true);
    try {
      if (entry.source_type === 'manual') {
        const { error } = await (supabase as any)
          .from('document_register_manual')
          .update({
            action_taken: editValues.action_taken,
            remarks: editValues.remarks,
          })
          .eq('id', entry.source_id);
        if (error) throw error;
      } else if (entry.extra_id) {
        const { error } = await (supabase as any)
          .from('document_register_extra')
          .update({
            action_taken: editValues.action_taken,
            remarks: editValues.remarks,
          })
          .eq('id', entry.extra_id);
        if (error) throw error;
      }

      toast({ title: 'บันทึกสำเร็จ' });
      setEditingId(null);
      fetchData();
      onDataChange?.();
    } catch (err: any) {
      console.error('Error saving:', err);
      toast({
        title: 'บันทึกไม่สำเร็จ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => setEditingId(null);

  const getEditKey = (entry: RegisterEntry) => entry.extra_id || entry.source_id;

  const exportToExcel = () => {
    const exportData = filteredData
      .sort((a, b) => a.register_number - b.register_number)
      .map((entry) => ({
        'ลำดับที่': entry.register_number,
        'เลขทะเบียนรับ': entry.doc_number || '',
        'ที่': entry.doc_reference || '',
        'ลงวันที่': entry.doc_date
          ? new Date(entry.doc_date).toLocaleDateString('th-TH', {
              day: 'numeric',
              month: 'short',
              year: '2-digit',
            })
          : '',
        'จาก': entry.from_org || '',
        'ถึง': entry.to_person || '',
        'เรื่อง': entry.subject || '',
        'การปฏิบัติ': entry.action_taken || '',
        'หมายเหตุ': entry.remarks || '',
      }));

    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    ws['!cols'] = [
      { wch: 8 },   // ลำดับที่
      { wch: 16 },  // เลขทะเบียนรับ
      { wch: 20 },  // ที่
      { wch: 14 },  // ลงวันที่
      { wch: 20 },  // จาก
      { wch: 20 },  // ถึง
      { wch: 40 },  // เรื่อง
      { wch: 20 },  // การปฏิบัติ
      { wch: 20 },  // หมายเหตุ
    ];

    const wb = XLSX.utils.book_new();
    const sheetName = isInternal ? 'ทะเบียนรับภายใน' : 'ทะเบียนรับภายนอก';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const monthSuffix = monthFrom > 0
      ? `_${THAI_MONTHS[monthFrom - 1]}${monthTo > 0 && monthTo !== monthFrom ? `-${THAI_MONTHS[monthTo - 1]}` : ''}`
      : '';
    const fileName = `${sheetName}_${selectedYear}${monthSuffix}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast({ title: 'ส่งออกสำเร็จ', description: `ไฟล์ ${fileName}` });
  };

  const viewDocument = (entry: RegisterEntry) => {
    const docType = entry.source_type === 'memo' ? 'memo' : 'doc_receive';
    navigate('/document-detail', {
      state: { documentId: entry.source_id, documentType: docType },
    });
  };

  const getSourceBadge = (type: string) => {
    if (type === 'memo') {
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 text-[10px] px-1.5">
          <FileText className="h-2.5 w-2.5 mr-0.5" />
          ระบบ
        </Badge>
      );
    }
    if (type === 'doc_receive') {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 text-[10px] px-1.5">
          <FileText className="h-2.5 w-2.5 mr-0.5" />
          ระบบ
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 text-[10px] px-1.5">
        <PenLine className="h-2.5 w-2.5 mr-0.5" />
        Manual
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">กำลังโหลดข้อมูลทะเบียน...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSourceFilter('all')}>
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">ทั้งหมด</p>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            </div>
            <div className={`p-2 rounded-lg ${isInternal ? 'bg-orange-100 dark:bg-orange-900/40' : 'bg-purple-100 dark:bg-purple-900/40'}`}>
              <Hash className={`h-5 w-5 ${isInternal ? 'text-orange-600 dark:text-orange-400' : 'text-purple-600 dark:text-purple-400'}`} />
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSourceFilter(isInternal ? 'memo' : 'doc_receive')}>
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">จากระบบ</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.fromSystem}</p>
            </div>
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSourceFilter('manual')}>
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">เพิ่มเอง</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.manual}</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40">
              <PenLine className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหา (เรื่อง, จาก, เลขที่)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
          className="border border-border rounded-lg px-3 py-2 bg-background text-sm min-w-[130px]"
        >
          <option value="all">ทั้งหมด</option>
          <option value={isInternal ? 'memo' : 'doc_receive'}>
            {isInternal ? 'จากระบบ (Memo)' : 'จากระบบ (หนังสือรับ)'}
          </option>
          <option value="manual">เพิ่มเอง (Manual)</option>
        </select>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="border border-border rounded-lg px-3 py-2 bg-background text-sm min-w-[120px]"
        >
          {[0, 1, 2].map((offset) => {
            const y = currentBuddhistYear - offset;
            return (
              <option key={y} value={y}>
                พ.ศ. {y}
              </option>
            );
          })}
        </select>
      </div>

      {/* Month range filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarRange className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">เดือน:</span>
        <select
          value={monthFrom}
          onChange={(e) => {
            const val = Number(e.target.value);
            setMonthFrom(val);
            if (val === 0) setMonthTo(0);
            else if (monthTo > 0 && monthTo < val) setMonthTo(val);
          }}
          className="border border-border rounded-lg px-2 py-1.5 bg-background text-sm min-w-[90px]"
        >
          <option value={0}>ทั้งปี</option>
          {THAI_MONTHS.map((name, i) => (
            <option key={i + 1} value={i + 1}>{name}</option>
          ))}
        </select>
        {monthFrom > 0 && (
          <>
            <span className="text-xs text-muted-foreground">ถึง</span>
            <select
              value={monthTo || monthFrom}
              onChange={(e) => setMonthTo(Number(e.target.value))}
              className="border border-border rounded-lg px-2 py-1.5 bg-background text-sm min-w-[90px]"
            >
              {THAI_MONTHS.slice(monthFrom - 1).map((name, i) => (
                <option key={monthFrom + i} value={monthFrom + i}>{name}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredData.length} รายการ
          {filteredData.length > ITEMS_PER_PAGE &&
            ` (แสดง ${startIndex + 1}-${Math.min(startIndex + ITEMS_PER_PAGE, filteredData.length)})`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 h-7 border-green-300 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950"
            onClick={exportToExcel}
            disabled={filteredData.length === 0}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export Excel
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1 h-7"
            onClick={() => setSortAsc((v) => !v)}
          >
            <ArrowUpDown className="h-3 w-3" />
            {sortAsc ? 'เก่า → ใหม่' : 'ใหม่ → เก่า'}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[60px] text-center text-xs font-semibold">ลำดับ</TableHead>
              <TableHead className="min-w-[160px] text-xs font-semibold">เลขที่หนังสือ</TableHead>
              <TableHead className="w-[90px] text-xs font-semibold">ลงวันที่</TableHead>
              <TableHead className="min-w-[100px] text-xs font-semibold">จาก</TableHead>
              <TableHead className="min-w-[100px] text-xs font-semibold">ถึง</TableHead>
              <TableHead className="min-w-[160px] text-xs font-semibold">เรื่อง</TableHead>
              <TableHead className="min-w-[100px] text-xs font-semibold">การปฏิบัติ</TableHead>
              <TableHead className="min-w-[100px] text-xs font-semibold">หมายเหตุ</TableHead>
              <TableHead className="w-[60px] text-center text-xs font-semibold">ดู</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FileText className="h-10 w-10 opacity-30" />
                    <p className="font-medium">ไม่มีข้อมูล</p>
                    <p className="text-xs">ยังไม่มีรายการทะเบียนในปีนี้</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              currentData.map((entry) => {
                const isEditing = editingId === getEditKey(entry);
                return (
                  <TableRow
                    key={`${entry.source_type}-${entry.source_id}`}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-mono font-bold text-sm">{entry.register_number}</span>
                        {getSourceBadge(entry.source_type)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="text-muted-foreground">{entry.doc_reference}</span>
                      <span className="font-semibold">{entry.doc_number || ''}</span>
                    </TableCell>
                    <TableCell className="text-xs">{formatThaiDate(entry.doc_date)}</TableCell>
                    <TableCell className="text-xs">{entry.from_org}</TableCell>
                    <TableCell className="text-xs">{entry.to_person}</TableCell>
                    <TableCell className="text-xs font-medium max-w-[200px] truncate">{entry.subject}</TableCell>

                    {/* Editable: การปฏิบัติ */}
                    <TableCell className="text-xs">
                      {isEditing ? (
                        <Input
                          value={editValues.action_taken}
                          onChange={(e) =>
                            setEditValues((v) => ({ ...v, action_taken: e.target.value }))
                          }
                          className="h-7 text-xs"
                        />
                      ) : (
                        <span className="text-muted-foreground">{entry.action_taken || '-'}</span>
                      )}
                    </TableCell>

                    {/* Editable: หมายเหตุ */}
                    <TableCell className="text-xs">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editValues.remarks}
                            onChange={(e) =>
                              setEditValues((v) => ({ ...v, remarks: e.target.value }))
                            }
                            className="h-7 text-xs"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-green-600 hover:bg-green-50"
                            onClick={() => saveEdit(entry)}
                            disabled={saving}
                          >
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-red-500 hover:bg-red-50"
                            onClick={cancelEdit}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 group">
                          <span className="text-muted-foreground">{entry.remarks || '-'}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                            onClick={() => startEdit(entry)}
                          >
                            <Pencil className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>

                    {/* ดูเอกสาร */}
                    <TableCell className="text-center">
                      {entry.source_type !== 'manual' ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950"
                          onClick={() => viewDocument(entry)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground/30">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            ก่อนหน้า
          </Button>
          <span className="text-sm font-medium text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            ถัดไป
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default RegisterTable;
