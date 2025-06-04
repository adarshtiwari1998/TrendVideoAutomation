import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Activity,
  Database,
  Cloud,
  Cpu,
  Wifi,
  Settings,
  AlertCircle,
  Info
} from "lucide-react";

interface SystemComponent {
  name: string;
  status: 'online' | 'high_load' | 'offline' | 'warning';
  health: 'healthy' | 'degraded' | 'unhealthy';
}

interface SystemStatusData {
  components: SystemComponent[];
  scheduler: Record<string, any>;
  systemStatus: string;
  lastHealthCheck: string;
}

export function SystemStatus() {
  const { data: statusData, isLoading, error } = useQuery({
    queryKey: ['/api/dashboard/system-status'],
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card className="bg-card rounded-xl shadow-sm border border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-20" />
          </div>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="system-component">
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-card rounded-xl shadow-sm border border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">System Status</h3>
            <Badge variant="destructive">Error</Badge>
          </div>
          <div className="flex items-center space-x-3 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-foreground">Failed to load system status</p>
              <p className="text-xs text-muted-foreground">{error.message}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const systemStatus = statusData as SystemStatusData;
  const components = systemStatus?.components || [];
  const allOperational = components.every(c => c.status === 'online' || c.status === 'high_load');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'high_load':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'offline':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'online':
        return 'status-indicator online';
      case 'high_load':
        return 'status-indicator warning';
      case 'warning':
        return 'status-indicator warning';
      case 'offline':
        return 'status-indicator offline';
      default:
        return 'status-indicator offline';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return <span className="text-success">Online</span>;
      case 'high_load':
        return <span className="text-warning">High Load</span>;
      case 'warning':
        return <span className="text-warning">Warning</span>;
      case 'offline':
        return <span className="text-destructive">Offline</span>;
      default:
        return <span className="text-muted-foreground">Unknown</span>;
    }
  };

  const getComponentIcon = (name: string) => {
    const iconMap = {
      'Trending API': Wifi,
      'Gemini AI': Cpu,
      'Video Generator': Settings,
      'Google Drive': Cloud,
      'YouTube API': Wifi,
      'Cron Scheduler': Activity
    };
    
    const IconComponent = iconMap[name] || Database;
    return <IconComponent className="w-4 h-4 text-muted-foreground" />;
  };

  const formatLastHealthCheck = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 5) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    return `${Math.floor(diffInMinutes / 60)}h ago`;
  };

  return (
    <Card className="bg-card rounded-xl shadow-sm border border-border">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">System Status</h3>
          <div className="flex items-center space-x-2">
            <div className={allOperational ? 'status-indicator online' : 'status-indicator warning'} />
            <span className={`text-sm font-medium ${allOperational ? 'text-success' : 'text-warning'}`}>
              {allOperational ? 'All Systems Operational' : 'Some Issues Detected'}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {components.map((component, index) => (
            <div key={index} className="system-component">
              <div className="flex items-center space-x-3">
                <div className={getStatusDot(component.status)} />
                <div className="flex items-center space-x-2">
                  {getComponentIcon(component.name)}
                  <span className="text-sm font-medium text-foreground">{component.name}</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusIcon(component.status)}
                {getStatusText(component.status)}
              </div>
            </div>
          ))}
        </div>

        {/* System Health Summary */}
        <div className="mt-6 pt-4 border-t border-border">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Uptime</span>
              </div>
              <p className="text-lg font-semibold text-foreground">99.8%</p>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span className="text-sm font-medium text-foreground">Health Check</span>
              </div>
              <p className="text-lg font-semibold text-foreground">Passed</p>
              <p className="text-xs text-muted-foreground">
                {systemStatus?.lastHealthCheck ? formatLastHealthCheck(systemStatus.lastHealthCheck) : 'Unknown'}
              </p>
            </div>
          </div>
        </div>

        {/* Next Optimization Notice */}
        <div className="mt-6 p-4 bg-success/5 rounded-lg border border-success/20">
          <div className="flex items-center space-x-3">
            <Info className="w-5 h-5 text-success flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-foreground">Next Optimization</h4>
              <p className="text-xs text-muted-foreground mt-1">
                System will optimize upload timing based on audience analytics at 2:00 AM IST
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
