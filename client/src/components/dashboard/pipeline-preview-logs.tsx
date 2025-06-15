import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertCircle, CheckCircle, Clock, XCircle, Info, FileText, ExternalLink, Eye } from 'lucide-react';

interface PipelineLog {
  id: number;
  job_id: number;
  step: string;
  status: 'starting' | 'completed' | 'error' | 'warning';
  message: string;
  details: string;
  progress: number;
  metadata?: {
    finalScript?: string;
    originalContent?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    videoLink?: string;
    thumbnailLink?: string;
    [key: string]: any;
  };
  created_at: string;
}

function ScriptPreviewDialog({ 
  finalScript, 
  originalContent, 
  title 
}: { 
  finalScript?: string; 
  originalContent?: string; 
  title?: string; 
}) {
  if (!finalScript && !originalContent) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="ml-2">
          <FileText className="h-3 w-3 mr-1" />
          View Script
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Script Comparison - {title}</DialogTitle>
          <DialogDescription>
            Compare the original content with the final cleaned script used for video generation
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 h-[60vh]">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Original Content</h4>
            <ScrollArea className="h-full border rounded-md p-3 bg-muted/30">
              <div className="text-sm whitespace-pre-wrap">
                {originalContent || 'No original content available'}
              </div>
            </ScrollArea>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Final Clean Script</h4>
            <ScrollArea className="h-full border rounded-md p-3 bg-green-50/50">
              <div className="text-sm whitespace-pre-wrap">
                {finalScript || 'No script available'}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DriveLinksDisplay({ metadata }: { metadata?: any }) {
  if (!metadata?.videoUrl && !metadata?.thumbnailUrl && !metadata?.videoLink && !metadata?.thumbnailLink) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {(metadata.videoUrl || metadata.videoLink) && (
        <Button 
          variant="outline" 
          size="sm" 
          asChild
          className="text-xs"
        >
          <a 
            href={metadata.videoUrl || metadata.videoLink} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1"
          >
            <Eye className="h-3 w-3" />
            View Video
            <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
      )}
      {(metadata.thumbnailUrl || metadata.thumbnailLink) && (
        <Button 
          variant="outline" 
          size="sm" 
          asChild
          className="text-xs"
        >
          <a 
            href={metadata.thumbnailUrl || metadata.thumbnailLink} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1"
          >
            <Eye className="h-3 w-3" />
            View Thumbnail
            <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
      )}
    </div>
  );
}

interface ActiveJob {
  id: number;
  title: string;
  videoType: 'long_form' | 'short';
  status: string;
  progress: number;
  createdAt: string;
}

async function fetchPipelineLogs(): Promise<{ logs: PipelineLog[]; activeJobs: ActiveJob[] }> {
  try {
    // First get active jobs
    const activeResponse = await fetch('/api/dashboard/active-pipeline');
    if (!activeResponse.ok) {
      throw new Error('Failed to fetch active pipeline status');
    }
    const activeData = await activeResponse.json();
    const activeJobs = activeData.active || [];

    // If no active jobs, return empty logs
    if (activeJobs.length === 0) {
      return { logs: [], activeJobs: [] };
    }

    // Get logs for active jobs
    const logsResponse = await fetch('/api/pipeline/logs');
    if (!logsResponse.ok) {
      throw new Error('Failed to fetch pipeline logs');
    }

    const logs = await logsResponse.json();
    return { 
      logs: Array.isArray(logs) ? logs : [], 
      activeJobs 
    };
  } catch (error) {
    console.error('Error fetching pipeline data:', error);
    return { logs: [], activeJobs: [] };
  }
}

export function PipelinePreviewLogs() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pipeline-logs'],
    queryFn: fetchPipelineLogs,
    refetchInterval: 2000,
    staleTime: 1000,
    retry: 3,
    retryDelay: 1000,
  });

  const logs = data?.logs || [];
  const activeJobs = data?.activeJobs || [];
  const hasActiveJobs = activeJobs.length > 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'starting':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      starting: 'bg-blue-100 text-blue-800 border-blue-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      error: 'bg-red-100 text-red-800 border-red-200',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    };

    return (
      <Badge className={variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800 border-gray-200'}>
        {status}
      </Badge>
    );
  };

  const formatTime = (timeStr: string) => {
    try {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) return 'Invalid time';
      return date.toLocaleTimeString();
    } catch {
      return 'Invalid time';
    }
  };

  const formatStep = (step: string) => {
    return step
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Logs</CardTitle>
          <CardDescription>Loading pipeline activity...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Logs</CardTitle>
          <CardDescription>Error loading pipeline logs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <AlertCircle className="h-6 w-6 mr-2" />
            Failed to load pipeline logs
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline Logs</CardTitle>
        <CardDescription>
          {hasActiveJobs 
            ? `Real-time logs for ${activeJobs.length} active job${activeJobs.length > 1 ? 's' : ''}`
            : 'No active pipelines running'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasActiveJobs ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Clock className="h-8 w-8 mb-2" />
            <p>No active pipelines</p>
            <p className="text-sm">Start a pipeline to see real-time logs</p>
          </div>
        ) : (
          <ScrollArea className="h-64 w-full">
            <div className="space-y-2">
              {logs.length === 0 ? (
                <div className="flex items-center justify-center h-16 text-muted-foreground">
                  <p className="text-sm">Waiting for pipeline logs...</p>
                </div>
              ) : (
                logs
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 20)
                  .map((log, index) => (
                    <div
                      key={`${log.id}-${index}`}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="mt-0.5">
                        {getStatusIcon(log.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            {formatStep(log.step)}
                          </span>
                          {getStatusBadge(log.status)}
                          <span className="text-xs text-muted-foreground">
                            Job #{log.job_id}
                          </span>
                        </div>
                        <p className="text-sm text-foreground mb-1">
                          {log.message}
                        </p>
                        {log.details && (
                          <p className="text-xs text-muted-foreground">
                            {log.details}
                          </p>
                        )}
                        
                        {/* Script Preview for completed script generation */}
                        {log.step === 'script_generation' && log.status === 'completed' && (
                          <div className="mt-2">
                            <ScriptPreviewDialog 
                              finalScript={log.metadata?.finalScript}
                              originalContent={log.metadata?.originalContent}
                              title={`Job #${log.job_id}`}
                            />
                            {log.metadata?.wordCount && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Word count: {log.metadata.wordCount} | 
                                Estimated duration: {Math.round((log.metadata.estimatedDuration || 0) / 60)} minutes
                              </div>
                            )}
                          </div>
                        )}

                        {/* Drive Links for file organization */}
                        {log.step === 'file_organization' && log.status === 'completed' && (
                          <DriveLinksDisplay metadata={log.metadata} />
                        )}

                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground">
                            {formatTime(log.created_at)}
                          </span>
                          {log.progress > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary transition-all duration-300"
                                  style={{ width: `${log.progress}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {log.progress}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}