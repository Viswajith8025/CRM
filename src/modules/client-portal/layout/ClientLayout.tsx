import { ReactNode } from "react"
import { ClientSidebar } from "../components/ClientSidebar"
import { Navbar } from "@/components/layout/Navbar"
import { Outlet } from "react-router-dom"

export function ClientLayout() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background">
      {/* Static sidebar for desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <ClientSidebar />
      </div>

      <div className="lg:pl-72">
        <Navbar />

        <main className="py-10">
          <div className="px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
