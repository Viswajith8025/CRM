import { useState, useEffect } from "react"
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
import { Target, TrendingUp, TrendingDown, Megaphone, Plus } from "lucide-react"

export function CampaignManager() {
  const { campaigns, fetchCampaigns, isLoading } = useMarketingStore()

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'google_ads': return <Target className="h-4 w-4 text-blue-500" />
      case 'meta_ads': return <Target className="h-4 w-4 text-indigo-500" />
      case 'linkedin': return <Target className="h-4 w-4 text-sky-600" />
      default: return <Megaphone className="h-4 w-4 text-orange-500" />
    }
  }

  const calculateCPL = (spend: number, leads: number) => {
    if (leads === 0) return 0
    return spend / leads
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">Ad Campaigns</h3>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> New Campaign
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead className="text-right">Spend</TableHead>
              <TableHead className="text-center">Leads</TableHead>
              <TableHead className="text-right">CPL</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">Loading campaigns...</TableCell>
              </TableRow>
            ) : campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">No campaigns active.</TableCell>
              </TableRow>
            ) : (
              campaigns.map(camp => (
                <TableRow key={camp.id}>
                  <TableCell className="font-bold">{camp.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getPlatformIcon(camp.platform)}
                      <span className="text-xs uppercase tracking-wider">{camp.platform.replace('_', ' ')}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">${camp.budget.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-rose-500">${camp.spend.toLocaleString()}</TableCell>
                  <TableCell className="text-center font-bold text-emerald-500">{camp.leads_count || 0}</TableCell>
                  <TableCell className="text-right font-bold">
                    ${calculateCPL(camp.spend, camp.leads_count || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={camp.status === 'active' ? 'default' : 'secondary'} className="uppercase text-[10px]">
                      {camp.status}
                    </Badge>
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
