import { useState } from "react"
import { Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { getFriendlySupabaseError } from "@/lib/supabaseError"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { ArrowLeft, Mail } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) throw error

      setIsSent(true)
      toast.success("Reset link sent!")
    } catch (error) {
      toast.error(getFriendlySupabaseError(error, "Failed to send reset link. Please check the email address."))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="flex justify-center mb-8">
          <Link to="/login" className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <div className="h-5 w-5 bg-primary-foreground rounded-sm rotate-45" />
            </div>
            <span className="text-2xl font-black tracking-tighter">
              ECRAFTZ
            </span>
          </Link>
        </div>

        <Card className="border-border/50 shadow-premium overflow-hidden">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-black">Forgot password?</CardTitle>
            <CardDescription>
              {isSent 
                ? "We've sent a password reset link to your email." 
                : "Enter your email address and we'll send you a link to reset your password."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isSent ? (
              <form onSubmit={handleResetRequest} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="name@company.com" 
                      required 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-muted/30 pl-9"
                    />
                  </div>
                </div>
                <Button className="w-full font-bold" type="submit" disabled={isLoading}>
                  {isLoading ? "Sending link..." : "Send reset link"}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="bg-primary/10 p-4 rounded-lg flex items-center gap-3 text-sm text-primary font-medium border border-primary/20">
                  <Mail className="h-5 w-5 shrink-0" />
                  <p>Check your email for the reset link. It might take a minute or two to arrive.</p>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full font-bold" 
                  onClick={() => setIsSent(false)}
                >
                  Didn't get the email? Try again
                </Button>
              </div>
            )}
            
            <div className="mt-6 text-center">
              <Link to="/login" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
