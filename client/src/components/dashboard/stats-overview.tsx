import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Video, 
  CheckCircle, 
  TrendingUp, 
  Clock,
  Smartphone,
  Upload,
  HardDrive
} from "lucide-react";

interface StatsOverviewProps {
  stats?: {
    todayVideos: number;
    todayShorts: number;
    successRate: number;
    queueCount: number;
    trendingTopics: number;
    storageUsed: string;
    systemStatus: string;
    weeklyTrend: number;
  };
  isLoading?: boolean;
}

export function StatsOverview({ stats, isLoading }: StatsOverviewProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="stats-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <Skeleton className="h-12 w-12 rounded-full" />
              </div>
              <div className="mt-4">
                <Skeleton className="h-4 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statsConfig = [
    {
      title: "Today's Videos",
      value: stats?.todayVideos || 0,
      change: stats?.todayVideos ? `+${stats.todayVideos} from yesterday` : "No videos today",
      changeType: "positive" as const,
      icon: Video,
      iconBg: "bg-primary/10",
      iconColor: "text-primary"
    },
    {
      title: "Success Rate",
      value: `${stats?.successRate || 94}%`,
      change: `+2% this week`,
      changeType: "positive" as const,
      icon: CheckCircle,
      iconBg: "bg-success/10",
      iconColor: "text-success"
    },
    {
      title: "Trending Topics",
      value: stats?.trendingTopics || 12,
      change: "Updated 5 min ago",
      changeType: "neutral" as const,
      icon: TrendingUp,
      iconBg: "bg-warning/10",
      iconColor: "text-warning"
    },
    {
      title: "Queue Status",
      value: stats?.queueCount || 3,
      change: "Processing...",
      changeType: "neutral" as const,
      icon: Clock,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600"
    }
  ];

  const additionalStats = [
    {
      title: "Shorts Created",
      value: stats?.todayShorts || 1,
      icon: Smartphone,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600"
    },
    {
      title: "Storage Used", 
      value: stats?.storageUsed || "15.2 GB",
      icon: HardDrive,
      iconBg: "bg-gray-100",
      iconColor: "text-gray-600"
    }
  ];

  return (
    <div className="space-y-6 mb-8">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsConfig.map((stat, index) => (
          <Card key={index} className="stats-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 ${stat.iconBg} rounded-full flex items-center justify-center`}>
                  <stat.icon className={`${stat.iconColor} w-6 h-6`} />
                </div>
              </div>
              <div className="mt-4 flex items-center space-x-2">
                <span className={`text-sm font-medium ${
                  stat.changeType === 'positive' ? 'text-success' :
                  stat.changeType === 'negative' ? 'text-destructive' :
                  'text-muted-foreground'
                }`}>
                  {stat.change}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        {additionalStats.map((stat, index) => (
          <Card key={index} className="stats-card">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 ${stat.iconBg} rounded-lg flex items-center justify-center`}>
                  <stat.icon className={`${stat.iconColor} w-5 h-5`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.title}</p>
                  <p className="text-lg font-semibold text-foreground">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* System Status */}
        <Card className="stats-card lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">System Status</p>
                <div className="flex items-center space-x-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${
                    stats?.systemStatus === 'active' ? 'bg-success animate-pulse-subtle' : 'bg-warning'
                  }`} />
                  <span className="text-sm font-medium text-foreground">
                    {stats?.systemStatus === 'active' ? 'All Systems Operational' : 'System Paused'}
                  </span>
                </div>
              </div>
              <Badge variant={stats?.systemStatus === 'active' ? 'default' : 'secondary'}>
                {stats?.systemStatus === 'active' ? 'Live' : 'Paused'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Trend */}
        <Card className="stats-card lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">This Week</p>
                <p className="text-lg font-semibold text-foreground">{stats?.weeklyTrend || 14} Videos</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-success font-medium">+15%</p>
                <p className="text-xs text-muted-foreground">vs last week</p>
              </div>
            </div>
          </CardContent>
        ))}
      </div>
    </div>
  );
}
