import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, RefreshCw, Play, TrendingUp, Trash2, ExternalLink, Eye, X } from 'lucide-react';

interface TrendingTopic {
  id: number;
  title: string;
  description: string;
  searchVolume: number;
  priority: string;
  category: string;
  source: string;
  createdAt: string;
  trending_data?: {
    tags?: string[];
    sourceUrl?: string;
    timestamp?: string;
    contentType?: string;
  };
}

export default function TrendingTopicsPage() {
  const queryClient = useQueryClient();
  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);
  const [viewingTopic, setViewingTopic] = useState<TrendingTopic | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TrendingTopic | null>(null);

  const { data: topicsData = [], isLoading } = useQuery({
    queryKey: ['trending-topics'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/trending-topics');
      if (!response.ok) throw new Error('Failed to fetch trending topics');
      return response.json();
    },
    refetchInterval: 30000
  });

  const topics = topicsData || [];

  // Check URL for view parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const viewId = urlParams.get('view');
    if (viewId && topics && topics.length > 0) {
      const topicToView = topics.find((t: TrendingTopic) => t.id === parseInt(viewId));
      if (topicToView) {
        setViewingTopic(topicToView);
      }
    }
  }, [topics]);

  const generateContentMutation = useMutation({
    mutationFn: async ({ topicId, videoType }: { topicId: number; videoType: string }) => {
      const response = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, videoType })
      });
      if (!response.ok) throw new Error('Failed to generate content');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trending-topics'] });
    }
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/trending/refresh', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to refresh trending topics');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trending-topics'] });
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (topicIds: number[]) => {
      const response = await fetch('/api/trending/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicIds })
      });
      if (!response.ok) throw new Error('Failed to delete topics');
      return response.json();
    },
    onSuccess: () => {
      setSelectedTopics([]);
      queryClient.invalidateQueries({ queryKey: ['trending-topics'] });
    }
  });

  const handleGenerateContent = (topicId: number, videoType: string) => {
    generateContentMutation.mutate({ topicId, videoType });
  };

  const handleSelectTopic = (topicId: number, checked: boolean) => {
    setSelectedTopics(prev => 
      checked 
        ? [...prev, topicId]
        : prev.filter(id => id !== topicId)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedTopics(checked ? topics.map((t: TrendingTopic) => t.id) : []);
  };

  const handleBulkDelete = () => {
    if (selectedTopics.length > 0) {
      bulkDeleteMutation.mutate(selectedTopics);
    }
  };

  const handleViewFullContent = (topic: TrendingTopic) => {
    setViewingTopic(topic);
    // Update URL
    const url = new URL(window.location.href);
    url.searchParams.set('view', topic.id.toString());
    window.history.pushState({}, '', url);
  };

  const handleCloseFullContent = () => {
    setViewingTopic(null);
    // Remove view parameter from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('view');
    window.history.pushState({}, '', url);
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

   const handleTopicClick = (topic: TrendingTopic) => {
    setSelectedTopic(topic);
  };

  const handleCloseModal = () => {
    setSelectedTopic(null);
  };

  const filteredTopics = topics.filter(topic => {
    return true;
  });

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Trending Topics</h1>
          {topics.length > 0 && (
            <Badge variant="secondary">{topics.length} topics</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedTopics.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="flex items-center gap-2"
            >
              {bulkDeleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete {selectedTopics.length} topics
            </Button>
          )}
          <Button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="flex items-center gap-2"
          >
            {refreshMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh Topics
          </Button>
        </div>
      </div>

      {topics.length > 0 && (
        <div className="flex items-center gap-4 mb-4 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="select-all"
              checked={selectedTopics.length === topics.length}
              onCheckedChange={handleSelectAll}
            />
            <label htmlFor="select-all" className="text-sm font-medium">
              Select all topics
            </label>
          </div>
          <Badge variant="outline">
            {selectedTopics.length} of {topics.length} selected
          </Badge>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4">
          {topics.map((topic: TrendingTopic) => (
            <Card key={topic.id} className={`hover:shadow-md transition-shadow ${selectedTopics.includes(topic.id) ? 'ring-2 ring-primary' : ''}`}>
              <CardHeader>
                <div className="flex items-start gap-4">
                  <Checkbox
                    checked={selectedTopics.includes(topic.id)}
                    onCheckedChange={(checked) => handleSelectTopic(topic.id, checked as boolean)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{topic.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mb-3">
                      {topic.description}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <Badge className={getPriorityColor(topic.priority)}>
                        {topic.priority}
                      </Badge>
                      <Badge variant="outline">{topic.category}</Badge>
                      <Badge variant="secondary">{topic.source}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {topic.searchVolume.toLocaleString()} searches
                      </span>
                    </div>
                    {topic.trending_data?.tags && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {topic.trending_data.tags.map((tag: string, index: number) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {topic.trending_data?.sourceUrl && (
                      <div className="flex items-center gap-2">
                        <a 
                          href={topic.trending_data.sourceUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Source
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewFullContent(topic)}
                      className="flex items-center gap-1 bg-purple-50 hover:bg-purple-100 border-purple-200"
                    >
                      <Eye className="h-3 w-3" />
                      View Full
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleGenerateContent(topic.id, 'long_form')}
                      disabled={generateContentMutation.isPending}
                      className="flex items-center gap-1"
                    >
                      <Play className="h-3 w-3" />
                      Long Video
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGenerateContent(topic.id, 'short')}
                      disabled={generateContentMutation.isPending}
                      className="flex items-center gap-1"
                    >
                      <Play className="h-3 w-3" />
                      Short
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Full Content Dialog */}
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
    </div>
  );
}