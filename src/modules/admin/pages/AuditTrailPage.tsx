import { useEffect, useState, useCallback } from "react"
import { useAuditStore, type AuditRecord } from "@/modules/admin"
import { useAuthStore } from "@/store/useAuthStore"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns"
import {
  PlusCircle, RefreshCcw, Trash2, CheckCircle2, CreditCard,
  LogIn, FileText, User, Send, ThumbsUp, ThumbsDown,
  UserCheck, ClipboardCheck, Milestone, StickyNote,
  Download, ArrowRight, Shield, Building2, Key, Unlock,
  Search, Filter, X, ChevronLeft, ChevronRight, CalendarIcon,
  AlertTriangle, Info, Zap, BarChart3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ActivityAction, AuditSeverity, AuditTargetType } from "@/lib/auditLogger"

// ─── Action Config ─────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { icon: JSX.Element; label: string; color: string; dot: string }> = {
  CREATE:               { icon: <PlusCircle className="h-3.5 w-3.5" />,    label: "Created",              color: "text-emerald-500", dot: "bg-emerald-500/15 border-emerald-500/40" },
  UPDATE:               { icon: <RefreshCcw className="h-3.5 w-3.5" />,    label: "Updated",              color: "text-blue-500",    dot: "bg-blue-500/15 border-blue-500/40" },
  DELETE:               { icon: <Trash2 className="h-3.5 w-3.5" />,         label: "Deleted",              color: "text-rose-500",    dot: "bg-rose-500/15 border-rose-500/40" },
  STATUS_CHANGE:        { icon: <RefreshCcw className="h-3.5 w-3.5" />,    label: "Status Changed",       color: "text-purple-500",  dot: "bg-purple-500/15 border-purple-500/40" },
  PAYMENT_STATUS_CHANGE:{ icon: <CreditCard className="h-3.5 w-3.5" />,    label: "Payment Status",       color: "text-amber-500",   dot: "bg-amber-500/15 border-amber-500/40" },
  PROPOSAL_SENT:        { icon: <Send className="h-3.5 w-3.5" />,           label: "Proposal Sent",        color: "text-indigo-500",  dot: "bg-indigo-500/15 border-indigo-500/40" },
  PROPOSAL_APPROVED:    { icon: <ThumbsUp className="h-3.5 w-3.5" />,      label: "Proposal Approved",    color: "text-emerald-500", dot: "bg-emerald-500/15 border-emerald-500/40" },
  PROPOSAL_REJECTED:    { icon: <ThumbsDown className="h-3.5 w-3.5" />,    label: "Proposal Rejected",    color: "text-rose-500",    dot: "bg-rose-500/15 border-rose-500/40" },
  CLIENT_ACTIVATED:     { icon: <UserCheck className="h-3.5 w-3.5" />,     label: "Client Activated",     color: "text-emerald-500", dot: "bg-emerald-500/15 border-emerald-500/40" },
  INVOICE_GENERATED:    { icon: <FileText className="h-3.5 w-3.5" />,      label: "Invoice Generated",    color: "text-cyan-500",    dot: "bg-cyan-500/15 border-cyan-500/40" },
  TASK_COMPLETED:       { icon: <ClipboardCheck className="h-3.5 w-3.5" />,label: "Task Completed",       color: "text-teal-500",    dot: "bg-teal-500/15 border-teal-500/40" },
  MILESTONE_REACHED:    { icon: <Milestone className="h-3.5 w-3.5" />,     label: "Milestone Reached",    color: "text-violet-500",  dot: "bg-violet-500/15 border-violet-500/40" },
  NOTE_ADDED:           { icon: <StickyNote className="h-3.5 w-3.5" />,    label: "Note Added",           color: "text-slate-400",   dot: "bg-slate-500/15 border-slate-500/40" },
  PERMISSION_CHANGE:    { icon: <Key className="h-3.5 w-3.5" />,            label: "Permission Changed",   color: "text-orange-500",  dot: "bg-orange-500/15 border-orange-500/40" },
  ACCESS_GRANTED:       { icon: <Unlock className="h-3.5 w-3.5" />,         label: "Access Granted",       color: "text-emerald-500", dot: "bg-emerald-500/15 border-emerald-500/40" },
  ACCESS_REVOKED:       { icon: <Shield className="h-3.5 w-3.5" />,         label: "Access Revoked",       color: "text-rose-500",    dot: "bg-rose-500/15 border-rose-500/40" },
  ORG_SUSPENDED:        { icon: <Building2 className="h-3.5 w-3.5" />,     label: "Org Suspended",        color: "text-rose-500",    dot: "bg-rose-500/15 border-rose-500/40" },
  ORG_REACTIVATED:      { icon: <Building2 className="h-3.5 w-3.5" />,     label: "Org Reactivated",      color: "text-emerald-500", dot: "bg-emerald-500/15 border-emerald-500/40" },
  LOGIN:                { icon: <LogIn className="h-3.5 w-3.5" />,          label: "Login",                color: "text-slate-400",   dot: "bg-slate-500/15 border-slate-500/40" },
  EXPORT:               { icon: <Download className="h-3.5 w-3.5" />,       label: "Exported",             color: "text-slate-400",   dot: "bg-slate-500/15 border-slate-500/40" },
}

const ENTITY_COLORS: Record<string, string> = {
  lead:         "bg-blue-500/10 text-blue-500 border-blue-500/20",
  client:       "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  project:      "bg-violet-500/10 text-violet-500 border-violet-500/20",
  task:         "bg-teal-500/10 text-teal-500 border-teal-500/20",
  invoice:      "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  payment:      "bg-amber-500/10 text-amber-500 border-amber-500/20",
  proposal:     "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  document:     "bg-slate-500/10 text-slate-400 border-slate-500/20",
  user:         "bg-orange-500/10 text-orange-500 border-orange-500/20",
  organization: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  milestone:    "bg-purple-500/10 text-purple-500 border-purple-500/20",
}

const SEVERITY_CONFIG = {
  info:     { icon: <Info className="h-3 w-3" />,         class: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  warning:  { icon: <AlertTriangle className="h-3 w-3" />, class: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  critical: { icon: <Zap className="h-3 w-3" />,           class: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
}

// ─── Date grouping ─────────────────────────────────────────────────────────────

function getDateLabel(dateStr: string) {
  const d = new Date(dateStr)
  if (isToday(d))     return "Today"
  if (isYesterday(d)) return "Yesterday"
  return format(d, "MMMM d, yyyy")
}

function groupByDate(records: AuditRecord[]) {
  const groups: { label: string; items: AuditRecord[] }[] = []
  let currentLabel = ""
  for (const r of records) {
    const label = getDateLabel(r.created_at)
    if (label !== currentLabel) {
      currentLabel = label
      groups.push({ label, items: [] })
    }
    groups[groups.length - 1].items.push(r)
  }
  return groups
}

// ─── Row Component ─────────────────────────────────────────────────────────────

function AuditRow({ record, isExpanded, onToggle }: {
  record: AuditRecord
  isExpanded: boolean
  onToggle: () => void
}) {
  const config = ACTION_CONFIG[record.action] ?? {
    icon: <FileText className="h-3.5 w-3.5" />,
    label: record.action,
    color: "text-muted-foreground",
    dot: "bg-muted border-muted-foreground/20",
  }
  const sev = SEVERITY_CONFIG[record.severity] ?? SEVERITY_CONFIG.info
  const hasDiff = record.metadata?.previous_value !== undefined && record.metadata?.new_value !== undefined

  return (
    <div
      className={cn(
        "relative flex gap-4 items-start pl-1 cursor-pointer group",
        isExpanded && "bg-muted/20 rounded-xl p-3 -mx-3"
      )}
      onClick={onToggle}
    >
      {/* Dot */}
      <div className={cn(
        "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-transform group-hover:scale-110",
        config.dot, config.color
      )}>
        {config.icon}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="text-sm font-bold text-foreground">
              {record.is_system ? "System" : (record.profiles?.full_name || "Unknown User")}
            </span>
            <span className={cn("text-sm font-medium", config.color)}>{config.label}</span>
            {record.target_name && (
              <span className="text-sm text-foreground font-semibold truncate max-w-[200px]">
                "{record.target_name}"
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Severity Badge */}
            <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-wider px-1.5 py-0 gap-1", sev.class)}>
              {sev.icon}{record.severity}
            </Badge>
            {/* Entity Badge */}
            <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-wider px-1.5 py-0", ENTITY_COLORS[record.target_type] ?? "bg-muted text-muted-foreground")}>
              {record.target_type}
            </Badge>
            <Avatar className="h-5 w-5 border shrink-0">
              <AvatarImage src={record.profiles?.avatar_url ?? ""} />
              <AvatarFallback className="text-[8px]"><User className="h-2.5 w-2.5" /></AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Description */}
        {record.metadata?.description && (
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {record.metadata.description}
          </p>
        )}

        {/* Diff view */}
        {hasDiff && (
          <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/40 text-[10px] font-bold">
            <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 line-through border border-rose-500/10">
              {typeof record.metadata.previous_value === 'number'
                ? `₹${record.metadata.previous_value.toLocaleString()}`
                : String(record.metadata.previous_value)}
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              {typeof record.metadata.new_value === 'number'
                ? `₹${record.metadata.new_value.toLocaleString()}`
                : String(record.metadata.new_value)}
            </span>
          </div>
        )}

        {/* Expanded: full metadata + checksum */}
        {isExpanded && (
          <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
            <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground font-medium">
              <div><span className="text-foreground font-bold">Record ID:</span> {record.id}</div>
              <div><span className="text-foreground font-bold">Target ID:</span> {record.target_id}</div>
              {record.checksum && (
                <div className="col-span-2"><span className="text-foreground font-bold">Integrity Hash:</span> <span className="font-mono">{record.checksum}</span></div>
              )}
            </div>
            {Object.keys(record.metadata || {}).length > 0 && (
              <pre className="text-[10px] text-muted-foreground bg-muted/40 rounded-lg p-2 overflow-x-auto font-mono border border-border/30 max-h-32">
                {JSON.stringify(record.metadata, null, 2)}
              </pre>
            )}
          </div>
        )}

        <span className="mt-1.5 inline-block text-[10px] text-muted-foreground/60 font-medium">
          {formatDistanceToNow(new Date(record.created_at), { addSuffix: true })}
          {" · "}{format(new Date(record.created_at), "MMM d, HH:mm")}
        </span>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AuditTrailPage() {
  const { records, totalCount, isLoading, filters, fetchAuditTrail, setFilters, resetFilters, subscribeToAudit } = useAuditStore()
  const { profile } = useAuthStore()
  const isSuperAdmin = profile?.role === 'super_admin'
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const page = filters.page ?? 1
  const limit = filters.limit ?? 50
  const totalPages = Math.ceil(totalCount / limit)
  const hasFilters = !!(filters.action || filters.targetType || filters.userId || filters.severity || search)

  useEffect(() => {
    fetchAuditTrail()
    const unsub = subscribeToAudit()
    return unsub
  }, [])

  const handleSearch = useCallback(() => {
    setFilters({ search })
    fetchAuditTrail({ search })
  }, [search, setFilters, fetchAuditTrail])

  const handleFilterChange = (key: string, value: string) => {
    const update = { [key]: (value === "all" || !value) ? undefined : value }
    setFilters(update)
    fetchAuditTrail({ ...filters, ...update, page: 1 })
  }

  const handleReset = () => {
    setSearch("")
    resetFilters()
    fetchAuditTrail({})
  }

  const grouped = groupByDate(records)

  return (
    <PageWrapper
      title="Audit Trail"
      description="Immutable, chronological record of all system events."
    >
      {/* ── Stats bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Events", value: totalCount.toLocaleString(), icon: <BarChart3 className="h-4 w-4 text-primary" />, color: "text-primary" },
          { label: "Critical", value: records.filter(r => r.severity === 'critical').length, icon: <Zap className="h-4 w-4 text-rose-500" />, color: "text-rose-500" },
          { label: "Warnings", value: records.filter(r => r.severity === 'warning').length, icon: <AlertTriangle className="h-4 w-4 text-amber-500" />, color: "text-amber-500" },
          { label: "Security Events", value: records.filter(r => ['PERMISSION_CHANGE','ACCESS_REVOKED','ORG_SUSPENDED'].includes(r.action)).length, icon: <Shield className="h-4 w-4 text-orange-500" />, color: "text-orange-500" },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50">
              {stat.icon}
            </div>
            <div>
              <p className={cn("text-lg font-black tracking-tight", stat.color)}>{stat.value}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="rounded-xl border border-border/50 bg-card p-4 mb-6 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              id="audit-search"
              placeholder="Search by entity name..."
              className="pl-9 h-9 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>

          {/* Action filter */}
          <Select value={filters.action ?? 'all'} onValueChange={v => handleFilterChange('action', v)}>
            <SelectTrigger id="audit-filter-action" className="h-9 w-[160px] text-sm">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {Object.entries(ACTION_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Entity Type filter */}
          <Select value={filters.targetType ?? 'all'} onValueChange={v => handleFilterChange('targetType', v)}>
            <SelectTrigger id="audit-filter-entity" className="h-9 w-[140px] text-sm">
              <SelectValue placeholder="All Entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              {Object.keys(ENTITY_COLORS).map(t => (
                <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Severity filter */}
          <Select value={filters.severity ?? 'all'} onValueChange={v => handleFilterChange('severity', v)}>
            <SelectTrigger id="audit-filter-severity" className="h-9 w-[120px] text-sm">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>

          {/* Date range */}
          <div className="flex items-center gap-1">
            <Input
              type="date"
              id="audit-from-date"
              className="h-9 w-[130px] text-xs"
              value={filters.fromDate ? filters.fromDate.substring(0, 10) : ''}
              onChange={e => handleFilterChange('fromDate', e.target.value ? new Date(e.target.value).toISOString() : '')}
            />
            <span className="text-muted-foreground text-xs font-bold">→</span>
            <Input
              type="date"
              id="audit-to-date"
              className="h-9 w-[130px] text-xs"
              value={filters.toDate ? filters.toDate.substring(0, 10) : ''}
              onChange={e => handleFilterChange('toDate', e.target.value ? new Date(e.target.value).toISOString() : '')}
            />
          </div>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="h-9 gap-1.5 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" /> Reset
            </Button>
          )}

          <Button size="sm" onClick={handleSearch} className="h-9 gap-1.5 ml-auto font-bold">
            <Filter className="h-3.5 w-3.5" /> Apply
          </Button>
        </div>

        {hasFilters && (
          <p className="text-xs text-muted-foreground font-medium">
            Showing <span className="font-bold text-foreground">{records.length}</span> of <span className="font-bold text-foreground">{totalCount}</span> events matching active filters
          </p>
        )}
      </div>

      {/* ── Timeline ── */}
      <div className="rounded-xl border border-border/50 bg-card p-6">
        {isLoading && records.length === 0 ? (
          <div className="space-y-6">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex gap-4 items-start">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center">
              <BarChart3 className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-bold text-muted-foreground">No audit events found</p>
            <p className="text-xs text-muted-foreground/60">Try adjusting your filters or date range</p>
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={handleReset} className="mt-2">Clear Filters</Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(group => (
              <div key={group.label} className="space-y-1">
                {/* Date separator */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-border/50" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 shrink-0">
                    {group.label}
                  </span>
                  <div className="h-px flex-1 bg-border/50" />
                </div>

                {/* Timeline items */}
                <div className="relative space-y-4 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-px before:bg-border/50">
                  {group.items.map(record => (
                    <AuditRow
                      key={record.id}
                      record={record}
                      isExpanded={expandedId === record.id}
                      onToggle={() => setExpandedId(expandedId === record.id ? null : record.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-border/40">
            <p className="text-xs text-muted-foreground font-medium">
              Page <span className="font-bold text-foreground">{page}</span> of <span className="font-bold text-foreground">{totalPages}</span>
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isLoading}
                onClick={() => {
                  const p = page - 1
                  setFilters({ page: p })
                  fetchAuditTrail({ ...filters, page: p })
                }}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isLoading}
                onClick={() => {
                  const p = page + 1
                  setFilters({ page: p })
                  fetchAuditTrail({ ...filters, page: p })
                }}
                className="gap-1"
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  )
}

