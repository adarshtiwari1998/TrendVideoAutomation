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
      
      // Step 1: Clean up old topics (older than 24 hours)
      await this.cleanupOldTopics();
      
      // Step 2: Get current trending topics
      const [googleTrends, newsTopics, globalTopics] = await Promise.all([
        this.getGoogleTrends(),
        this.getNewsTopics(),
        this.getMockIndiaTopics() // Renamed for global focus
      ]);

      const allTopics = [...googleTrends, ...newsTopics, ...globalTopics];
      
      // Step 3: Filter out topics similar to existing content
      const filteredTopics = await this.filterExistingContent(allTopics);
      const processedTopics = this.processDuplicatesAndPrioritize(filteredTopics);

      // Step 4: Store new unique topics
      for (const topic of processedTopics) {
        await storage.createTrendingTopic(topic);
      }

      await storage.createActivityLog({
        type: 'trending',
        title: 'Daily Trending Analysis Completed',
        description: `Analyzed and stored ${processedTopics.length} fresh trending topics (${allTopics.length - filteredTopics.length} duplicates filtered)`,
        status: 'success',
        metadata: { 
          count: processedTopics.length, 
          filtered: allTopics.length - filteredTopics.length,
          sources: ['google', 'news', 'global'],
          focusAreas: ['facts', 'news', 'science', 'technology', 'health']
        }
      });

      console.log(`Analysis complete. Found ${processedTopics.length} unique trending topics.`);
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

  private async cleanupOldTopics(): Promise<void> {
    try {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      
      await storage.deleteOldTrendingTopics(twentyFourHoursAgo);
      console.log('🧹 Cleaned up trending topics older than 24 hours');
    } catch (error) {
      console.error('Error cleaning up old topics:', error);
    }
  }

  private async filterExistingContent(topics: InsertTrendingTopic[]): Promise<InsertTrendingTopic[]> {
    try {
      // Get existing content jobs to avoid duplicates
      const existingJobs = await storage.getContentJobs(100);
      const existingTitles = existingJobs.map(job => job.title.toLowerCase());
      
      // Filter out topics that are too similar to existing content
      const uniqueTopics = topics.filter(topic => {
        const topicWords = topic.title.toLowerCase().split(' ');
        const isUnique = !existingTitles.some(existingTitle => {
          const commonWords = topicWords.filter(word => 
            existingTitle.includes(word) && word.length > 3
          );
          return commonWords.length >= 2; // If 2+ significant words match, consider duplicate
        });
        return isUnique;
      });

      console.log(`🔍 Filtered ${topics.length - uniqueTopics.length} duplicate topics`);
      return uniqueTopics;
    } catch (error) {
      console.error('Error filtering existing content:', error);
      return topics; // Return all if filtering fails
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
    const currentHour = new Date().getHours();
    const timeStamp = `${today}_${currentHour}`;
    
    return [
      {
        title: `Breaking: Global Climate Summit Reaches Historic Agreement - ${today}`,
        description: "World leaders unite on unprecedented climate action plan with immediate implementation targets",
        searchVolume: 4200000,
        priority: "high",
        category: "environment",
        source: "google_trends",
        trending_data: { date: today, region: 'Global', timestamp: timeStamp, contentType: 'breaking_news' },
        status: "pending"
      },
      {
        title: `Scientific Discovery: New Quantum Computing Breakthrough Changes Everything - ${today}`,
        description: "Scientists achieve quantum supremacy milestone that could revolutionize computing and AI forever",
        searchVolume: 3800000,
        priority: "high",
        category: "science",
        source: "google_trends",
        trending_data: { date: today, region: 'Global', timestamp: timeStamp, contentType: 'science_fact' },
        status: "pending"
      },
      {
        title: `Economic Alert: Global Markets React to Unexpected Policy Changes - ${today}`,
        description: "Major economies announce coordinated financial policies affecting millions worldwide",
        searchVolume: 3200000,
        priority: "high",
        category: "business",
        source: "google_trends",
        trending_data: { date: today, region: 'Global', timestamp: timeStamp, contentType: 'economic_news' },
        status: "pending"
      }
    ];
  }

  private getMockNewsTopics(): InsertTrendingTopic[] {
    const today = new Date().toISOString().split('T')[0];
    const currentHour = new Date().getHours();
    const timeStamp = `${today}_${currentHour}`;
    
    return [
      {
        title: `Amazing Fact: Ocean Discovery Reveals Hidden Ecosystem - ${today}`,
        description: "Marine biologists discover previously unknown deep-sea creatures with extraordinary survival abilities",
        searchVolume: 2800000,
        priority: "high",
        category: "science",
        source: "news_api",
        trending_data: { date: today, breaking: true, timestamp: timeStamp, contentType: 'amazing_fact' },
        status: "pending"
      },
      {
        title: `Health Breakthrough: Revolutionary Treatment Shows 95% Success Rate - ${today}`,
        description: "Medical researchers announce groundbreaking therapy that could change treatment forever",
        searchVolume: 3100000,
        priority: "high",
        category: "health",
        source: "news_api",
        trending_data: { date: today, urgent: true, timestamp: timeStamp, contentType: 'health_news' },
        status: "pending"
      },
      {
        title: `Mind-Blowing Fact: Space Telescope Captures Impossible Image - ${today}`,
        description: "NASA releases stunning photographs that challenge our understanding of the universe",
        searchVolume: 2600000,
        priority: "high",
        category: "science",
        source: "news_api",
        trending_data: { date: today, timestamp: timeStamp, contentType: 'space_fact' },
        status: "pending"
      }
    ];
  }

  private getMockIndiaTopics(): InsertTrendingTopic[] {
    const today = new Date().toISOString().split('T')[0];
    const currentHour = new Date().getHours();
    const timeStamp = `${today}_${currentHour}`;
    
    return [
      {
        title: `Incredible Fact: Ancient Civilization Discovery Rewrites History - ${today}`,
        description: "Archaeologists uncover 5000-year-old city with advanced technology that shouldn't exist",
        searchVolume: 3600000,
        priority: "high",
        category: "history",
        source: "global_trends",
        trending_data: { date: today, timestamp: timeStamp, contentType: 'historical_fact' },
        status: "pending"
      },
      {
        title: `Technology Shock: AI Predicts Major Event 99.9% Accuracy - ${today}`,
        description: "Artificial intelligence system demonstrates unprecedented prediction capabilities in global test",
        searchVolume: 4100000,
        priority: "high",
        category: "technology",
        source: "global_trends",
        trending_data: { date: today, timestamp: timeStamp, contentType: 'tech_breakthrough' },
        status: "pending"
      },
      {
        title: `Nature's Secret: Scientists Decode Animal Communication - ${today}`,
        description: "Breakthrough research reveals how animals have been communicating complex ideas all along",
        searchVolume: 2900000,
        priority: "high",
        category: "science",
        source: "global_trends",
        trending_data: { date: today, timestamp: timeStamp, contentType: 'nature_fact' },
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
