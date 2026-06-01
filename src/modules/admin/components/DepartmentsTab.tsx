/**
 * DepartmentsTab — Embedded tab component for SettingsPage.
 *
 * Renders the full Department Management UI:
 *  - List all departments (active + inactive) with status badges
 *  - Search/filter
 *  - Create department (Dialog)
 *  - Edit department (Dialog)
 *  - Disable department (AlertDialog — NOT hard delete)
 *  - Re-activate disabled department
 *
 * Access-controlled: ONLY super_admin can create / edit / disable departments.
 */
import { useEffect, useState, useMemo } from 'react'
import { useDepartmentStore, type Department } from '@/modules/dashboard/useDepartmentStore'
import { useAuthStore } from '@/store/useAuthStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Building2,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  PowerOff,
  Power,
  Loader2,
  Hash,
  AlignLeft,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Form State Type ──────────────────────────────────────────────────────────

interface DeptFormState {
  name: string
  description: string
  status: 'active' | 'inactive'
}

const EMPTY_FORM: DeptFormState = { name: '', description: '', status: 'active' }

// ─── Component ────────────────────────────────────────────────────────────────

export function DepartmentsTab() {
  const {
    departments,
    isLoading,
    fetchDepartments,
    createDepartment,
    updateDepartment,
    disableDepartment,
    activateDepartment,
  } = useDepartmentStore()

  const { profile } = useAuthStore()
  const isSuperAdmin = profile?.role === 'super_admin'
  // Only super_admin can create / edit / disable departments
  const canManage = isSuperAdmin

  // ── UI State ──
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')

  // Create dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<DeptFormState>(EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createErrors, setCreateErrors] = useState<Partial<DeptFormState>>({})

  // Edit dialog
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [editForm, setEditForm] = useState<DeptFormState>(EMPTY_FORM)
  const [editErrors, setEditErrors] = useState<Partial<DeptFormState>>({})

  // Disable confirm
  const [disablingId, setDisablingId] = useState<string | null>(null)

  useEffect(() => {
    fetchDepartments()
  }, [])

  // ── Filtered Departments ──
  const displayed = useMemo(() => {
    return departments
      .filter(d => filterStatus === 'all' || d.status === filterStatus)
      .filter(d => {
        const q = search.toLowerCase()
        return !q || d.name.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q)
      })
  }, [departments, search, filterStatus])

  // ── Validation ──
  function validate(form: DeptFormState, currentId?: string): Partial<DeptFormState> {
    const errs: Partial<DeptFormState> = {}
    if (!form.name.trim()) {
      errs.name = 'Department name is required.'
    } else if (form.name.trim().length < 2) {
      errs.name = 'Department name must be at least 2 characters.'
    } else {
      const dup = departments.find(
        d => d.name.toLowerCase() === form.name.trim().toLowerCase() && d.id !== currentId
      )
      if (dup) errs.name = `A department named "${form.name.trim()}" already exists.`
    }
    return errs
  }

  // ── Create ──
  const handleCreate = async () => {
    const errs = validate(createForm)
    if (Object.keys(errs).length > 0) { setCreateErrors(errs); return }
    setCreateErrors({})
    setIsSubmitting(true)
    try {
      await createDepartment(createForm)
      setIsCreateOpen(false)
      setCreateForm(EMPTY_FORM)
    } catch {
      // Error already toasted by store
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Edit ──
  const openEdit = (dept: Department) => {
    setEditingDept(dept)
    setEditForm({ name: dept.name, description: dept.description || '', status: dept.status })
    setEditErrors({})
  }

  const handleEdit = async () => {
    if (!editingDept) return
    const errs = validate(editForm, editingDept.id)
    if (Object.keys(errs).length > 0) { setEditErrors(errs); return }
    setEditErrors({})
    setIsSubmitting(true)
    try {
      await updateDepartment(editingDept.id, editForm)
      setEditingDept(null)
    } catch {
      // Error already toasted
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Disable ──
  const handleDisable = async () => {
    if (!disablingId) return
    try {
      await disableDepartment(disablingId)
    } catch {
      // Error already toasted
    } finally {
      setDisablingId(null)
    }
  }

  // ── Status badge helper ──
  const StatusBadge = ({ status }: { status: 'active' | 'inactive' }) =>
    status === 'active' ? (
      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 border font-bold">
        Active
      </Badge>
    ) : (
      <Badge className="bg-muted text-muted-foreground border font-bold">
        Inactive
      </Badge>
    )

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Departments
            </CardTitle>
            <CardDescription className="mt-1">
              Manage your organization's departments. Departments drive project scoping, team routing, and reporting.
            </CardDescription>
          </div>
          {canManage && (
            <Button
              id="dept-create-btn"
              className="gap-2 font-bold shrink-0"
              onClick={() => { setCreateForm(EMPTY_FORM); setCreateErrors({}); setIsCreateOpen(true) }}
            >
              <Plus className="h-4 w-4" />
              Add Department
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="dept-search"
                placeholder="Search departments…"
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
              <SelectTrigger className="w-36" id="dept-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Inactive only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border/50 bg-card/30 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 border-b border-border/50">
                  <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-3">Department</TableHead>
                  <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-3">Slug</TableHead>
                  <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-3">Description</TableHead>
                  <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-3">Status</TableHead>
                  <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-3">Created</TableHead>
                  {canManage && <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-3 text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-32">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold text-muted-foreground">Loading departments…</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : displayed.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-32">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Building2 className="h-8 w-8 opacity-20" />
                        <p className="text-sm font-bold">
                          {search || filterStatus !== 'all'
                            ? 'No departments match your filter.'
                            : 'No departments yet. Click "Add Department" to create the first one.'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  displayed.map(dept => (
                    <TableRow
                      key={dept.id}
                      className={`hover:bg-muted/20 transition-colors ${dept.status === 'inactive' ? 'opacity-60' : ''}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${dept.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                          <span className="font-bold text-sm">{dept.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                          {dept.slug}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                          {dept.description || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={dept.status} />
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {new Date(dept.created_at).toLocaleDateString(undefined, {
                            year: 'numeric', month: 'short', day: 'numeric',
                          })}
                        </span>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" id={`dept-menu-${dept.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[160px]">
                              <DropdownMenuItem onClick={() => openEdit(dept)} className="gap-2 font-medium cursor-pointer">
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {dept.status === 'active' ? (
                                <DropdownMenuItem
                                  onClick={() => setDisablingId(dept.id)}
                                  className="gap-2 font-medium cursor-pointer text-amber-500 focus:text-amber-600 focus:bg-amber-50"
                                >
                                  <PowerOff className="h-3.5 w-3.5" />
                                  Disable
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => activateDepartment(dept.id)}
                                  className="gap-2 font-medium cursor-pointer text-emerald-500 focus:text-emerald-600 focus:bg-emerald-50"
                                >
                                  <Power className="h-3.5 w-3.5" />
                                  Re-activate
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary footer */}
          {departments.length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium px-1">
              <span>
                {departments.filter(d => d.status === 'active').length} active ·{' '}
                {departments.filter(d => d.status === 'inactive').length} inactive
              </span>
              <span>{departments.length} total</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Create Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={isCreateOpen} onOpenChange={open => { if (!open) { setIsCreateOpen(false); setCreateErrors({}) } }}>
        <DialogContent id="dept-create-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Add New Department
            </DialogTitle>
            <DialogDescription>
              Create a department that can be assigned to employees, projects, and tasks.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="create-dept-name" className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide">
                <Hash className="h-3 w-3" /> Department Name *
              </Label>
              <Input
                id="create-dept-name"
                placeholder="e.g. Web Development"
                value={createForm.name}
                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                className={createErrors.name ? 'border-rose-500' : ''}
              />
              {createErrors.name && (
                <p className="text-xs text-rose-500 font-medium">{createErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-dept-desc" className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide">
                <AlignLeft className="h-3 w-3" /> Description (Optional)
              </Label>
              <Input
                id="create-dept-desc"
                placeholder="Brief description of this department's function"
                value={createForm.description}
                onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-wide">Status</Label>
              <Select
                value={createForm.status}
                onValueChange={(v: 'active' | 'inactive') => setCreateForm(f => ({ ...f, status: v }))}
              >
                <SelectTrigger id="create-dept-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive (hidden from dropdowns)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isSubmitting} className="font-bold" id="dept-create-submit">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={!!editingDept} onOpenChange={open => { if (!open) setEditingDept(null) }}>
        <DialogContent id="dept-edit-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              Edit Department
            </DialogTitle>
            <DialogDescription>
              Changes apply immediately. Linked employees and projects are not affected.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-dept-name" className="text-xs font-black uppercase tracking-wide">
                Department Name *
              </Label>
              <Input
                id="edit-dept-name"
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className={editErrors.name ? 'border-rose-500' : ''}
              />
              {editErrors.name && (
                <p className="text-xs text-rose-500 font-medium">{editErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-dept-desc" className="text-xs font-black uppercase tracking-wide">
                Description
              </Label>
              <Input
                id="edit-dept-desc"
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-wide">Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(v: 'active' | 'inactive') => setEditForm(f => ({ ...f, status: v }))}
              >
                <SelectTrigger id="edit-dept-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">Safety Notice</p>
              <p className="text-xs text-muted-foreground">
                Renaming a department updates all dropdown labels. Employees already assigned to this department
                keep their link — only the display name changes.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDept(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={isSubmitting} className="font-bold" id="dept-edit-submit">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Disable Confirm ─────────────────────────────────────────────────── */}
      <AlertDialog open={!!disablingId} onOpenChange={open => !open && setDisablingId(null)}>
        <AlertDialogContent id="dept-disable-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Department?</AlertDialogTitle>
            <AlertDialogDescription>
              This department will be hidden from all assignment dropdowns (projects, employees, tasks).
              Existing records that reference it remain intact — nothing is deleted.
              You can re-activate it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisable}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold"
              id="dept-disable-confirm"
            >
              <PowerOff className="mr-2 h-4 w-4" />
              Yes, Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
