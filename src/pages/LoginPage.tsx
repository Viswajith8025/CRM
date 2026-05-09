import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { getFriendlySupabaseError } from "@/lib/supabaseError"
import { useAuthStore } from "@/store/useAuthStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { rateLimiter } from "@/lib/rateLimiter"
import { AlertCircle, Clock } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [lockout, setLockout] = useState<{ isLocked: boolean, message: string, seconds: number } | null>(null)
  const navigate = useNavigate()
  const { user } = useAuthStore()

  useEffect(() => {
    if (user) {
      navigate("/")
    }
  }, [user, navigate])

  // Cooldown timer for lockouts
  useEffect(() => {
    if (lockout && lockout.seconds > 0) {
      const timer = setInterval(() => {
        setLockout(prev => {
          if (!prev || prev.seconds <= 1) {
            clearInterval(timer)
            return null
          }
          return { ...prev, seconds: prev.seconds - 1 }
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [lockout])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      // 1. Check for existing lockout
      const status = await rateLimiter.checkLockout(email)
      if (status.isLocked) {
        setLockout({ isLocked: true, message: status.message, seconds: status.remainingSeconds })
        setIsLoading(false)
        return
      }

      // 2. Log attempt
      await rateLimiter.logAuthEvent(email, 'LOGIN_ATTEMPT', false)

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        // 3. Log failure and check if this attempt triggered a new lockout
        await rateLimiter.logAuthEvent(email, 'LOGIN_FAILURE', false, { error: error.message })
        
        const newStatus = await rateLimiter.checkLockout(email)
        if (newStatus.isLocked) {
          setLockout({ isLocked: true, message: newStatus.message, seconds: newStatus.remainingSeconds })
        }
        
        throw error
      }

      // 4. Log success
      await rateLimiter.logAuthEvent(email, 'LOGIN_SUCCESS', true)

      toast.success("Welcome back!")
      navigate("/")
    } catch (error) {
      toast.error(getFriendlySupabaseError(error, "Failed to sign in. Check your email and password."))
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
            <CardTitle className="text-2xl font-black">Sign in</CardTitle>
            <CardDescription>
              Enter your email and password to access your ECRAFTZ dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {lockout && (
              <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="font-black uppercase tracking-widest text-[10px]">Access Blocked</AlertTitle>
                <AlertDescription className="text-xs font-medium">
                  {lockout.message.split('locked for')[0]} locked for <span className="font-bold underline">{lockout.seconds}s</span>.
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@company.com" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-muted/30"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link 
                    to="/forgot-password"
                    className="text-xs font-bold text-primary hover:underline transition-all"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-muted/30"
                />
              </div>
              <Button type="submit" className="w-full font-black py-6" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-6">
              <Separator />
              <p className="text-center text-xs text-muted-foreground mt-6">
                Don't have an account?{" "}
                <Link to="/register" className="text-primary font-bold hover:underline">
                  Create one now
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

function Separator() {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-card px-2 text-muted-foreground font-bold">Or continue with</span>
      </div>
    </div>
  )
}
