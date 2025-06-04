import { Sidebar } from "@/components/ui/sidebar";
import { StatsOverview } from "@/components/dashboard/stats-overview";
import { AutomationPipeline } from "@/components/dashboard/automation-pipeline";
import { TrendingTopics } from "@/components/dashboard/trending-topics";
import { UploadSchedule } from "@/components/dashboard/upload-schedule";
import { SystemStatus } from "@/components/dashboard/system-status";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Play, Pause, RotateCcw } from "lucide-react";
import { useState, useEffect } from "react";

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [systemStatus, setSystemStatus] = useState("active");
  const [isAutomationRunning, setIsAutomationRunning] = useState(true);

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // System status query
  const { data: systemStatusData } = useQuery({
    queryKey: ['/api/dashboard/system-status'],
    refetchInterval: 60000, // Refresh every minute
  });

  useEffect(() => {
    if (systemStatusData) {
      setSystemStatus(systemStatusData.systemStatus || "active");
    }
  }, [systemStatusData]);

  // Automation control mutations
  const startAutomationMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/automation/start'),
    onSuccess: () => {
      setIsAutomationRunning(true);
      toast({
        title: "Automation Started",
        description: "The YouTube automation system is now active.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to start automation: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const pauseAutomationMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/automation/pause'),
    onSuccess: () => {
      setIsAutomationRunning(false);
      toast({
        title: "Automation Paused",
        description: "The YouTube automation system has been paused.",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to pause automation: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const refreshTrendsMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/trending/refresh'),
    onSuccess: () => {
      toast({
        title: "Trending Analysis Started",
        description: "Refreshing trending topics from all sources.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/trending-topics'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to refresh trends: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const triggerDailyAutomationMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/automation/trigger-daily'),
    onSuccess: () => {
      toast({
        title: "Daily Automation Triggered",
        description: "Started creating today's video content.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to trigger automation: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleToggleAutomation = () => {
    if (isAutomationRunning) {
      pauseAutomationMutation.mutate();
    } else {
      startAutomationMutation.mutate();
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="bg-card shadow-sm border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Automation Dashboard</h2>
              <p className="text-muted-foreground mt-1">Manage your YouTube content automation pipeline</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${systemStatus === 'active' ? 'bg-success animate-pulse-subtle' : 'bg-warning'}`} />
                <span className="text-sm font-medium text-foreground">
                  {systemStatus === 'active' ? 'System Active' : 'System Paused'}
                </span>
              </div>
              <Button
                onClick={handleToggleAutomation}
                disabled={startAutomationMutation.isPending || pauseAutomationMutation.isPending}
                className={isAutomationRunning ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'}
              >
                {isAutomationRunning ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause Automation
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Automation
                  </>
                )}
              </Button>
            </div>
          </div>
        </header>

        <div className="p-6">
          {/* Stats Overview */}
          <StatsOverview stats={stats} isLoading={statsLoading} />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
            {/* Automation Pipeline */}
            <div className="xl:col-span-2">
              <AutomationPipeline />
            </div>

            {/* Trending Topics */}
            <div>
              <TrendingTopics onRefresh={() => refreshTrendsMutation.mutate()} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Upload Schedule */}
            <UploadSchedule />

            {/* System Status */}
            <SystemStatus />
          </div>

          {/* Recent Activity */}
          <RecentActivity />

          {/* Quick Actions */}
          <div className="mt-6 bg-card rounded-xl shadow-sm p-6 border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
            
            <div className="flex flex-wrap gap-3">
              <Button 
                variant="outline" 
                onClick={() => refreshTrendsMutation.mutate()}
                disabled={refreshTrendsMutation.isPending}
              >
                <RotateCcw className={`w-4 h-4 mr-2 ${refreshTrendsMutation.isPending ? 'animate-spin' : ''}`} />
                Refresh Trends
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => triggerDailyAutomationMutation.mutate()}
                disabled={triggerDailyAutomationMutation.isPending}
              >
                <Play className="w-4 h-4 mr-2" />
                Trigger Daily Automation
              </Button>
              
              <Button variant="outline" asChild>
                <a href="https://drive.google.com" target="_blank" rel="noopener noreferrer">
                  Open Google Drive
                </a>
              </Button>
              
              <Button variant="outline" asChild>
                <a href="https://studio.youtube.com" target="_blank" rel="noopener noreferrer">
                  Open YouTube Studio
                </a>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
