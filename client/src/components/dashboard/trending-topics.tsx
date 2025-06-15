import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useState } from "react";
import { 
  TrendingUp, 
  RotateCcw, 
  AlertCircle,
  Play,
  Eye,
  Trash2,
  Clock,
  X,
  ExternalLink
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
  trending_data?: {
    tags?: string[];
    sourceUrl?: string;
    timestamp?: string;
    contentType?: string;
    fullContent?: string;
  };
}

interface TrendingTopicsProps {
  onRefresh?: () => void;
}

export function TrendingTopics({ onRefresh }: TrendingTopicsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [viewingTopic, setViewingTopic] = useState<TrendingTopic | null>(null);

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

  const deleteMutation = useMutation({
    mutationFn: (topicId: number) =>
      apiRequest('DELETE', `/api/trending/${topicId}`),
    onSuccess: () => {
      toast({
        title: "Topic Deleted",
        description: "The trending topic has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/trending-topics'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete topic: ${error.message}`,
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

  const handleDeleteTopic = (topicId: number) => {
    deleteMutation.mutate(topicId);
  };

  const handleViewFullContent = (topic: TrendingTopic) => {
    setViewingTopic(topic);
  };

  const handleCloseFullContent = () => {
    setViewingTopic(null);
  };

  const getFullContent = (topic: TrendingTopic) => {
    // Try to get full content from trending_data
    if (topic.trending_data && typeof topic.trending_data === 'object') {
      const trendingData = topic.trending_data as any;
      if (trendingData.fullContent && trendingData.fullContent.length > topic.description.length) {
        return trendingData.fullContent;
      }
    }
    return topic.description;
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
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Fresh daily topics • Auto-expires in 24h</p>
                <Badge variant="secondary" className="text-xs">
                  {trendingTopics.length} topics today
                </Badge>
              </div>
              {trendingTopics.slice(0, 10).map((topic) => (
                <div key={topic.id} className="trending-topic-item group p-3 bg-muted/10 rounded-lg hover:bg-muted/20 transition-colors border border-border/50">
                  <div className="flex items-start space-x-3">
                    <div className={`w-2 h-2 ${getPriorityDot(topic.priority)} rounded-full mt-2 flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                        {topic.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {topic.description}
                      </p>
                      <div className="flex items-center space-x-2 mt-2 flex-wrap">
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${getPriorityColor(topic.priority)}`}
                        >
                          {topic.priority}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {topic.category}
                        </Badge>
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                          <Eye className="w-3 h-3" />
                          <span>{formatSearchVolume(topic.searchVolume)}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{formatTimeAgo(topic.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col space-y-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs bg-purple-50 hover:bg-purple-100 border-purple-200"
                        onClick={() => handleViewFullContent(topic)}
                        title="View full content"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Full
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs bg-green-50 hover:bg-green-100 border-green-200"
                        onClick={() => handleGenerateContent(topic.id, 'long_form')}
                        disabled={generateContentMutation.isPending}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Long
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs bg-blue-50 hover:bg-blue-100 border-blue-200"
                        onClick={() => handleGenerateContent(topic.id, 'short')}
                        disabled={generateContentMutation.isPending}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Short
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs bg-red-50 hover:bg-red-100 border-red-200 text-red-600 hover:text-red-700"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteTopic(topic.id);
                        }}
                        disabled={deleteMutation.isPending}
                        title="Delete this topic"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button 
              variant="outline" 
              className="w-full mt-4"
              onClick={() => setLocation('/trending-topics')}
            >
              View All Topics
            </Button>
          </>
        )}
      </CardContent>

      {/* Full Content Modal Dialog */}
      <Dialog open={!!viewingTopic} onOpenChange={handleCloseFullContent}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <DialogTitle className="text-xl font-bold pr-8">
                {viewingTopic?.title}
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCloseFullContent}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          
          {viewingTopic && (
            <div className="space-y-4">
              {/* Topic metadata */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={getPriorityColor(viewingTopic.priority)}>
                  {viewingTopic.priority}
                </Badge>
                <Badge variant="outline">{viewingTopic.category}</Badge>
                <Badge variant="secondary">{viewingTopic.source}</Badge>
                <span className="text-sm text-muted-foreground">
                  {viewingTopic.searchVolume.toLocaleString()} searches
                </span>
              </div>

              {/* Source URL if available */}
              {viewingTopic.trending_data?.sourceUrl && (
                <div className="flex items-center gap-2">
                  <a 
                    href={viewingTopic.trending_data.sourceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Original Source
                  </a>
                </div>
              )}

              {/* Full content */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Full Content</h3>
                <div className="bg-muted/30 p-4 rounded-lg">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {getFullContent(viewingTopic)}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={() => handleGenerateContent(viewingTopic.id, 'long_form')}
                  disabled={generateContentMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Generate Long Video
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleGenerateContent(viewingTopic.id, 'short')}
                  disabled={generateContentMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Generate Short Video
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
