import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Search,
  Users,
  Briefcase,
  CheckSquare,
  FileText,
  UserPlus,
  Loader2,
  Command as CommandIcon
} from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { useSearchStore } from "@/store/useSearchStore"
import { useSecurePermissions } from "@/hooks/useSecurePermissions"
import { useDebounce } from "@/hooks/useDebounce"

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebounce(query, 300)
  const navigate = useNavigate()
  const { results, isLoading, search, clearResults } = useSearchStore()
  const { canSearch } = useSecurePermissions()

  // Keyboard shortcut Ctrl+K or Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!canSearch) return
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [canSearch])

  // Trigger search on debounced query change
  useEffect(() => {
    if (debouncedQuery) {
      search(debouncedQuery)
    } else {
      clearResults()
    }
  }, [debouncedQuery, search, clearResults])

  const onSelect = (url: string) => {
    setOpen(false)
    navigate(url)
  }

  const groupedResults = {
    lead: results.filter(r => r.type === 'lead'),
    client: results.filter(r => r.type === 'client'),
    project: results.filter(r => r.type === 'project'),
    task: results.filter(r => r.type === 'task'),
    invoice: results.filter(r => r.type === 'invoice'),
    employee: results.filter(r => r.type === 'employee'),
  }

  if (!canSearch) {
    return null
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full max-w-[200px] md:max-w-none md:w-64 px-3 py-1.5 text-sm text-muted-foreground bg-muted/50 border rounded-lg hover:bg-muted transition-colors group"
      >
        <Search className="h-4 w-4 group-hover:text-primary transition-colors" />
        <span className="flex-1 text-left">Quick Search...</span>
        <kbd className="hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <CommandInput 
          placeholder="Type to search clients, tasks, projects..." 
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {isLoading ? (
              <div className="flex items-center justify-center py-6 gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium">Searching across ERP...</span>
              </div>
            ) : (
              "No results found."
            )}
          </CommandEmpty>

          {groupedResults.lead.length > 0 && (
            <CommandGroup heading="Leads">
              {groupedResults.lead.map((item) => (
                <CommandItem key={item.id} onSelect={() => onSelect(item.url)}>
                  <UserPlus className="mr-2 h-4 w-4 text-orange-500" />
                  <div className="flex flex-col">
                    <span>{item.title}</span>
                    <span className="text-[10px] text-muted-foreground">{item.subtitle}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {groupedResults.client.length > 0 && (
            <CommandGroup heading="Clients">
              {groupedResults.client.map((item) => (
                <CommandItem key={item.id} onSelect={() => onSelect(item.url)}>
                  <Users className="mr-2 h-4 w-4 text-blue-500" />
                  <div className="flex flex-col">
                    <span>{item.title}</span>
                    <span className="text-[10px] text-muted-foreground">{item.subtitle}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {groupedResults.project.length > 0 && (
            <CommandGroup heading="Projects">
              {groupedResults.project.map((item) => (
                <CommandItem key={item.id} onSelect={() => onSelect(item.url)}>
                  <Briefcase className="mr-2 h-4 w-4 text-purple-500" />
                  <div className="flex flex-col">
                    <span>{item.title}</span>
                    <span className="text-[10px] text-muted-foreground">{item.subtitle}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {groupedResults.task.length > 0 && (
            <CommandGroup heading="Tasks">
              {groupedResults.task.map((item) => (
                <CommandItem key={item.id} onSelect={() => onSelect(item.url)}>
                  <CheckSquare className="mr-2 h-4 w-4 text-emerald-500" />
                  <div className="flex flex-col">
                    <span>{item.title}</span>
                    <span className="text-[10px] text-muted-foreground">{item.subtitle}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {groupedResults.invoice.length > 0 && (
            <CommandGroup heading="Invoices">
              {groupedResults.invoice.map((item) => (
                <CommandItem key={item.id} onSelect={() => onSelect(item.url)}>
                  <FileText className="mr-2 h-4 w-4 text-rose-500" />
                  <div className="flex flex-col">
                    <span>{item.title}</span>
                    <span className="text-[10px] text-muted-foreground">{item.subtitle}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {groupedResults.employee.length > 0 && (
            <CommandGroup heading="Team Members">
              {groupedResults.employee.map((item) => (
                <CommandItem key={item.id} onSelect={() => onSelect(item.url)}>
                  <Users className="mr-2 h-4 w-4 text-cyan-500" />
                  <div className="flex flex-col">
                    <span>{item.title}</span>
                    <span className="text-[10px] text-muted-foreground">{item.subtitle}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />
          
          <CommandGroup heading="Quick Actions">
            <CommandItem onSelect={() => onSelect('/tasks')}>
              <CheckSquare className="mr-2 h-4 w-4" />
              <span>Go to Task Board</span>
            </CommandItem>
            <CommandItem onSelect={() => onSelect('/crm')}>
              <Users className="mr-2 h-4 w-4" />
              <span>Go to CRM Kanban</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
