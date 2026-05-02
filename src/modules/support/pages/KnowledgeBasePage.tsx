import { useEffect, useState } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { useSupportStore } from "../supportStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, BookOpen, ChevronRight } from "lucide-react"

export default function KnowledgeBasePage() {
  const { articles, fetchArticles, isLoading } = useSupportStore()
  const [search, setSearch] = useState("")

  useEffect(() => {
    fetchArticles()
  }, [])

  const filteredArticles = articles.filter(a => 
    a.title.toLowerCase().includes(search.toLowerCase()) || 
    a.category.toLowerCase().includes(search.toLowerCase())
  )

  const categories = Array.from(new Set(articles.map(a => a.category)))

  return (
    <PageWrapper 
      title="Knowledge Base" 
      description="Internal playbooks, client FAQs, and technical documentation."
      actions={
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> New Article
        </Button>
      }
    >
      <div className="mt-6 flex gap-6">
        {/* Main Content */}
        <div className="flex-1 space-y-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search articles by title or keyword..." 
              className="pl-9 h-12 text-lg"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="grid gap-4">
            {isLoading ? (
              <div className="text-center p-10 text-muted-foreground">Loading articles...</div>
            ) : filteredArticles.length === 0 ? (
              <div className="text-center p-10 text-muted-foreground border rounded-xl border-dashed">
                No articles found matching your search.
              </div>
            ) : (
              filteredArticles.map(article => (
                <div 
                  key={article.id} 
                  className="p-5 rounded-xl border bg-card hover:border-primary/50 transition-colors cursor-pointer group"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg group-hover:text-primary transition-colors">{article.title}</h4>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="secondary" className="uppercase text-[10px]">{article.category}</Badge>
                          {!article.is_published && (
                            <Badge variant="outline" className="uppercase text-[10px] text-amber-500 border-amber-500/20">Draft</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="hidden lg:block w-72 space-y-6">
          <div className="rounded-xl border bg-card p-5">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-4">Categories</h3>
            <div className="space-y-2">
              <Button variant="ghost" className="w-full justify-start text-sm h-8" onClick={() => setSearch("")}>
                All Articles
              </Button>
              {categories.map(cat => (
                <Button 
                  key={cat} 
                  variant="ghost" 
                  className="w-full justify-start text-sm h-8 capitalize"
                  onClick={() => setSearch(cat)}
                >
                  {cat.replace('_', ' ')}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
