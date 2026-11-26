'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  AlertCircle,
  ArrowRight,
  Info,
  Download,
  RefreshCw,
  Building2,
} from 'lucide-react';
import { useImportCatalogueExcelMutation, useGetBranchesQuery } from '@/store/services/catalogueApi';
import { useAppSelector, RootState } from '@/store';
import { Branch } from '@/types';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string, destinationBranchId?: string) => void;
  initialBranchId?: string;
  branches?: Branch[];
}

interface DuplicateReport {
  itemNo: string;
  posDisplayName: string;
  brand: string;
  category: string;
  productLine: string;
  size: string;
  height: number;
  reason: string;
}

interface ImportResult {
  totalRows: number;
  successCount: number;
  duplicateCount: number;
  updatedCount?: number;
  duplicates: DuplicateReport[];
  created: any[];
  updated?: any[];
}

export default function ExcelImportModal({
  isOpen,
  onClose,
  onSuccess,
  initialBranchId,
  branches: propBranches,
}: ExcelImportModalProps) {
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const { data: fetchedBranches = [] } = useGetBranchesQuery(undefined, {
    skip: Boolean(propBranches && propBranches.length > 0),
  });
  const availableBranches = propBranches && propBranches.length > 0 ? propBranches : fetchedBranches;

  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    if (!isSuperAdmin) {
      return currentUser?.assignedBranchId || (currentUser as any)?.branchId || '';
    }
    return initialBranchId || '';
  });

  // Track previous isOpen state so we only initialize branch when modal opens
  const prevIsOpenRef = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      if (!isSuperAdmin) {
        setSelectedBranchId(currentUser?.assignedBranchId || (currentUser as any)?.branchId || '');
      } else if (initialBranchId) {
        setSelectedBranchId(initialBranchId);
      } else if (availableBranches.length > 0) {
        const dura = availableBranches.find(
          (b) => b.name?.toLowerCase().includes('dura') || b.code?.toLowerCase().includes('312')
        );
        setSelectedBranchId(dura ? dura.id : availableBranches[0].id);
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialBranchId, isSuperAdmin, availableBranches, currentUser]);

  // Fallback if availableBranches loads after modal is already opened and no branch selected yet
  useEffect(() => {
    if (isSuperAdmin && !selectedBranchId && availableBranches.length > 0) {
      const dura = availableBranches.find(
        (b) => b.name?.toLowerCase().includes('dura') || b.code?.toLowerCase().includes('312')
      );
      setSelectedBranchId(dura ? dura.id : availableBranches[0].id);
    }
  }, [isSuperAdmin, selectedBranchId, availableBranches]);

  const activeBranchObj = availableBranches.find((b) => b.id === selectedBranchId);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isUpdatingDuplicates, setIsUpdatingDuplicates] = useState(false);
  const [updateSuccessMsg, setUpdateSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importExcel, { isLoading: isUploading }] = useImportCatalogueExcelMutation();

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processFile(selected);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      processFile(dropped);
    }
  };

  const processFile = (f: File) => {
    setParseError(null);
    setResult(null);
    setUpdateSuccessMsg(null);
    setFile(f);
    setIsProcessingFile(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!data || data.length === 0) {
          setParseError('The selected file contains no readable rows.');
          setParsedRows([]);
        } else {
          setParsedRows(data);
        }
      } catch (err: any) {
        setParseError(`Failed to parse file: ${err.message || 'Unknown error'}`);
        setParsedRows([]);
      } finally {
        setIsProcessingFile(false);
      }
    };

    reader.onerror = () => {
      setParseError('Could not read file from disk.');
      setIsProcessingFile(false);
    };

    reader.readAsBinaryString(f);
  };

  const handleUploadConfirm = async () => {
    if (parsedRows.length === 0) return;
    if (!selectedBranchId) {
      setParseError('Please select a destination branch before uploading.');
      return;
    }
    setParseError(null);
    setUpdateSuccessMsg(null);

    try {
      const res = await importExcel({
        rows: parsedRows,
        branchId: selectedBranchId,
      }).unwrap();
      const importData = (res as any)?.data || res;
      setResult({
        totalRows: importData.totalRows || parsedRows.length,
        successCount: importData.successCount || 0,
        duplicateCount: importData.duplicateCount || 0,
        updatedCount: importData.updatedCount || 0,
        duplicates: importData.duplicates || [],
        created: importData.created || [],
        updated: importData.updated || [],
      });
      const targetB = availableBranches.find((b) => b.id === selectedBranchId);
      onSuccess(
        `Import finished for ${targetB?.name || 'selected branch'}: ${importData.successCount || 0} created, ${importData.duplicateCount || 0} duplicates found.`,
        selectedBranchId
      );
    } catch (err: any) {
      setParseError(err?.data?.error?.message || err?.data?.message || err?.message || 'Import operation failed.');
    }
  };

  const handleUpdateDuplicates = async () => {
    if (parsedRows.length === 0) return;
    if (!selectedBranchId) {
      setParseError('Please select a destination branch before uploading.');
      return;
    }
    setIsUpdatingDuplicates(true);
    setParseError(null);
    setUpdateSuccessMsg(null);

    try {
      const res = await importExcel({
        rows: parsedRows,
        branchId: selectedBranchId,
        updateDuplicates: true,
      }).unwrap();
      const syncData = (res as any)?.data || res;
      const count = syncData.updatedCount || syncData.updated?.length || result?.duplicates.length || 0;
      setResult({
        totalRows: syncData.totalRows || parsedRows.length,
        successCount: syncData.successCount || result?.successCount || 0,
        duplicateCount: 0,
        updatedCount: count,
        duplicates: [],
        created: syncData.created || result?.created || [],
        updated: syncData.updated || [],
      });
      const targetB = availableBranches.find((b) => b.id === selectedBranchId);
      setUpdateSuccessMsg(`Successfully synchronized and updated ${count} existing products for ${targetB?.name || 'selected branch'}!`);
      onSuccess(
        `Catalogue sync completed for ${targetB?.name || 'selected branch'}: ${count} existing products updated.`,
        selectedBranchId
      );
    } catch (err: any) {
      setParseError(err?.data?.error?.message || err?.data?.message || err?.message || 'Failed to update existing products.');
    } finally {
      setIsUpdatingDuplicates(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setResult(null);
    setParseError(null);
    setUpdateSuccessMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadSampleSheet = () => {
    const sampleData = [
      {
        'Item #': 1,
        'Brand': 'MoltyFoam',
        'Category': 'Topper',
        'Product Line': 'Memory Topper',
        'POS Display Name': 'Memory Topper 78x72x3',
        'Display label': '78x72',
        'Length (in)': 78,
        'Width (in)': 72,
        'Height (in)': 3,
        'Variant / Notes': 'Standard',
        'Current Stock': 10,
        'Minimum Stock': 2,
        'List Price': 44500,
        'Effective Date': '09/04/2026',
      },
      {
        'Item #': 2,
        'Brand': 'MoltyFoam',
        'Category': 'Mattress',
        'Product Line': 'Molty Foam Standard',
        'POS Display Name': 'Molty Foam 78x72x6',
        'Display label': '78x72',
        'Length (in)': 78,
        'Width (in)': 72,
        'Height (in)': 6,
        'Variant / Notes': 'High Density Ortho Support',
        'Current Stock': 5,
        'Minimum Stock': 1,
        'List Price': 48500,
        'Effective Date': '01/01/2026',
      },
      {
        'Item #': 3,
        'Brand': 'Celeste',
        'Category': 'Pillow',
        'Product Line': 'Celeste Orthocare',
        'POS Display Name': 'Celeste Orthocare Pillow',
        'Display label': 'Standard',
        'Length (in)': 24,
        'Width (in)': 16,
        'Height (in)': 5,
        'Variant / Notes': 'Memory Foam Fill',
        'Current Stock': 20,
        'Minimum Stock': 5,
        'List Price': 6500,
        'Effective Date': '01/01/2026',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws['!cols'] = [
      { wch: 8 },  // Item #
      { wch: 14 }, // Brand
      { wch: 14 }, // Category
      { wch: 22 }, // Product Line
      { wch: 30 }, // POS Display Name
      { wch: 14 }, // Display label
      { wch: 12 }, // Length (in)
      { wch: 12 }, // Width (in)
      { wch: 12 }, // Height (in)
      { wch: 26 }, // Variant / Notes
      { wch: 14 }, // Current Stock
      { wch: 14 }, // Minimum Stock
      { wch: 14 }, // List Price
      { wch: 14 }, // Effective Date
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products_Sample');
    XLSX.writeFile(wb, 'MoltyFoam_Product_Import_Sample.xlsx');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/70 flex items-center justify-center text-blue-600">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-sans tracking-tight">
                Import Catalogue from Excel
              </h2>
              <p className="text-xs text-slate-500 font-normal">
                Upload products, sizes, prices, and initial stock via spreadsheet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Destination Branch Selection Block */}
          {!result && (
            <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-brand-blue" />
                  <span>Destination Branch</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                {currentUser?.role !== 'SUPER_ADMIN' ? (
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    Locked to Assigned Store
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-500">
                    Select which branch this sheet belongs to
                  </span>
                )}
              </div>

              {currentUser?.role === 'SUPER_ADMIN' ? (
                <div className="space-y-2">
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-brand-blue cursor-pointer transition-all"
                  >
                    <option value="">-- Choose Branch to Upload Catalogue * --</option>
                    {availableBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code || (b as any).shopNumber})
                      </option>
                    ))}
                  </select>
                  {activeBranchObj && (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/80 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                      <span>Target Branch: <strong className="font-bold text-emerald-950">{activeBranchObj.name}</strong> ({activeBranchObj.code || (activeBranchObj as any)?.shopNumber})</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>{activeBranchObj?.name || 'Your Assigned Store'}</span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {activeBranchObj?.code || (activeBranchObj as any)?.shopNumber}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Download Sample Sheet Banner */}
          {!result && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200 shadow-2xs">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-950 font-sans">
                    Sample Excel Spreadsheet
                  </h3>
                  <p className="text-xs text-emerald-700">
                    Download sample template with correct columns and demo rows.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadSampleSheet}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Sample Sheet</span>
              </button>
            </div>
          )}

          {/* Format Guide Note */}
          {!result && (
            <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 flex items-start gap-3 text-xs text-blue-900">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold">Required Columns (Auto-Mapped):</span>
                <p className="text-blue-800 leading-relaxed font-mono text-[11px]">
                  Brand, Category, Product Line, POS Display Name, Length (in), Width (in), Height (in), List Price, Current Stock, Minimum Stock
                </p>
                <p className="text-slate-600 text-[11px] pt-0.5">
                  • <strong>Display Label:</strong> Auto-generated as <code className="bg-white px-1 py-0.5 rounded border border-blue-100 font-bold">Length x Width</code> (e.g. 78x72).
                  <br />
                  • <strong>Pricing:</strong> List Price is automatically set as both Retail and Wholesale price.
                </p>
              </div>
            </div>
          )}

          {/* Upload Dropzone */}
          {!result && (
            <>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center ${file
                    ? 'border-blue-500 bg-blue-50/30'
                    : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/70'
                  }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-12 h-12 rounded-2xl bg-blue-100/70 flex items-center justify-center text-blue-600 mb-2.5">
                  {isProcessingFile ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                </div>

                {file ? (
                  <div>
                    <p className="text-sm font-bold text-slate-800 font-sans">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB • {parsedRows.length} rows detected
                    </p>
                    <span className="inline-block mt-2 text-xs font-semibold text-blue-600 bg-white px-2.5 py-1 rounded-lg border border-blue-200">
                      Click or drop another file to change
                    </span>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-bold text-slate-800 font-sans">
                      Drop Excel file here, or <span className="text-blue-600 underline">browse</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Supports .xlsx, .xls, and .csv files</p>
                  </div>
                )}
              </div>

              {parseError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2.5 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Sample Rows Preview */}
              {parsedRows.length > 0 && !parseError && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100/70 px-3 py-2 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Parsed Preview (First {Math.min(3, parsedRows.length)} of {parsedRows.length} rows)</span>
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px]">Ready to import</span>
                  </div>
                  <div className="overflow-x-auto max-h-36 text-xs">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase border-b border-slate-200">
                          <th className="p-2 text-left font-semibold">Brand</th>
                          <th className="p-2 text-left font-semibold">Category</th>
                          <th className="p-2 text-left font-semibold">Product Line</th>
                          <th className="p-2 text-left font-semibold">POS Name</th>
                          <th className="p-2 text-left font-semibold">Price</th>
                          <th className="p-2 text-left font-semibold">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {parsedRows.slice(0, 3).map((r, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-2 font-medium text-slate-800">{r['Brand'] || r['brand'] || '—'}</td>
                            <td className="p-2 text-slate-600">{r['Category'] || r['category'] || '—'}</td>
                            <td className="p-2 text-slate-600">{r['Product Line'] || r['productLine'] || '—'}</td>
                            <td className="p-2 text-slate-600">{r['POS Display Name'] || r['posDisplayName'] || '—'}</td>
                            <td className="p-2 font-mono font-semibold text-slate-800">{r['List Price'] || r['listPrice'] || '—'}</td>
                            <td className="p-2 font-mono text-slate-600">{r['Current Stock'] || r['stock'] || '0'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Import Result View (Success & Duplicate Report) */}
          {result && (
            <div className="space-y-4">
              {/* Success Notification Banner if duplicates updated */}
              {updateSuccessMsg && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-2.5 text-xs text-emerald-900 font-semibold animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{updateSuccessMsg}</span>
                </div>
              )}

              {/* Summary Cards */}
              <div className={`grid gap-3 ${result.updatedCount && result.updatedCount > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-emerald-800 font-semibold block">Newly Added</span>
                    <span className="text-xl font-bold text-emerald-900 font-mono">
                      {result.successCount}
                    </span>
                    <span className="text-[11px] text-emerald-700 block">new items registered</span>
                  </div>
                </div>

                {result.updatedCount !== undefined && result.updatedCount > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs text-blue-800 font-semibold block">Updated & Synced</span>
                      <span className="text-xl font-bold text-blue-900 font-mono">
                        {result.updatedCount}
                      </span>
                      <span className="text-[11px] text-blue-700 block">prices & stock updated</span>
                    </div>
                  </div>
                )}

                <div className={`rounded-xl p-4 border flex items-center gap-3 ${result.duplicateCount > 0
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${result.duplicateCount > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold block">Duplicates Skipped</span>
                    <span className="text-xl font-bold font-mono">
                      {result.duplicateCount}
                    </span>
                    <span className="text-[11px] opacity-80 block">
                      {result.duplicateCount > 0 ? 'multi-entry skipped' : 'zero duplicates'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Duplicates Detail Table & Update Button */}
              {result.duplicates.length > 0 && (
                <div className="space-y-3">
                  {/* Action Bar to Update Existing Products */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <RefreshCw className={`w-4 h-4 ${isUpdatingDuplicates ? 'animate-spin' : ''}`} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 font-sans">
                          Update Existing Products with Excel Data?
                        </h4>
                        <p className="text-[11px] text-slate-600">
                          Click to overwrite prices and sync stock for all {result.duplicates.length} existing items.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isUpdatingDuplicates}
                      onClick={handleUpdateDuplicates}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all shrink-0 cursor-pointer disabled:bg-blue-400"
                    >
                      {isUpdatingDuplicates ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Updating Products...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          <span>Update All {result.duplicates.length} Duplicates</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Duplicates Inspection Table */}
                  <div className="border border-amber-200 rounded-xl overflow-hidden bg-white">
                    <div className="bg-amber-50/80 px-3.5 py-2.5 border-b border-amber-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Duplicate Items Inspection ({result.duplicates.length})
                      </span>
                      <span className="text-[11px] text-amber-700">Currently skipped</span>
                    </div>
                    <div className="overflow-x-auto max-h-48 text-xs">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase border-b border-slate-200">
                            <th className="p-2 text-left font-semibold">Row #</th>
                            <th className="p-2 text-left font-semibold">POS Display Name</th>
                            <th className="p-2 text-left font-semibold">Brand / Category</th>
                            <th className="p-2 text-left font-semibold">Size</th>
                            <th className="p-2 text-left font-semibold">Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans">
                          {result.duplicates.map((d, idx) => (
                            <tr key={idx} className="hover:bg-amber-50/40">
                              <td className="p-2 font-mono text-slate-500">{d.itemNo}</td>
                              <td className="p-2 font-semibold text-slate-800">{d.posDisplayName}</td>
                              <td className="p-2 text-slate-600">{d.brand} • {d.category}</td>
                              <td className="p-2 font-mono text-slate-600">{d.size}{d.height > 0 ? `x${d.height}` : ''}</td>
                              <td className="p-2 text-amber-700 font-medium text-[11px]">{d.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
          {result ? (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Upload Another File
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Done & View Catalogue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-200/50 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSampleSheet}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  title="Download template spreadsheet"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Sample Sheet</span>
                </button>
              </div>
              <button
                type="button"
                disabled={parsedRows.length === 0 || isUploading || isProcessingFile || !selectedBranchId}
                onClick={handleUploadConfirm}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer ${parsedRows.length === 0 || isUploading || isProcessingFile || !selectedBranchId
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing {parsedRows.length} Rows...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Import {parsedRows.length > 0 ? `${parsedRows.length} Products` : 'File'}</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
