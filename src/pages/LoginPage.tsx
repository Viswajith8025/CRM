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

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuthStore()

  useEffect(() => {
    if (user) {
      navigate("/")
    }
  }, [user, navigate])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

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
          <CardContent>
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
