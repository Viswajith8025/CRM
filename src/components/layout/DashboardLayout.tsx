import { ReactNode, useEffect } from "react"
import { Sidebar } from "./Sidebar"
import { Navbar } from "./Navbar"
import { NetworkIndicator } from "../shared/NetworkIndicator"
import { QuickActionButton } from "../shared/QuickActionButton"
import { useNotificationsStore } from "@/modules/notifications"

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { fetchNotifications, subscribeToNotifications } = useNotificationsStore()

  useEffect(() => {
    fetchNotifications()
    const unsubscribe = subscribeToNotifications()
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [fetchNotifications, subscribeToNotifications])

  return (
    <div className="min-h-screen bg-background">
      {/* Static sidebar for desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-60 lg:flex-col">
        <Sidebar />
      </div>

      <div className="lg:pl-60">
        <Navbar />

        <main className="py-10">
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>

      <NetworkIndicator />
      <QuickActionButton />
    </div>
  )
}

