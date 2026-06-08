import React, { useState } from 'react';
import { ESSLService } from '../services/eSSLService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Save, Activity, History, Server, DownloadCloud } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

type DayAttendance = {
  status: 'P' | 'A' | 'L' | 'W';
  firstIn: string | null;
  lastOut: string | null;
};

type MatrixRecord = {
  pin: string;
  name: string;
  statuses: Record<string, DayAttendance>;
};

export default function AttendanceDevicePage() {
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('eSSL_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore parsing errors
      }
    }
    return {
      url: '/iclock/WebAPIService.asmx',
      userName: '',
      userPassword: '',
      serialNumber: ''
    };
  });

  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [attendanceData, setAttendanceData] = useState<{ dates: string[], records: MatrixRecord[] } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // wfhSet stores keys like "pin|date" for quick lookup
  const [wfhSet, setWfhSet] = useState<Set<string>>(new Set());
  const [pendingWfh, setPendingWfh] = useState<{ pin: string; date: string; name: string; action: 'mark' | 'remove' } | null>(null);
  const [isMappingOpen, setIsMappingOpen] = useState(false);
  const [bioEmployees, setBioEmployees] = useState<{ pin: string; name: string }[]>([]);
  const [mappingSaving, setMappingSaving] = useState(false);
  const [selectedSummaryDate, setSelectedSummaryDate] = useState<string>('');

  // Fetch from DB on mount
  React.useEffect(() => {
    const fetchConfig = async () => {
      if (!profile?.organization_id) return;
      const { data, error } = await supabase
        .from('essl_device_settings')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .single();
      
      if (data && !error) {
        setConfig({
          url: data.url || '/iclock/WebAPIService.asmx',
          userName: data.user_name || '',
          userPassword: data.user_password || '',
          serialNumber: data.serial_number || ''
        });
      }
    };
    fetchConfig();
  }, [profile?.organization_id]);

  React.useEffect(() => {
    localStorage.setItem('eSSL_config', JSON.stringify(config));
  }, [config]);

  const saveConfig = async () => {
    if (!profile?.organization_id) {
      toast.error('Organization ID not found. Configuration saved locally.');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('essl_device_settings')
        .upsert({
          organization_id: profile.organization_id,
          url: config.url,
          user_name: config.userName,
          user_password: config.userPassword,
          serial_number: config.serialNumber,
          updated_at: new Date().toISOString()
        }, { onConflict: 'organization_id' });
        
      if (error) throw error;
      toast.success("Configuration saved to database.");
      setIsSettingsOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Saved locally. Run the SQL script to enable DB saving: " + err.message);
    }
  };

  // State for Logs
  const [logs, setLogs] = useState({ 
    from: new Date().toISOString().split('T')[0], 
    to: new Date().toISOString().split('T')[0] 
  });

  const getService = () => new ESSLService(config);

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setResult(null);
      setAttendanceData(null);
      
      const ensureYMD = (dateStr: string) => {
        if (!dateStr || dateStr.trim() === '') return new Date().toISOString().split('T')[0];
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
        const parts = dateStr.split(/[-/]/);
        if (parts.length === 3) {
           if (parts[0].length === 4) return `${parts[0]}-${parts[1]}-${parts[2]}`;
           if (parts[2].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return new Date(dateStr).toISOString().split('T')[0];
      };

      const finalFrom = ensureYMD(logs.from);
      const finalTo = ensureYMD(logs.to);
      const formattedFrom = `${finalFrom} 00:00`;
      const formattedTo = `${finalTo} 23:59`;
      
      const service = getService();
      
      let employeesXml = '';
      try {
        employeesXml = await service.getAllEmployees(config.serialNumber) || '';
      } catch (err: any) {
        console.warn('Device does not support GetAllEmployee action. Falling back to extracting PINs from logs.', err);
      }
      
      const logsXml = await service.getTransactionsLog(formattedFrom, formattedTo, config.serialNumber);

      // Fetch biometric_employees for name mapping
      const { data: bioEmpData } = await supabase
        .from('biometric_employees')
        .select('pin, name')
        .eq('organization_id', profile?.organization_id || '');

      const dbEmpMap = new Map<string, string>();
      if (bioEmpData) {
        bioEmpData.forEach((e: any) => dbEmpMap.set(String(e.pin), e.name));
      }

      const parser = new DOMParser();
      
      const empMap = new Map<string, string>();
      // Initialize with all configured biometric employees so they show up even if absent
      dbEmpMap.forEach((name, pin) => {
        empMap.set(pin, name);
      });

      if (employeesXml) {
        const doc = parser.parseFromString(`<root>${employeesXml}</root>`, "text/xml");
        const rows = doc.getElementsByTagName("Row");
        for (let i = 0; i < rows.length; i++) {
          const pin = rows[i].getElementsByTagName("PIN")[0]?.textContent;
          const name = rows[i].getElementsByTagName("Name")[0]?.textContent;
          if (pin && name) empMap.set(pin, name);
        }
      }

      const punches: { pin: string; date: string; time: string; dt: Date }[] = [];
      if (logsXml) {
        if (logsXml.includes('Logs Count:')) {
          const lines = logsXml.split('\n');
          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine || cleanLine.startsWith('Logs Count:')) continue;
            let parts = cleanLine.split('\t');
            if (parts.length < 2) parts = cleanLine.split(/\s{2,}/);
            if (parts.length < 2) {
              const spaces = cleanLine.split(/\s+/);
              if (spaces.length >= 3 && spaces[1].match(/^\d{4}-\d{2}-\d{2}$/)) {
                parts = [spaces[0], spaces[1] + " " + spaces[2]];
              }
            }
            if (parts.length >= 2) {
              const pin = parts[0].trim();
              const dtStr = parts[1].trim();
              if (pin && dtStr) {
                const [d, t] = dtStr.split(" ");
                if (d && t) {
                  punches.push({ pin, date: d, time: t, dt: new Date(dtStr) });
                  if (!empMap.has(pin)) {
                    empMap.set(pin, dbEmpMap.get(pin) || `Employee ${pin}`);
                  }
                }
              }
            }
          }
        } else {
          const doc = parser.parseFromString(`<root>${logsXml}</root>`, "text/xml");
          const rows = doc.getElementsByTagName("Row");
          for (let i = 0; i < rows.length; i++) {
            const pin = rows[i].getElementsByTagName("PIN")[0]?.textContent;
            const dtStr = rows[i].getElementsByTagName("DateTime")[0]?.textContent;
            if (pin && dtStr) {
              const [d, t] = dtStr.split(" ");
              punches.push({ pin, date: d, time: t, dt: new Date(dtStr) });
              if (!empMap.has(pin)) {
                empMap.set(pin, dbEmpMap.get(pin) || `Employee ${pin}`);
              }
            }
          }
        }
      }

      const datesToProcess: string[] = [];
      let currentDate = new Date(finalFrom);
      const endDate = new Date(finalTo);
      while (currentDate <= endDate) {
        datesToProcess.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      const records: MatrixRecord[] = [];
      for (const [pin, name] of empMap.entries()) {
        const statuses: Record<string, DayAttendance> = {};
        for (const date of datesToProcess) {
          const dayPunches = punches.filter(p => p.pin === pin && p.date === date).sort((a, b) => a.dt.getTime() - b.dt.getTime());
          if (dayPunches.length > 0) {
            const firstIn = dayPunches[0].time;
            const lastOut = dayPunches[dayPunches.length - 1].time;
            statuses[date] = {
              status: firstIn > "09:15:00" ? 'L' : 'P',
              firstIn: firstIn.substring(0, 5),
              lastOut: firstIn !== lastOut ? lastOut.substring(0, 5) : null
            };
          } else {
            statuses[date] = { status: 'A', firstIn: null, lastOut: null };
          }
        }
        records.push({ pin, name, statuses });
      }

      if (records.length === 0) {
        setResult('No employee or transaction data found. Response: ' + (employeesXml || '') + (logsXml || ''));
      } else {
        setAttendanceData({ 
          dates: datesToProcess, 
          records: records.sort((a, b) => a.name.localeCompare(b.name)) 
        });
        setSelectedSummaryDate(datesToProcess[datesToProcess.length - 1] || '');
      }
      // Fetch WFH records for the date range
      if (profile?.organization_id) {
        const { data: wfhData } = await supabase
          .from('wfh_records')
          .select('biometric_pin, date')
          .eq('organization_id', profile.organization_id)
          .gte('date', finalFrom)
          .lte('date', finalTo);
        if (wfhData) {
          setWfhSet(new Set(wfhData.map((r: any) => `${r.biometric_pin}|${r.date}`)));
        }
      }

      toast.success("Attendance logs fetched successfully");
    } catch (error: any) {
      toast.error('Operation failed: ' + error.message);
      setResult('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleWfh = async (pin: string, date: string) => {
    if (!profile?.organization_id) return;
    const key = `${pin}|${date}`;
    const isWfh = wfhSet.has(key);
    try {
      if (isWfh) {
        await supabase.from('wfh_records').delete()
          .eq('organization_id', profile.organization_id)
          .eq('biometric_pin', pin)
          .eq('date', date);
        setWfhSet(prev => { const n = new Set(prev); n.delete(key); return n; });
        toast.success('WFH removed');
      } else {
        await supabase.from('wfh_records').upsert({
          organization_id: profile.organization_id,
          biometric_pin: pin,
          date,
          marked_by: profile.id,
        }, { onConflict: 'organization_id,biometric_pin,date' });
        setWfhSet(prev => new Set([...prev, key]));
        toast.success('Marked as WFH');
      }
    } catch (e: any) {
      toast.error('Failed to update WFH: ' + e.message);
    }
  };

  const openMapping = async () => {
    const { data, error } = await supabase
      .from('biometric_employees')
      .select('pin, name')
      .eq('organization_id', profile?.organization_id || '')
      .order('pin');
    if (error) { toast.error('Failed to load employees'); return; }
    setBioEmployees(data && data.length > 0 ? data : [{ pin: '', name: '' }]);
    setIsMappingOpen(true);
  };

  const saveMapping = async () => {
    if (!profile?.organization_id) return;
    setMappingSaving(true);
    try {
      const valid = bioEmployees.filter(e => e.pin.trim() && e.name.trim());
      if (valid.length === 0) { toast.error('Add at least one employee'); setMappingSaving(false); return; }
      // Delete all existing for org then upsert
      await supabase.from('biometric_employees').delete().eq('organization_id', profile.organization_id);
      await supabase.from('biometric_employees').insert(
        valid.map(e => ({ organization_id: profile.organization_id, pin: e.pin.trim(), name: e.name.trim() }))
      );
      toast.success('Employee list saved!');
      setIsMappingOpen(false);
    } catch (e: any) {
      toast.error('Save failed: ' + e.message);
    } finally {
      setMappingSaving(false);
    }
  };


  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Server className="h-8 w-8 text-primary" />
            Attendance Register
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Biometric attendance fetched from your eSSL device.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2" onClick={openMapping}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Employee Mapping
          </Button>
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <SettingsIcon className="h-4 w-4" /> Device Settings
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <SettingsIcon className="h-5 w-5 text-primary" />
                  Connection Settings
                </DialogTitle>
                <DialogDescription>
                  Device URL and authentication credentials
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="url">Web Service URL</Label>
                  <Input id="url" name="url" value={config.url} onChange={handleConfigChange} placeholder="http://192.168.1.34:85/iclock/WebAPIService.asmx" className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serialNumber">Device Serial Number</Label>
                  <Input id="serialNumber" name="serialNumber" value={config.serialNumber} onChange={handleConfigChange} placeholder="e.g. DS123456" className="bg-background" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="userName">User Name</Label>
                    <Input id="userName" name="userName" value={config.userName} onChange={handleConfigChange} className="bg-background" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userPassword">Password</Label>
                    <Input id="userPassword" name="userPassword" type="password" value={config.userPassword} onChange={handleConfigChange} className="bg-background" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button className="w-full sm:w-auto gap-2" onClick={saveConfig}>
                  <Save className="h-4 w-4" /> Save Configuration
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">From</Label>
          <Input type="date" value={logs.from} onChange={e => setLogs({...logs, from: e.target.value})} className="h-9 w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">To</Label>
          <Input type="date" value={logs.to} onChange={e => setLogs({...logs, to: e.target.value})} className="h-9 w-40" />
        </div>
        <Button onClick={fetchLogs} disabled={loading || !logs.from || !logs.to || !config.serialNumber || !config.url} className="h-9 gap-2 px-5">
          <DownloadCloud className="h-4 w-4" />
          {loading ? 'Fetching...' : 'Fetch Attendance'}
        </Button>
        {attendanceData && (
          <div className="ml-auto flex items-center gap-5 self-end pb-0.5">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />Present</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" />Late</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" />Absent</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" />WFH</span>
            <span className="text-xs text-muted-foreground border-l pl-4">{attendanceData.records.length} employees · {attendanceData.dates.length} days</span>
            <span className="text-[10px] text-muted-foreground/60 italic">Click Absent cell to mark WFH</span>
          </div>
        )}
      </div>

      {/* Daily Status Summary */}
      {attendanceData && selectedSummaryDate && (() => {
        const presentList: any[] = [];
        const absentList: any[] = [];
        const wfhList: any[] = [];

        attendanceData.records.forEach(r => {
          const dayData = r.statuses[selectedSummaryDate];
          if (!dayData) return;
          const isWfh = wfhSet.has(`${r.pin}|${selectedSummaryDate}`);
          const status = isWfh && dayData.status === 'A' ? 'W' : dayData.status;

          if (status === 'P' || status === 'L') {
            presentList.push({ name: r.name, pin: r.pin, time: dayData.firstIn, isLate: status === 'L' });
          } else if (status === 'W') {
            wfhList.push({ name: r.name, pin: r.pin });
          } else {
            absentList.push({ name: r.name, pin: r.pin });
          }
        });

        const formatDateHeader = (dStr: string) => {
          return new Date(dStr).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
        };

        return (
          <div className="flex flex-col gap-4 p-5 rounded-xl border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Attendance Snapshot</span>
                <span className="font-bold text-foreground text-base mt-0.5">{formatDateHeader(selectedSummaryDate)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Select Date:</span>
                <select
                  value={selectedSummaryDate}
                  onChange={e => setSelectedSummaryDate(e.target.value)}
                  className="h-8 rounded-lg border bg-background px-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  {attendanceData.dates.map(d => (
                    <option key={d} value={d}>
                      {new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-1">
              {/* Present Box */}
              <div className="rounded-xl border p-4 bg-emerald-50/20 dark:bg-emerald-950/5 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-emerald-600 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Present ({presentList.length})
                  </span>
                </div>
                {presentList.length > 0 ? (
                  <div className="flex flex-col gap-1 max-h-32 overflow-auto pr-1">
                    {presentList.map((e, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-emerald-100/30 last:border-0">
                        <span className="font-medium text-foreground">{e.name}</span>
                        <span className="text-[10px] text-muted-foreground font-medium tabular-nums bg-emerald-100/50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded">
                          {e.time || '—'} {e.isLate && <span className="text-amber-500 font-bold ml-1">L</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic py-2">No employees checked in</span>
                )}
              </div>

              {/* Absent Box */}
              <div className="rounded-xl border p-4 bg-rose-50/20 dark:bg-rose-950/5 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-rose-600 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Absent ({absentList.length})
                  </span>
                </div>
                {absentList.length > 0 ? (
                  <div className="flex flex-col gap-1 max-h-32 overflow-auto pr-1">
                    {absentList.map((e, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-rose-100/30 last:border-0">
                        <span className="font-medium text-foreground">{e.name}</span>
                        <span className="text-[10px] text-muted-foreground">ID: {e.pin}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic py-2">No absentees</span>
                )}
              </div>

              {/* WFH Box */}
              <div className="rounded-xl border p-4 bg-blue-50/20 dark:bg-blue-950/5 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-blue-600 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    Work From Home ({wfhList.length})
                  </span>
                </div>
                {wfhList.length > 0 ? (
                  <div className="flex flex-col gap-1 max-h-32 overflow-auto pr-1">
                    {wfhList.map((e, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-blue-100/30 last:border-0">
                        <span className="font-medium text-foreground">{e.name}</span>
                        <span className="text-[10px] text-muted-foreground">ID: {e.pin}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic py-2">No one working from home</span>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Attendance Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {attendanceData ? (
          <div className="overflow-auto max-h-[65vh]">
            <table className="min-w-max w-full text-sm border-collapse">
              <thead className="sticky top-0 z-20 bg-card/95 backdrop-blur-sm border-b-2 border-border">
                <tr>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs w-10">#</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-foreground text-xs uppercase tracking-wide min-w-[200px]">Employee</th>
                  {attendanceData.dates.map(date => {
                    const d = new Date(date);
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <th key={date} className={`px-1.5 py-3 text-center min-w-[72px] ${isWeekend ? 'bg-violet-50/70 dark:bg-violet-950/20' : ''}`}>
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-sm font-bold text-foreground leading-none">{d.getDate()}</span>
                          <span className={`text-[10px] font-semibold uppercase tracking-wide ${isWeekend ? 'text-violet-500' : 'text-muted-foreground'}`}>
                            {d.toLocaleDateString('en-US', { weekday: 'short' })}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {attendanceData.records.map((record, i) => {
                  const initials = record.name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();
                  const avatarColors = ['bg-blue-500','bg-violet-500','bg-emerald-600','bg-orange-500','bg-rose-500','bg-cyan-600','bg-indigo-500','bg-teal-600'];
                  const avatarColor = avatarColors[i % avatarColors.length];
                  return (
                    <tr key={i} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground font-medium">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-full ${avatarColor} text-white flex items-center justify-center font-bold text-sm shrink-0 shadow`}>
                            {initials}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-sm leading-tight">{record.name}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">ID: {record.pin}</p>
                          </div>
                        </div>
                      </td>
                      {attendanceData.dates.map(date => {
                        const dayData = record.statuses[date];
                        const d = new Date(date);
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        const isWfh = wfhSet.has(`${record.pin}|${date}`);
                        const effectiveStatus = isWfh && dayData.status === 'A' ? 'W' : dayData.status;
                        let bubbleCls = 'bg-red-100 text-red-600 cursor-pointer hover:bg-blue-100 hover:text-blue-600 transition-colors';
                        if (effectiveStatus === 'P') bubbleCls = 'bg-emerald-100 text-emerald-700';
                        else if (effectiveStatus === 'L') bubbleCls = 'bg-amber-100 text-amber-700';
                        else if (effectiveStatus === 'W') bubbleCls = 'bg-blue-100 text-blue-700 cursor-pointer hover:bg-red-100 hover:text-red-600 transition-colors';
                        const isClickable = effectiveStatus === 'A' || effectiveStatus === 'W';
                        return (
                          <td key={date} className={`px-1.5 py-2.5 align-top ${isWeekend ? 'bg-violet-50/30 dark:bg-violet-950/10' : ''}`}>
                            <div className="flex flex-col items-center gap-1">
                              <span
                                title={isClickable ? (effectiveStatus === 'W' ? 'Click to remove WFH' : 'Click to mark WFH') : undefined}
                                onClick={isClickable ? () => setPendingWfh({ pin: record.pin, date, name: record.name, action: effectiveStatus === 'W' ? 'remove' : 'mark' }) : undefined}
                                className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-[11px] font-bold ${bubbleCls}`}
                              >
                                {effectiveStatus}
                              </span>
                              {(dayData.status === 'P' || dayData.status === 'L') && (
                                <div className="flex flex-col items-center gap-px">
                                  <span className="text-[10px] text-emerald-600 font-medium tabular-nums">{dayData.firstIn}</span>
                                  <span className="text-[10px] text-rose-500 font-medium tabular-nums">{dayData.lastOut ?? '—'}</span>
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : result ? (
          <div className="p-6">
            <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground bg-muted/40 p-4 rounded-lg border">{result}</pre>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-28 gap-5">
            <div className="h-20 w-20 rounded-2xl bg-primary/5 border-2 border-primary/10 flex items-center justify-center">
              <History className="h-9 w-9 text-primary/30" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground/70">No attendance data loaded</p>
              <p className="text-sm text-muted-foreground mt-1">Pick a date range and click <span className="font-semibold text-primary">Fetch Attendance</span></p>
            </div>
          </div>
        )}
      </div>
      {/* Employee Mapping Dialog */}
      <Dialog open={isMappingOpen} onOpenChange={setIsMappingOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Employee List
            </DialogTitle>
            <DialogDescription>
              Add each employee's <strong>Device ID</strong> (from the eSSL portal) and their <strong>Name</strong>. This is used to display real names on the attendance board.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto flex-1 border rounded-lg mt-2">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm border-b">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground w-28">Device ID</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Employee Name</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bioEmployees.map((emp, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2">
                      <Input
                        className="h-8 text-center tabular-nums w-full"
                        placeholder="e.g. 10"
                        value={emp.pin}
                        onChange={e => setBioEmployees(prev => prev.map((x, j) => j === i ? { ...x, pin: e.target.value } : x))}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-8 w-full"
                        placeholder="e.g. Name"
                        value={emp.name}
                        onChange={e => setBioEmployees(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => setBioEmployees(prev => prev.filter((_, j) => j !== i))}
                        className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors mx-auto"
                        title="Remove row"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={() => setBioEmployees(prev => [...prev, { pin: '', name: '' }])}
            className="mt-2 w-full border border-dashed border-primary/30 rounded-lg py-2 text-sm text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            Add Employee
          </button>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setIsMappingOpen(false)}>Cancel</Button>
            <Button onClick={saveMapping} disabled={mappingSaving} className="gap-2">
              <Save className="h-4 w-4" />
              {mappingSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* WFH Confirmation Dialog */}

      <Dialog open={!!pendingWfh} onOpenChange={open => { if (!open) setPendingWfh(null); }}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {pendingWfh?.action === 'mark' ? (
                <span className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">W</span>
              ) : (
                <span className="h-8 w-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm">A</span>
              )}
              {pendingWfh?.action === 'mark' ? 'Mark as Work From Home?' : 'Remove WFH Status?'}
            </DialogTitle>
            <DialogDescription className="pt-1">
              {pendingWfh?.action === 'mark' ? (
                <>
                  Mark <span className="font-semibold text-foreground">{pendingWfh?.name}</span> as{' '}
                  <span className="font-semibold text-blue-600">Work From Home</span> on{' '}
                  <span className="font-semibold text-foreground">
                    {pendingWfh?.date ? new Date(pendingWfh.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                  </span>?
                </>
              ) : (
                <>
                  Remove WFH status for <span className="font-semibold text-foreground">{pendingWfh?.name}</span> on{' '}
                  <span className="font-semibold text-foreground">
                    {pendingWfh?.date ? new Date(pendingWfh.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                  </span>? It will revert to <span className="font-semibold text-red-600">Absent</span>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPendingWfh(null)}>Cancel</Button>
            <Button
              className={pendingWfh?.action === 'mark' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-destructive hover:bg-destructive/90 text-white'}
              onClick={async () => {
                if (pendingWfh) {
                  await toggleWfh(pendingWfh.pin, pendingWfh.date);
                  setPendingWfh(null);
                }
              }}
            >
              {pendingWfh?.action === 'mark' ? '✓ Confirm WFH' : 'Remove WFH'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingsIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2001/XMLSchema-instance"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
