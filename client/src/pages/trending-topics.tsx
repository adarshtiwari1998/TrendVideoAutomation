import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
  ExternalLink,
  Calendar
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
    publishDate?: string;
    extractedAt?: string;
    timeframe?: string;
  };
}

export function TrendingTopicsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTopic, setSelectedTopic] = useState<TrendingTopic | null>(null);

  // Fetch trending topics
  const { data: topics = [], isLoading, error, refetch } = useQuery({
    queryKey: ["trending-topics"],
    queryFn: () => apiRequest("/api/dashboard/trending-topics"),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Format date helper function
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

      if (diffInHours < 1) {
        return "Just now";
      } else if (diffInHours < 24) {
        return `${diffInHours} hours ago`;
      } else {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch {
      return "Recently";
    }
  };

  // Generate script mutation
  const generateScriptMutation = useMutation({
    mutationFn: (topicId: number) => 
      apiRequest(`/api/content/generate/${topicId}`, { method: "POST" }),
    onSuccess: () => {
      toast({
        title: "Script Generated",
        description: "Script has been generated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["trending-topics"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate script",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5 text-gray-700" />
          <h1 className="text-2xl font-semibold">Trending Topics</h1>
        </div>
        <button
          onClick={() => refetch()}
          className="rounded-md border bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Refresh
        </button>
      </div>
      {error && (
        <div className="rounded-md border border-destructive bg-destructive/15 p-3 text-sm text-destructive">
          <AlertCircle className="mr-2 h-4 w-4" />
          Failed to load trending topics.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <>
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="group relative space-y-3 rounded-md border p-4"
              >
                <div className="animate-pulse">
                  <div className="mb-2 h-5 w-3/4 bg-gray-200"></div>
                  <div className="h-3 w-5/6 bg-gray-200"></div>
                  <div className="mt-4 flex justify-between">
                    <div className="h-8 w-20 bg-gray-200"></div>
                    <div className="h-8 w-20 bg-gray-200"></div>
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : (
          topics?.map((topic) => (
            <div
              key={topic.id}
              className="group relative space-y-3 rounded-md border p-4"
            >
              <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 line-clamp-2">
                        {topic.title}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <TrendingUp className="h-4 w-4" />
                        <span className="font-medium">
                          {topic.searchVolume?.toLocaleString() || 'N/A'} searches
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-600 text-sm line-clamp-3">
                      {topic.description}
                    </p>

                    {/* Date and Time Display */}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          Published: {topic.trending_data?.publishDate 
                            ? formatDate(topic.trending_data.publishDate)
                            : formatDate(topic.createdAt)
                          }
                        </span>
                      </div>
                      {topic.trending_data?.extractedAt && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            Extracted: {formatDate(topic.trending_data.extractedAt)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        topic.priority === 'high' 
                          ? 'bg-red-100 text-red-800'
                          : topic.priority === 'medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {topic.priority} priority
                      </span>
                      <span className="text-xs text-gray-500 capitalize">
                        {topic.category?.replace(/_/g, ' ')}
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
                          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 truncate"
                          title={topic.trending_data.sourceUrl}
                        >
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">
                            {topic.trending_data.sourceUrl.length > 50 
                              ? `${topic.trending_data.sourceUrl.substring(0, 50)}...`
                              : topic.trending_data.sourceUrl
                            }
                          </span>
                        </a>
                      </div>
                    )}
                  </div>
              <div className="absolute bottom-4 right-4 flex space-x-2">
                <button
                  onClick={() => setSelectedTopic(topic)}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-slate-50"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  <span className="hidden sm:block">View</span>
                </button>
                <button
                  onClick={() => generateScriptMutation.mutate(topic.id)}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-slate-50"
                  disabled={generateScriptMutation.isLoading}
                >
                  {generateScriptMutation.isLoading ? (
                    <>
                      <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
                      Generating
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Generate
                    </>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {selectedTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="relative w-full max-w-2xl rounded-lg bg-white p-6">
            <button
              className="absolute top-2 right-2 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
              onClick={() => setSelectedTopic(null)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
            <h3 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
              {selectedTopic.title}
            </h3>
            <div className="mt-4 space-y-2">
              <p className="text-gray-700">{selectedTopic.description}</p>
              {selectedTopic.trending_data?.sourceUrl && (
                <a
                  href={selectedTopic.trending_data.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  View Source
                </a>
              )}
              {selectedTopic.trending_data?.fullContent && (
                <div className="mt-4">
                  <h4 className="text-lg font-semibold">Full Content</h4>
                  <p className="text-gray-800">
                    {selectedTopic.trending_data.fullContent}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}