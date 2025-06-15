import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { 
  CheckCircle, 
  RotateCcw, 
  Video, 
  Image, 
  Upload,
  Clock,
  AlertCircle
} from "lucide-react";

interface PipelineJob {
  id: number;
  title: string;
  videoType: 'long_form' | 'short';
  status: string;
  progress: number;
  createdAt: string;
}

interface PipelineData {
  active: PipelineJob[];
  scheduled: PipelineJob[];
  isRunning: boolean;
}

export function AutomationPipeline() {
  const { data: pipelineData, isLoading, error } = useQuery({
    queryKey: ['/api/dashboard/active-pipeline'],
    refetchInterval: 1000, // Refresh every 1 second for real-time updates
    staleTime: 0, // Always refetch for latest data
    cacheTime: 0 // Don't cache to ensure fresh data
  });

  if (isLoading) {
    return (
      <Card className="bg-card rounded-xl shadow-sm border border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-4 bg-muted/30 rounded-lg">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-2 w-32" />
                </div>
                <Skeleton className="h-6 w-16" />
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
            <h3 className="text-lg font-semibold text-foreground">Active Content Pipeline</h3>
            <Badge variant="destructive">Error</Badge>
          </div>
          <div className="flex items-center space-x-3 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-foreground">Failed to load pipeline data</p>
              <p className="text-xs text-muted-foreground">{error.message}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const pipeline = pipelineData as PipelineData;
  const activeJobs = pipeline?.active || [];
  const hasActiveJobs = activeJobs.length > 0;

  const getStepIcon = (status: string, progress: number) => {
    if (status === 'completed' || progress === 100) {
      return <CheckCircle className="w-5 h-5 text-success" />;
    }
    if (status === 'failed') {
      return <AlertCircle className="w-5 h-5 text-destructive" />;
    }
    if (status.includes('processing') || status.includes('generation') || status.includes('creation')) {
      return <RotateCcw className="w-5 h-5 text-primary animate-spin" />;
    }
    return <Clock className="w-5 h-5 text-muted-foreground" />;
  };

  const getStepClasses = (status: string, progress: number) => {
    if (status === 'completed' || progress === 100) {
      return "pipeline-step completed";
    }
    if (status === 'failed') {
      return "pipeline-step bg-destructive/10 border border-destructive/20";
    }
    if (status.includes('processing') || status.includes('generation') || status.includes('creation')) {
      return "pipeline-step active";
    }
    return "pipeline-step pending";
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'pending': { variant: 'secondary' as const, label: 'Pending' },
      'script_generation': { variant: 'default' as const, label: 'Generating Script' },
      'video_creation': { variant: 'default' as const, label: 'Creating Video' },
      'thumbnail_generation': { variant: 'default' as const, label: 'Generating Thumbnail' },
      'uploading': { variant: 'default' as const, label: 'Uploading' },
      'completed': { variant: 'default' as const, label: 'Completed' },
      'failed': { variant: 'destructive' as const, label: 'Failed' }
    };

    const statusInfo = statusMap[status] || { variant: 'secondary' as const, label: status };
    return (
      <Badge variant={statusInfo.variant} className={statusInfo.variant === 'default' ? 'bg-primary' : ''}>
        {statusInfo.label}
      </Badge>
    );
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

  return (
    <Card className="bg-card rounded-xl shadow-sm border border-border">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Active Content Pipeline</h3>
          <div className="flex items-center space-x-2">
            {pipeline?.isRunning && (
              <>
                <div className="w-3 h-3 bg-success rounded-full animate-pulse-subtle" />
                <span className="text-sm text-muted-foreground">Live</span>
              </>
            )}
          </div>
        </div>

        {!hasActiveJobs ? (
          <div className="text-center py-12">
            <Video className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="text-lg font-medium text-foreground mb-2">No Active Jobs</h4>
            <p className="text-muted-foreground mb-4">The automation pipeline is ready for new content creation.</p>
            <Button variant="outline" size="sm">
              <RotateCcw className="w-4 h-4 mr-2" />
              Trigger Automation
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {activeJobs.map((job) => (
              <div key={job.id} className={getStepClasses(job.status, job.progress)}>
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  {getStepIcon(job.status, job.progress)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-foreground">
                      {job.title || `${job.videoType === 'long_form' ? 'Long-form' : 'Short'} Video`}
                    </h4>
                    {getStatusBadge(job.status)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {job.videoType === 'long_form' ? 'Long-form video' : 'YouTube Short'} • 
                    Started {formatTimeAgo(job.createdAt)}
                  </p>
                  {job.progress > 0 && job.progress < 100 && (
                    <div className="flex items-center space-x-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>Progress</span>
                          <span>{job.progress}%</span>
                        </div>
                        <Progress value={job.progress} className="h-2" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pipeline Steps Overview */}
        <div className="mt-8 pt-6 border-t border-border">
          <h4 className="text-sm font-medium text-foreground mb-4">Pipeline Stages</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Trending Analysis', icon: CheckCircle, status: 'completed' },
              { label: 'Script Generation', icon: RotateCcw, status: hasActiveJobs ? 'active' : 'pending' },
              { label: 'Video Creation', icon: Video, status: 'pending' },
              { label: 'Thumbnail Generation', icon: Image, status: 'pending' },
              { label: 'YouTube Upload', icon: Upload, status: 'pending' }
            ].map((step, index) => (
              <div key={index} className="text-center">
                <div className={`w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center ${
                  step.status === 'completed' ? 'bg-success/10' :
                  step.status === 'active' ? 'bg-primary/10' :
                  'bg-muted'
                }`}>
                  <step.icon className={`w-5 h-5 ${
                    step.status === 'completed' ? 'text-success' :
                    step.status === 'active' ? 'text-primary' :
                    'text-muted-foreground'
                  } ${step.status === 'active' ? 'animate-spin' : ''}`} />
                </div>
                <p className="text-xs text-muted-foreground">{step.label}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
