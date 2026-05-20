import React, { useState, useRef, useEffect } from 'react'
import { MessageSquare, X, Send, Sparkles, RefreshCw, Bot, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/useAuthStore'

interface Message {
  sender: 'ai' | 'user'
  text: string
  timestamp: Date
}

export function FloatingAIAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const { profile } = useAuthStore()
  
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom whenever messages list updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Initialize welcome message when opened for the first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setIsTyping(true)
      const timer = setTimeout(() => {
        const name = profile?.full_name || "Viswajith"
        setMessages([
          {
            sender: 'ai',
            text: `Hello ${name}! 🌴 I am your Janani AI Operations Assistant. I can help you analyze department intelligence, track time accountability, manage client renewals, or audit invoices. What can I do for you today?`,
            timestamp: new Date()
          }
        ])
        setIsTyping(false)
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    const userText = inputValue.trim()
    setMessages(prev => [...prev, { sender: 'user', text: userText, timestamp: new Date() }])
    setInputValue('')
    setIsTyping(true)

    // Dynamic intelligent CRM replies simulator
    setTimeout(() => {
      let reply = ""
      const q = userText.toLowerCase()

      if (q.includes('hi') || q.includes('hello') || q.includes('hey')) {
        reply = "Hello! Hope your day is going great. How can I help you navigate your CRM analytics or operations today?"
      } else if (q.includes('department') || q.includes('intelligence') || q.includes('team') || q.includes('employee')) {
        reply = "You can manage all your department personnel in the 'Dashboard -> Department Intelligence' workspace. Clicking any employee in the roster will open their private dashboard, complete with their weekly time desk graphs and active tasks."
      } else if (q.includes('invoice') || q.includes('billing') || q.includes('financial') || q.includes('money')) {
        reply = "Our billing suite supports automated statement tracking, manual invoice adjustments, and complete financial reporting. Check out the 'Financials' tab to log transactions or 'Reports' to download custom statements."
      } else if (q.includes('renewal') || q.includes('client') || q.includes('contract')) {
        reply = "Under the 'Client Renewals' module, you can keep track of expiring SLA dates, send customized renewal emails, or run bulk uploads to register new enterprise contracts."
      } else if (q.includes('report') || q.includes('analytics') || q.includes('sales')) {
        reply = "To compile performance metrics, navigate to the 'Reports' page. You can customize filters by staff member, specify date ranges, and instantly export comprehensive Sales Reports in PDF or CSV formats."
      } else {
        reply = "I understand! As the Janani CRM Copilot, I'm fully synchronized with your workspace. Let me know if you'd like me to look up department capacities, task SLA risks, or client payment histories!"
      }

      setMessages(prev => [...prev, { sender: 'ai', text: reply, timestamp: new Date() }])
      setIsTyping(false)
    }, 1200)
  }

  const handleResetChat = () => {
    setMessages([])
    setIsOpen(false)
  }

  return (
    <div className="fixed bottom-8 right-24 z-[100] print:hidden">
      {/* Floating Button with Badge mimicking screenshot */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative h-14 w-14 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 flex items-center justify-center border border-primary/20",
          isOpen 
            ? "bg-rose-500 hover:bg-rose-600 text-white" 
            : "bg-gradient-to-tr from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600 text-white"
        )}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
        
        {/* Cute AI Red Badge */}
        {!isOpen && (
          <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[7px] tracking-tight leading-none px-1 py-0.5 rounded-full border border-card shadow-sm flex items-center justify-center animate-bounce">
            AI
          </span>
        )}
      </button>

      {/* Chat Window Panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-96 rounded-3xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col h-[480px] animate-in slide-in-from-bottom-4 duration-300">
          
          {/* Header */}
          <div className="p-4 border-b border-border/40 bg-gradient-to-r from-blue-600/10 to-indigo-500/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md">
                <Sparkles className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <h4 className="text-xs font-black text-foreground uppercase tracking-widest">Janani AI Copilot</h4>
                <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Always Online
                </p>
              </div>
            </div>
            
            <button 
              onClick={handleResetChat}
              title="Reset Chat"
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Conversation view */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/5">
            {messages.map((msg, index) => {
              const isAI = msg.sender === 'ai'
              return (
                <div 
                  key={index}
                  className={cn(
                    "flex gap-2.5 max-w-[85%]",
                    isAI ? "mr-auto" : "ml-auto flex-row-reverse"
                  )}
                >
                  <div className={cn(
                    "h-7 w-7 rounded-lg shrink-0 flex items-center justify-center border text-[10px]",
                    isAI 
                      ? "bg-gradient-to-tr from-blue-600 to-indigo-500 border-primary/20 text-white" 
                      : "bg-muted border-border/40 text-foreground"
                  )}>
                    {isAI ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                  </div>

                  <div className={cn(
                    "p-3 rounded-2xl text-xs font-semibold leading-relaxed shadow-sm",
                    isAI 
                      ? "bg-card border border-border/40 text-foreground rounded-tl-none" 
                      : "bg-blue-600 text-white rounded-tr-none"
                  )}>
                    {msg.text}
                    <span className={cn(
                      "block text-[8px] mt-1 text-right",
                      isAI ? "text-muted-foreground" : "text-blue-200"
                    )}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              )
            })}

            {isTyping && (
              <div className="flex gap-2.5 max-w-[80%] mr-auto">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="p-3 rounded-2xl bg-card border border-border/40 text-foreground rounded-tl-none flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0.2s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Form Input */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-border/40 bg-card flex gap-2">
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask anything about Janani CRM..." 
              className="flex-1 bg-muted/40 border border-border/40 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background"
            />
            <Button type="submit" size="icon" className="h-9 w-9 rounded-xl shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>

        </div>
      )}
    </div>
  )
}
