import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  TrendingUp, 
  RotateCcw, 
  AlertCircle,
  Play,
  Eye
} from "lucide-react";

interface TrendingTopic {
  id: number;
  title: string;
  description: string;
  searchVolume: number;
  priority: 'high' | 'medium' | 'low';
  category: string;
  source: string;
  status: string;
  createdAt: string;
}

interface TrendingTopicsProps {
  onRefresh?: () => void;
}

export function TrendingTopics({ onRefresh }: TrendingTopicsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: topics, isLoading, error } = useQuery({
    queryKey: ['/api/dashboard/trending-topics'],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const generateContentMutation = useMutation({
    mutationFn: ({ topicId, videoType }: { topicId: number; videoType: 'long_form' | 'short' }) =>
      apiRequest('POST', '/api/content/generate', { topicId, videoType }),
    onSuccess: () => {
      toast({
        title: "Content Generation Started",
        description: "The automation pipeline has started creating content for this topic.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to generate content: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-card rounded-xl shadow-sm border border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start space-x-3 p-3 bg-muted/30 rounded-lg">
                <Skeleton className="h-2 w-2 rounded-full mt-2" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <div className="flex items-center space-x-2">
                    <Skeleton className="h-5 w-12 rounded-full" />
                    <Skeleton className="h-3 w-16" />
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
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Trending Topics</h3>
            <Badge variant="destructive">Error</Badge>
          </div>
          <div className="flex items-center space-x-3 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-foreground">Failed to load trending topics</p>
              <p className="text-xs text-muted-foreground">{error.message}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const trendingTopics = (topics as TrendingTopic[]) || [];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-warning text-warning-foreground';
      case 'low': return 'bg-success text-success-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getPriorityDot = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive';
      case 'medium': return 'bg-warning';
      case 'low': return 'bg-success';
      default: return 'bg-secondary';
    }
  };

  const formatSearchVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`;
    }
    if (volume >= 1000) {
      return `${(volume / 1000).toFixed(0)}K`;
    }
    return volume.toString();
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const handleGenerateContent = (topicId: number, videoType: 'long_form' | 'short') => {
    generateContentMutation.mutate({ topicId, videoType });
  };

  return (
    <Card className="bg-card rounded-xl shadow-sm border border-border">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Trending Topics</h3>
          <Button 
            variant="outline" 
            size="sm"
            onClick={onRefresh}
            className="h-8 w-8 p-0"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        {trendingTopics.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="text-lg font-medium text-foreground mb-2">No Trending Topics</h4>
            <p className="text-muted-foreground mb-4">Trending analysis hasn't found any topics yet.</p>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Refresh Topics
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {trendingTopics.slice(0, 5).map((topic) => (
                <div key={topic.id} className="trending-topic-item group">
                  <div className={`w-2 h-2 ${getPriorityDot(topic.priority)} rounded-full mt-2 flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                      {topic.title}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {topic.description}
                    </p>
                    <div className="flex items-center space-x-2 mt-2">
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${getPriorityColor(topic.priority)}`}
                      >
                        {topic.priority}
                      </Badge>
                      <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                        <Eye className="w-3 h-3" />
                        <span>{formatSearchVolume(topic.searchVolume)} searches</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(topic.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs"
                      onClick={() => handleGenerateContent(topic.id, 'long_form')}
                      disabled={generateContentMutation.isPending}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Long
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs"
                      onClick={() => handleGenerateContent(topic.id, 'short')}
                      disabled={generateContentMutation.isPending}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Short
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button 
              variant="outline" 
              className="w-full mt-4"
              onClick={onRefresh}
            >
              View All Topics
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
