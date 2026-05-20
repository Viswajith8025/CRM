import { PageWrapper } from "@/components/shared/PageWrapper"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CampaignManager } from "../components/CampaignManager"
import { SEOTagTracker } from "../components/SEOTagTracker"
import { SocialCalendar } from "../components/SocialCalendar"
import { Target, Search, CalendarHeart } from "lucide-react"

interface MarketingDashboardProps {
  isEmbedded?: boolean
}

export default function MarketingDashboard({ isEmbedded = false }: MarketingDashboardProps) {
  const content = (
    <Tabs defaultValue="campaigns" className={isEmbedded ? "mt-2" : "mt-6"}>
      <TabsList className="grid grid-cols-3 max-w-md mb-6">
        <TabsTrigger value="campaigns" className="gap-2 text-xs">
          <Target className="h-3.5 w-3.5" /> Ad Campaigns
        </TabsTrigger>
        <TabsTrigger value="seo" className="gap-2 text-xs">
          <Search className="h-3.5 w-3.5" /> SEO Tracker
        </TabsTrigger>
        <TabsTrigger value="social" className="gap-2 text-xs">
          <CalendarHeart className="h-3.5 w-3.5" /> Social Media
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="campaigns" className="m-0">
        <CampaignManager />
      </TabsContent>
      
      <TabsContent value="seo" className="m-0">
        <SEOTagTracker />
      </TabsContent>
      
      <TabsContent value="social" className="m-0">
        <SocialCalendar />
      </TabsContent>
    </Tabs>
  )

  if (isEmbedded) {
    return content
  }

  return (
    <PageWrapper 
      title="Digital Marketing" 
      description="Track ad campaigns, monitor SEO keywords, and plan social media."
    >
      {content}
    </PageWrapper>
  )
}

