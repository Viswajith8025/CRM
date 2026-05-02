import { PageWrapper } from "@/components/shared/PageWrapper"
import { TeamList } from "../../crm/components/TeamList"

export default function TeamPage() {
  return (
    <PageWrapper 
      title="Team Members" 
      description="View and manage all registered users within the CRM platform."
    >
      <div className="mt-6">
        <TeamList />
      </div>
    </PageWrapper>
  )
}
