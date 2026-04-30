import { ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { DynamicBreadcrumbs } from "./DynamicBreadcrumbs"

interface PageWrapperProps {
  children: ReactNode
  title: string
  description?: string
  actions?: ReactNode
  breadcrumbs?: ReactNode
  className?: string
}

export function PageWrapper({ children, title, description, actions, breadcrumbs, className }: PageWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn("space-y-8", className)}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="mb-2">
            {breadcrumbs || <DynamicBreadcrumbs />}
          </div>
          <motion.h1 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-4xl font-black tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent"
          >
            {title}
          </motion.h1>
          {description && (
            <p className="text-muted-foreground text-lg font-medium leading-relaxed max-w-2xl">
              {description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {actions}
        </div>
      </div>
      <div className="relative">
        {children}
      </div>
    </motion.div>
  )
}
