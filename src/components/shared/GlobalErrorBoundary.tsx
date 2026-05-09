import React, { Component, ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { Button } from "@/components/ui/button";
import { ShieldAlert, RefreshCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorId?: string;
}

/**
 * Enterprise Global Error Boundary
 * Catch-all for React runtime crashes with Sentry integration.
 */
export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = Sentry.captureException(error, { extra: { errorInfo } });
    this.setState({ errorId });
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full bg-card border rounded-2xl p-8 shadow-2xl text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center">
              <ShieldAlert className="h-8 w-8 text-rose-500" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-black tracking-tight text-foreground uppercase">
                System Crash Detected
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                A critical error occurred in the application. Our engineering team has been notified automatically.
              </p>
            </div>

            {this.state.errorId && (
              <div className="bg-muted/50 py-2 px-4 rounded-lg border border-border/50">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Incident Report ID
                </p>
                <code className="text-[10px] font-mono text-primary font-bold">{this.state.errorId}</code>
              </div>
            )}

            <div className="pt-4 flex flex-col gap-3">
              <Button onClick={this.handleReset} className="w-full gap-2 font-bold py-6">
                <RefreshCcw className="h-4 w-4" />
                Reload Application
              </Button>
              <Button variant="ghost" asChild className="w-full text-xs text-muted-foreground font-medium">
                <a href="mailto:support@ecraftz.com">Contact Technical Support</a>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
