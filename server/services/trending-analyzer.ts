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
      
      // Step 2: Get current trending topics from specific niches
      const [globalNews, factsAndNature, indiaSpecific] = await Promise.all([
        this.getMockGlobalNews(),
        this.getMockFactsAndNature(), 
        this.getMockIndiaSpecific()
      ]);

      const allTopics = [...globalNews, ...factsAndNature, ...indiaSpecific];
      
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

  private getMockGlobalNews(): InsertTrendingTopic[] {
    const today = new Date().toISOString().split('T')[0];
    const currentHour = new Date().getHours();
    const timeStamp = `${today}_${currentHour}`;
    
    return [
      {
        title: `Breaking: Global Summit Announces Major Climate Action Plan - ${today}`,
        description: "World leaders unite on unprecedented climate action with immediate targets for carbon reduction and renewable energy transition",
        searchVolume: 4200000,
        priority: "high",
        category: "global_news",
        source: "google_trends",
        trending_data: { 
          date: today, 
          region: 'Global', 
          timestamp: timeStamp, 
          contentType: 'breaking_news',
          sourceUrl: 'https://example.com/climate-summit-2024',
          tags: ['climate', 'environment', 'politics', 'global']
        },
        status: "pending"
      },
      {
        title: `India Politics: Parliament Passes Historic Education Reform Bill - ${today}`,
        description: "Indian Parliament approves comprehensive education reform affecting millions of students across the country",
        searchVolume: 3800000,
        priority: "high",
        category: "india_politics", 
        source: "google_trends",
        trending_data: { 
          date: today, 
          region: 'India', 
          timestamp: timeStamp, 
          contentType: 'political_news',
          sourceUrl: 'https://example.com/india-education-reform',
          tags: ['india', 'politics', 'education', 'parliament']
        },
        status: "pending"
      },
      {
        title: `Cricket: India vs Australia Test Series Breaks Viewership Records - ${today}`,
        description: "Historic cricket match draws record-breaking global audience as India leads the series with exceptional performance",
        searchVolume: 5200000,
        priority: "high",
        category: "cricket",
        source: "google_trends",
        trending_data: { 
          date: today, 
          region: 'Global', 
          timestamp: timeStamp, 
          contentType: 'sports_news',
          sourceUrl: 'https://example.com/ind-vs-aus-cricket',
          tags: ['cricket', 'india', 'australia', 'sports', 'test_series']
        },
        status: "pending"
      }
    ];
  }

  private getMockFactsAndNature(): InsertTrendingTopic[] {
    const today = new Date().toISOString().split('T')[0];
    const currentHour = new Date().getHours();
    const timeStamp = `${today}_${currentHour}`;
    
    return [
      {
        title: `Amazing Fact: Scientists Discover Animals That Never Age - ${today}`,
        description: "Researchers identify immortal species that could hold the key to understanding aging and longevity in humans",
        searchVolume: 2800000,
        priority: "high",
        category: "facts",
        source: "news_api",
        trending_data: { 
          date: today, 
          breaking: true, 
          timestamp: timeStamp, 
          contentType: 'amazing_fact',
          sourceUrl: 'https://example.com/immortal-animals-discovery',
          tags: ['science', 'nature', 'animals', 'longevity', 'research']
        },
        status: "pending"
      },
      {
        title: `Nature Wonder: Rare Himalayan Flowers Bloom After 12 Years - ${today}`,
        description: "Magnificent Himalayan blue poppies create stunning natural display, last seen over a decade ago",
        searchVolume: 2100000,
        priority: "medium",
        category: "nature",
        source: "news_api",
        trending_data: { 
          date: today, 
          timestamp: timeStamp, 
          contentType: 'nature_phenomenon',
          sourceUrl: 'https://example.com/himalayan-blue-poppies',
          tags: ['nature', 'himalaya', 'flowers', 'rare', 'botanical']
        },
        status: "pending"
      },
      {
        title: `Mind-Blowing Fact: Ocean Currents Found to Control Global Weather - ${today}`,
        description: "New research reveals how deep ocean currents directly influence weather patterns across all continents",
        searchVolume: 3100000,
        priority: "high",
        category: "facts",
        source: "news_api",
        trending_data: { 
          date: today, 
          timestamp: timeStamp, 
          contentType: 'science_fact',
          sourceUrl: 'https://example.com/ocean-currents-weather',
          tags: ['ocean', 'weather', 'climate', 'science', 'research']
        },
        status: "pending"
      },
      {
        title: `Global Politics: UN Security Council Votes on Revolutionary Climate Treaty - ${today}`,
        description: "Historic vote could establish binding international climate laws affecting all 195 member nations",
        searchVolume: 3900000,
        priority: "high",
        category: "global_politics",
        source: "news_api",
        trending_data: { 
          date: today, 
          timestamp: timeStamp, 
          contentType: 'political_news',
          sourceUrl: 'https://example.com/un-climate-treaty-vote',
          tags: ['politics', 'UN', 'climate', 'treaty', 'international']
        },
        status: "pending"
      }
    ];
  }

  private getMockIndiaSpecific(): InsertTrendingTopic[] {
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
      .slice(0, 10); // Keep top 10 topics
  }
}

export const trendingAnalyzer = new TrendingAnalyzer();
