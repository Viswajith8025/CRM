import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Optional fallback component to render on error */
  fallback?: ReactNode
  /** Module name for contextual error messages */
  module?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[ECRAFTZ Crash] ${this.props.module || 'Unknown Module'}:`,
      error,
      errorInfo.componentStack
    )
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-6 text-center px-4">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-amber-500/20" />
            <div className="relative rounded-full bg-amber-500/10 p-5 ring-2 ring-amber-500/20">
              <AlertTriangle className="h-10 w-10 text-amber-500" />
            </div>
          </div>

          <div className="space-y-2 max-w-md">
            <h2 className="text-xl font-bold tracking-tight">
              {this.props.module ? `${this.props.module} crashed` : 'Something went wrong'}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              An unexpected error occurred. This has been logged automatically. 
              You can try refreshing this section or return to the dashboard.
            </p>
            {this.state.error && (
              <details className="mt-3 text-left">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  Technical Details
                </summary>
                <pre className="mt-2 rounded-lg bg-muted p-3 text-[11px] text-muted-foreground overflow-auto max-h-32 font-mono">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>

          <div className="flex gap-3">
            <Button onClick={this.handleRetry} variant="outline" className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              Try Again
            </Button>
            <Button onClick={this.handleGoHome} className="gap-2">
              <Home className="h-4 w-4" />
              Go to Dashboard
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
