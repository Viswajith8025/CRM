import { useState, useEffect } from 'react'
import { Play, Square, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { useTimeStore } from '../timeStore'
import { formatDistanceStrict } from 'date-fns'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function Timer() {
  const { activeTimer, startTimer, stopTimer } = useTimeStore()
  const [description, setDescription] = useState("")
  const [elapsed, setElapsed] = useState("00:00:00")

  useEffect(() => {
    let interval: any
    if (activeTimer) {
      setDescription(activeTimer.description)
      interval = setInterval(() => {
        const start = new Date(activeTimer.start_time).getTime()
        const now = new Date().getTime()
        const diff = now - start
        
        const h = Math.floor(diff / 3600000)
        const m = Math.floor((diff % 3600000) / 60000)
        const s = Math.floor((diff % 60000) / 1000)
        
        setElapsed(
          `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        )
      }, 1000)
    } else {
      setElapsed("00:00:00")
    }
    return () => clearInterval(interval)
  }, [activeTimer])

  const handleStart = () => {
    if (!description) return
    startTimer({
      start_time: new Date().toISOString(),
      task_id: null,
      description,
      is_billable: true
    })
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="What are you working on?" 
              className="pl-9 bg-background border-primary/10"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!!activeTimer}
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="text-2xl font-mono font-bold tracking-wider w-24 text-center">
              {elapsed}
            </div>
            {activeTimer ? (
              <Button 
                variant="destructive" 
                className="gap-2 px-6 shadow-lg shadow-destructive/20"
                onClick={() => stopTimer()}
              >
                <Square className="h-4 w-4 fill-current" />
                Stop
              </Button>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-block">
                      <Button 
                        className="gap-2 px-6 shadow-lg shadow-primary/20"
                        onClick={handleStart}
                        disabled={!description}
                      >
                        <Play className="h-4 w-4 fill-current" />
                        Start
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {!description && (
                    <TooltipContent>
                      <p>Please enter a description to start the timer</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
