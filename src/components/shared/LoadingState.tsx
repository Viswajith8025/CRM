import { Loader2 } from "lucide-react"

export function LoadingState() {
  return (
    <div className="flex h-[400px] w-full flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-muted-foreground animate-pulse font-medium">Loading your data...</p>
    </div>
  )
}

export function LoadingPage() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg font-semibold tracking-tight">Initializing ERP Pro...</p>
      </div>
    </div>
  )
}
