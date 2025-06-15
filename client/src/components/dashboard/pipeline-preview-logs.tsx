import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { 
  Video, 
  Image, 
  FileText, 
  Upload, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Play,
  Edit,
  Sparkles,
  Cloud
} from "lucide-react";
import { useState } from "react";

interface PipelineLog {
  id: number;
  jobId: number;
  step: string;
  status: 'starting' | 'progress' | 'completed' | 'error';
  message: string;
  details?: string;
  timestamp: string;
  progress?: number;
  metadata?: any;
}

interface PipelinePreviewLogsProps {
  selectedJobId?: number;
}

export function PipelinePreviewLogs({ selectedJobId }: PipelinePreviewLogsProps) {
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  const { data: logs, isLoading, error } = useQuery({
    queryKey: selectedJobId && selectedJobId > 0 
      ? ['/api/pipeline/logs', selectedJobId] 
      : ['/api/pipeline/logs/recent'],
    queryFn: async () => {
      if (selectedJobId && selectedJobId > 0) {
        const response = await fetch(`/api/pipeline/logs/${selectedJobId}`);
        if (!response.ok) throw new Error('Failed to fetch job logs');
        const data = await response.json();
        
        // Remove duplicates and sort by timestamp
        const uniqueLogs = data.reduce((acc: any[], log: any) => {
          const existing = acc.find(l => l.step === log.step && l.status === log.status && l.job_id === log.job_id);
          if (!existing) {
            acc.push(log);
          }
          return acc;
        }, []);
        
        return uniqueLogs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      } else {
        // Show recent logs when no active jobs
        const response = await fetch('/api/pipeline/logs?limit=15');
        if (!response.ok) throw new Error('Failed to fetch recent logs');
        const data = await response.json();
        
        // Filter for only the latest status of each step per job
        const latestLogs = data.reduce((acc: any[], log: any) => {
          const key = `${log.job_id}-${log.step}`;
          const existing = acc.find(l => `${l.job_id}-${l.step}` === key);
          if (!existing || new Date(log.timestamp) > new Date(existing.timestamp)) {
            if (existing) {
              acc.splice(acc.indexOf(existing), 1);
            }
            acc.push(log);
          }
          return acc;
        }, []);
        
        return latestLogs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
    },
    refetchInterval: 2000,
    enabled: true,
  });

  const getStepIcon = (step: string, status: string) => {
    if (status === 'error') return <AlertCircle className="h-4 w-4 text-red-500" />;
    if (status === 'completed') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === 'progress' || status === 'starting') return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;

    switch (step) {
      case 'script_generation': return <FileText className="h-4 w-4 text-purple-500" />;
      case 'video_creation': return <Video className="h-4 w-4 text-blue-500" />;
      case 'audio_generation': return <Play className="h-4 w-4 text-green-500" />;
      case 'video_editing': return <Edit className="h-4 w-4 text-orange-500" />;
      case 'thumbnail_generation': return <Image className="h-4 w-4 text-pink-500" />;
      case 'file_organization': return <Cloud className="h-4 w-4 text-cyan-500" />;
      case 'upload_scheduling': return <Upload className="h-4 w-4 text-indigo-500" />;
      default: return <Sparkles className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStepTitle = (step: string) => {
    const titles = {
      'script_generation': 'Script Generation',
      'video_creation': 'Video Creation',
      'audio_generation': 'Audio Generation (TTS)',
      'video_editing': 'Professional Video Editing',
      'thumbnail_generation': 'Thumbnail Generation',
      'file_organization': 'File Organization & Upload',
      'upload_scheduling': 'YouTube Upload Scheduling',
      'pipeline_start': 'Pipeline Initialization',
      'pipeline_complete': 'Pipeline Completed'
    };
    return titles[step] || step.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'starting': return <Badge variant="secondary">Starting</Badge>;
      case 'progress': return <Badge className="bg-blue-500">In Progress</Badge>;
      case 'completed': return <Badge className="bg-green-500">Completed</Badge>;
      case 'error': return <Badge variant="destructive">Error</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const toggleLogExpansion = (logId: number) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  if (isLoading) {
    return (
      <Card className="h-[600px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Pipeline Preview Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading logs...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-[600px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Pipeline Preview Logs
            <Badge variant="destructive">Error</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-6 w-6 mr-2" />
            <span>Failed to load logs</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[600px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Pipeline Preview Logs
          {selectedJobId && selectedJobId > 0 ? (
            <Badge variant="default">Job #{selectedJobId} Only</Badge>
          ) : (
            <Badge variant="outline">Active Jobs Only</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading logs...</span>
            </div>
          ) : logs?.length > 0 ? (
            <div className="space-y-3">
              {logs.map((log: PipelineLog) => (
                <div key={log.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                  <div 
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => toggleLogExpansion(log.id)}
                  >
                    {getStepIcon(log.step, log.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-medium text-sm">{getStepTitle(log.step)}</h4>
                        <div className="flex items-center gap-2">
                          {log.progress && (
                            <span className="text-xs text-muted-foreground">
                              {log.progress}%
                            </span>
                          )}
                          {getStatusBadge(log.status)}
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{log.message}</p>

                      {/* Progress bar for in-progress items */}
                      {log.progress && log.status === 'progress' && (
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${log.progress}%` }}
                          />
                        </div>
                      )}

                      {/* Expanded details */}
                      {expandedLogs.has(log.id) && (log.details || log.metadata) && (
                        <div className="mt-3 p-3 bg-muted rounded-md">
                          {log.details && (
                            <div className="mb-2">
                              <p className="text-sm font-medium mb-1">Details:</p>
                              <p className="text-sm text-muted-foreground">{log.details}</p>
                            </div>
                          )}
                          {log.metadata && (
                            <div>
                              <p className="text-sm font-medium mb-1">Metadata:</p>
                              <pre className="text-xs bg-background p-2 rounded border overflow-x-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Sparkles className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {selectedJobId ? 'No logs for this job' : 'No active pipeline jobs'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedJobId 
                  ? 'This job may not have generated any logs yet'
                  : 'Logs will appear here when active jobs are running'
                }
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}