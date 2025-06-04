
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Play, TrendingUp } from 'lucide-react';

interface TrendingTopic {
  id: number;
  title: string;
  description: string;
  searchVolume: number;
  priority: string;
  category: string;
  source: string;
  createdAt: string;
}

export default function TrendingTopicsPage() {
  const queryClient = useQueryClient();

  const { data: topics = [], isLoading } = useQuery({
    queryKey: ['trending-topics'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/trending-topics');
      if (!response.ok) throw new Error('Failed to fetch trending topics');
      return response.json();
    },
    refetchInterval: 30000
  });

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

  const handleGenerateContent = (topicId: number, videoType: string) => {
    generateContentMutation.mutate({ topicId, videoType });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Trending Topics</h1>
        </div>
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

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4">
          {topics.map((topic: TrendingTopic) => (
            <Card key={topic.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{topic.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mb-3">
                      {topic.description}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={getPriorityColor(topic.priority)}>
                        {topic.priority}
                      </Badge>
                      <Badge variant="outline">{topic.category}</Badge>
                      <Badge variant="secondary">{topic.source}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {topic.searchVolume.toLocaleString()} searches
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
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
    </div>
  );
}
