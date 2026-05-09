"use client"

import * as React from "react"
import {
  Calendar as CalendarIcon,
  CheckSquare,
  CreditCard,
  FileText,
  Layout,
  Plus,
  Search,
  Settings,
  User,
  Users,
  Home,
  Briefcase,
  PieChart,
  LogOut,
  Target,
  Building,
  Zap,
  Loader2,
  ChevronRight
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { useDebounce } from "@/hooks/useDebounce"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { useAuthStore } from "@/store/useAuthStore"
import { cn } from "@/lib/utils"

interface SearchResult {
  id: string
  type: 'lead' | 'client' | 'project' | 'task' | 'invoice' | 'employee'
  title: string
  subtitle: string
  status: string
  link: string
  metadata: any
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const navigate = useNavigate()
  const { profile, logout } = useAuthStore()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const handleSearch = React.useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([])
      return
    }

    setIsSearching(true)
    try {
      const { data, error } = await supabase.rpc('global_search', {
        p_query: searchQuery,
        p_limit: 20
      })

      if (error) throw error
      setResults(data || [])
    } catch (err) {
      console.error("Global search error:", err)
    } finally {
      setIsSearching(false)
    }
  }, [])

  React.useEffect(() => {
    handleSearch(debouncedQuery)
  }, [debouncedQuery, handleSearch])

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false)
    setQuery("")
    command()
  }, [])

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) acc[result.type] = []
    acc[result.type].push(result)
    return acc
  }, {} as Record<string, SearchResult[]>)

  const getIcon = (type: string) => {
    switch (type) {
      case 'lead': return <Target className="mr-2 h-4 w-4 text-emerald-500" />
      case 'client': return <Building className="mr-2 h-4 w-4 text-blue-500" />
      case 'project': return <Briefcase className="mr-2 h-4 w-4 text-amber-500" />
      case 'task': return <CheckSquare className="mr-2 h-4 w-4 text-indigo-500" />
      case 'invoice': return <CreditCard className="mr-2 h-4 w-4 text-rose-500" />
      case 'employee': return <User className="mr-2 h-4 w-4 text-slate-500" />
      default: return <FileText className="mr-2 h-4 w-4" />
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <div className="relative">
        <CommandInput 
          placeholder="Search leads, projects, invoices..." 
          value={query}
          onValueChange={setQuery}
        />
        {isSearching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      <CommandList className="max-h-[500px]">
        <CommandEmpty>
          {isSearching ? "Searching..." : "No results found for this query."}
        </CommandEmpty>
        
        {query.length < 2 && (
          <>
            <CommandGroup heading="Quick Actions">
              <CommandItem onSelect={() => runCommand(() => navigate("/tasks"))}>
                <Zap className="mr-2 h-4 w-4 text-amber-500" />
                <span>Create New Task</span>
                <CommandShortcut>⌘T</CommandShortcut>
              </CommandItem>
              {isAdmin && (
                <CommandItem onSelect={() => runCommand(() => navigate("/crm"))}>
                  <Plus className="mr-2 h-4 w-4 text-emerald-500" />
                  <span>Add New Lead</span>
                  <CommandShortcut>⌘L</CommandShortcut>
                </CommandItem>
              )}
              <CommandItem onSelect={() => runCommand(() => navigate("/projects"))}>
                <Briefcase className="mr-2 h-4 w-4 text-blue-500" />
                <span>Start New Project</span>
                <CommandShortcut>⌘P</CommandShortcut>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Navigation">
              <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
                <Home className="mr-2 h-4 w-4" />
                <span>Dashboard Overview</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => navigate("/tasks"))}>
                <CheckSquare className="mr-2 h-4 w-4" />
                <span>My Tasks</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => navigate("/projects"))}>
                <Layout className="mr-2 h-4 w-4" />
                <span>Projects Portfolio</span>
              </CommandItem>
              {isAdmin && (
                <>
                  <CommandItem onSelect={() => runCommand(() => navigate("/crm"))}>
                    <Target className="mr-2 h-4 w-4" />
                    <span>CRM & Sales Pipeline</span>
                  </CommandItem>
                  <CommandItem onSelect={() => runCommand(() => navigate("/billing"))}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Financial Center</span>
                  </CommandItem>
                </>
              )}
            </CommandGroup>
          </>
        )}

        {Object.entries(groupedResults).map(([type, items]) => (
          <CommandGroup key={type} heading={type.charAt(0).toUpperCase() + type.slice(1) + 's'}>
            {items.map((item) => (
              <CommandItem
                key={item.id}
                onSelect={() => runCommand(() => navigate(item.link))}
                className="group"
              >
                {getIcon(item.type)}
                <div className="flex flex-col flex-1 truncate">
                  <span className="font-bold truncate">{item.title}</span>
                  <span className="text-[10px] text-muted-foreground truncate">{item.subtitle}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[10px] uppercase font-black px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-muted text-muted-foreground"
                  )}>
                    {item.status?.replace('_', ' ')}
                  </span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}

        <CommandSeparator />

        <CommandGroup heading="Settings & System">
          <CommandItem onSelect={() => runCommand(() => navigate("/profile"))}>
            <User className="mr-2 h-4 w-4" />
            <span>My User Profile</span>
          </CommandItem>
          {isAdmin && (
            <CommandItem onSelect={() => runCommand(() => navigate("/settings"))}>
              <Settings className="mr-2 h-4 w-4" />
              <span>System Settings</span>
            </CommandItem>
          )}
          <CommandItem onSelect={() => runCommand(() => logout())} className="text-rose-500">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Secure Logout</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
      
      <div className="flex items-center justify-between border-t p-3 bg-muted/20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <kbd className="pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-bold opacity-100 flex">
              ESC
            </kbd>
            <span className="text-[10px] text-muted-foreground">Close</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-bold opacity-100 flex">
              ↵
            </kbd>
            <span className="text-[10px] text-muted-foreground">Select</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 opacity-40">
          <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-tighter">Enterprise Search v2.0</span>
        </div>
      </div>
    </CommandDialog>
  )
}
