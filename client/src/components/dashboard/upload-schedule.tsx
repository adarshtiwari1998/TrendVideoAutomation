import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, AlertCircle, Video, Calendar } from 'lucide-react';

interface ScheduledVideo {
  id: number;
  title: string;
  videoType: 'long_form' | 'short';
  scheduledTime: string;
  status: 'ready_for_upload' | 'uploading' | 'completed' | 'failed';
  progress: number;
  driveUrl?: string;
  youtubeId?: string;
}

async function fetchScheduledVideos(): Promise<{ scheduled: ScheduledVideo[]; processing: number }> {
  const response = await fetch('/api/dashboard/scheduled-videos');
  if (!response.ok) {
    throw new Error('Failed to fetch scheduled videos');
  }
  return response.json();
}

export function UploadSchedule() {
  const { data: scheduledData, isLoading, error } = useQuery({
    queryKey: ['scheduled-videos'],
    queryFn: fetchScheduledVideos,
    refetchInterval: 3000,
    staleTime: 1000,
  });

  const scheduledVideos = scheduledData?.scheduled || [];
  const processingCount = scheduledData?.processing || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upload Schedule
          </CardTitle>
          <CardDescription>Loading scheduled videos...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upload Schedule
          </CardTitle>
          <CardDescription>Error loading scheduled videos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <AlertCircle className="h-6 w-6 mr-2" />
            Failed to load scheduled videos
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready_for_upload':
        return <Clock className="h-4 w-4" />;
      case 'uploading':
        return <Video className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready_for_upload':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'uploading':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatScheduledTime = (timeStr: string) => {
    try {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) return 'Invalid date';

      const now = new Date();
      const diffMs = date.getTime() - now.getTime();
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));

      if (diffHours < 1) {
        const diffMins = Math.round(diffMs / (1000 * 60));
        return diffMins <= 0 ? 'Now' : `in ${diffMins}m`;
      } else if (diffHours < 24) {
        return `in ${diffHours}h`;
      } else {
        return date.toLocaleDateString();
      }
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Upload Schedule
        </CardTitle>
        <CardDescription>
          {scheduledVideos.length > 0 
            ? `${scheduledVideos.length} videos scheduled for upload`
            : 'No videos scheduled for upload'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {scheduledVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Calendar className="h-8 w-8 mb-2" />
            <p>No scheduled uploads</p>
            <p className="text-sm">Videos will appear here when ready for upload</p>
          </div>
        ) : (
          <div className="space-y-3">
            {scheduledVideos.map((video, index) => (
              <div
                key={`${video.id}-${index}`}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`p-2 rounded-full ${getStatusColor(video.status)} border`}>
                    {getStatusIcon(video.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{video.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {video.videoType === 'long_form' ? 'Long Form' : 'Short'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatScheduledTime(video.scheduledTime)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(video.status)}>
                    {video.status.replace('_', ' ')}
                  </Badge>
                  {video.youtubeId && (
                    <a
                      href={`https://youtube.com/watch?v=${video.youtubeId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-xs"
                    >
                      View
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-semibold text-foreground">
                {scheduledVideos.filter(v => v.status === 'ready_for_upload').length}
              </p>
              <p className="text-xs text-muted-foreground">Scheduled</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                {scheduledVideos.filter(v => v.status === 'uploading').length}
              </p>
              <p className="text-xs text-muted-foreground">Uploading</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                {scheduledVideos.filter(v => v.status === 'completed').length}
              </p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}