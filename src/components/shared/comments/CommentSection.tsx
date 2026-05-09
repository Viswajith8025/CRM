import React, { useState, useEffect, useRef } from 'react'
import { useCommentStore } from '@/modules/comments/commentStore'
import type { Comment } from '@/modules/comments/commentStore'
import { useTeamStore } from '@/modules/admin'
import { useAuthStore } from '@/store/useAuthStore'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatDistanceToNow } from 'date-fns'
import { Send, Reply, Trash2, AtSign, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'

interface CommentSectionProps {
  entityId: string
  entityType: 'task' | 'project' | 'invoice'
}

export function CommentSection({ entityId, entityType }: CommentSectionProps) {
  const { comments, fetchComments, addComment, deleteComment, isLoading } = useCommentStore()
  const { members, fetchMembers } = useTeamStore()
  const { profile } = useAuthStore()
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [cursorPos, setCursorPos] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetchComments(entityId)
    fetchMembers()
  }, [entityId])

  const entityComments = comments[entityId] || []

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const position = e.target.selectionStart
    setNewComment(value)
    setCursorPos(position)

    const lastAtIdx = value.lastIndexOf('@', position - 1)
    if (lastAtIdx !== -1 && !value.slice(lastAtIdx, position).includes(' ')) {
      setShowMentions(true)
      setMentionSearch(value.slice(lastAtIdx + 1, position))
    } else {
      setShowMentions(false)
    }
  }

  const insertMention = (member: any) => {
    const lastAtIdx = newComment.lastIndexOf('@', cursorPos - 1)
    const before = newComment.slice(0, lastAtIdx)
    const after = newComment.slice(cursorPos)
    const updated = `${before}@${member.full_name} ${after}`
    setNewComment(updated)
    setShowMentions(false)
    textareaRef.current?.focus()
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!newComment.trim() || !profile) return

    // Extract mentions from text
    const mentions = members
      .filter(m => newComment.includes(`@${m.full_name}`))
      .map(m => ({ id: m.id, name: m.full_name || 'User' }))

    try {
      await addComment({
        content: newComment,
        entity_id: entityId,
        entity_type: entityType,
        user_id: profile.id,
        parent_id: replyTo?.id || null,
        mentions
      })
      setNewComment('')
      setReplyTo(null)
      toast.success('Comment posted')
    } catch (error) {
      toast.error('Failed to post comment')
    }
  }

  return (
    <div className="flex flex-col h-full bg-card/50 rounded-xl border overflow-hidden">
      <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          Internal Chat
        </h3>
        <span className="text-[10px] font-bold text-muted-foreground uppercase">
          {entityComments.length} Threads
        </span>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {entityComments.length === 0 ? (
            <div className="text-center py-10">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <AtSign className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">No internal discussions yet. Start one by typing below.</p>
            </div>
          ) : (
            entityComments.map(comment => (
              <CommentItem 
                key={comment.id} 
                comment={comment} 
                onReply={setReplyTo} 
                onDelete={() => deleteComment(comment.id, entityId)}
                currentUserId={profile?.id}
              />
            ))
          )}
        </div>
      </ScrollArea>

      <div className="p-4 bg-muted/10 border-t relative">
        {showMentions && (
          <div className="absolute bottom-full left-4 w-64 bg-popover border rounded-lg shadow-xl mb-2 overflow-hidden z-50">
            <div className="p-2 border-b bg-muted/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Mention User
            </div>
            <div className="max-h-48 overflow-y-auto">
              {members
                .filter(m => m.full_name?.toLowerCase().includes(mentionSearch.toLowerCase()))
                .map(member => (
                  <button
                    key={member.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-3 transition-colors"
                    onClick={() => insertMention(member)}
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px]">{member.full_name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="font-bold">{member.full_name}</span>
                  </button>
                ))
              }
            </div>
          </div>
        )}

        {replyTo && (
          <div className="mb-2 p-2 bg-primary/5 rounded-lg border border-primary/20 flex items-center justify-between">
            <div className="text-[10px]">
              <span className="font-bold text-primary">Replying to: </span>
              <span className="text-muted-foreground line-clamp-1 italic">"{replyTo.content}"</span>
            </div>
            <button onClick={() => setReplyTo(null)} className="text-[10px] font-bold text-muted-foreground hover:text-primary">Cancel</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="relative">
          <Textarea
            ref={textareaRef}
            placeholder="Type your message... use @ to mention someone"
            className="min-h-[80px] pr-12 text-sm resize-none focus-visible:ring-primary/20"
            value={newComment}
            onChange={handleTextChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
          />
          <Button 
            type="submit" 
            size="icon" 
            className="absolute bottom-2 right-2 h-8 w-8 rounded-lg"
            disabled={!newComment.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="text-[9px] text-muted-foreground mt-2 font-medium">
          Shift + Enter for new line. Press Enter to send.
        </p>
      </div>
    </div>
  )
}

function CommentItem({ comment, onReply, onDelete, currentUserId }: { 
  comment: Comment, 
  onReply: (c: Comment) => void,
  onDelete: () => void,
  currentUserId?: string
}) {
  return (
    <div className="group">
      <div className="flex gap-4">
        <Avatar className="h-8 w-8 border-2 border-background shadow-sm shrink-0">
          <AvatarImage src={comment.profiles?.avatar_url} />
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px]">
            {comment.profiles?.full_name?.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black">{comment.profiles?.full_name}</span>
              <span className="text-[10px] text-muted-foreground font-medium">
                {formatDistanceToNow(new Date(comment.created_at))} ago
              </span>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => onReply(comment)}
                className="p-1 hover:text-primary transition-colors"
                title="Reply"
              >
                <Reply className="h-3.5 w-3.5" />
              </button>
              {currentUserId === comment.user_id && (
                <button 
                  onClick={onDelete}
                  className="p-1 hover:text-rose-500 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {renderContent(comment.content, comment.mentions)}
          </div>

          {/* Threaded Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-4 pl-4 border-l-2 border-muted space-y-4">
              {comment.replies.map(reply => (
                <CommentItem 
                  key={reply.id} 
                  comment={reply} 
                  onReply={onReply} 
                  onDelete={() => onDelete()} // Simplification: delete parent refreshes list
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function renderContent(content: string, mentions: any[]) {
  if (!mentions || mentions.length === 0) return content

  let parts: (string | JSX.Element)[] = [content]
  
  mentions.forEach(mention => {
    const mentionText = `@${mention.name}`
    const newParts: (string | JSX.Element)[] = []
    
    parts.forEach(part => {
      if (typeof part !== 'string') {
        newParts.push(part)
        return
      }

      const segments = part.split(mentionText)
      segments.forEach((seg, i) => {
        newParts.push(seg)
        if (i < segments.length - 1) {
          newParts.push(
            <span key={mention.id} className="text-primary font-bold bg-primary/10 px-1 rounded">
              {mentionText}
            </span>
          )
        }
      })
    })
    parts = newParts
  })

  return parts
}

