import { useState, useEffect, useMemo } from "react"
import { Play, Coffee, Square, Clock, ChevronLeft, ChevronRight, HelpCircle, Loader2, Calendar as CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useTimeDeskStore } from "../timeDeskStore"
import type { BreakType } from "../timeDeskStore"
import { useTimeDeskSettingsStore } from "../timeDeskSettingsStore"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/useAuthStore"
import { 
  format, 
  differenceInSeconds, 
  addDays, 
  subDays,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth
} from "date-fns"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

// Company Shift Target: 8 Hours
const TARGET_HOURS = 8
const TARGET_SECONDS = TARGET_HOURS * 3600

/**
 * Helper to divide a month into custom weeks where:
 * - Sundays are completely skipped/off.
 * - Each week contains exactly 6 working days (Mon-Sat).
 * - Week 1 starts on the 1st of the month.
 * - The last week contains the remaining days of the month.
 */
function getCustomWeeksForMonth(date: Date) {
  const start = startOfMonth(date)
  const end = endOfMonth(date)
  
  const workingDays: Date[] = []
  let curr = start
  while (curr <= end) {
    if (curr.getDay() !== 0) { // 0 = Sunday is OFF
      workingDays.push(new Date(curr))
    }
    curr = addDays(curr, 1)
  }

  const customWeeks: { wStart: Date; wEnd: Date; days: Date[] }[] = []
  
  for (let i = 0; i < workingDays.length; i += 6) {
    const chunk = workingDays.slice(i, i + 6)
    if (chunk.length > 0) {
      customWeeks.push({
        wStart: chunk[0],
        wEnd: chunk[chunk.length - 1],
        days: chunk
      })
    }
  }

  return customWeeks
}

export function TimeDeskDashboardClock() {
  const { profile } = useAuthStore()
  const {
    activeSession,
    activeBreak,
    fetchActiveSession,
    checkIn,
    checkOut,
    startBreak,
    endBreak,
    isLoading: isStoreLoading
  } = useTimeDeskStore()

  const { workSettings, fetchSettings } = useTimeDeskSettingsStore()

  useEffect(() => {
    fetchSettings()
  }, [])

  // Selected date state (defaults to today)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  // View Mode: 'day' | 'week' | 'month'
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day')

  // Local state for loaded session logs and live ticking
  const [todaySessions, setTodaySessions] = useState<any[]>([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Cumulative durations updated live (in seconds)
  const [liveFocusSeconds, setLiveFocusSeconds] = useState(0)
  const [liveBreakSeconds, setLiveBreakSeconds] = useState(0)
  const [liveActiveTimer, setLiveActiveTimer] = useState(0)

  // Start and end bounds of query based on viewMode and custom 6-working-days logic
  const dateRange = useMemo(() => {
    let start: Date
    let end: Date

    if (viewMode === 'day') {
      start = selectedDate
      end = selectedDate
    } else if (viewMode === 'week') {
      const weeks = getCustomWeeksForMonth(selectedDate)
      const activeWeek = weeks.find(w => selectedDate >= w.wStart && selectedDate <= w.wEnd) || weeks[0]
      start = activeWeek.wStart
      end = activeWeek.wEnd
    } else { // month
      start = startOfMonth(selectedDate)
      end = endOfMonth(selectedDate)
    }

    return { start, end }
  }, [selectedDate, viewMode])

  // Verify if selectedDate range contains today's date
  const isSelectedToday = useMemo(() => {
    const today = new Date()
    if (viewMode === 'day') {
      return isSameDay(selectedDate, today)
    } else if (viewMode === 'week') {
      const weeks = getCustomWeeksForMonth(selectedDate)
      const activeWeek = weeks.find(w => selectedDate >= w.wStart && selectedDate <= w.wEnd) || weeks[0]
      return today >= activeWeek.wStart && today <= activeWeek.wEnd
    } else {
      return isSameMonth(selectedDate, today)
    }
  }, [selectedDate, viewMode, currentTime])

  // Can the user check-in / break today from this view? (Only allowed in Day view on today's date)
  const canControlSession = useMemo(() => {
    return viewMode === 'day' && isSameDay(selectedDate, new Date())
  }, [viewMode, selectedDate])

  // Fetch shift sessions and breaks for selected range
  const fetchTodayData = async (rangeStart: Date = dateRange.start, rangeEnd: Date = dateRange.end) => {
    if (!profile?.id) return
    setIsLoadingLogs(true)
    try {
      const startStr = format(rangeStart, 'yyyy-MM-dd')
      const endStr = format(rangeEnd, 'yyyy-MM-dd')
      
      const { data, error } = await supabase
        .from('work_sessions')
        .select('*, break_sessions(*)')
        .eq('user_id', profile.id)
        .gte('start_time', `${startStr}T00:00:00`)
        .lte('start_time', `${endStr}T23:59:59`)
        .order('start_time', { ascending: true })

      if (error) throw error
      setTodaySessions(data || [])
    } catch (err) {
      console.error("Failed to load session statistics for selected date range", err)
    } finally {
      setIsLoadingLogs(false)
    }
  }

  // Reload logs when dateRange or profile changes
  useEffect(() => {
    fetchActiveSession()
    fetchTodayData(dateRange.start, dateRange.end)
  }, [profile?.id, dateRange])

  // Periodic updates: tick live clock & synchronize every second (only for today)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Calculate live cumulative work and break durations
  useEffect(() => {
    let focusSec = 0
    let breakSec = 0
    let activeTimerSec = 0

    // 1. Calculate finished sessions in the selected period (excluding active live session)
    todaySessions.forEach(session => {
      // If it's the active live session, we handle it separately to get real-time ticking
      if (activeSession && session.id === activeSession.id) return

      const start = new Date(session.start_time)
      const end = session.end_time ? new Date(session.end_time) : new Date()
      const totalSec = differenceInSeconds(end, start)

      let sessionBreakSec = 0
      session.break_sessions?.forEach((b: any) => {
        if (b.type === 'meeting') return // Skip meetings, count as active focus!
        const bStart = new Date(b.start_time)
        const bEnd = b.end_time ? new Date(b.end_time) : new Date()
        sessionBreakSec += differenceInSeconds(bEnd, bStart)
      })

      breakSec += sessionBreakSec
      focusSec += Math.max(0, totalSec - sessionBreakSec)
    })

    // 2. Add active live session details (if user is currently clocked in AND the selected period includes today)
    const isPeriodToday = isSameDay(selectedDate, new Date()) || 
                          (viewMode === 'week' && (() => {
                            const weeks = getCustomWeeksForMonth(selectedDate)
                            const activeWeek = weeks.find(w => selectedDate >= w.wStart && selectedDate <= w.wEnd) || weeks[0]
                            const today = new Date()
                            return today >= activeWeek.wStart && today <= activeWeek.wEnd
                          })()) ||
                          (viewMode === 'month' && isSameMonth(selectedDate, new Date()))

    if (activeSession && isPeriodToday) {
      const now = new Date()
      const sessionStart = new Date(activeSession.start_time)
      const elapsedTotal = differenceInSeconds(now, sessionStart)

      const liveSessionData = todaySessions.find(s => s.id === activeSession.id) || activeSession

      // Calculate completed breaks of this active session (excluding meetings)
      let completedBreaksSec = 0
      liveSessionData.break_sessions?.forEach((b: any) => {
        if (b.type === 'meeting') return // Skip meetings
        if (b.end_time) {
          completedBreaksSec += differenceInSeconds(new Date(b.end_time), new Date(b.start_time))
        }
      })

      let currentLiveBreakSec = 0
      let currentLiveFocusSec = 0

      if (activeBreak && activeBreak.type !== 'meeting') {
        // User is currently ON BREAK (excluding meetings)
        const breakStart = new Date(activeBreak.start_time)
        const currentBreakElapsed = differenceInSeconds(now, breakStart)
        
        currentLiveBreakSec = completedBreaksSec + currentBreakElapsed
        currentLiveFocusSec = Math.max(0, elapsedTotal - currentLiveBreakSec)
        
        // Active Dial shows TOTAL accumulated break time (not just current stretch) in Day view
        activeTimerSec = viewMode === 'day' ? currentLiveBreakSec : (focusSec + currentLiveFocusSec)

        breakSec += currentLiveBreakSec
        focusSec += currentLiveFocusSec
      } else {
        // User is currently WORKING or inside a MEETING (which ticks as Focus/Work)
        currentLiveBreakSec = completedBreaksSec
        currentLiveFocusSec = Math.max(0, elapsedTotal - completedBreaksSec)
        
        // If currently in a meeting, tick active timer as cumulative meeting duration
        if (activeBreak && activeBreak.type === 'meeting') {
          // Calculate total meeting time for today
          let totalMeetingSec = 0;
          todaySessions.forEach(session => {
             session.break_sessions?.forEach((b: any) => {
               if (b.type === 'meeting') {
                 const bStart = new Date(b.start_time)
                 const bEnd = b.end_time ? new Date(b.end_time) : new Date()
                 totalMeetingSec += differenceInSeconds(bEnd, bStart)
               }
             })
          });
          const meetingStart = new Date(activeBreak.start_time)
          const currentMeetingElapsed = differenceInSeconds(now, meetingStart)
          
          activeTimerSec = viewMode === 'day' ? (totalMeetingSec + currentMeetingElapsed) : (focusSec + currentLiveFocusSec)
        } else {
          // Focus mode shows Total Focus Time
          activeTimerSec = (focusSec + currentLiveFocusSec)
        }

        breakSec += currentLiveBreakSec
        focusSec += currentLiveFocusSec
      }
    } else {
      // Offline / Past or selected period does not contain active live session:
      // Active dial shows the total completed Focus time of that period
      activeTimerSec = focusSec
    }

    setLiveFocusSeconds(focusSec)
    setLiveBreakSeconds(breakSec)
    setLiveActiveTimer(activeTimerSec)
  }, [todaySessions, activeSession, activeBreak, currentTime, selectedDate, viewMode])

  // Custom action triggers that also refresh local statistics
  const handleCheckIn = async () => {
    await checkIn()
    await fetchTodayData(dateRange.start, dateRange.end)
  }

  const handleCheckOut = async () => {
    try {
      await checkOut()
      await fetchTodayData(dateRange.start, dateRange.end)
    } catch (err) {
      // Controlled shift validation error handled by store toast
    }
  }

  const handleStartBreak = async (type: BreakType) => {
    await startBreak(type)
    await fetchTodayData(dateRange.start, dateRange.end)
  }

  const handleEndBreak = async () => {
    await endBreak()
    await fetchTodayData(dateRange.start, dateRange.end)
  }

  // Navigation arrows handler based on custom 6-working-day weeks
  const handlePrevPeriod = () => {
    if (viewMode === 'day') {
      setSelectedDate(prev => subDays(prev, 1))
    } else if (viewMode === 'week') {
      const weeks = getCustomWeeksForMonth(selectedDate)
      const currentWeekIdx = weeks.findIndex(w => selectedDate >= w.wStart && selectedDate <= w.wEnd)
      
      if (currentWeekIdx > 0) {
        setSelectedDate(weeks[currentWeekIdx - 1].wStart)
      } else {
        const prevMonthEnd = endOfMonth(subMonths(selectedDate, 1))
        setSelectedDate(prevMonthEnd)
      }
    } else {
      setSelectedDate(prev => subMonths(prev, 1))
    }
  }

  const handleNextPeriod = () => {
    if (viewMode === 'day') {
      setSelectedDate(prev => addDays(prev, 1))
    } else if (viewMode === 'week') {
      const weeks = getCustomWeeksForMonth(selectedDate)
      const currentWeekIdx = weeks.findIndex(w => selectedDate >= w.wStart && selectedDate <= w.wEnd)
      
      if (currentWeekIdx !== -1 && currentWeekIdx < weeks.length - 1) {
        setSelectedDate(weeks[currentWeekIdx + 1].wStart)
      } else {
        const nextMonthStart = startOfMonth(addMonths(selectedDate, 1))
        setSelectedDate(nextMonthStart)
      }
    } else {
      setSelectedDate(prev => addMonths(prev, 1))
    }
  }

  // Format Helper: Seconds to HHh MMm SSs
  const formatSecToHMS = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`
  }

  // Format Helper: Seconds to HHh MMm
  const formatSecToHM = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${h}h ${m}m`
  }

  // Format Helper: Seconds to clock display (HH:MM or --)
  const formatSecToClockHMS = (seconds: number) => {
    if (seconds === 0) return "--"
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`
  }

  // Target scale helper based on view mode (6 working days/week, skipping Sundays)
  const targetSeconds = useMemo(() => {
    if (viewMode === 'day') return TARGET_SECONDS
    if (viewMode === 'week') return 6 * TARGET_SECONDS // 6 working days * 8 hours = 48 hours
    
    // In Month Mode, count total working days in active month
    const weeks = getCustomWeeksForMonth(selectedDate)
    const totalWorkingDays = weeks.reduce((sum, w) => sum + w.days.length, 0)
    return totalWorkingDays * TARGET_SECONDS
  }, [viewMode, selectedDate])

  // Minimum Hours slider logic
  const workPercentage = useMemo(() => {
    if (targetSeconds === 0) return 0
    return Math.min(100, Math.round((liveFocusSeconds / targetSeconds) * 100))
  }, [liveFocusSeconds, targetSeconds])

  // Format period label dynamically for top bar
  const periodLabel = useMemo(() => {
    if (viewMode === 'day') {
      const today = new Date()
      const isTodaySelected = isSameDay(selectedDate, today)
      return `${isTodaySelected ? "Today, " : ""}${format(selectedDate, "MMM dd, yyyy")}`
    } else if (viewMode === 'week') {
      const weeks = getCustomWeeksForMonth(selectedDate)
      const activeWeek = weeks.find(w => selectedDate >= w.wStart && selectedDate <= w.wEnd) || weeks[0]
      const weekNumber = weeks.indexOf(activeWeek) + 1
      return `Week ${weekNumber} (${format(activeWeek.wStart, "MMM dd")} - ${format(activeWeek.wEnd, "MMM dd, yyyy")})`
    } else {
      return format(selectedDate, "MMMM yyyy")
    }
  }, [selectedDate, viewMode])

  // Single Day stats derivations
  const clockInTime = useMemo(() => {
    if (todaySessions.length === 0) return "--"
    return format(new Date(todaySessions[0].start_time), "hh:mm a")
  }, [todaySessions])

  const clockOutTime = useMemo(() => {
    const today = new Date()
    const isTodaySelected = isSameDay(selectedDate, today)
    if (isTodaySelected) {
      if (!activeSession) {
        if (todaySessions.length > 0) {
          const lastSession = todaySessions[todaySessions.length - 1]
          if (lastSession.end_time) {
            return format(new Date(lastSession.end_time), "hh:mm a")
          }
        }
        return "--"
      }
      return activeBreak ? "On Break" : "Working"
    } else {
      if (todaySessions.length > 0) {
        const lastSession = todaySessions[todaySessions.length - 1]
        if (lastSession.end_time) {
          return format(new Date(lastSession.end_time), "hh:mm a")
        }
      }
      return "--"
    }
  }, [activeSession, activeBreak, todaySessions, selectedDate])

  // Aggregated Period Statistics (Week / Month)
  const periodStats = useMemo(() => {
    if (todaySessions.length === 0) {
      return { avgIn: "--", avgOut: "--", daysWorked: 0 }
    }

    // Group sessions by day
    const sessionsByDay: Record<string, any[]> = {}
    todaySessions.forEach(s => {
      const dStr = format(new Date(s.start_time), 'yyyy-MM-dd')
      if (!sessionsByDay[dStr]) sessionsByDay[dStr] = []
      sessionsByDay[dStr].push(s)
    })

    const days = Object.keys(sessionsByDay)
    let totalInMinutes = 0
    let totalOutMinutes = 0
    let outCount = 0

    days.forEach(d => {
      const daySessions = sessionsByDay[d]
      
      // Clock-in is the earliest start of the day
      const earliest = new Date(daySessions[0].start_time)
      totalInMinutes += earliest.getHours() * 60 + earliest.getMinutes()

      // Clock-out is the latest end of the day (if completed)
      const completedSessions = daySessions.filter(s => s.end_time)
      if (completedSessions.length > 0) {
        const latest = new Date(completedSessions[completedSessions.length - 1].end_time)
        totalOutMinutes += latest.getHours() * 60 + latest.getMinutes()
        outCount++
      }
    })

    const avgInMin = Math.round(totalInMinutes / days.length)
    const avgInHour = Math.floor(avgInMin / 60)
    const avgInMinute = avgInMin % 60
    const avgInAmpm = avgInHour >= 12 ? 'PM' : 'AM'
    const formattedAvgIn = `${(avgInHour % 12 || 12).toString().padStart(2, '0')}:${avgInMinute.toString().padStart(2, '0')} ${avgInAmpm}`

    let formattedAvgOut = "--"
    if (outCount > 0) {
      const avgOutMin = Math.round(totalOutMinutes / outCount)
      const avgOutHour = Math.floor(avgOutMin / 60)
      const avgOutMinute = avgOutMin % 60
      const avgOutAmpm = avgOutHour >= 12 ? 'PM' : 'AM'
      formattedAvgOut = `${(avgOutHour % 12 || 12).toString().padStart(2, '0')}:${avgOutMinute.toString().padStart(2, '0')} ${avgOutAmpm}`
    }

    return {
      avgIn: formattedAvgIn,
      avgOut: formattedAvgOut,
      daysWorked: days.length
    }
  }, [todaySessions])

  // Focus Percentage donut logic: ratio of focus time vs total logged session
  const focusPercentage = useMemo(() => {
    const total = liveFocusSeconds + liveBreakSeconds
    if (total === 0) return 0
    return Math.round((liveFocusSeconds / total) * 100)
  }, [liveFocusSeconds, liveBreakSeconds])

  // Efficiency computation (Focus vs total ratio)
  const efficiency = useMemo(() => {
    const total = liveFocusSeconds + liveBreakSeconds
    if (total === 0) return 0
    const ratio = (liveFocusSeconds / total) * 100
    if (liveFocusSeconds > targetSeconds) {
      return Math.min(200, Math.round((liveFocusSeconds / targetSeconds) * 100))
    }
    return Math.round(ratio)
  }, [liveFocusSeconds, liveBreakSeconds, targetSeconds])

  // Timeline representation segments (normalized to percentages of 24h day)
  const timelineSegments = useMemo(() => {
    const segments: { type: 'focus' | 'break' | 'meeting', left: number, width: number }[] = []
    
    todaySessions.forEach(session => {
      const sStart = new Date(session.start_time)
      const sEnd = session.end_time ? new Date(session.end_time) : new Date()

      // Calculate minutes from midnight
      const sStartMin = sStart.getHours() * 60 + sStart.getMinutes()
      const sEndMin = sEnd.getHours() * 60 + sEnd.getMinutes()

      const sLeft = (sStartMin / 1440) * 100
      const sWidth = ((sEndMin - sStartMin) / 1440) * 100

      // Add default focus segment
      segments.push({ type: 'focus', left: sLeft, width: sWidth })

      // Overlay break sessions inside this work session
      session.break_sessions?.forEach((b: any) => {
        const bStart = new Date(b.start_time)
        const bEnd = b.end_time ? new Date(b.end_time) : new Date()

        const bStartMin = bStart.getHours() * 60 + bStart.getMinutes()
        const bEndMin = bEnd.getHours() * 60 + bEnd.getMinutes()

        const bLeft = (bStartMin / 1440) * 100
        const bWidth = ((bEndMin - bStartMin) / 1440) * 100

        segments.push({ 
          type: b.type === 'meeting' ? 'meeting' : 'break', 
          left: bLeft, 
          width: bWidth 
        })
      })
    })

    return segments
  }, [todaySessions, currentTime])

  // Weekly aggregate bar chart metrics (exposing exactly the 6 working days in the active week)
  const weeklyData = useMemo(() => {
    const weeks = getCustomWeeksForMonth(selectedDate)
    const activeWeek = weeks.find(w => selectedDate >= w.wStart && selectedDate <= w.wEnd) || weeks[0]
    const days = activeWeek.days // exactly 6 working days!
    
    return days.map(d => {
      const dStr = format(d, 'yyyy-MM-dd')
      let focusSec = 0
      let breakSec = 0
      
      todaySessions.forEach(session => {
        const sStr = format(new Date(session.start_time), 'yyyy-MM-dd')
        if (sStr !== dStr) return
        
        const start = new Date(session.start_time)
        const end = session.end_time ? new Date(session.end_time) : new Date()
        const totalSec = differenceInSeconds(end, start)

        let sessionBreakSec = 0
        session.break_sessions?.forEach((b: any) => {
          if (b.type === 'meeting') return // Skip meetings
          const bStart = new Date(b.start_time)
          const bEnd = b.end_time ? new Date(b.end_time) : new Date()
          sessionBreakSec += differenceInSeconds(bEnd, bStart)
        })

        breakSec += sessionBreakSec
        focusSec += Math.max(0, totalSec - sessionBreakSec)
      })

      // Also merge active session if active session is on this day
      if (activeSession) {
        const activeStr = format(new Date(activeSession.start_time), 'yyyy-MM-dd')
        if (activeStr === dStr) {
          const now = new Date()
          const sessionStart = new Date(activeSession.start_time)
          const elapsedTotal = differenceInSeconds(now, sessionStart)
          const liveSessionData = todaySessions.find(s => s.id === activeSession.id) || activeSession

          let completedBreaksSec = 0
          liveSessionData.break_sessions?.forEach((b: any) => {
            if (b.type === 'meeting') return // Skip meetings
            if (b.end_time) {
              completedBreaksSec += differenceInSeconds(new Date(b.end_time), new Date(b.start_time))
            }
          })

          let currentLiveBreakSec = 0
          let currentLiveFocusSec = 0

          if (activeBreak && activeBreak.type !== 'meeting') {
            const breakStart = new Date(activeBreak.start_time)
            const currentBreakElapsed = differenceInSeconds(now, breakStart)
            currentLiveBreakSec = completedBreaksSec + currentBreakElapsed
            currentLiveFocusSec = Math.max(0, elapsedTotal - currentLiveBreakSec)
          } else {
            currentLiveBreakSec = completedBreaksSec
            currentLiveFocusSec = Math.max(0, elapsedTotal - completedBreaksSec)
          }

          breakSec += currentLiveBreakSec
          focusSec += currentLiveFocusSec
        }
      }

      const focusHrs = Number((focusSec / 3600).toFixed(1))
      const breakHrs = Number((breakSec / 3600).toFixed(1))
      const label = format(d, 'EEE')
      const fullDate = format(d, 'MMMM dd, yyyy')

      return { label, fullDate, focusHrs, breakHrs }
    })
  }, [todaySessions, activeSession, activeBreak, selectedDate, currentTime])

  // Monthly aggregate bar chart metrics grouped by our custom 6-working-day weeks
  const monthlyData = useMemo(() => {
    const weeks = getCustomWeeksForMonth(selectedDate)

    return weeks.map((w, idx) => {
      let focusSec = 0
      let breakSec = 0

      todaySessions.forEach(session => {
        const sessionDate = new Date(session.start_time)
        const isWithinWeek = sessionDate >= w.wStart && sessionDate <= w.wEnd
        if (isWithinWeek) {
          const start = new Date(session.start_time)
          const end = session.end_time ? new Date(session.end_time) : new Date()
          const totalSec = differenceInSeconds(end, start)

          let sessionBreakSec = 0
          session.break_sessions?.forEach((b: any) => {
            if (b.type === 'meeting') return // Skip meetings
            const bStart = new Date(b.start_time)
            const bEnd = b.end_time ? new Date(b.end_time) : new Date()
            sessionBreakSec += differenceInSeconds(bEnd, bStart)
          })

          breakSec += sessionBreakSec
          focusSec += Math.max(0, totalSec - sessionBreakSec)
        }
      })

      // Also merge active session if active session is in this week
      if (activeSession) {
        const activeDate = new Date(activeSession.start_time)
        const isWithinWeek = activeDate >= w.wStart && activeDate <= w.wEnd
        if (isWithinWeek) {
          const now = new Date()
          const sessionStart = new Date(activeSession.start_time)
          const elapsedTotal = differenceInSeconds(now, sessionStart)
          const liveSessionData = todaySessions.find(s => s.id === activeSession.id) || activeSession

          let completedBreaksSec = 0
          liveSessionData.break_sessions?.forEach((b: any) => {
            if (b.type === 'meeting') return // Skip meetings
            if (b.end_time) {
              completedBreaksSec += differenceInSeconds(new Date(b.end_time), new Date(b.start_time))
            }
          })

          let currentLiveBreakSec = 0
          let currentLiveFocusSec = 0

          if (activeBreak && activeBreak.type !== 'meeting') {
            const breakStart = new Date(activeBreak.start_time)
            const currentBreakElapsed = differenceInSeconds(now, breakStart)
            currentLiveBreakSec = completedBreaksSec + currentBreakElapsed
            currentLiveFocusSec = Math.max(0, elapsedTotal - currentLiveBreakSec)
          } else {
            currentLiveBreakSec = completedBreaksSec
            currentLiveFocusSec = Math.max(0, elapsedTotal - completedBreaksSec)
          }

          breakSec += currentLiveBreakSec
          focusSec += currentLiveFocusSec
        }
      }

      const focusHrs = Number((focusSec / 3600).toFixed(1))
      const breakHrs = Number((breakSec / 3600).toFixed(1))
      const label = `Week ${idx + 1}`
      const fullDate = `${format(w.wStart, 'MMM dd')} - ${format(w.wEnd, 'MMM dd')}`

      return { label, fullDate, focusHrs, breakHrs }
    })
  }, [todaySessions, activeSession, activeBreak, selectedDate, currentTime])

  return (
    <Card className="bg-card border-border/40 shadow-sm rounded-2xl overflow-hidden mb-6">
      {/* Top Header tab-bar and controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-border/10 p-5 bg-slate-50/50 gap-4">
        {/* Left tabs selector */}
        <div className="flex items-center bg-slate-100 rounded-xl p-1 shrink-0 border">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setViewMode('day')}
            className={cn(
              "h-8 rounded-lg text-xs font-black uppercase px-4 transition-all",
              viewMode === 'day' ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-700"
            )}
          >
            Day
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setViewMode('week')}
            className={cn(
              "h-8 rounded-lg text-xs font-black uppercase px-4 transition-all",
              viewMode === 'week' ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-700"
            )}
          >
            Week
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setViewMode('month')}
            className={cn(
              "h-8 rounded-lg text-xs font-black uppercase px-4 transition-all",
              viewMode === 'month' ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-700"
            )}
          >
            Month
          </Button>
        </div>

        {/* Target hours progress indicator */}
        <div className="flex items-center gap-4 flex-1 max-w-sm w-full">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">Minimum hours</span>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-black text-slate-600 uppercase">
              <span>{liveFocusSeconds > 0 ? (viewMode === 'day' ? "08hr" : viewMode === 'week' ? "48hr" : `${Math.round(targetSeconds / 3600)}hr`) : "00hr"}</span>
              <span>{workPercentage}%</span>
            </div>
            <div className="h-2 w-full bg-slate-200/60 rounded-full overflow-hidden border">
              <div 
                className="h-full bg-sky-500 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${workPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right side date picker popover / navigate arrows */}
        <div className="flex items-center gap-3 shrink-0 self-stretch md:self-auto justify-between border-t md:border-t-0 pt-3 md:pt-0">
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-1.5 border">
            <Clock className="h-4 w-4 text-sky-500" />
            <div className="text-left leading-none">
              <p className="text-xs font-black text-slate-700 tabular-nums">
                {format(currentTime, "hh:mm a")}
              </p>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">INDIA</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-3 py-1 border">
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 text-xs font-black text-slate-600 hover:text-slate-800 transition-colors uppercase pr-2 border-r border-slate-200">
                  {periodLabel}
                  <CalendarIcon className="h-4 w-4 text-slate-400" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border border-slate-100 shadow-2xl rounded-2xl" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                  className="rounded-2xl"
                />
              </PopoverContent>
            </Popover>

            <div className="flex items-center">
              <button 
                onClick={handlePrevPeriod} 
                className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-all"
                title="Previous Period"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button 
                onClick={handleNextPeriod} 
                className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-all"
                title="Next Period"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main clock dashboard content */}
      <CardContent className="p-6 md:p-8">
        {isLoadingLogs ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Synchronizing Work Log...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-8 items-center">
            
            {/* Column 1: Left Donut progress chart & Legends */}
            <div className="xl:col-span-1 flex flex-col items-center justify-center border-b xl:border-b-0 xl:border-r border-border/10 pb-6 xl:pb-0 xl:pr-6">
              <div className="relative h-32 w-32 flex items-center justify-center mb-6">
                <svg className="absolute inset-0 h-full w-full transform -rotate-90">
                  <circle cx="64" cy="64" r="54" fill="transparent" stroke="#f1f5f9" strokeWidth="6" />
                  <circle 
                    cx="64" 
                    cy="64" 
                    r="54" 
                    fill="transparent" 
                    stroke="#84cc16" 
                    strokeWidth="8" 
                    strokeDasharray="339" 
                    strokeDashoffset={339 - (339 * workPercentage) / 100}
                    className="transition-all duration-1000 ease-in-out"
                  />
                </svg>
                <div className="text-center z-10">
                  <h3 className="text-xl font-black text-slate-800 tracking-tighter">
                    {`${workPercentage}%`}
                  </h3>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Shift Goal</p>
                </div>
              </div>

              {/* Legends list */}
              {(() => {
                const maxBreakMinutes = workSettings?.max_break_minutes ?? 60
                const allowedBreakSec = maxBreakMinutes * 60
                const remainingBreakSec = Math.max(0, allowedBreakSec - liveBreakSeconds)
                
                return (
                  <div className="w-full space-y-3 px-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Focus</span>
                      <span className="font-bold text-lime-600 tabular-nums">
                        {liveFocusSeconds > 0 ? formatSecToHM(liveFocusSeconds) : "--"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Break Limit</span>
                      <span className="font-bold text-slate-500 tabular-nums">
                        {formatSecToHM(allowedBreakSec)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Break Used</span>
                      <span className="font-bold text-amber-500 tabular-nums">
                        {liveBreakSeconds > 0 ? formatSecToClockHMS(liveBreakSeconds) : "00h 00m"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Break Left</span>
                      <span className={cn(
                        "font-bold tabular-nums",
                        remainingBreakSec > 0 && remainingBreakSec <= 300 
                          ? "text-rose-500 animate-pulse font-black" 
                          : remainingBreakSec === 0 
                            ? "text-slate-400 line-through" 
                            : "text-rose-600"
                      )}>
                        {remainingBreakSec > 0 ? formatSecToClockHMS(remainingBreakSec) : "00h 00m"}
                      </span>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Column 2: Control shift buttons */}
            <div className="xl:col-span-1 flex flex-col items-center justify-center gap-4 border-b xl:border-b-0 xl:border-r border-border/10 pb-6 xl:pb-0 xl:pr-6">
              {canControlSession ? (
                <>
                  {!activeSession ? (
                    <Button 
                      onClick={handleCheckIn}
                      className="w-full h-24 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 text-slate-600 hover:text-slate-800 flex flex-col items-center justify-center gap-2 active:scale-98 transition-all shadow-sm group"
                      disabled={isStoreLoading}
                    >
                      <div className="p-2 bg-sky-50 rounded-full text-sky-500 group-hover:scale-110 transition-transform">
                        <Play className="h-5 w-5 fill-current" />
                      </div>
                      <span className="font-black text-xs uppercase tracking-wider">Start Work</span>
                    </Button>
                  ) : (
                    <div className="w-full space-y-4">
                      <Button 
                        onClick={handleCheckOut}
                        className="w-full h-12 rounded-2xl bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-600 font-black text-xs uppercase tracking-widest gap-2 active:scale-98 transition-all"
                        disabled={isStoreLoading}
                      >
                        <Square className="h-4 w-4 fill-current" />
                        Stop Work
                      </Button>

                      {activeBreak ? (
                        <Button 
                          onClick={handleEndBreak}
                          className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-widest gap-2 shadow-lg shadow-emerald-500/10 active:scale-98 transition-all"
                          disabled={isStoreLoading}
                        >
                          <Play className="h-4 w-4 fill-current" />
                          End Break
                        </Button>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          <Button 
                            onClick={() => handleStartBreak('lunch')}
                            className="h-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 hover:bg-amber-100 font-bold text-[9px] uppercase tracking-wider"
                            disabled={isStoreLoading}
                          >
                            Lunch
                          </Button>
                          <Button 
                            onClick={() => handleStartBreak('short_break')}
                            className="h-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 hover:bg-amber-100 font-bold text-[9px] uppercase tracking-wider"
                            disabled={isStoreLoading}
                          >
                            Tea
                          </Button>
                          <Button 
                            onClick={() => handleStartBreak('meeting')}
                            className="h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-[9px] uppercase tracking-wider"
                            disabled={isStoreLoading}
                          >
                            Meet
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                // Past days or Week/Month views: shift buttons disabled and faded out exactly like the screenshot
                <div className="w-full space-y-4 opacity-40 select-none">
                  <Button 
                    className="w-full h-20 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 flex flex-col items-center justify-center gap-1.5 cursor-not-allowed"
                    disabled
                  >
                    <Play className="h-4 w-4 fill-current text-slate-300" />
                    <span className="font-black text-[10px] uppercase tracking-widest">
                      {viewMode === 'day' ? 'Start Work' : 'Actions Locked'}
                    </span>
                  </Button>
                  <Button 
                    className="w-full h-12 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-widest cursor-not-allowed"
                    disabled
                  >
                    Break
                  </Button>
                </div>
              )}
            </div>

            {/* Column 3: Central Speedometer Ticked Dial */}
            <div className="xl:col-span-1 flex flex-col items-center justify-center">
              <div className="relative h-48 w-48 flex items-center justify-center">
                {/* Ticked circle borders */}
                <svg className="absolute inset-0 h-full w-full transform -rotate-90">
                  <circle cx="96" cy="96" r="82" fill="transparent" stroke="#f1f5f9" strokeWidth="6" />
                  <circle 
                    cx="96" 
                    cy="96" 
                    r="82" 
                    fill="transparent" 
                    stroke={
                      canControlSession && activeSession 
                        ? (activeBreak 
                            ? (activeBreak.type === 'meeting' ? "#0ea5e9" : "#eab308") 
                            : "#84cc16") 
                        : "#a3e635"
                    } 
                    strokeWidth="6" 
                    strokeDasharray="515" 
                    strokeDashoffset="0"
                    className="transition-all duration-1000 ease-in-out"
                  />
                </svg>

                {/* Dial Concentric dashed borders */}
                <div className="absolute inset-2.5 rounded-full border border-dashed border-slate-200/80 animate-spin-slow pointer-events-none" />

                {/* Ticking / Static focus time */}
                <div className="text-center z-10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {canControlSession && activeSession 
                      ? (activeBreak 
                          ? (activeBreak.type === 'meeting' ? "In Meeting" : "On Break") 
                          : "Focus Mode") 
                      : "Focus"}
                  </p>
                  <h2 className="text-xl font-black tracking-tight text-slate-800 mt-1 tabular-nums">
                    {canControlSession && activeSession ? (
                      formatSecToHMS(liveActiveTimer)
                    ) : (
                      liveFocusSeconds > 0 ? formatSecToHM(liveFocusSeconds) : "00h 00m"
                    )}
                  </h2>
                  <div className="h-1 w-6 rounded-full mx-auto bg-slate-200 mt-1.5" />
                </div>
              </div>
            </div>

            {/* Column 4: Stat Details (Dynamic based on viewMode) */}
            <div className="xl:col-span-1 flex flex-col items-center xl:items-start gap-4 justify-center border-b xl:border-b-0 xl:border-l border-border/10 pb-6 xl:pb-0 xl:pl-6">
              {viewMode === 'day' ? (
                <>
                  <div className="space-y-1 text-center xl:text-left">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clock In</span>
                    <p className="text-lg font-black text-lime-600 uppercase tracking-tight">{clockInTime}</p>
                  </div>

                  <div className="space-y-1 text-center xl:text-left">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clock Out</span>
                    <p className="text-lg font-black text-slate-700 uppercase tracking-tight">{clockOutTime}</p>
                  </div>

                  <div className="space-y-1 text-center xl:text-left">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Break</span>
                    <p className="text-lg font-black text-slate-500 tabular-nums">
                      {liveBreakSeconds > 0 ? formatSecToClockHMS(liveBreakSeconds) : "--"}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1 text-center xl:text-left">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Clock In</span>
                    <p className="text-lg font-black text-lime-600 uppercase tracking-tight">{periodStats.avgIn}</p>
                  </div>

                  <div className="space-y-1 text-center xl:text-left">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Clock Out</span>
                    <p className="text-lg font-black text-slate-700 uppercase tracking-tight">{periodStats.avgOut}</p>
                  </div>

                  <div className="space-y-1 text-center xl:text-left">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Days Worked</span>
                    <p className="text-lg font-black text-slate-500 tabular-nums">
                      {periodStats.daysWorked} {periodStats.daysWorked === 1 ? 'day' : 'days'}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Column 5: Efficiency card */}
            <div className="xl:col-span-1 bg-slate-50 border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden shadow-inner h-32 w-full xl:w-full shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Efficiency</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="focus:outline-none">
                      <HelpCircle className="h-3.5 w-3.5 text-slate-300 cursor-pointer hover:text-slate-500 transition-colors" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="end" className="max-w-[220px] p-3 rounded-xl border border-slate-100 shadow-xl text-left">
                    <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">What is Efficiency?</p>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Efficiency measures your <span className="font-bold text-slate-700">focused work time</span> as a percentage of your total logged session (focus + break). A score of <span className="font-bold text-lime-600">80%+</span> is excellent. If you exceed your daily target hours, it can go above 100%.
                    </p>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-black text-slate-800 tracking-tighter">
                  {`${efficiency}%`}
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Focus vs break ratio</p>
              </div>
            </div>

          </div>
        )}

        {/* Dynamic bottom visualization section depending on viewMode */}
        <div className="mt-12 pt-6 border-t border-border/10">
          
          {/* DAY VIEW: Horizontal Timeline Ruler */}
          {viewMode === 'day' && (
            <>
              {/* Hour labels */}
              <div className="relative flex justify-between text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider select-none mb-3">
                <span>12 AM</span>
                <span>2 AM</span>
                <span>4 AM</span>
                <span>6 AM</span>
                <span>8 AM</span>
                <span>10 AM</span>
                <span>12 PM</span>
                <span>2 PM</span>
                <span>4 PM</span>
                <span>6 PM</span>
                <span>8 PM</span>
                <span>10 PM</span>
                <span>11 PM</span>
              </div>

              {/* Timeline progress track */}
              <div className="h-4 w-full bg-slate-100 rounded-full relative overflow-hidden border">
                {/* Color-coded shift segments render list */}
                {timelineSegments.map((seg, idx) => (
                  <div 
                    key={idx}
                    className={cn(
                      "absolute h-full transition-all duration-500 shadow-inner",
                      seg.type === 'focus' 
                        ? "bg-emerald-400/80 border-r border-emerald-500/20" 
                        : seg.type === 'meeting'
                          ? "bg-sky-400/90 border-r border-sky-500/20 animate-pulse"
                          : "bg-amber-400/90 border-r border-amber-500/20"
                    )}
                    style={{
                      left: `${seg.left}%`,
                      width: `${seg.width}%`
                    }}
                  />
                ))}
              </div>

              {/* Timeline color guides legend */}
              <div className="flex flex-wrap items-center justify-center gap-6 mt-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>Focus</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-sky-400" />
                  <span>Meeting</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-400" />
                  <span>Break</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-slate-300" />
                  <span>Away / Checked Out</span>
                </div>
              </div>
            </>
          )}

          {/* WEEK VIEW: Premium stacked column bar chart (6 working days Mon-Sat, Sunday OFF) */}
          {viewMode === 'week' && (
            <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center mb-4">Weekly Focus & Break Breakdown (6 Working Days, Sunday Off)</h4>
              <div className="grid grid-cols-6 gap-4 md:gap-6 h-48 items-end pt-4 max-w-4xl mx-auto w-full">
                {weeklyData.map((day, idx) => {
                  const maxHrs = Math.max(...weeklyData.map(d => d.focusHrs + d.breakHrs), 8) // default max scale of 8 hrs
                  const focusHeight = (day.focusHrs / maxHrs) * 100
                  const breakHeight = (day.breakHrs / maxHrs) * 100
                  
                  return (
                    <div key={idx} className="flex flex-col items-center group h-full justify-end relative">
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full mb-2 bg-slate-800 text-white text-[10px] p-2.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-20 shadow-xl border border-slate-700/50 leading-normal text-center min-w-[120px] transition-opacity duration-200">
                        <p className="font-black border-b border-slate-700 pb-1 mb-1 text-[9px] uppercase tracking-wider text-slate-300">{day.fullDate}</p>
                        <p className="text-emerald-400 font-bold">Focus: {day.focusHrs}h</p>
                        {day.breakHrs > 0 && <p className="text-amber-400 font-bold">Break: {day.breakHrs}h</p>}
                      </div>

                      {/* Stacked columns container */}
                      <div className="w-full bg-slate-100 rounded-xl overflow-hidden border flex flex-col justify-end h-36 relative shadow-inner group-hover:border-slate-300 transition-all">
                        {/* Break segment */}
                        <div 
                          className="w-full bg-amber-400/90 transition-all duration-1000 shadow-sm border-t border-amber-500/20"
                          style={{ height: `${breakHeight}%` }}
                        />
                        {/* Focus segment */}
                        <div 
                          className="w-full bg-emerald-400/90 transition-all duration-1000 shadow-sm border-t border-emerald-500/20"
                          style={{ height: `${focusHeight}%` }}
                        />
                      </div>

                      {/* Labels */}
                      <span className="text-[10px] font-black text-slate-700 mt-2.5 uppercase tracking-wide">{day.label}</span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{day.focusHrs > 0 ? `${day.focusHrs}h` : "--"}</span>
                    </div>
                  )
                })}
              </div>

              {/* Weekly bar legends */}
              <div className="flex items-center justify-center gap-6 mt-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>Productive Focus</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-400" />
                  <span>Break Time</span>
                </div>
              </div>
            </div>
          )}

          {/* MONTH VIEW: Premium stacked week-groups bar chart (custom 6-working-day weeks) */}
          {viewMode === 'month' && (
            <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center mb-4">Monthly Focus & Break Breakdown</h4>
              <div 
                className="grid gap-6 md:gap-8 h-48 items-end pt-4 max-w-3xl mx-auto w-full"
                style={{ gridTemplateColumns: `repeat(${monthlyData.length}, minmax(0, 1fr))` }}
              >
                {monthlyData.map((week, idx) => {
                  const maxHrs = Math.max(...monthlyData.map(w => w.focusHrs + w.breakHrs), 48) // default max scale of 48 hrs (1 custom week target)
                  const focusHeight = (week.focusHrs / maxHrs) * 100
                  const breakHeight = (week.breakHrs / maxHrs) * 100
                  
                  return (
                    <div key={idx} className="flex flex-col items-center group h-full justify-end relative">
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full mb-2 bg-slate-800 text-white text-[10px] p-2.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-20 shadow-xl border border-slate-700/50 leading-normal text-center min-w-[140px] transition-opacity duration-200">
                        <p className="font-black border-b border-slate-700 pb-1 mb-1 text-[9px] uppercase tracking-wider text-slate-300">{week.fullDate}</p>
                        <p className="text-emerald-400 font-bold">Focus: {week.focusHrs}h</p>
                        {week.breakHrs > 0 && <p className="text-amber-400 font-bold">Break: {week.breakHrs}h</p>}
                      </div>

                      {/* Stacked columns container */}
                      <div className="w-full bg-slate-100 rounded-xl overflow-hidden border flex flex-col justify-end h-36 relative shadow-inner group-hover:border-slate-300 transition-all">
                        {/* Break segment */}
                        <div 
                          className="w-full bg-amber-400/90 transition-all duration-1000 shadow-sm border-t border-amber-500/20"
                          style={{ height: `${breakHeight}%` }}
                        />
                        {/* Focus segment */}
                        <div 
                          className="w-full bg-emerald-400/90 transition-all duration-1000 shadow-sm border-t border-emerald-500/20"
                          style={{ height: `${focusHeight}%` }}
                        />
                      </div>

                      {/* Labels */}
                      <span className="text-[10px] font-black text-slate-700 mt-2.5 uppercase tracking-wide">{week.label}</span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{week.focusHrs > 0 ? `${week.focusHrs}h` : "--"}</span>
                    </div>
                  )
                })}
              </div>

              {/* Monthly bar legends */}
              <div className="flex items-center justify-center gap-6 mt-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>Productive Focus</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-400" />
                  <span>Break Time</span>
                </div>
              </div>
            </div>
          )}

        </div>

      </CardContent>
    </Card>
  )
}
