import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { 
  CheckCircle, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  Upload,
  Video,
  TrendingUp,
  Settings,
  Activity,
  ExternalLink
} from "lucide-react";

interface ActivityLog {
  id: number;
  type: 'upload' | 'generation' | 'trending' | 'error' | 'system';
  title: string;
  description: string;
  status: 'success' | 'error' | 'warning' | 'info';
  metadata: any;
  createdAt: string;
}

export function RecentActivity() {
  const { data: activities, isLoading, error } = useQuery({
    queryKey: ['/api/dashboard/recent-activity'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card className="bg-card rounded-xl shadow-sm border border-border">
        <CardContent className="p-6">
          <Skeleton className="h-6 w-32 mb-6" />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="activity-log-item">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <div className="flex items-center space-x-4">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                </div>
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
          <h3 className="text-lg font-semibold text-foreground mb-6">Recent Activity</h3>
          <div className="flex items-center space-x-3 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-foreground">Failed to load activity</p>
              <p className="text-xs text-muted-foreground">{error.message}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activityLogs = (activities as ActivityLog[]) || [];

  const getActivityIcon = (type: string, status: string) => {
    const iconClasses = "w-5 h-5";
    
    if (status === 'error') {
      return <AlertCircle className={`${iconClasses} text-destructive`} />;
    }
    
    switch (type) {
      case 'upload':
        return <Upload className={`${iconClasses} text-success`} />;
      case 'generation':
        return <Video className={`${iconClasses} text-primary`} />;
      case 'trending':
        return <TrendingUp className={`${iconClasses} text-warning`} />;
      case 'system':
        return status === 'warning' 
          ? <AlertTriangle className={`${iconClasses} text-warning`} />
          : <Settings className={`${iconClasses} text-secondary`} />;
      default:
        return <Info className={`${iconClasses} text-muted-foreground`} />;
    }
  };

  const getActivityBadge = (type: string, status: string) => {
    const badgeMap = {
      'upload': { variant: 'default' as const, label: 'Upload', className: 'bg-success text-success-foreground' },
      'generation': { variant: 'default' as const, label: 'Generation', className: 'bg-primary text-primary-foreground' },
      'trending': { variant: 'default' as const, label: 'Trending', className: 'bg-warning text-warning-foreground' },
      'error': { variant: 'destructive' as const, label: 'Error', className: '' },
      'system': { variant: 'secondary' as const, label: 'System', className: '' }
    };

    if (status === 'error') {
      return <Badge variant="destructive">Error</Badge>;
    }

    const badgeInfo = badgeMap[type] || badgeMap.system;
    return (
      <Badge 
        variant={badgeInfo.variant} 
        className={badgeInfo.className || ''}
      >
        {badgeInfo.label}
      </Badge>
    );
  };

  const getActivityBackground = (type: string, status: string) => {
    if (status === 'error') {
      return 'bg-destructive/5 border-l-4 border-l-destructive';
    }
    
    switch (type) {
      case 'upload':
        return 'bg-success/5 border-l-4 border-l-success';
      case 'generation':
        return 'bg-primary/5 border-l-4 border-l-primary';
      case 'trending':
        return 'bg-warning/5 border-l-4 border-l-warning';
      case 'system':
        return status === 'warning' 
          ? 'bg-warning/5 border-l-4 border-l-warning'
          : 'bg-secondary/5 border-l-4 border-l-secondary';
      default:
        return 'bg-muted/30';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getMetadataDisplay = (activity: ActivityLog) => {
    const metadata = activity.metadata || {};
    
    switch (activity.type) {
      case 'upload':
        return metadata.youtubeId ? (
          <Button 
            variant="outline" 
            size="sm" 
            className="h-6 px-2 text-xs"
            asChild
          >
            <a 
              href={`https://youtube.com/watch?v=${metadata.youtubeId}`} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              View
            </a>
          </Button>
        ) : null;
      case 'generation':
        return metadata.videoType ? (
          <span className="text-xs text-muted-foreground">
            Type: {metadata.videoType === 'long_form' ? 'Long Video' : 'Short'}
          </span>
        ) : null;
      case 'trending':
        return metadata.count ? (
          <span className="text-xs text-muted-foreground">
            {metadata.count} topics found
          </span>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <Card className="bg-card rounded-xl shadow-sm border border-border">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
          <Button variant="outline" size="sm">
            <Activity className="w-4 h-4 mr-2" />
            View All
          </Button>
        </div>

        {activityLogs.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="text-lg font-medium text-foreground mb-2">No Recent Activity</h4>
            <p className="text-muted-foreground">System activity will appear here as it happens.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activityLogs.slice(0, 10).map((activity) => (
              <div 
                key={activity.id} 
                className={`activity-log-item ${getActivityBackground(activity.type, activity.status)}`}
              >
                <div className="w-10 h-10 bg-card rounded-full flex items-center justify-center flex-shrink-0 border border-border">
                  {getActivityIcon(activity.type, activity.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-1">
                        {activity.title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {activity.description}
                      </p>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      {getActivityBadge(activity.type, activity.status)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(activity.createdAt)}
                    </span>
                    {getMetadataDisplay(activity)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activityLogs.length > 10 && (
          <Button 
            variant="outline" 
            className="w-full mt-6"
          >
            View Full Activity Log
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
