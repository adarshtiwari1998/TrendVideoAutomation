import { google } from 'googleapis';
import { storage } from '../storage';
import type { InsertTrendingTopic } from '@shared/schema';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

export class TrendingAnalyzer {
  private youtube: any;
  private customSearch: any;

  constructor() {
    const youtubeKey = process.env.YOUTUBE_API_KEY;
    const customSearchKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
    const customSearchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;

    if (!customSearchKey || !customSearchEngineId) {
      throw new Error('GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_ENGINE_ID are required for trending analysis');
    }

    // Initialize YouTube Data API
    if (youtubeKey) {
      this.youtube = google.youtube({
        version: 'v3',
        auth: youtubeKey
      });
      console.log('✅ YouTube Data API initialized');
    }

    // Initialize Custom Search API
    if (customSearchKey && customSearchEngineId) {
      this.customSearch = google.customsearch({
        version: 'v1',
        auth: customSearchKey
      });
      console.log('✅ Google Custom Search API initialized');
    }

    console.log('🚀 Advanced TrendingAnalyzer initialized - Targeting reliable news sources for YouTube content');
  }

  async analyzeTrendingTopics(): Promise<void> {
    try {
      const currentDate = new Date();
      console.log(`🔥 ADVANCED TRENDING ANALYSIS: Scanning reliable news sources for YouTube-ready content`);

      // Step 1: Clean up old topics
      await this.cleanupOldTopics();

      // Step 2: Get trending content from RELIABLE NEWS SOURCES
      const [
        spaceNews,
        geographyNews,
        scienceBreakthroughs,
        natureDiscoveries,
        worldFacts
      ] = await Promise.all([
        this.getReliableNewsContent('space astronomy NASA discovery breakthrough mars moon', 'space_news'),
        this.getReliableNewsContent('geography world countries facts discovery amazing', 'geography_facts'),
        this.getReliableNewsContent('science breakthrough discovery research innovation', 'science_facts'),
        this.getReliableNewsContent('nature wildlife environment discovery species', 'nature_facts'),
        this.getReliableNewsContent('world facts amazing discovery geography countries', 'geography_news')
      ]);

      const allTopics = [
        ...spaceNews,
        ...geographyNews,
        ...scienceBreakthroughs,
        ...natureDiscoveries,
        ...worldFacts
      ];

      console.log(`📊 ANALYSIS RESULTS: Found ${allTopics.length} potential YouTube topics from reliable sources`);

      // Step 3: Enhanced filtering for YouTube content
      const youtubeReadyTopics = await this.filterForYouTubeContent(allTopics);
      const finalTopics = this.prioritizeByEngagement(youtubeReadyTopics);

      // Step 4: Store trending topics
      for (const topic of finalTopics) {
        await storage.createTrendingTopic(topic);
      }

      await storage.createActivityLog({
        type: 'trending',
        title: 'Advanced Trending Analysis - YouTube Ready Content',
        description: `Found ${finalTopics.length} high-quality topics from reliable news sources`,
        status: 'success',
        metadata: { 
          count: finalTopics.length,
          date: currentDate.toISOString().split('T')[0],
          sources: 'reliable_news_sites',
          contentQuality: 'youtube_optimized'
        }
      });

      console.log(`✅ ANALYSIS COMPLETE: ${finalTopics.length} YouTube-ready trending topics stored`);
    } catch (error) {
      console.error('❌ Advanced trending analysis failed:', error);
      await storage.createActivityLog({
        type: 'error',
        title: 'Advanced Trending Analysis Failed',
        description: `Error: ${error.message}`,
        status: 'error',
        metadata: { error: error.message }
      });
    }
  }

  private async getReliableNewsContent(query: string, category: string): Promise<InsertTrendingTopic[]> {
    try {
      console.log(`🔍 SCANNING RELIABLE SOURCES for: ${query}`);
      console.log(`📰 Target category: ${category}`);

      // Get today's date for recent content
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      // Enhanced search with reliable news sources prioritized
      const enhancedQuery = `${query} site:space.com OR site:nasa.gov OR site:bbc.com/science OR site:nationalgeographic.com OR site:sciencenews.org OR site:newscientist.com OR site:smithsonianmag.com OR site:scientificamerican.com`;

      console.log(`🎯 ENHANCED SEARCH QUERY: ${enhancedQuery}`);

      const response = await this.customSearch.cse.list({
        cx: process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID,
        q: enhancedQuery,
        num: 8,
        sort: 'date',
        dateRestrict: 'd2' // Last 2 days for fresh content
      });

      const topics: InsertTrendingTopic[] = [];

      if (response.data.items && response.data.items.length > 0) {
        console.log(`📊 Found ${response.data.items.length} results from reliable sources`);

        for (const item of response.data.items) {
          console.log(`\n🔍 PROCESSING: ${item.title}`);
          console.log(`🌐 SOURCE: ${item.link}`);
          console.log(`📝 SNIPPET: ${item.snippet?.substring(0, 100)}...`);

          // Enhanced content extraction with better error handling
          const contentData = await this.extractHighQualityContent(item.link, item.snippet || '', item.title);

          if (contentData.isGoodContent) {
            console.log(`✅ HIGH-QUALITY CONTENT EXTRACTED`);
            console.log(`  📏 Length: ${contentData.fullText.length} characters`);
            console.log(`  🎯 YouTube Ready: ${contentData.youtubeReady ? 'YES' : 'NO'}`);
            console.log(`  ⭐ Engagement Score: ${contentData.engagementScore}/10`);

            topics.push({
              title: this.optimizeForYouTube(item.title, category),
              description: contentData.description,
              searchVolume: this.estimateSearchVolume(contentData.engagementScore, category),
              priority: contentData.engagementScore >= 7 ? 'high' : 'medium',
              category: category,
              source: 'reliable_news',
              trending_data: {
                date: today.toISOString().split('T')[0],
                timestamp: today.toISOString(),
                timeframe: 'last_48_hours',
                sourceUrl: item.link,
                realTime: true,
                dataFreshness: 'current',
                fullContent: contentData.fullText,
                youtubeOptimized: true,
                engagementScore: contentData.engagementScore,
                contentQuality: contentData.isGoodContent ? 'high' : 'medium',
                extractedAt: today.toISOString(),
                sourceDomain: this.extractDomain(item.link),
                wordCount: contentData.wordCount
              },
              status: 'pending'
            });
          } else {
            console.log(`❌ POOR QUALITY CONTENT - Skipping`);
          }
        }
      } else {
        console.log(`⚠️ No results found for: ${query}`);
      }

      console.log(`📈 CATEGORY RESULTS: ${topics.length} high-quality topics for ${category}`);
      return topics;

    } catch (error) {
      console.error(`❌ Error getting reliable news for ${category}:`, error.message);
      return [];
    }
  }

  private async extractHighQualityContent(url: string, fallbackSnippet: string, title: string): Promise<{
    description: string;
    fullText: string;
    isGoodContent: boolean;
    youtubeReady: boolean;
    engagementScore: number;
    wordCount: number;
  }> {
    try {
      console.log(`🔧 ADVANCED CONTENT EXTRACTION from: ${url}`);

      const response = await fetch(url, {
        timeout: 20000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        console.warn(`⚠️ HTTP ${response.status} for ${url}`);
        return this.createFallbackContent(fallbackSnippet, title);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove unwanted elements more thoroughly
      const unwantedSelectors = [
        'script', 'style', 'nav', 'header', 'footer', 'aside',
        '.advertisement', '.ads', '.ad', '.social-share', '.share',
        '.comments', '.comment', '.related-articles', '.related',
        '.sidebar', '.menu', '.navigation', '.breadcrumb',
        '.cookie', '.newsletter', '.popup', '.modal',
        '[data-ad]', '[class*="ad-"]', '[id*="ad-"]',
        '.social-media', '.social-links', '.author-bio'
      ];

      unwantedSelectors.forEach(selector => $(selector).remove());

      // Advanced content selectors for reliable news sites
      const reliableContentSelectors = [
        // NASA specific
        '#maincontent', '.hds-content-item',
        // BBC specific
        '[data-component="text-block"]', '.story-body__inner',
        // National Geographic
        '.article__content', '.parsys_column',
        // Science News
        '.post-content', '.entry-content',
        // New Scientist
        '.article-content', '.content-body',
        // Scientific American
        '.article-content', '.article-body',
        // Smithsonian
        '.article-body', '.field-item',
        // General reliable selectors
        'article', '[role="main"]', '.main-content',
        '.article-content', '.story-content', '.post-body',
        '.content', '.text-content', 'main'
      ];

      let extractedText = '';
      let usedSelector = '';

      // Try each selector and get the best content
      for (const selector of reliableContentSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          const paragraphs = elements.find('p, div').map((_, el) => {
            const text = $(el).text().trim();
            return text.length > 30 ? text : null; // Filter out short/empty paragraphs
          }).get().filter(Boolean);

          if (paragraphs.length >= 3) { // Need at least 3 substantial paragraphs
            const combinedText = paragraphs.join(' ').trim();
            if (combinedText.length > 500) { // Substantial content
              extractedText = combinedText;
              usedSelector = selector;
              break;
            }
          }
        }
      }

      // If no good content found, try alternative extraction
      if (extractedText.length < 500) {
        const allParagraphs = $('p').map((_, el) => $(el).text().trim()).get();
        const goodParagraphs = allParagraphs.filter(p => p.length > 50 && p.length < 1000);
        if (goodParagraphs.length >= 2) {
          extractedText = goodParagraphs.slice(0, 8).join(' ').trim();
          usedSelector = 'filtered-paragraphs';
        }
      }

      // Clean and analyze the content
      extractedText = this.cleanExtractedText(extractedText);
      const analysis = this.analyzeContentQuality(extractedText, title, url);

      console.log(`📊 CONTENT ANALYSIS RESULTS:`);
      console.log(`  📏 Length: ${extractedText.length} chars`);
      console.log(`  📝 Words: ${analysis.wordCount}`);
      console.log(`  ⭐ Engagement Score: ${analysis.engagementScore}/10`);
      console.log(`  🎯 YouTube Ready: ${analysis.youtubeReady}`);
      console.log(`  ✅ Good Content: ${analysis.isGoodContent}`);
      console.log(`  🔧 Extracted via: ${usedSelector}`);

      if (analysis.isGoodContent) {
        return {
          description: extractedText.substring(0, 800) + (extractedText.length > 800 ? '...' : ''),
          fullText: extractedText,
          isGoodContent: true,
          youtubeReady: analysis.youtubeReady,
          engagementScore: analysis.engagementScore,
          wordCount: analysis.wordCount
        };
      }

      return this.createFallbackContent(fallbackSnippet, title);

    } catch (error) {
      console.error(`💥 EXTRACTION ERROR for ${url}: ${error.message}`);
      return this.createFallbackContent(fallbackSnippet, title);
    }
  }

  private analyzeContentQuality(text: string, title: string, url: string): {
    isGoodContent: boolean;
    youtubeReady: boolean;
    engagementScore: number;
    wordCount: number;
  } {
    const wordCount = text.split(/\s+/).filter(w => w.length > 2).length;
    let score = 0;

    // Length scoring
    if (wordCount >= 200) score += 2;
    if (wordCount >= 400) score += 1;
    if (wordCount >= 600) score += 1;

    // Content quality indicators
    const qualityKeywords = [
      'discovery', 'breakthrough', 'research', 'study', 'scientists', 'researchers',
      'new', 'first time', 'amazing', 'incredible', 'surprising', 'reveals',
      'found', 'discovered', 'according to', 'experts', 'findings'
    ];

    const foundKeywords = qualityKeywords.filter(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    ).length;

    score += Math.min(foundKeywords, 3); // Max 3 points for keywords

    // Engagement factors
    const engagementWords = [
      'amazing', 'incredible', 'shocking', 'surprising', 'unbelievable',
      'mind-blowing', 'fascinating', 'extraordinary', 'remarkable'
    ];

    const engagementCount = engagementWords.filter(word => 
      text.toLowerCase().includes(word) || title.toLowerCase().includes(word)
    ).length;

    score += Math.min(engagementCount, 2); // Max 2 points for engagement

    // Reliable source bonus
    const reliableDomains = ['nasa.gov', 'bbc.com', 'nationalgeographic.com', 'sciencenews.org'];
    if (reliableDomains.some(domain => url.includes(domain))) {
      score += 2;
    }

    const isGoodContent = wordCount >= 200 && score >= 5;
    const youtubeReady = wordCount >= 300 && score >= 6;

    return {
      isGoodContent,
      youtubeReady,
      engagementScore: Math.min(score, 10),
      wordCount
    };
  }

  private createFallbackContent(snippet: string, title: string): {
    description: string;
    fullText: string;
    isGoodContent: boolean;
    youtubeReady: boolean;
    engagementScore: number;
    wordCount: number;
  } {
    const fallbackText = snippet || `${title} - This is an interesting topic that could make great YouTube content.`;
    return {
      description: fallbackText,
      fullText: fallbackText,
      isGoodContent: false,
      youtubeReady: false,
      engagementScore: 3,
      wordCount: fallbackText.split(' ').length
    };
  }

  private cleanExtractedText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .replace(/\t+/g, ' ')
      .replace(/[^\w\s.,!?;:'"()-]/g, '')
      .trim();
  }

  private optimizeForYouTube(title: string, category: string): string {
    // Add engaging prefixes based on category
    const prefixes = {
      space_news: ['🚀 BREAKING:', '🌟 AMAZING SPACE:', '🛸 INCREDIBLE:'],
      science_facts: ['🧬 SCIENCE BREAKTHROUGH:', '⚗️ AMAZING DISCOVERY:', '🔬 INCREDIBLE SCIENCE:'],
      geography_facts: ['🌍 AMAZING WORLD FACT:', '🗺️ INCREDIBLE GEOGRAPHY:', '🌎 MIND-BLOWING:'],
      nature_facts: ['🌿 AMAZING NATURE:', '🦋 INCREDIBLE WILDLIFE:', '🌺 NATURE\'S SECRET:'],
      geography_news: ['🌍 WORLD NEWS:', '🗺️ GEOGRAPHY UPDATE:', '🌎 GLOBAL DISCOVERY:']
    };

    const categoryPrefixes = prefixes[category] || ['🔥 TRENDING:'];
    const randomPrefix = categoryPrefixes[Math.floor(Math.random() * categoryPrefixes.length)];

    return `${randomPrefix} ${title}`.substring(0, 100);
  }

  private estimateSearchVolume(engagementScore: number, category: string): number {
    const baseVolumes = {
      space_news: 2000000,
      science_facts: 1500000,
      geography_facts: 1000000,
      nature_facts: 1200000,
      geography_news: 800000
    };

    const base = baseVolumes[category] || 1000000;
    const multiplier = 0.5 + (engagementScore / 20); // 0.5 to 1.0 multiplier

    return Math.floor(base * multiplier);
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  private async filterForYouTubeContent(topics: InsertTrendingTopic[]): Promise<InsertTrendingTopic[]> {
    // Filter for YouTube-ready content
    const filtered = topics.filter(topic => {
      const trendingData = topic.trending_data as any;
      return trendingData.youtubeOptimized && 
             trendingData.engagementScore >= 5 &&
             trendingData.wordCount >= 200;
    });

    console.log(`🎬 YOUTUBE FILTER: ${filtered.length}/${topics.length} topics are YouTube-ready`);
    return filtered;
  }

  private prioritizeByEngagement(topics: InsertTrendingTopic[]): InsertTrendingTopic[] {
    return topics
      .sort((a, b) => {
        const aData = a.trending_data as any;
        const bData = b.trending_data as any;
        return (bData.engagementScore || 0) - (aData.engagementScore || 0);
      })
      .slice(0, 15); // Top 15 most engaging topics
  }

  private async cleanupOldTopics(): Promise<void> {
    try {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      await storage.deleteOldTrendingTopics(twentyFourHoursAgo);
      console.log('🧹 Cleaned up old trending topics');
    } catch (error) {
      console.error('Error cleaning up old topics:', error);
    }
  }
}

export const trendingAnalyzer = new TrendingAnalyzer();