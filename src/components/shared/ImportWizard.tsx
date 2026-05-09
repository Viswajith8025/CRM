import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Upload, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet,
  Settings2,
  PlayCircle,
  Loader2
} from "lucide-react";
import { ImportService, MODULE_SCHEMAS } from "@/lib/importService";
import type { ImportModule, ImportMapping, ImportError } from "@/lib/importService";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "sonner";

interface ImportWizardProps {
  module: ImportModule;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

export function ImportWizard({ module, open, onOpenChange, onComplete }: ImportWizardProps) {
  const { profile } = useAuthStore();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [mappings, setMappings] = useState<ImportMapping[]>([]);
  const [validation, setValidation] = useState<{ validRows: any[], errors: ImportError[] }>({ validRows: [], errors: [] });
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ imported: number, failed: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const schema = MODULE_SCHEMAS[module];

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep('upload');
        setFile(null);
        setColumns([]);
        setRows([]);
        setMappings([]);
        setValidation({ validRows: [], errors: [] });
        setProgress(0);
        setResults(null);
        setIsProcessing(false);
      }, 300);
    }
  }, [open]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    try {
      const { columns, rows } = await ImportService.parseFile(uploadedFile);
      setColumns(columns);
      setRows(rows);
      
      const initialMappings = ImportService.autoMap(columns, module);
      setMappings(initialMappings);
      setStep('mapping');
    } catch (err) {
      toast.error("Failed to parse file. Ensure it is a valid Excel or CSV.");
    }
  };

  const handleMappingChange = (excelCol: string, dbField: string) => {
    setMappings(prev => {
      const filtered = prev.filter(m => m.dbField !== dbField && m.excelColumn !== excelCol);
      if (dbField === 'none') return filtered;
      return [...filtered, { excelColumn: excelCol, dbField }];
    });
  };

  const runValidation = () => {
    const results = ImportService.validate(rows, mappings, module);
    setValidation(results);
    setStep('preview');
  };

  const startImport = async () => {
    if (!profile) return;
    setIsProcessing(true);
    setStep('importing');

    try {
      const res = await ImportService.batchImport(
        module,
        validation.validRows,
        profile.organization_id,
        profile.id,
        file?.name || 'unknown_file'
      );
      setResults(res);
      setStep('complete');
      onComplete?.();
    } catch (err) {
      toast.error("Import failed due to a system error.");
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Import Data to {schema.label}</DialogTitle>
              <DialogDescription>Bulk migration wizard for production-grade data ingestion.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl bg-muted/5">
              <Upload className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <h3 className="font-bold text-lg">Upload Excel or CSV File</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Drop your migration file here or click to browse.</p>
              <Input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                onChange={handleFileUpload}
                className="max-w-xs cursor-pointer"
              />
            </div>
          )}

          {/* STEP 2: MAPPING */}
          {step === 'mapping' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                  <Settings2 className="h-4 w-4" /> Column Mapping
                </h3>
                <Badge variant="secondary">{mappings.length} Fields Mapped</Badge>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Excel Column</TableHead>
                    <TableHead className="w-12"><ArrowRight className="h-4 w-4" /></TableHead>
                    <TableHead>ERP Database Field</TableHead>
                    <TableHead>Sample Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columns.map(col => {
                    const currentMapping = mappings.find(m => m.excelColumn === col);
                    return (
                      <TableRow key={col}>
                        <TableCell className="font-medium">{col}</TableCell>
                        <TableCell><ArrowRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                        <TableCell>
                          <Select 
                            value={currentMapping?.dbField || 'none'} 
                            onValueChange={(val) => handleMappingChange(col, val)}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Skip column" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Skip column</SelectItem>
                              {schema.fields.map(f => (
                                <SelectItem key={f.name} value={f.name}>
                                  {f.label} {f.required && '*'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {String(rows[0]?.[col] || 'N/A')}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* STEP 3: PREVIEW & VALIDATE */}
          {step === 'preview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <div className="flex items-center gap-2 text-emerald-600 mb-1">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-xs font-black uppercase tracking-widest">Ready to Import</span>
                  </div>
                  <div className="text-2xl font-black text-emerald-700">{validation.validRows.length} Rows</div>
                </div>
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  <div className="flex items-center gap-2 text-rose-600 mb-1">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-xs font-black uppercase tracking-widest">Validation Errors</span>
                  </div>
                  <div className="text-2xl font-black text-rose-700">{validation.errors.length} Issues</div>
                </div>
              </div>

              {validation.errors.length > 0 && (
                <div className="border rounded-xl overflow-hidden">
                  <div className="bg-rose-50 p-3 border-b border-rose-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-900">Critical Issues (Skipped Rows)</span>
                  </div>
                  <ScrollArea className="h-[200px]">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="w-16">Row</TableHead>
                          <TableHead>Column</TableHead>
                          <TableHead>Error Message</TableHead>
                          <TableHead>Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validation.errors.slice(0, 10).map((err, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-bold">{err.row}</TableCell>
                            <TableCell className="text-xs">{err.column}</TableCell>
                            <TableCell className="text-xs text-rose-600 font-medium">{err.message}</TableCell>
                            <TableCell className="text-xs font-mono">{String(err.data)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}

              <div className="border rounded-xl overflow-hidden">
                 <div className="bg-muted/30 p-3 border-b flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Data Preview (Mpped Rows)</span>
                 </div>
                 <Table>
                    <TableHeader>
                      <TableRow>
                        {mappings.map(m => (
                          <TableHead key={m.dbField}>{schema.fields.find(f => f.name === m.dbField)?.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                       {validation.validRows.slice(0, 5).map((row, i) => (
                         <TableRow key={i}>
                            {mappings.map(m => (
                              <TableCell key={m.dbField} className="text-xs truncate max-w-[150px]">{String(row[m.dbField])}</TableCell>
                            ))}
                         </TableRow>
                       ))}
                    </TableBody>
                 </Table>
              </div>
            </div>
          )}

          {/* STEP 4: IMPORTING */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-20 space-y-6">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <div className="text-center">
                <h3 className="font-bold text-lg">Ingesting Data...</h3>
                <p className="text-sm text-muted-foreground mt-1">Please wait while we sync your records to the secure cloud.</p>
              </div>
              <Progress value={isProcessing ? 66 : 100} className="w-full max-w-md h-2" />
            </div>
          )}

          {/* STEP 5: COMPLETE */}
          {step === 'complete' && results && (
            <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
              <div className="h-20 w-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-2xl">Import Successful</h3>
                <p className="text-muted-foreground mt-2">
                  Successfully migrated <span className="font-black text-foreground">{results.imported}</span> records to {schema.label}.
                </p>
              </div>
              {results.failed > 0 && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl max-w-sm">
                  <p className="text-sm text-amber-700 font-medium">
                    {results.failed} rows were skipped due to system errors. Check logs for details.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t bg-muted/5">
          <div className="flex justify-between w-full">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isProcessing}>
              Cancel
            </Button>
            
            <div className="flex gap-2">
              {step === 'mapping' && (
                <Button onClick={runValidation} className="gap-2">
                  Continue to Preview <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              {step === 'preview' && (
                <>
                  <Button variant="outline" onClick={() => setStep('mapping')}>
                    Back to Mapping
                  </Button>
                  <Button 
                    onClick={startImport} 
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700" 
                    disabled={validation.validRows.length === 0}
                  >
                    Start Ingestion <PlayCircle className="h-4 w-4" />
                  </Button>
                </>
              )}
              {step === 'complete' && (
                <Button onClick={() => onOpenChange(false)} className="font-bold uppercase tracking-widest">
                  Finish
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper component
function ScrollArea({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={`overflow-auto ${className}`}>{children}</div>;
}
