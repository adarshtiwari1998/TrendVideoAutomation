
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Video, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { PipelinePreviewLogs } from '@/components/dashboard/pipeline-preview-logs';
import { useState } from 'react';

interface ContentJob {
  id: number;
  title: string;
  videoType: string;
  status: string;
  progress: number;
  createdAt: string;
  scheduledTime?: string;
  youtubeId?: string;
}

export default function VideoPipelinePage() {
  const [selectedJobId, setSelectedJobId] = useState<number | undefined>();

  const { data: pipeline, isLoading } = useQuery({
    queryKey: ['active-pipeline'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/active-pipeline');
      if (!response.ok) throw new Error('Failed to fetch pipeline');
      return response.json();
    },
    refetchInterval: 5000
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'processing': return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      default: return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'processing': return 'bg-blue-500';
      default: return 'bg-yellow-500';
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-2 mb-6">
        <Video className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Video Pipeline</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pipeline Status */}
          <div className="space-y-6">
          {/* Active Jobs */}
          <Card>
            <CardHeader>
              <CardTitle>Active Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              {pipeline?.active?.length > 0 ? (
                <div className="space-y-4">
                  {pipeline.active.map((job: ContentJob) => (
                    <div 
                      key={job.id} 
                      className={`border rounded-lg p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedJobId === job.id ? 'ring-2 ring-primary bg-primary/5' : ''
                      }`}
                      onClick={() => setSelectedJobId(selectedJobId === job.id ? undefined : job.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(job.status)}
                          <h3 className="font-medium">{job.title}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(job.status)}>
                            {job.status}
                          </Badge>
                          <Badge variant="outline">{job.videoType}</Badge>
                        </div>
                      </div>
                      <Progress value={job.progress} className="mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {job.progress}% complete
                      </p>
                      {selectedJobId === job.id ? (
                        <p className="text-xs text-primary mt-2">
                          ✓ Viewing detailed logs - Click to show all logs
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-2">
                          Click to view detailed logs →
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No active jobs</p>
              )}
            </CardContent>
          </Card>

          {/* Scheduled Jobs */}
          <Card>
            <CardHeader>
              <CardTitle>Scheduled for Upload</CardTitle>
            </CardHeader>
            <CardContent>
              {pipeline?.scheduled?.length > 0 ? (
                <div className="space-y-4">
                  {pipeline.scheduled.map((job: ContentJob) => (
                    <div key={job.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{job.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            Scheduled: {job.scheduledTime ? new Date(job.scheduledTime).toLocaleString() : 'Not scheduled'}
                          </p>
                        </div>
                        <Badge variant="outline">{job.videoType}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No scheduled uploads</p>
              )}
            </CardContent>
          </Card>
          </div>

          {/* Pipeline Preview Logs */}
          <div>
            <PipelinePreviewLogs selectedJobId={selectedJobId} />
          </div>
        </div>
      )}
    </div>
  );
}
