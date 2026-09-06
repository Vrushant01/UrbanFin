import React, { useState, useRef } from 'react';
import { UploadCloud, File, AlertCircle, CheckCircle, X, ChevronRight, FileText, Image as ImageIcon } from 'lucide-react';
import { Button } from '../ui/Button';

interface AddWithFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (ocrData: any, matches: any) => void;
}

export function AddWithFileModal({ isOpen, onClose, onConfirm }: AddWithFileModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'review'>('idle');
  const [ocrData, setOcrData] = useState<any>(null);
  const [ocrMatches, setOcrMatches] = useState<any>(null);
  const [rawText, setRawText] = useState<string>('');
  const [showRawText, setShowRawText] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File exceeds 10MB limit.');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File exceeds 10MB limit.');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleExtract = async () => {
    if (!file) return;

    setStatus('uploading');
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('urbanfin_jwt_token');
      setStatus('analyzing');
      const res = await fetch('/api/ocr/analyze', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: formData,
      });

      const json = await res.json();

      if (!res.ok || json.status === 'error') {
        throw new Error(json.message || 'Failed to analyze document.');
      }

      setOcrData(json);
      setOcrMatches(json.matches || {});
      setRawText(json.raw_text || '');
      setStatus('review');
    } catch (err: any) {
      setError(err.message || 'An error occurred during OCR extraction.');
      setStatus('idle');
    }
  };

  const reset = () => {
    setFile(null);
    setStatus('idle');
    setOcrData(null);
    setRawText('');
    setShowRawText(false);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const renderReviewScreen = () => {
    if (!ocrData) return null;

    const data = ocrData.data || {};
    const conf = ocrData.confidence || {};
    const val = ocrData.validation || { isValid: true, warnings: [] };
    const m = ocrData.matches || {};

    const renderField = (label: string, value: any, confScore: number | undefined) => {
      let confStatus = null;
      if (confScore !== undefined) {
        if (confScore >= 0.85) {
          confStatus = <span className="text-emerald-600 text-xs font-bold flex items-center gap-1"><CheckCircle size={12}/> {Math.round(confScore * 100)}%</span>;
        } else {
          confStatus = <span className="text-amber-600 text-xs font-bold flex items-center gap-1"><AlertCircle size={12}/> {Math.round(confScore * 100)}% - Verify</span>;
        }
      }
      return (
        <div className="py-2 border-b border-slate-100 last:border-0">
          <div className="text-xs text-slate-500 font-semibold uppercase">{label}</div>
          <div className="flex items-center justify-between mt-1">
            <span className="font-medium text-slate-900">{value || <span className="text-slate-300 italic">Not detected</span>}</span>
            {confStatus}
          </div>
        </div>
      );
    };

    return (
      <div className="flex flex-col h-[70vh]">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Review Extracted Information</h2>
            <p className="text-sm text-slate-500">Please verify the AI-extracted data against your original document.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowRawText(!showRawText)}>
            {showRawText ? 'View Structured Data' : 'View Detected Text'}
          </Button>
        </div>

        {showRawText ? (
          <div className="flex-1 bg-slate-900 text-slate-300 p-4 rounded-xl overflow-auto font-mono text-xs whitespace-pre-wrap">
            <div className="text-emerald-400 mb-2 border-b border-slate-700 pb-2">Detected OCR Text</div>
            {rawText}
          </div>
        ) : (
          <div className="flex-1 flex gap-6 min-h-0">
            {/* Left: Document Preview */}
            <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-3 bg-slate-100 border-b border-slate-200 font-semibold text-sm flex items-center gap-2 text-slate-700">
                {file?.type.includes('pdf') ? <FileText size={16}/> : <ImageIcon size={16}/>}
                Original Document
              </div>
              <div className="flex-1 flex items-center justify-center p-4 bg-slate-200/50">
                {file?.type.includes('pdf') ? (
                  <object data={URL.createObjectURL(file)} type="application/pdf" className="w-full h-full rounded shadow-sm">
                    <p>PDF preview not available. File uploaded successfully.</p>
                  </object>
                ) : file ? (
                  <img src={URL.createObjectURL(file)} alt="Preview" className="max-w-full max-h-full object-contain rounded shadow-sm" />
                ) : null}
              </div>
            </div>

            {/* Right: Extracted Data */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-y-auto">
              <div className="p-4">
                {/* Database Matches */}
                <div className="mb-6 space-y-2">
                  <div className={`p-3 rounded-lg border ${m.customerFound ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'} flex items-center justify-between`}>
                    <span className="text-sm font-bold flex items-center gap-2">
                      {m.customerFound ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
                      Customer Match
                    </span>
                    <span className="text-sm">{m.customerFound ? 'Found ✓' : 'Not Found ⚠'}</span>
                  </div>
                  
                  {ocrData.document_type === 'payment_receipt' && (
                    <div className={`p-3 rounded-lg border ${m.invoiceFound ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'} flex items-center justify-between`}>
                      <span className="text-sm font-bold flex items-center gap-2">
                        {m.invoiceFound ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
                        Invoice Match
                      </span>
                      <span className="text-sm">{m.invoiceFound ? 'Found ✓' : 'Not Found ⚠'}</span>
                    </div>
                  )}
                </div>

                {/* Validation Warnings */}
                {!val.isValid && val.warnings.length > 0 && (
                  <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl">
                    <h4 className="text-rose-800 font-bold text-sm mb-2 flex items-center gap-2"><AlertCircle size={16}/> Financial Verification Required</h4>
                    <ul className="list-disc pl-5 text-sm text-rose-700 space-y-1">
                      {val.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}

                {/* Extracted Fields */}
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-800 border-b border-slate-200 pb-2 mb-3">Extracted Fields</h3>
                  {ocrData.document_type === 'payment_receipt' ? (
                    <>
                      {renderField('Customer', data.customer_name, conf.customer_name)}
                      {renderField('Invoice Reference', data.invoice_reference, conf.invoice_reference)}
                      {renderField('Receipt Date', data.receipt_date, conf.receipt_date)}
                      {renderField('Amount', `Rs. ${data.amount || ''}`, conf.amount)}
                      {renderField('Payment Method', data.payment_method, conf.payment_method)}
                      {renderField('Source Receipt No', data.source_receipt_number, undefined)}
                    </>
                  ) : (
                    <>
                      {renderField('Customer/Vendor', data.customer_or_vendor_name, conf.customer_or_vendor_name)}
                      {renderField('Invoice Number', data.invoice_number, conf.invoice_number)}
                      {renderField('Invoice Date', data.invoice_date, undefined)}
                      {renderField('Grand Total', `Rs. ${data.grand_total || ''}`, conf.grand_total)}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={() => onConfirm(ocrData, m)}>
            Continue to Form <ChevronRight size={16} className="ml-1"/>
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-md w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <UploadCloud className="text-blue-600" />
            Add with File OCR
          </h2>
          <button onClick={close} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {error && (
            <div className="mb-6 p-4 bg-rose-50 text-rose-700 rounded-xl border border-rose-100 flex items-center gap-3">
              <AlertCircle size={20} />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {status === 'idle' && (
            <div className="max-w-2xl mx-auto">
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-xl p-12 text-center hover:bg-blue-50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileChange}
                  accept=".pdf,image/png,image/jpeg,image/webp"
                />
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-blue-500">
                  <UploadCloud size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Upload a PDF or Image</h3>
                <p className="text-slate-500 mb-6 text-sm">Drag & drop your file here, or click to browse.</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Supported: PDF, PNG, JPG, JPEG, WEBP • Max 10MB</p>
              </div>

              {file && (
                <div className="mt-6 p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                      <File size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800">{file.name}</div>
                      <div className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => setFile(null)}>Remove</Button>
                    <Button variant="primary" size="sm" onClick={handleExtract}>Extract Data</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {(status === 'uploading' || status === 'analyzing') && (
            <div className="max-w-md mx-auto text-center py-20">
              <div className="inline-block relative w-20 h-20 mb-8">
                <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-blue-600">
                  <FileText size={24} className="animate-pulse" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                {status === 'uploading' ? 'Uploading document...' : 'Analyzing document...'}
              </h3>
              <div className="space-y-3 mt-8 text-sm text-slate-500 font-medium max-w-xs mx-auto text-left">
                <div className="flex items-center gap-3"><CheckCircle size={16} className="text-emerald-500"/> File uploaded successfully</div>
                <div className="flex items-center gap-3"><CheckCircle size={16} className="text-emerald-500"/> OCR text detected</div>
                <div className="flex items-center gap-3">
                  {status === 'analyzing' ? <span className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"/> : <div className="w-4"/>} 
                  Understanding document with AI
                </div>
                <div className="flex items-center gap-3 opacity-50"><div className="w-4"/> Matching database records</div>
              </div>
            </div>
          )}

          {status === 'review' && renderReviewScreen()}
        </div>
      </div>
    </div>
  );
}
