import React, { useState } from 'react'
import { Plus, X, Briefcase, FileText, UserPlus, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/store/useAuthStore'
import { useRBACStore } from '@/modules/admin/rbacStore'

export function QuickActionButton() {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const { hasPermission } = useRBACStore()

  // Hide Quick Action button for non-management roles
  if (!hasPermission('projects.manage')) return null

  const actions = [
    { 
      label: 'New Lead', 
      icon: UserPlus, 
      color: 'text-blue-500', 
      onClick: () => navigate('/crm?action=new-lead') 
    },
    { 
      label: 'New Project', 
      icon: Briefcase, 
      color: 'text-emerald-500', 
      onClick: () => navigate('/projects?action=new-project') 
    },
    { 
      label: 'New Invoice', 
      icon: FileText, 
      color: 'text-amber-500', 
      onClick: () => navigate('/billing?action=new-invoice') 
    },
    { 
      label: 'New Task', 
      icon: Zap, 
      color: 'text-purple-500', 
      onClick: () => navigate('/tasks?action=new-task') 
    },
  ]

  return (
    <div className="fixed bottom-8 right-8 z-[100] print:hidden">
      <DropdownMenu onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            size="icon" 
            className={cn(
              "h-14 w-14 rounded-full shadow-2xl transition-all duration-300 hover:scale-110",
              isOpen ? "rotate-45 bg-rose-500 hover:bg-rose-600" : "bg-primary hover:bg-primary/90"
            )}
          >
            {isOpen ? <X className="h-7 w-7" /> : <Plus className="h-7 w-7" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="mb-4 w-56 p-2 rounded-2xl bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl">
          <div className="px-3 py-2 mb-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quick Create</p>
          </div>
          {actions.map((action) => (
            <DropdownMenuItem 
              key={action.label} 
              onClick={action.onClick}
              className="flex items-center gap-3 p-3 cursor-pointer rounded-xl hover:bg-muted/50 transition-colors"
            >
              <div className={cn("h-8 w-8 rounded-lg bg-background flex items-center justify-center border", action.color)}>
                <action.icon className="h-4 w-4" />
              </div>
              <span className="font-bold text-sm">{action.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
