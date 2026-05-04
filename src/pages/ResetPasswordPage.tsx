import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { getFriendlySupabaseError } from "@/lib/supabaseError"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { Lock, Check, X, ShieldAlert } from "lucide-react"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isSessionChecked, setIsSessionChecked] = useState(false)
  const [isValidSession, setIsValidSession] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Check if we have a session (recovery link automatically signs the user in)
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession()
      
      // If there's no session, they shouldn't be here unless they just clicked a link
      // But Supabase usually handles the hashing and session creation on redirect
      if (!session) {
        setIsValidSession(false)
      } else {
        setIsValidSession(true)
      }
      setIsSessionChecked(true)
    }

    checkSession()

    // Listen for auth changes to catch the recovery event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsValidSession(true)
        setIsSessionChecked(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const passwordRequirements = [
    { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
    { label: "At least one number", test: (p: string) => /\d/.test(p) },
    { label: "At least one special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
    { label: "Passwords match", test: (p: string) => p === confirmPassword && p !== "" },
  ]

  const isPasswordValid = passwordRequirements.every(req => req.test(password))

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!isPasswordValid) return
    
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ 
        password: password 
      })

      if (error) throw error

      setIsSuccess(true)
      toast.success("Password updated successfully!")
      
      // Redirect to login after a short delay
      setTimeout(() => {
        navigate("/login")
      }, 3000)
    } catch (error) {
      toast.error(getFriendlySupabaseError(error, "Failed to update password."))
    } finally {
      setIsLoading(false)
    }
  }

  if (!isSessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground font-medium">Validating recovery session...</p>
        </div>
      </div>
    )
  }

  if (!isValidSession && !isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background p-4">
        <Card className="w-full max-w-md border-destructive/20 shadow-premium">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl font-black">Invalid or Expired Link</CardTitle>
            <CardDescription>
              The password reset link is invalid or has expired. Please request a new one.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button asChild className="w-full font-bold">
              <Link to="/forgot-password">Request new link</Link>
            </Button>
            <Button variant="ghost" asChild className="w-full font-bold text-muted-foreground">
              <Link to="/login">Back to login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
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
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <div className="h-5 w-5 bg-primary-foreground rounded-sm rotate-45" />
            </div>
            <span className="text-2xl font-black tracking-tighter">
              ECRAFTZ
            </span>
          </div>
        </div>

        <Card className="border-border/50 shadow-premium">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-black">Reset password</CardTitle>
            <CardDescription>
              Create a new secure password for your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSuccess ? (
              <div className="space-y-6 py-4 text-center">
                <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
                  <Check className="h-8 w-8 text-green-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">All set!</h3>
                  <p className="text-muted-foreground text-sm">
                    Your password has been reset successfully. You'll be redirected to login in a few seconds.
                  </p>
                </div>
                <Button asChild className="w-full font-bold">
                  <Link to="/login">Sign in now</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="password" 
                        type="password" 
                        required 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-muted/30 pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="confirmPassword" 
                        type="password" 
                        required 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="bg-muted/30 pl-9"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg space-y-2 border border-border/50">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Requirements</p>
                  {passwordRequirements.map((req, i) => {
                    const isMet = req.test(password)
                    return (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        {isMet ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground/30" />
                        )}
                        <span className={isMet ? "text-foreground font-medium" : "text-muted-foreground"}>
                          {req.label}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <Button 
                  className="w-full font-bold" 
                  type="submit" 
                  disabled={isLoading || !isPasswordValid}
                >
                  {isLoading ? "Updating password..." : "Reset password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
