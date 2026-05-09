import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { PenTool, ShieldCheck, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SignatureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSign: (data: { name: string, signature: string }) => void
  title?: string
  documentName?: string
}

export function SignatureDialog({ 
  open, 
  onOpenChange, 
  onSign, 
  title = "Sign Document", 
  documentName = "the document" 
}: SignatureDialogProps) {
  const [name, setName] = useState('')
  const [agreed, setAgreed] = useState(false)

  const handleSign = () => {
    if (!name || !agreed) return
    onSign({
      name,
      signature: `[DIGITALLY SIGNED BY ${name.toUpperCase()}]`
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/30 backdrop-blur-2xl border-border/50">
        <DialogHeader>
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <PenTool className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-xl font-black">{title}</DialogTitle>
          <DialogDescription className="font-medium">
            You are legally signing <span className="text-foreground font-bold">{documentName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Full Legal Name</Label>
            <Input 
              id="name" 
              placeholder="Enter your full name" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 font-bold"
            />
          </div>

          <div className="p-4 rounded-xl bg-muted/20 border border-border/50 space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox 
                id="agree" 
                checked={agreed} 
                onCheckedChange={(val) => setAgreed(!!val)}
                className="mt-1"
              />
              <Label htmlFor="agree" className="text-xs leading-relaxed text-muted-foreground cursor-pointer select-none">
                I understand that this is a <span className="text-foreground font-bold italic">legally binding digital signature</span>. 
                By checking this box, I authorize the execution of this document.
              </Label>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-tight">
              Securely Encrypted & Audit-Logged
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 font-bold">Cancel</Button>
          <Button 
            onClick={handleSign} 
            disabled={!name || !agreed}
            className="flex-1 font-black uppercase tracking-widest"
          >
            Sign & Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
