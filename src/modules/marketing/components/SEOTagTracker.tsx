import { useEffect } from "react"
import { useMarketingStore } from "../marketingStore"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, TrendingUp, TrendingDown, Minus, Plus } from "lucide-react"

export function SEOTagTracker() {
  const { keywords, fetchKeywords, isLoading } = useMarketingStore()

  useEffect(() => {
    fetchKeywords()
  }, [])

  const getRankChange = (current: number | null, prev: number | null) => {
    if (!current || !prev) return <Minus className="h-4 w-4 text-muted-foreground" />
    if (current < prev) return <TrendingUp className="h-4 w-4 text-emerald-500" /> // Lower rank is better (e.g. 1 is best)
    if (current > prev) return <TrendingDown className="h-4 w-4 text-rose-500" />
    return <Minus className="h-4 w-4 text-muted-foreground" />
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">SEO Keyword Rankings</h3>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Add Keyword
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Keyword</TableHead>
              <TableHead>Target URL</TableHead>
              <TableHead className="text-right">Search Volume</TableHead>
              <TableHead className="text-center">Difficulty</TableHead>
              <TableHead className="text-center">Current Rank</TableHead>
              <TableHead className="text-center">Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">Loading keywords...</TableCell>
              </TableRow>
            ) : keywords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No SEO keywords tracked.</TableCell>
              </TableRow>
            ) : (
              keywords.map(kw => (
                <TableRow key={kw.id}>
                  <TableCell className="font-bold">{kw.keyword}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{kw.target_url}</TableCell>
                  <TableCell className="text-right font-mono">{kw.search_volume.toLocaleString()}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-[10px]">
                      {kw.difficulty}/100
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-bold text-lg">
                    {kw.current_rank || 'N/A'}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      {getRankChange(kw.current_rank, kw.previous_rank)}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
