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
import { Eye, EyeOff } from "lucide-react"

export default function RegisterPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [fullName, setFullName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuthStore()

  useEffect(() => {
    if (user) {
      navigate("/")
    }
  }, [user, navigate])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: 'employee', // Always default to employee on registration
          },
        },
      })

      if (error) throw error

      if (data.session) {
        toast.success("Account created successfully!")
        navigate("/")
      } else {
        toast.info("Registration successful! Please check your email for confirmation.")
        navigate("/login")
      }
    } catch (error) {
      toast.error(getFriendlySupabaseError(error, "Failed to create account. Please try again."))
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
        <div className="flex justify-center mb-8 overflow-hidden">
          <img src="/ecraftzlogo.png" alt="Logo" className="h-32 w-auto object-contain brightness-110 scale-110 drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]" />
        </div>

        <Card className="border-border/50 shadow-premium">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-black">Create an account</CardTitle>
            <CardDescription>
              Enter your details to get started with your secure dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input 
                  id="fullName" 
                  type="text" 
                  placeholder="John Doe" 
                  required 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-muted/30"
                />
              </div>
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
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••"
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-muted/30 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full font-black py-6" disabled={isLoading}>
                {isLoading ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Already have an account? </span>
              <Link to="/login" className="text-primary font-bold hover:underline">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
