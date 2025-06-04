import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { 
  Clock, 
  Video, 
  Smartphone, 
  Calendar,
  AlertCircle,
  CheckCircle,
  RotateCcw
} from "lucide-react";

interface ScheduledVideo {
  id: number;
  title: string;
  videoType: 'long_form' | 'short';
  scheduledTime: string | null;
  status: string;
  progress: number;
}

interface UploadScheduleData {
  scheduled: ScheduledVideo[];
  processing: ScheduledVideo[];
}

export function UploadSchedule() {
  const { data: scheduleData, isLoading, error } = useQuery({
    queryKey: ['/api/dashboard/scheduled-videos'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card className="bg-card rounded-xl shadow-sm border border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-4 bg-muted/30 rounded-lg">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-3 w-3 rounded-full" />
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
            <h3 className="text-lg font-semibold text-foreground">Upload Schedule</h3>
            <Badge variant="destructive">Error</Badge>
          </div>
          <div className="flex items-center space-x-3 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-foreground">Failed to load schedule</p>
              <p className="text-xs text-muted-foreground">{error.message}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const schedule = scheduleData as UploadScheduleData;
  const scheduledVideos = schedule?.scheduled || [];
  const processingVideos = schedule?.processing || [];
  const allVideos = [...scheduledVideos, ...processingVideos];

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
    
    const timeString = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    if (isToday) return `Today ${timeString}`;
    if (isTomorrow) return `Tomorrow ${timeString}`;
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusBadge = (video: ScheduledVideo) => {
    if (video.status === 'completed' && video.scheduledTime) {
      return <Badge className="bg-success text-success-foreground">Ready</Badge>;
    }
    if (video.status === 'failed') {
      return <Badge variant="destructive">Failed</Badge>;
    }
    if (video.progress > 0 && video.progress < 100) {
      return <Badge variant="secondary">Processing {video.progress}%</Badge>;
    }
    return <Badge variant="outline">Queued</Badge>;
  };

  const getStatusIcon = (video: ScheduledVideo) => {
    if (video.status === 'completed' && video.scheduledTime) {
      return <CheckCircle className="w-3 h-3 text-success" />;
    }
    if (video.status === 'failed') {
      return <AlertCircle className="w-3 h-3 text-destructive" />;
    }
    if (video.progress > 0 && video.progress < 100) {
      return <RotateCcw className="w-3 h-3 text-primary animate-spin" />;
    }
    return <Clock className="w-3 h-3 text-muted-foreground" />;
  };

  const getVideoIcon = (videoType: string) => {
    return videoType === 'short' ? (
      <Smartphone className="text-warning w-5 h-5" />
    ) : (
      <Video className="text-primary w-5 h-5" />
    );
  };

  const getCardGradient = (videoType: string) => {
    return videoType === 'short' 
      ? "bg-gradient-to-r from-warning/5 to-orange-500/5 border-warning/20"
      : "bg-gradient-to-r from-primary/5 to-purple-500/5 border-primary/20";
  };

  return (
    <Card className="bg-card rounded-xl shadow-sm border border-border">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Upload Schedule</h3>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>IST Timezone</span>
          </div>
        </div>

        {allVideos.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="text-lg font-medium text-foreground mb-2">No Scheduled Videos</h4>
            <p className="text-muted-foreground">Upload schedule is clear. New videos will appear here when ready.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {allVideos.slice(0, 6).map((video) => (
              <div 
                key={video.id} 
                className={`flex items-center space-x-4 p-4 rounded-lg border ${getCardGradient(video.videoType)}`}
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  video.videoType === 'short' ? 'bg-warning/10' : 'bg-primary/10'
                }`}>
                  {getVideoIcon(video.videoType)}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-foreground">
                    {video.videoType === 'short' ? 'YouTube Short' : 'Long Form Video'}
                  </h4>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {video.title || 'Content in production...'}
                  </p>
                  <div className="flex items-center space-x-4 mt-2">
                    {video.scheduledTime ? (
                      <div className="flex items-center space-x-1 text-xs">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className={video.videoType === 'short' ? 'text-warning' : 'text-primary'}>
                          {formatDateTime(video.scheduledTime)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Processing...</span>
                    )}
                    {getStatusBadge(video)}
                  </div>
                </div>
                <div className="text-right">
                  {getStatusIcon(video)}
                  <span className="text-xs text-muted-foreground mt-1 block">
                    {video.scheduledTime ? 'Scheduled' : 'Processing'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Today's Summary */}
        <div className="mt-6 pt-6 border-t border-border">
          <h4 className="text-sm font-medium text-foreground mb-4">Today's Schedule Summary</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <Video className="w-4 h-4 text-primary" />
              </div>
              <p className="text-lg font-semibold text-foreground">
                {scheduledVideos.filter(v => v.videoType === 'long_form').length}
              </p>
              <p className="text-xs text-muted-foreground">Long Videos</p>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <Smartphone className="w-4 h-4 text-warning" />
              </div>
              <p className="text-lg font-semibold text-foreground">
                {scheduledVideos.filter(v => v.videoType === 'short').length}
              </p>
              <p className="text-xs text-muted-foreground">Shorts</p>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-4 h-4 text-success" />
              </div>
              <p className="text-lg font-semibold text-foreground">
                {scheduledVideos.filter(v => v.status === 'completed').length}
              </p>
              <p className="text-xs text-muted-foreground">Ready</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
