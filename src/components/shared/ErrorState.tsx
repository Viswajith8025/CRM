import { AlertCircle, RefreshCcw, WifiOff, ShieldX, FileQuestion } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ErrorCategory } from "@/lib/errorHandler"

interface ErrorStateProps {
  title?: string
  message?: string
  category?: ErrorCategory
  onRetry?: () => void
  compact?: boolean
}

const categoryConfig: Record<string, { icon: React.ReactNode; color: string; defaultTitle: string }> = {
  network: {
    icon: <WifiOff className="h-10 w-10" />,
    color: "text-amber-500 bg-amber-500/10",
    defaultTitle: "Connection Lost",
  },
  auth: {
    icon: <ShieldX className="h-10 w-10" />,
    color: "text-rose-500 bg-rose-500/10",
    defaultTitle: "Session Expired",
  },
  permission: {
    icon: <ShieldX className="h-10 w-10" />,
    color: "text-rose-500 bg-rose-500/10",
    defaultTitle: "Access Denied",
  },
  not_found: {
    icon: <FileQuestion className="h-10 w-10" />,
    color: "text-blue-500 bg-blue-500/10",
    defaultTitle: "Not Found",
  },
  default: {
    icon: <AlertCircle className="h-10 w-10" />,
    color: "text-destructive bg-destructive/10",
    defaultTitle: "Something went wrong",
  },
}

export function ErrorState({
  title,
  message = "We encountered an unexpected error. Please try again later.",
  category,
  onRetry,
  compact = false,
}: ErrorStateProps) {
  const config = categoryConfig[category || "default"] || categoryConfig.default

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
        <div className={`flex-shrink-0 rounded-full p-1.5 ${config.color}`}>
          <AlertCircle className="h-4 w-4" />
        </div>
        <p className="text-sm text-muted-foreground flex-1">{message}</p>
        {onRetry && (
          <Button onClick={onRetry} variant="ghost" size="sm" className="gap-1 h-7 text-xs">
            <RefreshCcw className="h-3 w-3" />
            Retry
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-[400px] w-full flex-col items-center justify-center gap-6 text-center">
      <div className={`rounded-full p-4 ${config.color}`}>
        {config.icon}
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">
          {title || config.defaultTitle}
        </h2>
        <p className="text-muted-foreground max-w-xs">{message}</p>
      </div>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="gap-2">
          <RefreshCcw className="h-4 w-4" />
          Try Again
        </Button>
      )}
    </div>
  )
}
