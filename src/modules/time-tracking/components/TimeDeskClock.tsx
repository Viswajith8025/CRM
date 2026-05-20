import { useEffect, useState } from "react"
import { Play, Pause, Coffee, LogOut, Clock, Timer, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTimeDeskStore } from "../timeDeskStore"
import type { BreakType } from "../timeDeskStore"
import { cn } from "@/lib/utils"

export function TimeDeskClock() {
  const { 
    activeSession, 
    activeBreak, 
    workDuration, 
    syncLiveTimers, 
    fetchActiveSession,
    checkIn,
    checkOut,
    startBreak,
    endBreak,
    isLoading
  } = useTimeDeskStore()

  const [time, setTime] = useState(0)

  // Live clock tick
  useEffect(() => {
    fetchActiveSession()
    const interval = setInterval(() => {
      syncLiveTimers()
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const isWorking = activeSession && !activeBreak
  const isOnBreak = !!activeBreak

  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        "hidden md:flex items-center gap-3 px-4 py-1.5 rounded-full border transition-all duration-300",
        isWorking ? "bg-sky-50 border-sky-200 text-sky-700 shadow-sm shadow-sky-100" :
        isOnBreak ? "bg-amber-50 border-amber-200 text-amber-700 shadow-sm shadow-amber-100" :
        "bg-slate-50 border-slate-200 text-slate-400"
      )}>
        <div className="flex items-center gap-2 mr-2 border-r border-current/20 pr-3">
          <div className={cn(
            "h-2 w-2 rounded-full animate-pulse",
            isWorking ? "bg-sky-500" : 
            isOnBreak ? "bg-amber-500" : 
            "bg-slate-300"
          )} />
          <span className="text-[10px] font-black uppercase tracking-widest">
            {isWorking ? "Working" : isOnBreak ? "On Break" : "Offline"}
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono font-black text-sm tabular-nums">
          <Clock className="h-3.5 w-3.5 opacity-50" />
          {formatTime(workDuration)}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant={activeSession ? "default" : "outline"} 
            size="sm" 
            className={cn(
              "font-black uppercase tracking-tighter text-[10px] h-9 gap-2 shadow-sm transition-all active:scale-95",
              isWorking ? "bg-sky-600 hover:bg-sky-700 shadow-sky-600/20" :
              isOnBreak ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20" :
              "border-sky-200 text-sky-600 hover:bg-sky-50"
            )}
            disabled={isLoading}
          >
            {isWorking ? <Timer className="h-3.5 w-3.5 animate-spin-slow" /> : 
             isOnBreak ? <Coffee className="h-3.5 w-3.5" /> : 
             <Play className="h-3.5 w-3.5" />}
            {isWorking ? "In Session" : isOnBreak ? "Break Mode" : "Start Shift"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 p-4 rounded-2xl border-border/40 shadow-2xl bg-card">
          <div className="flex items-center gap-3 mb-4 p-1 border-b border-border/10 pb-4">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-2">Company Break Windows</p>
              <div className="flex gap-2">
                <span className="text-[9px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">TEA: 11:00</span>
                <span className="text-[9px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">LUNCH: 13:00</span>
                <span className="text-[9px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">TEA: 16:00</span>
              </div>
            </div>
          </div>
          
          <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2 py-1">
            Shift Management
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="opacity-50" />
          
          {!activeSession ? (
            <DropdownMenuItem onClick={() => checkIn()} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer focus:bg-sky-50 focus:text-sky-700">
              <div className="p-2 rounded-lg bg-sky-100 text-sky-600">
                <Play className="h-4 w-4" />
              </div>
              <div>
                <p className="font-black text-sm uppercase tracking-tighter leading-none">Start Shift</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Clock-in for today</p>
              </div>
            </DropdownMenuItem>
          ) : (
            <>
              {isWorking && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="w-full">
                    <DropdownMenuItem className="flex items-center gap-3 p-3 rounded-xl cursor-pointer focus:bg-amber-50 focus:text-amber-700">
                      <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
                        <Coffee className="h-4 w-4" />
                      </div>
                      <div className="text-left">
                        <p className="font-black text-sm uppercase tracking-tighter leading-none">Take Break</p>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Pause work timer</p>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="left" align="start" className="w-48 rounded-xl border-amber-100 p-2">
                    {(['lunch', 'short_break', 'meeting'] as BreakType[]).map(type => (
                      <DropdownMenuItem key={type} onClick={() => startBreak(type)} className="p-2 rounded-lg capitalize font-bold text-xs uppercase tracking-tight">
                        {type.replace('_', ' ')}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {isOnBreak && (
                <DropdownMenuItem onClick={() => endBreak()} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer focus:bg-sky-50 focus:text-sky-700">
                  <div className="p-2 rounded-lg bg-sky-100 text-sky-600">
                    <Play className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-black text-sm uppercase tracking-tighter leading-none">Resume Work</p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Return to session</p>
                  </div>
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator className="my-2" />
              <DropdownMenuItem onClick={() => checkOut()} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer focus:bg-rose-50 focus:text-rose-700">
                <div className="p-2 rounded-lg bg-rose-100 text-rose-600">
                  <LogOut className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-black text-sm uppercase tracking-tighter leading-none text-rose-600">End Shift</p>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Clock-out & Save</p>
                </div>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
