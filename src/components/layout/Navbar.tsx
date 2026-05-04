import { Bell, Search, Sun, Moon, Menu } from "lucide-react"
import { useTheme } from "@/hooks/useTheme"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuthStore } from "@/store/useAuthStore"
import { useNavigate } from "react-router-dom"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Sidebar } from "./Sidebar"
import { useNotificationsStore } from "@/modules/notifications/notificationsStore"
import { useEffect } from "react"
import { GlobalSearch } from "../GlobalSearch"

export function Navbar() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { user, profile, signOut } = useAuthStore()
  const { 
    notifications, 
    unreadCount, 
    fetchNotifications, 
    subscribeToNotifications,
    markAsRead,
    markAllAsRead 
  } = useNotificationsStore()

  useEffect(() => {
    fetchNotifications()
    const unsubscribe = subscribeToNotifications()
    return () => unsubscribe()
  }, [])

  return (
    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-background/80 backdrop-blur-md px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <div className="sr-only">
            <SheetHeader>
              <SheetTitle>Navigation Menu</SheetTitle>
              <SheetDescription>
                Access all platform modules and settings.
              </SheetDescription>
            </SheetHeader>
          </div>
          <Sidebar />
        </SheetContent>
      </Sheet>

      {/* Separator */}
      <div className="h-6 w-px bg-border lg:hidden" aria-hidden="true" />

        <div className="flex flex-1 items-center gap-x-4 self-stretch lg:gap-x-6">
          <GlobalSearch />
        </div>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center border-2 border-background">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                Notifications
                <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  {unreadCount} New
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-[350px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
                    <p className="text-xs text-muted-foreground">No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id}>
                      <DropdownMenuItem 
                        onClick={() => markAsRead(n.id)}
                        className={`flex flex-col items-start gap-1 p-4 cursor-pointer focus:bg-accent/50 ${!n.is_read ? 'bg-primary/[0.03]' : ''}`}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div className={`h-2 w-2 rounded-full ${
                            n.type === 'assignment' ? 'bg-blue-500' : 
                            n.type === 'billing' ? 'bg-emerald-500' : 
                            n.type === 'system' ? 'bg-rose-500' : 'bg-primary'
                          }`} />
                          <p className={`text-sm ${!n.is_read ? 'font-bold' : 'font-medium'}`}>{n.title}</p>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {new Date(n.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{n.description}</p>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </div>
                  ))
                )}
              </div>
              <DropdownMenuSeparator />
              <div className="p-2 flex items-center justify-between">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-[10px] h-7 px-2"
                  onClick={() => markAllAsRead()}
                >
                  Mark all as read
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-[10px] h-7 px-2 text-primary hover:text-primary"
                  onClick={() => navigate("/notifications")}
                >
                  View All
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Separator */}
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-border" aria-hidden="true" />

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="-m-1.5 flex items-center p-1.5">
                <span className="sr-only">Open user menu</span>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url} />
                  <AvatarFallback>{profile?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
                <span className="hidden lg:flex lg:items-center">
                  <span className="ml-4 text-sm font-black leading-6 tracking-tight text-foreground uppercase" aria-hidden="true">
                    {profile?.role === 'admin' ? (
                      <span className="text-primary">ROOT ADMIN</span>
                    ) : profile?.role === 'manager' ? (
                      'Manager'
                    ) : (
                      profile?.full_name || user?.email?.split('@')[0] || 'Guest'
                    )}
                  </span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")}>Profile</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/billing")}>Billing</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/settings")}>Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={async () => {
                await signOut()
                navigate("/login")
              }}>
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
  )
}
