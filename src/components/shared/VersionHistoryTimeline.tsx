import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { 
  History, 
  User, 
  ChevronRight, 
  Database,
  ArrowRightLeft,
  Clock,
  ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'

interface Version {
  id: string
  version_number: number
  data: any
  created_at: string
  change_summary: string
  profiles: {
    full_name: string | null
    avatar_url: string | null
  } | null
}

interface VersionHistoryTimelineProps {
  entityType: 'invoice' | 'proposal' | 'project' | 'client'
  entityId: string
  trigger?: React.ReactNode
}

export function VersionHistoryTimeline({ entityType, entityId, trigger }: VersionHistoryTimelineProps) {
  const [versions, setVersions] = useState<Version[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null)

  const fetchVersions = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('entity_versions')
        .select('*, profiles:changed_by(full_name, avatar_url)')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('version_number', { ascending: false })
      
      if (error) throw error
      setVersions(data)
    } catch (err) {
      console.error("Failed to fetch versions:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Sheet onOpenChange={(open) => open && fetchVersions()}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <History className="h-4 w-4" />
            History
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] border-l border-border/50 bg-card/95 backdrop-blur-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Version History
          </SheetTitle>
          <SheetDescription>
            Immutable audit trail for this {entityType}. Compare snapshots and track changes.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-8 flex flex-col h-[calc(100vh-180px)]">
          <ScrollArea className="flex-1 pr-4">
            <div className="relative space-y-4">
              {/* Vertical line */}
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border/50" />

              {versions.length === 0 && !isLoading && (
                <div className="text-center py-10">
                  <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground font-medium">No previous versions found.</p>
                </div>
              )}

              {versions.map((v, i) => (
                <div key={v.id} className="relative pl-10 group">
                  {/* Dot */}
                  <div className={cn(
                    "absolute left-2.5 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-primary transition-transform group-hover:scale-125",
                    i === 0 ? "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "bg-muted-foreground/30"
                  )} />

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-widest text-primary">
                        Version {v.version_number} {i === 0 && "• Current"}
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {format(new Date(v.created_at), 'MMM d, HH:mm')}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-muted/20 border border-border/50 group-hover:bg-muted/40 transition-colors">
                      <p className="text-xs font-medium text-foreground mb-2">
                        {v.change_summary}
                      </p>
                      
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground">
                          Edited by {v.profiles?.full_name || 'System Auto-Save'}
                        </span>
                      </div>

                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full mt-3 h-7 text-[10px] font-black uppercase tracking-tight gap-1 hover:bg-primary/10 hover:text-primary"
                        onClick={() => setSelectedVersion(v)}
                      >
                        <ArrowRightLeft className="h-3 w-3" />
                        Compare Snapshot
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {selectedVersion && (
            <div className="mt-4 p-4 rounded-2xl bg-muted/40 border border-primary/20 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-primary">Snapshot Viewer v{selectedVersion.version_number}</h4>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedVersion(null)}>
                  <ChevronRight className="h-4 w-4 rotate-90" />
                </Button>
              </div>
              <div className="bg-black/40 rounded-lg p-3 overflow-hidden">
                <pre className="text-[10px] font-mono leading-tight text-emerald-400 overflow-x-auto max-h-[150px]">
                  {JSON.stringify(selectedVersion.data, null, 2)}
                </pre>
              </div>
              <p className="text-[9px] text-muted-foreground mt-2 italic font-medium">
                * Note: Snapshot contains the full state of the record at this point in time.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
