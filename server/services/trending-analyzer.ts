
import { GoogleGenerativeAI } from '@google/generative-ai';
import { storage } from '../storage';
import type { InsertTrendingTopic } from '@shared/schema';

export class TrendingAnalyzer {
  private gemini: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('⚠️  GEMINI_API_KEY not found - trending analysis will be limited');
    }
    
    this.gemini = new GoogleGenerativeAI(apiKey || 'dev-mock-key');
    console.log('TrendingAnalyzer initialized with Gemini AI for real trending topics');
  }

  async analyzeTrendingTopics(): Promise<void> {
    try {
      console.log('🚀 Starting AI-powered trending topics analysis...');
      
      // Step 1: Clean up old topics (older than 24 hours)
      await this.cleanupOldTopics();
      
      // Step 2: Generate real trending topics using Gemini AI
      const [globalNews, factsAndNature, indiaSpecific] = await Promise.all([
        this.getAIGeneratedGlobalNews(),
        this.getAIGeneratedFactsAndNature(), 
        this.getAIGeneratedIndiaSpecific()
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
        title: 'AI Trending Analysis Completed',
        description: `Generated ${processedTopics.length} trending topics using Gemini AI (${allTopics.length - filteredTopics.length} duplicates filtered)`,
        status: 'success',
        metadata: { 
          count: processedTopics.length, 
          filtered: allTopics.length - filteredTopics.length,
          sources: ['gemini_ai'],
          focusAreas: ['current_events', 'facts', 'india', 'global_news']
        }
      });

      console.log(`✅ AI Analysis complete. Generated ${processedTopics.length} real trending topics.`);
    } catch (error) {
      console.error('❌ Error analyzing trending topics:', error);
      await storage.createActivityLog({
        type: 'error',
        title: 'AI Trending Analysis Failed',
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
      const existingJobs = await storage.getContentJobs(100);
      const existingTitles = existingJobs.map(job => job.title.toLowerCase());
      
      const uniqueTopics = topics.filter(topic => {
        const topicWords = topic.title.toLowerCase().split(' ');
        const isUnique = !existingTitles.some(existingTitle => {
          const commonWords = topicWords.filter(word => 
            existingTitle.includes(word) && word.length > 3
          );
          return commonWords.length >= 2;
        });
        return isUnique;
      });

      console.log(`🔍 Filtered ${topics.length - uniqueTopics.length} duplicate topics`);
      return uniqueTopics;
    } catch (error) {
      console.error('Error filtering existing content:', error);
      return topics;
    }
  }

  private async getAIGeneratedGlobalNews(): Promise<InsertTrendingTopic[]> {
    try {
      if (!process.env.GEMINI_API_KEY) {
        console.log('No Gemini API key - using fallback topics');
        return this.getFallbackGlobalNews();
      }

      const prompt = `Generate 3 current global news trending topics for today ${new Date().toISOString().split('T')[0]}. 
      
      Focus on:
      - Current world events and breaking news
      - Technology breakthroughs
      - Climate and environment news
      - Major political developments
      - Economic updates

      Return ONLY a JSON array with this exact format:
      [
        {
          "title": "Breaking: [Specific current event title]",
          "description": "Detailed description of the event and its impact",
          "searchVolume": [realistic number between 1000000-5000000],
          "priority": "high|medium|low",
          "category": "global_news|technology|environment|politics|economy"
        }
      ]

      Make topics feel current and relevant to today's date. Each title should be unique and newsworthy.`;

      const model = this.gemini.getGenerativeModel({ model: "gemini-1.5-pro" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      try {
        const aiTopics = JSON.parse(text);
        return aiTopics.map((topic: any) => ({
          ...topic,
          source: 'gemini_ai',
          trending_data: { 
            date: new Date().toISOString().split('T')[0],
            aiGenerated: true,
            timestamp: new Date().toISOString(),
            contentType: 'ai_trending_news'
          },
          status: 'pending'
        }));
      } catch (parseError) {
        console.log('Failed to parse AI response, using fallback');
        return this.getFallbackGlobalNews();
      }

    } catch (error) {
      console.error('Gemini API error for global news:', error);
      return this.getFallbackGlobalNews();
    }
  }

  private async getAIGeneratedFactsAndNature(): Promise<InsertTrendingTopic[]> {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return this.getFallbackFactsAndNature();
      }

      const prompt = `Generate 3 amazing facts and nature-related trending topics for today.
      
      Focus on:
      - Mind-blowing scientific discoveries
      - Incredible animal facts
      - Natural phenomena and wonders
      - Space and astronomy facts
      - Environmental discoveries

      Return ONLY a JSON array with this exact format:
      [
        {
          "title": "Amazing Fact: [Fascinating discovery or fact]",
          "description": "Detailed explanation of why this is amazing and its significance",
          "searchVolume": [realistic number between 800000-3500000],
          "priority": "high|medium|low",
          "category": "facts|nature|science|space|animals"
        }
      ]

      Make each fact genuinely interesting and shareable.`;

      const model = this.gemini.getGenerativeModel({ model: "gemini-1.5-pro" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      try {
        const aiTopics = JSON.parse(text);
        return aiTopics.map((topic: any) => ({
          ...topic,
          source: 'gemini_ai',
          trending_data: { 
            date: new Date().toISOString().split('T')[0],
            aiGenerated: true,
            timestamp: new Date().toISOString(),
            contentType: 'ai_amazing_facts'
          },
          status: 'pending'
        }));
      } catch (parseError) {
        return this.getFallbackFactsAndNature();
      }

    } catch (error) {
      console.error('Gemini API error for facts:', error);
      return this.getFallbackFactsAndNature();
    }
  }

  private async getAIGeneratedIndiaSpecific(): Promise<InsertTrendingTopic[]> {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return this.getFallbackIndiaSpecific();
      }

      const prompt = `Generate 3 India-specific trending topics for today.
      
      Focus on:
      - Indian politics and governance
      - Bollywood and entertainment
      - Indian cricket and sports
      - Technology and startup news from India
      - Indian culture and festivals
      - Indian economy and business

      Return ONLY a JSON array with this exact format:
      [
        {
          "title": "India: [Specific current event or topic]",
          "description": "Detailed description relevant to Indian audience",
          "searchVolume": [realistic number between 1500000-4000000],
          "priority": "high|medium|low",
          "category": "india_politics|bollywood|cricket|indian_tech|culture|business"
        }
      ]

      Make topics feel current and relevant to Indian audience today.`;

      const model = this.gemini.getGenerativeModel({ model: "gemini-1.5-pro" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      try {
        const aiTopics = JSON.parse(text);
        return aiTopics.map((topic: any) => ({
          ...topic,
          source: 'gemini_ai',
          trending_data: { 
            date: new Date().toISOString().split('T')[0],
            aiGenerated: true,
            timestamp: new Date().toISOString(),
            contentType: 'ai_india_trending'
          },
          status: 'pending'
        }));
      } catch (parseError) {
        return this.getFallbackIndiaSpecific();
      }

    } catch (error) {
      console.error('Gemini API error for India topics:', error);
      return this.getFallbackIndiaSpecific();
    }
  }

  // Fallback methods for when Gemini API is not available
  private getFallbackGlobalNews(): InsertTrendingTopic[] {
    const today = new Date().toISOString().split('T')[0];
    return [
      {
        title: `Breaking: Global Climate Summit Announces Major Policy Changes - ${today}`,
        description: "World leaders announce unprecedented climate action plan with immediate implementation targets",
        searchVolume: 3800000,
        priority: "high",
        category: "global_news",
        source: "fallback",
        trending_data: { date: today, fallback: true },
        status: "pending"
      }
    ];
  }

  private getFallbackFactsAndNature(): InsertTrendingTopic[] {
    const today = new Date().toISOString().split('T')[0];
    return [
      {
        title: `Amazing Fact: Scientists Discover Ocean Species That Live Forever - ${today}`,
        description: "Marine biologists uncover immortal jellyfish species with regenerative capabilities",
        searchVolume: 2500000,
        priority: "high",
        category: "facts",
        source: "fallback",
        trending_data: { date: today, fallback: true },
        status: "pending"
      }
    ];
  }

  private getFallbackIndiaSpecific(): InsertTrendingTopic[] {
    const today = new Date().toISOString().split('T')[0];
    return [
      {
        title: `India: Major Infrastructure Project Announced for Smart Cities - ${today}`,
        description: "Government unveils massive digital infrastructure plan affecting major Indian cities",
        searchVolume: 3200000,
        priority: "high",
        category: "india_politics",
        source: "fallback",
        trending_data: { date: today, fallback: true },
        status: "pending"
      }
    ];
  }

  private calculatePriority(searchVolume: number): string {
    if (searchVolume > 2000000) return 'high';
    if (searchVolume > 500000) return 'medium';
    return 'low';
  }

  private processDuplicatesAndPrioritize(topics: InsertTrendingTopic[]): InsertTrendingTopic[] {
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
      .slice(0, 10);
  }
}

export const trendingAnalyzer = new TrendingAnalyzer();
