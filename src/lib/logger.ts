import * as Sentry from "@sentry/react";

type LogLevel = 'info' | 'warn' | 'error';

interface LogContext {
  module: 'auth' | 'billing' | 'crm' | 'projects' | 'admin' | 'storage';
  organizationId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Enterprise Structured Logger
 * Integrates with Sentry and Console for unified observability.
 */
export const logger = {
  log(level: LogLevel, message: string, context: LogContext) {
    const timestamp = new Date().toISOString();
    const logPayload = {
      timestamp,
      level,
      message,
      ...context,
    };

    // 1. Console Logging (Structured)
    if (process.env.NODE_ENV === 'development') {
      const colors = { info: '🟢', warn: '🟡', error: '🔴' };
      console.log(`${colors[level]} [${context.module.toUpperCase()}] ${message}`, context.metadata || '');
    }

    // 2. Remote Error Tracking
    if (level === 'error') {
      Sentry.captureMessage(message, {
        level: 'error',
        extra: context.metadata,
        tags: {
          module: context.module,
          organization_id: context.organizationId,
        },
      });
    }

    // 3. Remote Performance Tracking (Breadcrumbs)
    Sentry.addBreadcrumb({
      category: context.module,
      message: message,
      level: level === 'info' ? 'info' : 'warning',
      data: context.metadata,
    });
  },

  info(message: string, context: LogContext) {
    this.log('info', message, context);
  },

  warn(message: string, context: LogContext) {
    this.log('warn', message, context);
  },

  error(message: string, error: any, context: LogContext) {
    this.log('error', message, {
      ...context,
      metadata: { 
        ...context.metadata, 
        errorMessage: error?.message || error,
        stack: error?.stack 
      }
    });
    
    if (error instanceof Error) {
      Sentry.captureException(error, {
        tags: {
          module: context.module,
          organization_id: context.organizationId,
        }
      });
    }
  }
};
