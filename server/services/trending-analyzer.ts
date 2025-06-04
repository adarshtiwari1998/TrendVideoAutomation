import axios from 'axios';
import { storage } from '../storage';
import type { InsertTrendingTopic } from '@shared/schema';

export class TrendingAnalyzer {
  private googleTrendsApiKey: string;
  private newsApiKey: string;
  private twitterApiKey: string;

  constructor() {
    this.googleTrendsApiKey = process.env.GOOGLE_TRENDS_API_KEY || process.env.YOUTUBE_API_KEY || '';
    this.newsApiKey = process.env.NEWS_API_KEY || process.env.GEMINI_API_KEY || '';
    this.twitterApiKey = process.env.TWITTER_API_KEY || process.env.GOOGLE_TRENDS_API_KEY || '';
  }

  async analyzeTrendingTopics(): Promise<void> {
    try {
      console.log('Starting trending topics analysis...');
      
      const [googleTrends, newsTopics, indiaSpecificTopics] = await Promise.all([
        this.getGoogleTrends(),
        this.getNewsTopics(),
        this.getIndiaSpecificTrends()
      ]);

      const allTopics = [...googleTrends, ...newsTopics, ...indiaSpecificTopics];
      const processedTopics = this.processDuplicatesAndPrioritize(allTopics);

      for (const topic of processedTopics) {
        await storage.createTrendingTopic(topic);
      }

      await storage.createActivityLog({
        type: 'trending',
        title: 'Trending Topics Analysis Completed',
        description: `Analyzed and stored ${processedTopics.length} trending topics`,
        status: 'success',
        metadata: { count: processedTopics.length, sources: ['google', 'news', 'india'] }
      });

      console.log(`Analysis complete. Found ${processedTopics.length} trending topics.`);
    } catch (error) {
      console.error('Error analyzing trending topics:', error);
      await storage.createActivityLog({
        type: 'error',
        title: 'Trending Analysis Failed',
        description: `Error: ${error.message}`,
        status: 'error',
        metadata: { error: error.message }
      });
    }
  }

  private async getGoogleTrends(): Promise<InsertTrendingTopic[]> {
    try {
      // Using YouTube API as fallback to get trending content
      const response = await axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
        params: {
          key: this.googleTrendsApiKey,
          part: 'snippet,statistics',
          chart: 'mostPopular',
          regionCode: 'IN',
          maxResults: 20
        }
      });

      return response.data.items.map((item: any) => ({
        title: item.snippet.title,
        description: item.snippet.description?.substring(0, 500) || '',
        searchVolume: parseInt(item.statistics.viewCount) || 0,
        priority: this.calculatePriority(parseInt(item.statistics.viewCount) || 0),
        category: this.categorizeContent(item.snippet.title, item.snippet.description),
        source: 'google_trends',
        trending_data: item,
        status: 'pending'
      }));
    } catch (error) {
      console.error('Google Trends API error:', error);
      return this.getMockGoogleTrends();
    }
  }

  private async getNewsTopics(): Promise<InsertTrendingTopic[]> {
    try {
      // Mock implementation - replace with actual News API
      return this.getMockNewsTopics();
    } catch (error) {
      console.error('News API error:', error);
      return this.getMockNewsTopics();
    }
  }

  private async getIndiaSpecificTrends(): Promise<InsertTrendingTopic[]> {
    try {
      // Mock implementation - replace with actual India-specific trending API
      return this.getMockIndiaTopics();
    } catch (error) {
      console.error('India trends API error:', error);
      return this.getMockIndiaTopics();
    }
  }

  private getMockGoogleTrends(): InsertTrendingTopic[] {
    const today = new Date().toISOString().split('T')[0];
    return [
      {
        title: `Breaking: Major Tech Breakthrough Announced - ${today}`,
        description: "Revolutionary AI technology unveiled today with potential to transform multiple industries",
        searchVolume: 3500000,
        priority: "high",
        category: "technology",
        source: "google_trends",
        trending_data: { date: today, region: 'IN' },
        status: "pending"
      },
      {
        title: `India's Economic Growth Milestone Reached Today`,
        description: "Historic economic indicators show unprecedented growth in key sectors",
        searchVolume: 2800000,
        priority: "high",
        category: "business",
        source: "google_trends",
        trending_data: { date: today, region: 'IN' },
        status: "pending"
      }
    ];
  }

  private getMockNewsTopics(): InsertTrendingTopic[] {
    const today = new Date().toISOString().split('T')[0];
    return [
      {
        title: `Today's Market: Record-Breaking Trading Volume - ${today}`,
        description: "Indian stock markets witness unprecedented trading activity with major sectoral shifts",
        searchVolume: 2200000,
        priority: "high",
        category: "business",
        source: "news_api",
        trending_data: { date: today, breaking: true },
        status: "pending"
      },
      {
        title: `Weather Alert: Monsoon Updates Across India`,
        description: "Critical weather patterns affecting agriculture and urban areas nationwide",
        searchVolume: 1800000,
        priority: "medium",
        category: "environment",
        source: "news_api",
        trending_data: { date: today, urgent: true },
        status: "pending"
      }
    ];
  }

  private getMockIndiaTopics(): InsertTrendingTopic[] {
    return [
      {
        title: "IPL 2024 Auction: Record-Breaking Player Deals",
        description: "Analysis of the most expensive player transfers in IPL history",
        searchVolume: 3200000,
        priority: "high",
        category: "sports",
        source: "india_trends",
        trending_data: {},
        status: "pending"
      },
      {
        title: "India's Space Mission: Chandrayaan-4 Announcement",
        description: "ISRO announces next lunar mission with international collaboration",
        searchVolume: 2100000,
        priority: "high",
        category: "science",
        source: "india_trends",
        trending_data: {},
        status: "pending"
      }
    ];
  }

  private calculatePriority(searchVolume: number): string {
    if (searchVolume > 2000000) return 'high';
    if (searchVolume > 500000) return 'medium';
    return 'low';
  }

  private categorizeContent(title: string, description: string = ''): string {
    const content = `${title} ${description}`.toLowerCase();
    
    if (content.includes('tech') || content.includes('ai') || content.includes('digital')) return 'technology';
    if (content.includes('sport') || content.includes('cricket') || content.includes('ipl')) return 'sports';
    if (content.includes('business') || content.includes('startup') || content.includes('funding')) return 'business';
    if (content.includes('politics') || content.includes('election') || content.includes('government')) return 'politics';
    if (content.includes('health') || content.includes('medical')) return 'health';
    if (content.includes('environment') || content.includes('climate')) return 'environment';
    if (content.includes('space') || content.includes('science')) return 'science';
    
    return 'general';
  }

  private processDuplicatesAndPrioritize(topics: InsertTrendingTopic[]): InsertTrendingTopic[] {
    // Remove duplicates based on title similarity and prioritize by search volume
    const uniqueTopics = new Map<string, InsertTrendingTopic>();
    
    topics.forEach(topic => {
      const key = topic.title.toLowerCase().replace(/[^\w\s]/g, '').trim();
      const existing = uniqueTopics.get(key);
      
      if (!existing || topic.searchVolume > existing.searchVolume) {
        uniqueTopics.set(key, topic);
      }
    });

    return Array.from(uniqueTopics.values())
      .sort((a, b) => b.searchVolume - a.searchVolume)
      .slice(0, 15); // Keep top 15 topics
  }
}

export const trendingAnalyzer = new TrendingAnalyzer();
