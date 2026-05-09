import { useEffect, useState } from 'react';
import { PageWrapper } from '@/components/shared/PageWrapper';
import { useSuperAdminStore } from '../superAdminStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, ShieldAlert, Building2, Users, Activity, Zap } from 'lucide-react';
import { toast } from 'sonner';

export default function SuperAdminDashboard() {
  const { organizations, fetchOrganizations, toggleOrganizationStatus, isLoading } = useSuperAdminStore();
  const [isToggling, setIsToggling] = useState<string | null>(null);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const handleToggle = async (orgId: string, currentStatus: string) => {
    setIsToggling(orgId);
    try {
      await toggleOrganizationStatus(orgId, currentStatus);
      toast.success(`Organization ${currentStatus === 'active' ? 'suspended' : 'activated'} successfully.`);
    } catch (error) {
      toast.error("Failed to update organization status.");
    } finally {
      setIsToggling(null);
    }
  };

  const activeOrgs = organizations.filter(o => o.status === 'active').length;
  const suspendedOrgs = organizations.filter(o => o.status === 'suspended').length;
  const totalUsers = organizations.reduce((acc, org) => acc + (org.user_count || 0), 0);

  return (
    <PageWrapper 
      title="Super Admin Dashboard" 
      description="Platform-wide governance and SaaS management."
    >
      <div className="mb-6 flex justify-end">
        <Button 
          variant="outline" 
          className="gap-2 font-black uppercase tracking-widest border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary"
          disabled={isLoading}
          onClick={async () => {
            const name = prompt("Enter Demo Organization Name:");
            if (name) {
              try {
                await generateDemoOrganization(name);
                toast.success(`Demo Organization "${name}" generated with full seed data!`);
              } catch (err) {
                toast.error("Failed to generate demo organization.");
              }
            }
          }}
        >
          <Zap className="h-4 w-4 fill-primary/20" />
          Generate Demo Org
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-3 mb-8">
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Active Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">{activeOrgs}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Users</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">{totalUsers}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Suspended</CardTitle>
            <ShieldAlert className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-rose-500">{suspendedOrgs}</div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-muted/20 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">Organization Management</h3>
            <p className="text-sm text-muted-foreground">View and manage all tenant organizations on the platform.</p>
          </div>
          <Activity className="h-5 w-5 text-muted-foreground" />
        </div>
        
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead>Admin Email</TableHead>
                <TableHead className="text-center">Users</TableHead>
                <TableHead className="text-center">Billing</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Access Control</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map(org => (
                <TableRow key={org.id} className={org.status === 'suspended' ? 'bg-rose-500/5' : ''}>
                  <TableCell className="font-bold">{org.company_name || 'Unnamed Org'}</TableCell>
                  <TableCell className="text-muted-foreground">{org.corporate_email || 'N/A'}</TableCell>
                  <TableCell className="text-center font-mono">{org.user_count}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="uppercase text-[10px]">
                      {org.subscription_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={org.status === 'active' ? 'default' : 'destructive'} className="uppercase text-[10px]">
                      {org.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <span className="text-xs text-muted-foreground">
                        {org.status === 'active' ? 'Active' : 'Suspended'}
                      </span>
                      <Switch 
                        checked={org.status === 'active'}
                        disabled={isToggling === org.id}
                        onCheckedChange={() => handleToggle(org.id, org.status)}
                        className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-rose-500"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {organizations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No organizations found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </PageWrapper>
  );
}
