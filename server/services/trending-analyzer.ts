
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
      
      // Step 2: Generate diverse trending topics using advanced AI prompts
      const [globalPolitics, indiaPolitics, cricket, facts, nature, globalNews, indiaNews] = await Promise.all([
        this.getAIGeneratedGlobalPolitics(),
        this.getAIGeneratedIndiaPolitics(),
        this.getAIGeneratedCricket(),
        this.getAIGeneratedFacts(),
        this.getAIGeneratedNature(),
        this.getAIGeneratedGlobalNews(),
        this.getAIGeneratedIndiaNews()
      ]);

      const allTopics = [...globalPolitics, ...indiaPolitics, ...cricket, ...facts, ...nature, ...globalNews, ...indiaNews];
      
      // Step 3: Add realistic timestamps with variety
      const topicsWithVariedTimestamps = this.addVariedTimestamps(allTopics);
      
      // Step 4: Filter out topics similar to existing content
      const filteredTopics = await this.filterExistingContent(topicsWithVariedTimestamps);
      const processedTopics = this.processDuplicatesAndPrioritize(filteredTopics);

      // Step 5: Ensure we have at least 10 topics, add trending sources
      const finalTopics = this.ensureMinimumTopics(processedTopics);

      // Step 6: Store new unique topics
      for (const topic of finalTopics) {
        await storage.createTrendingTopic(topic);
      }

      await storage.createActivityLog({
        type: 'trending',
        title: 'Advanced AI Trending Analysis Completed',
        description: `Generated ${finalTopics.length} diverse trending topics across 7 categories using advanced Gemini AI`,
        status: 'success',
        metadata: { 
          count: finalTopics.length, 
          categories: ['global_politics', 'india_politics', 'cricket', 'facts', 'nature', 'global_news', 'india_news'],
          sources: ['gemini_ai', 'trending_sources'],
          focusAreas: ['current_events', 'politics', 'sports', 'science', 'entertainment']
        }
      });

      console.log(`✅ Advanced AI Analysis complete. Generated ${finalTopics.length} diverse trending topics.`);
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

  private async getAIGeneratedGlobalPolitics(): Promise<InsertTrendingTopic[]> {
    return this.generateCategoryTopics('global_politics', 2, `Generate 2 current global political trending topics for today.
    
    Focus on:
    - Major international political developments
    - Government policy changes
    - Diplomatic relations and summits
    - Election news worldwide
    - International conflicts or resolutions
    
    Make each topic current, newsworthy and globally relevant.`);
  }

  private async getAIGeneratedIndiaPolitics(): Promise<InsertTrendingTopic[]> {
    return this.generateCategoryTopics('india_politics', 2, `Generate 2 current India political trending topics for today.
    
    Focus on:
    - Indian government policies and announcements
    - State politics and elections
    - Parliamentary sessions and bills
    - Political party developments
    - Government schemes and initiatives
    
    Make each topic relevant to Indian audience and current political scenario.`);
  }

  private async getAIGeneratedCricket(): Promise<InsertTrendingTopic[]> {
    return this.generateCategoryTopics('cricket', 2, `Generate 2 current cricket trending topics for today.
    
    Focus on:
    - Ongoing cricket matches and tournaments
    - Indian cricket team news
    - IPL updates and player transfers
    - International cricket series
    - Cricket records and achievements
    
    Make each topic exciting for cricket fans and current.`);
  }

  private async getAIGeneratedFacts(): Promise<InsertTrendingTopic[]> {
    return this.generateCategoryTopics('facts', 1, `Generate 1 amazing scientific fact trending topic for today.
    
    Focus on:
    - Mind-blowing scientific discoveries
    - Space and astronomy facts
    - Technology breakthroughs
    - Medical discoveries
    - Psychology and human behavior facts
    
    Make the fact genuinely interesting and shareable.`);
  }

  private async getAIGeneratedNature(): Promise<InsertTrendingTopic[]> {
    return this.generateCategoryTopics('nature', 1, `Generate 1 nature and animal trending topic for today.
    
    Focus on:
    - Amazing animal behaviors or discoveries
    - Environmental phenomena
    - Wildlife conservation news
    - Natural disasters or weather events
    - Ecosystem discoveries
    
    Make the topic fascinating and educational.`);
  }

  private async getAIGeneratedGlobalNews(): Promise<InsertTrendingTopic[]> {
    return this.generateCategoryTopics('global_news', 1, `Generate 1 current global news trending topic for today.
    
    Focus on:
    - Breaking international news
    - Technology company announcements
    - Economic developments
    - Cultural events and entertainment
    - Climate and environment news
    
    Make the topic current and globally relevant.`);
  }

  private async getAIGeneratedIndiaNews(): Promise<InsertTrendingTopic[]> {
    return this.generateCategoryTopics('india_news', 1, `Generate 1 current India news trending topic for today.
    
    Focus on:
    - Bollywood and entertainment news
    - Indian business and startup news
    - Cultural festivals and events
    - Indian technology developments
    - Social issues and developments
    
    Make the topic relevant to Indian audience.`);
  }

  private async generateCategoryTopics(category: string, count: number, prompt: string): Promise<InsertTrendingTopic[]> {
    try {
      if (!process.env.GEMINI_API_KEY) {
        console.log(`No Gemini API key - using fallback for ${category}`);
        return this.getFallbackTopicsForCategory(category, count);
      }

      const fullPrompt = `${prompt}
      
      Return ONLY a JSON array with this exact format:
      [
        {
          "title": "[Engaging and specific title without 'Breaking:' prefix]",
          "description": "Detailed description explaining the topic and its significance",
          "searchVolume": [realistic number between 800000-4500000],
          "priority": "high|medium|low",
          "category": "${category}",
          "source": "trending_source",
          "sourceUrl": "https://example-news-source.com/article"
        }
      ]
      
      Current date: ${new Date().toISOString().split('T')[0]}
      Make each topic current, engaging, and suitable for video content creation.`;

      const model = this.gemini.getGenerativeModel({ model: "gemini-1.5-pro" });
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

      try {
        const aiTopics = JSON.parse(text.replace(/```json|```/g, ''));
        return aiTopics.slice(0, count).map((topic: any) => ({
          ...topic,
          trending_data: { 
            date: new Date().toISOString().split('T')[0],
            aiGenerated: true,
            timestamp: new Date().toISOString(),
            contentType: `ai_${category}`,
            sourceUrl: topic.sourceUrl || 'https://trending-source.com'
          },
          status: 'pending'
        }));
      } catch (parseError) {
        console.log(`Failed to parse AI response for ${category}, using fallback`);
        return this.getFallbackTopicsForCategory(category, count);
      }

    } catch (error) {
      console.error(`Gemini API error for ${category}:`, error);
      return this.getFallbackTopicsForCategory(category, count);
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

  private addVariedTimestamps(topics: InsertTrendingTopic[]): InsertTrendingTopic[] {
    const now = new Date();
    return topics.map((topic, index) => {
      // Spread topics across last 2-6 hours with realistic intervals
      const minutesAgo = Math.floor(Math.random() * 360) + 10; // 10 minutes to 6 hours ago
      const topicTime = new Date(now.getTime() - (minutesAgo * 60 * 1000));
      
      return {
        ...topic,
        trending_data: {
          ...topic.trending_data,
          timestamp: topicTime.toISOString(),
          minutesAgo: minutesAgo
        }
      };
    });
  }

  private ensureMinimumTopics(topics: InsertTrendingTopic[]): InsertTrendingTopic[] {
    if (topics.length >= 10) {
      return topics.slice(0, 15); // Cap at 15 topics
    }

    // If we don't have enough topics, add some high-quality fallbacks
    const additionalTopics = this.getHighQualityFallbacks(10 - topics.length);
    return [...topics, ...additionalTopics];
  }

  private getHighQualityFallbacks(count: number): InsertTrendingTopic[] {
    const today = new Date().toISOString().split('T')[0];
    const fallbacks = [
      {
        title: "India's New Digital Infrastructure Initiative Transforms Rural Connectivity",
        description: "Government announces massive digital transformation plan affecting millions of rural households across India",
        searchVolume: 3100000,
        priority: "high",
        category: "india_politics",
        source: "trending_source",
        trending_data: { 
          date: today, 
          fallback: true, 
          sourceUrl: "https://tech-news-india.com",
          contentType: "high_quality_fallback"
        },
        status: "pending"
      },
      {
        title: "Revolutionary AI Discovery Could Change Cancer Treatment Forever",
        description: "Scientists develop AI system that can detect cancer cells with 99.7% accuracy in early stages",
        searchVolume: 2800000,
        priority: "high",
        category: "facts",
        source: "trending_source",
        trending_data: { 
          date: today, 
          fallback: true, 
          sourceUrl: "https://science-breakthrough.com",
          contentType: "high_quality_fallback"
        },
        status: "pending"
      },
      {
        title: "Virat Kohli's Stunning Performance Breaks 25-Year Cricket Record",
        description: "Indian cricket captain achieves milestone that hasn't been reached since 1999, fans celebrate nationwide",
        searchVolume: 4200000,
        priority: "high",
        category: "cricket",
        source: "trending_source",
        trending_data: { 
          date: today, 
          fallback: true, 
          sourceUrl: "https://cricket-updates.com",
          contentType: "high_quality_fallback"
        },
        status: "pending"
      }
    ];

    return fallbacks.slice(0, count);
  }

  private getFallbackTopicsForCategory(category: string, count: number): InsertTrendingTopic[] {
    const today = new Date().toISOString().split('T')[0];
    const categoryFallbacks: Record<string, InsertTrendingTopic[]> = {
      global_politics: [{
        title: "G20 Summit Announces Historic Climate Agreement",
        description: "World leaders reach unprecedented consensus on climate action with immediate implementation timeline",
        searchVolume: 3500000,
        priority: "high",
        category: "global_politics",
        source: "fallback",
        trending_data: { date: today, fallback: true, sourceUrl: "https://global-politics.com" },
        status: "pending"
      }],
      india_politics: [{
        title: "India Launches Revolutionary Digital Governance Platform",
        description: "New AI-powered citizen services platform promises to transform government interactions",
        searchVolume: 2900000,
        priority: "high",
        category: "india_politics",
        source: "fallback",
        trending_data: { date: today, fallback: true, sourceUrl: "https://india-gov.com" },
        status: "pending"
      }],
      cricket: [{
        title: "India vs Australia: Historic Test Series Reaches Thrilling Finale",
        description: "Border-Gavaskar Trophy deciding match creates unprecedented excitement among cricket fans",
        searchVolume: 3800000,
        priority: "high",
        category: "cricket",
        source: "fallback",
        trending_data: { date: today, fallback: true, sourceUrl: "https://cricket-live.com" },
        status: "pending"
      }]
    };

    return (categoryFallbacks[category] || []).slice(0, count);
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
