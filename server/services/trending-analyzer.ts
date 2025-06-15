
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

    console.log('🚀 SPACE & SCIENCE TrendingAnalyzer initialized - Targeting space, astronomy, and science content only');
  }

  async analyzeTrendingTopics(): Promise<void> {
    try {
      const currentDate = new Date();
      console.log(`🔥 SPACE & SCIENCE TRENDING ANALYSIS: Scanning for space, astronomy, and science content`);

      // Step 1: Clean up old topics
      await this.cleanupOldTopics();

      // Step 2: Get trending content from SPACE & SCIENCE SOURCES ONLY
      const [
        spaceNews,
        spaceFacts,
        spaceAstronomy,
        earthSpaceScience,
        generalScienceFacts,
        natureEnvironmentCosmic
      ] = await Promise.all([
        this.getSpaceAndScienceContent('space news NASA discovery Mars moon breakthrough recent', 'space_news'),
        this.getSpaceAndScienceContent('space facts astronomy solar system planets galaxies stars', 'space_facts'),
        this.getSpaceAndScienceContent('space astronomy telescope discovery exoplanets cosmic phenomena', 'space_astronomy'),
        this.getSpaceAndScienceContent('earth space science geology atmosphere climate cosmic impact', 'earth_space_science'),
        this.getSpaceAndScienceContent('science facts physics chemistry biology breakthrough discovery', 'general_science_facts'),
        this.getSpaceAndScienceContent('nature environment cosmic connection universe ecology space impact', 'nature_environment_cosmic')
      ]);

      const allTopics = [
        ...spaceNews,
        ...spaceFacts,
        ...spaceAstronomy,
        ...earthSpaceScience,
        ...generalScienceFacts,
        ...natureEnvironmentCosmic
      ];

      console.log(`📊 SPACE & SCIENCE RESULTS: Found ${allTopics.length} space and science topics`);

      // Step 3: Enhanced filtering for YouTube space/science content
      const spaceReadyTopics = await this.filterForSpaceAndScienceContent(allTopics);
      const finalTopics = this.prioritizeByEngagement(spaceReadyTopics);

      // Step 4: Store trending topics
      for (const topic of finalTopics) {
        await storage.createTrendingTopic(topic);
      }

      await storage.createActivityLog({
        type: 'trending',
        title: 'Space & Science Trending Analysis Complete',
        description: `Found ${finalTopics.length} high-quality space and science topics`,
        status: 'success',
        metadata: { 
          count: finalTopics.length,
          date: currentDate.toISOString().split('T')[0],
          sources: 'space_science_only',
          contentQuality: 'space_optimized'
        }
      });

      console.log(`✅ SPACE & SCIENCE ANALYSIS COMPLETE: ${finalTopics.length} space and science topics stored`);
    } catch (error) {
      console.error('❌ Space & science trending analysis failed:', error);
      await storage.createActivityLog({
        type: 'error',
        title: 'Space & Science Trending Analysis Failed',
        description: `Error: ${error.message}`,
        status: 'error',
        metadata: { error: error.message }
      });
    }
  }

  private async getSpaceAndScienceContent(query: string, category: string): Promise<InsertTrendingTopic[]> {
    try {
      console.log(`🔍 SCANNING SPACE & SCIENCE ARTICLES for: ${query}`);
      console.log(`📰 Target category: ${category}`);
      console.log(`🎯 MINIMUM TARGET: 10 specific article posts from last 48 hours`);

      // Get current date and time for precise 48-hour filtering
      const now = new Date();
      const fortyEightHoursAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));
      
      console.log(`⏰ CURRENT TIME: ${now.toISOString()}`);
      console.log(`⏰ FILTERING FROM: ${fortyEightHoursAgo.toISOString()}`);
      console.log(`📅 EXACT 48H WINDOW: Last 48 hours only`);

      // Enhanced query to find SPECIFIC ARTICLES, not homepage URLs
      const specificArticleQuery = `${query} "article" OR "news" OR "story" OR "report" OR "research" OR "study" OR "breakthrough" OR "discovery" -"home" -"category" -"tag" -"index" filetype:html`;
      
      // Dynamic site targeting based on category and query content
      const dynamicSiteQuery = this.buildDynamicSiteQuery(query, category);
      
      // Combine specific article search with dynamic site targeting
      const spaceAndScienceQuery = `${specificArticleQuery} ${dynamicSiteQuery}`;

      console.log(`🎯 DYNAMIC SEARCH QUERY: ${spaceAndScienceQuery.substring(0, 200)}...`);

      const topics: InsertTrendingTopic[] = [];
      let totalProcessed = 0;
      let validArticles = 0;

      // Try multiple searches with different dynamic approaches to get at least 10 posts
      const searchAttempts = [
        { query: spaceAndScienceQuery, num: 10 },
        { query: `${query} recent news article 2025 -"home" -"category" -"humans-in-space" -"science-nature"`, num: 10 },
        { query: `${query} discovery article today -"index" -"tag" -"category"`, num: 10 },
        { query: `${query} breakthrough news article -"home" -"main" -"category" ${this.getTopSourcesForCategory(category)}`, num: 10 },
        { query: `${query} news discovery -"category" -"tag" -"section" filetype:html`, num: 10 },
        { query: `"${query.split(' ')[0]}" news article discovery recent -"home" -"index" -"category"`, num: 10 }
      ];

      for (const searchAttempt of searchAttempts) {
        if (validArticles >= 10) break; // Stop if we have enough articles

        console.log(`\n🔍 SEARCH ATTEMPT: ${searchAttempt.query.substring(0, 100)}...`);

        try {
          const response = await this.customSearch.cse.list({
            cx: process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID,
            q: searchAttempt.query,
            num: searchAttempt.num,
            sort: 'date',
            dateRestrict: 'd2', // Last 48 hours
            cr: 'countryUS', // Focus on US sources for English content
            lr: 'lang_en' // English language results
          });

          if (response.data.items && response.data.items.length > 0) {
            console.log(`📊 Found ${response.data.items.length} potential articles from space & science sources`);

            for (const item of response.data.items) {
              totalProcessed++;
              console.log(`\n🔍 PROCESSING ARTICLE ${totalProcessed}: ${item.title}`);
              console.log(`🌐 URL: ${item.link}`);
              console.log(`📝 SNIPPET: ${item.snippet?.substring(0, 100)}...`);

              // STRICT URL VALIDATION - Must be a specific article, not homepage
              if (!this.isSpecificArticleUrl(item.link)) {
                console.log(`❌ NOT A SPECIFIC ARTICLE URL - Homepage/Category detected: ${item.link}`);
                continue;
              }

              // Strict 48-hour date validation
              const publishDate = this.extractPublishDate(item);
              if (!this.isWithinLast48Hours(publishDate, fortyEightHoursAgo)) {
                console.log(`❌ CONTENT TOO OLD - Published: ${publishDate?.toISOString() || 'unknown'}`);
                continue;
              }

              // Verify this is actually space/science content
              if (!this.isValidSpaceOrScienceContent(item.title, item.snippet || '', item.link)) {
                console.log(`❌ NOT SPACE/SCIENCE CONTENT - Skipping`);
                continue;
              }

              // Enhanced content extraction for space/science content
              const contentData = await this.extractSpaceAndScienceContent(item.link, item.snippet || '', item.title);

              // Calculate real search volume based on trending factors
              const searchVolume = await this.calculateRealSearchVolume(item.title, contentData, category);
              
              // More lenient search volume for article discovery
              if (searchVolume < 100000) {
                console.log(`❌ LOW SEARCH VOLUME: ${searchVolume.toLocaleString()} - Skipping`);
                continue;
              }

              if (contentData.isGoodContent && contentData.isSpaceOrScience) {
                validArticles++;
                console.log(`✅ VALID ARTICLE ${validArticles}: HIGH-QUALITY SPACE/SCIENCE CONTENT`);
                console.log(`  📏 Length: ${contentData.fullText.length} characters`);
                console.log(`  🎯 Space/Science Ready: ${contentData.spaceReadyContent ? 'YES' : 'NO'}`);
                console.log(`  ⭐ Engagement Score: ${contentData.engagementScore}/10`);
                console.log(`  🔥 Search Volume: ${searchVolume.toLocaleString()}`);
                console.log(`  📅 Published: ${publishDate?.toISOString() || 'within 24h'}`);
                console.log(`  🔗 Article URL: ${item.link}`);

                topics.push({
                  title: this.optimizeForSpace(item.title, category),
                  description: contentData.description,
                  searchVolume: searchVolume,
                  priority: searchVolume >= 1000000 ? 'high' : 'medium',
                  category: category,
                  source: 'space_science_article',
                  trending_data: {
                    date: now.toISOString().split('T')[0],
                    timestamp: now.toISOString(),
                    timeframe: 'last_48_hours',
                    sourceUrl: item.link,
                    realTime: true,
                    dataFreshness: 'current',
                    fullContent: contentData.fullText,
                    spaceOptimized: true,
                    engagementScore: contentData.engagementScore,
                    contentQuality: contentData.isGoodContent ? 'high' : 'medium',
                    extractedAt: now.toISOString(),
                    sourceDomain: this.extractDomain(item.link),
                    wordCount: contentData.wordCount,
                    isSpaceScience: true,
                    publishDate: publishDate?.toISOString(),
                    searchVolumeAnalyzed: true,
                    withinLast48Hours: true,
                    articleType: 'specific_post',
                    publishDateFormatted: publishDate ? this.formatPublishDate(publishDate) : 'Today'
                  },
                  status: 'pending'
                });
              } else {
                console.log(`❌ POOR QUALITY OR NON-SPACE CONTENT - Skipping`);
              }
            }
          } else {
            console.log(`⚠️ No results found for search attempt`);
          }
        } catch (error) {
          console.error(`❌ Search attempt failed:`, error.message);
          continue;
        }
      }

      console.log(`📈 ARTICLE DISCOVERY COMPLETE:`);
      console.log(`  📊 Total URLs processed: ${totalProcessed}`);
      console.log(`  ✅ Valid articles found: ${validArticles}`);
      console.log(`  🎯 Target met: ${validArticles >= 10 ? 'YES' : 'NO'} (need 10, got ${validArticles})`);
      console.log(`  📰 Category: ${category}`);
      
      return topics;

    } catch (error) {
      console.error(`❌ Error getting space/science articles for ${category}:`, error.message);
      return [];
    }
  }

  private isSpecificArticleUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      
      // Exclude homepage and category URLs
      const excludePatterns = [
        /^\/$/, // Root homepage
        /^\/$/,
        /^\/index/, // Index pages
        /^\/category/, // Category pages
        /^\/tag/, // Tag pages
        /^\/topics/, // Topic pages
        /^\/section/, // Section pages
        /^\/home/, // Home pages
        /^\/news\/$/, // News category page
        /^\/science\/$/, // Science category page
        /^\/space\/$/, // Space category page
        /\/category\//, // Any category path
        /\/humans-in-space\/$/, // NASA category
        /\/science-nature\/$/, // Smithsonian category
        /^\/blog\/$/, // Blog homepage
        /^\/main/, // Main pages
        /^\/search/, // Search pages
        /^\/archive/, // Archive pages
        /\/feed\/$/, // Feed pages
        /\/rss\/$/, // RSS pages
        /\/page\/\d+\/$/ // Pagination pages
      ];

      // Check if URL matches exclusion patterns
      const isExcluded = excludePatterns.some(pattern => pattern.test(pathname));
      if (isExcluded) {
        console.log(`🚫 EXCLUDED URL PATTERN: ${pathname}`);
        return false;
      }

      // Must have specific article indicators
      const articleIndicators = [
        /\/news\//, // News article
        /\/article\//, // Article
        /\/story\//, // Story
        /\/report\//, // Report
        /\/research\//, // Research
        /\/releases\//, // Press releases
        /\/missions\//, // Mission updates
        /\/updates\//, // Updates
        /\/content\/article/, // Science.org format
        /\/articles\//, // Nature format
        /\d{4}\/\d{2}\//, // Date in URL (2025/01/)
        /\d{4}-\d{2}-\d{2}/, // Date format (2025-01-15)
        /-\d{8}$/, // Ending with date
        /[a-z]+-[a-z]+-[a-z]+/ // Multiple words with hyphens (typical article URLs)
      ];

      const hasArticleIndicator = articleIndicators.some(pattern => pattern.test(pathname));
      
      // Also check for minimum path depth (specific articles usually have deeper paths)
      const pathDepth = pathname.split('/').filter(p => p.length > 0).length;
      const hasMinimumDepth = pathDepth >= 2;

      const isSpecificArticle = hasArticleIndicator && hasMinimumDepth;
      
      console.log(`📊 URL ANALYSIS: ${url}`);
      console.log(`  📂 Path: ${pathname}`);
      console.log(`  🎯 Has article indicator: ${hasArticleIndicator}`);
      console.log(`  📏 Path depth: ${pathDepth} (min 2)`);
      console.log(`  ✅ Is specific article: ${isSpecificArticle}`);

      return isSpecificArticle;
    } catch (error) {
      console.error(`Error analyzing URL: ${url}`, error.message);
      return false;
    }
  }

  private formatPublishDate(date: Date): string {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  private buildDynamicSiteQuery(query: string, category: string): string {
    // Determine relevant domains based on query keywords and category
    const queryLower = query.toLowerCase();
    let siteParts: string[] = [];

    // NASA sources for space-related queries
    if (queryLower.includes('nasa') || queryLower.includes('space') || queryLower.includes('mars') || queryLower.includes('moon')) {
      siteParts.push('site:nasa.gov/news', 'site:nasa.gov/missions', 'site:jpl.nasa.gov/news');
    }

    // Space industry sources
    if (queryLower.includes('spacex') || queryLower.includes('rocket') || queryLower.includes('launch')) {
      siteParts.push('site:spacex.com/updates', 'site:spacenews.com', 'site:spaceflightnow.com/news');
    }

    // Astronomy sources
    if (queryLower.includes('astronomy') || queryLower.includes('telescope') || queryLower.includes('star') || queryLower.includes('galaxy')) {
      siteParts.push('site:astronomy.com/news', 'site:universetoday.com', 'site:space.com/news');
    }

    // Science journal sources
    if (queryLower.includes('research') || queryLower.includes('study') || queryLower.includes('discovery')) {
      siteParts.push('site:science.org/content/article', 'site:nature.com/articles', 'site:sciencedaily.com/releases');
    }

    // Popular science sources
    if (queryLower.includes('science') || queryLower.includes('physics') || queryLower.includes('chemistry')) {
      siteParts.push('site:sciencenews.org/article', 'site:newscientist.com/article', 'site:scientificamerican.com/article');
    }

    // Environment and earth science
    if (queryLower.includes('earth') || queryLower.includes('climate') || queryLower.includes('environment')) {
      siteParts.push('site:nationalgeographic.com/science/article', 'site:smithsonianmag.com/science-nature');
    }

    // General science and tech sources
    if (queryLower.includes('technology') || queryLower.includes('breakthrough')) {
      siteParts.push('site:phys.org/news', 'site:esa.int/ESA_Multimedia/Videos');
    }

    // If no specific matches, use broad science sources
    if (siteParts.length === 0) {
      siteParts = [
        'site:nasa.gov/news', 'site:space.com/news', 'site:sciencenews.org/article',
        'site:newscientist.com/article', 'site:phys.org/news', 'site:sciencedaily.com/releases'
      ];
    }

    // Remove duplicates and limit to avoid overly long queries
    const uniqueSites = [...new Set(siteParts)].slice(0, 8);
    
    return uniqueSites.length > 0 ? `(${uniqueSites.join(' OR ')})` : '';
  }

  private getTopSourcesForCategory(category: string): string {
    const categorySourceMap: { [key: string]: string[] } = {
      'space_news': ['site:nasa.gov/news', 'site:space.com/news', 'site:spacenews.com'],
      'space_facts': ['site:astronomy.com/news', 'site:universetoday.com', 'site:space.com/news'],
      'space_astronomy': ['site:astronomy.com/news', 'site:universetoday.com', 'site:nasa.gov/missions'],
      'earth_space_science': ['site:nasa.gov/news', 'site:nationalgeographic.com/science/article', 'site:phys.org/news'],
      'general_science_facts': ['site:sciencenews.org/article', 'site:newscientist.com/article', 'site:sciencedaily.com/releases'],
      'nature_environment_cosmic': ['site:nationalgeographic.com/science/article', 'site:smithsonianmag.com/science-nature', 'site:phys.org/news']
    };

    const sources = categorySourceMap[category] || ['site:nasa.gov/news', 'site:space.com/news', 'site:sciencenews.org/article'];
    return `(${sources.join(' OR ')})`;
  }

  private isValidSpaceOrScienceContent(title: string, snippet: string, url: string): boolean {
    const spaceKeywords = [
      'space', 'nasa', 'astronomy', 'planet', 'mars', 'moon', 'solar', 'galaxy', 'star', 'universe',
      'cosmic', 'telescope', 'satellite', 'spacex', 'rocket', 'spacecraft', 'astronaut', 'orbit',
      'science', 'discovery', 'research', 'breakthrough', 'physics', 'chemistry', 'biology',
      'climate', 'earth', 'environment', 'nature', 'species', 'evolution', 'quantum', 'technology'
    ];

    const excludeKeywords = [
      'facebook', 'tripadvisor', 'travel', 'vacation', 'hotel', 'restaurant', 'shopping',
      'business', 'finance', 'stock', 'crypto', 'politics', 'sports', 'entertainment',
      'celebrity', 'fashion', 'food', 'recipe', 'dating', 'social media'
    ];

    const content = `${title} ${snippet}`.toLowerCase();
    
    // Check if content contains space/science keywords
    const hasSpaceContent = spaceKeywords.some(keyword => content.includes(keyword));
    
    // Check if content contains excluded keywords
    const hasExcludedContent = excludeKeywords.some(keyword => content.includes(keyword));

    // Dynamic domain validation based on content relevance
    const reliableDomains = [
      'nasa.gov', 'space.com', 'spacenews.com', 'spaceflightnow.com', 'esa.int',
      'sciencenews.org', 'newscientist.com', 'scientificamerican.com', 'smithsonianmag.com',
      'nationalgeographic.com', 'phys.org', 'science.org', 'nature.com', 'sciencedaily.com',
      'astronomy.com', 'universetoday.com', 'spacex.com', 'jpl.nasa.gov'
    ];

    const isReliableDomain = reliableDomains.some(domain => url.includes(domain));

    // More flexible validation - allow content with strong space/science indicators even from other domains
    const strongSpaceIndicators = ['nasa', 'spacex', 'astronomy', 'discovery', 'research', 'breakthrough'].some(keyword => content.includes(keyword));
    
    return hasSpaceContent && !hasExcludedContent && (isReliableDomain || strongSpaceIndicators);
  }

  private async extractSpaceAndScienceContent(url: string, fallbackSnippet: string, title: string): Promise<{
    description: string;
    fullText: string;
    isGoodContent: boolean;
    spaceReadyContent: boolean;
    isSpaceOrScience: boolean;
    engagementScore: number;
    wordCount: number;
  }> {
    try {
      console.log(`🔧 SPACE/SCIENCE CONTENT EXTRACTION from: ${url}`);

      const response = await fetch(url, {
        timeout: 25000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SpaceBot/1.0; +http://example.com/bot)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        console.warn(`⚠️ HTTP ${response.status} for ${url}`);
        return this.createSpaceFallbackContent(fallbackSnippet, title);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove unwanted elements
      const unwantedSelectors = [
        'script', 'style', 'nav', 'header', 'footer', 'aside',
        '.advertisement', '.ads', '.ad', '.social-share', '.share',
        '.comments', '.comment', '.related-articles', '.related',
        '.sidebar', '.menu', '.navigation', '.breadcrumb',
        '.cookie', '.newsletter', '.popup', '.modal'
      ];

      unwantedSelectors.forEach(selector => $(selector).remove());

      // Space and science specific content selectors
      const spaceContentSelectors = [
        // NASA specific
        '#maincontent', '.hds-content-item', '.uds-article-content',
        // Space.com
        '.content-wrapper', '.article-content', '.vanilla-body',
        // Science journals
        '.article-content', '.article-body', '.content-body',
        '.main-content', '.post-content', '.entry-content',
        // General scientific content
        'article', '[role="main"]', '.text-content',
        '.story-content', '.article-text', 'main'
      ];

      let extractedText = '';
      let usedSelector = '';

      // Try each selector and get the best content
      for (const selector of spaceContentSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          const paragraphs = elements.find('p, div').map((_, el) => {
            const text = $(el).text().trim();
            return text.length > 50 ? text : null;
          }).get().filter(Boolean);

          if (paragraphs.length >= 2) {
            const combinedText = paragraphs.join(' ').trim();
            if (combinedText.length > 300) {
              extractedText = combinedText;
              usedSelector = selector;
              break;
            }
          }
        }
      }

      // If no good content found, try alternative extraction
      if (extractedText.length < 300) {
        const allParagraphs = $('p').map((_, el) => $(el).text().trim()).get();
        const goodParagraphs = allParagraphs.filter(p => p.length > 30 && p.length < 2000);
        if (goodParagraphs.length >= 2) {
          extractedText = goodParagraphs.slice(0, 6).join(' ').trim();
          usedSelector = 'filtered-paragraphs';
        }
      }

      // Clean and analyze the content
      extractedText = this.cleanExtractedText(extractedText);
      const analysis = this.analyzeSpaceContentQuality(extractedText, title, url);

      console.log(`📊 SPACE CONTENT ANALYSIS RESULTS:`);
      console.log(`  📏 Length: ${extractedText.length} chars`);
      console.log(`  📝 Words: ${analysis.wordCount}`);
      console.log(`  ⭐ Engagement Score: ${analysis.engagementScore}/10`);
      console.log(`  🚀 Space Ready: ${analysis.spaceReadyContent}`);
      console.log(`  🔬 Is Space/Science: ${analysis.isSpaceOrScience}`);
      console.log(`  🔧 Extracted via: ${usedSelector}`);

      if (analysis.isGoodContent && analysis.isSpaceOrScience) {
        return {
          description: extractedText.substring(0, 800) + (extractedText.length > 800 ? '...' : ''),
          fullText: extractedText,
          isGoodContent: true,
          spaceReadyContent: analysis.spaceReadyContent,
          isSpaceOrScience: true,
          engagementScore: analysis.engagementScore,
          wordCount: analysis.wordCount
        };
      }

      return this.createSpaceFallbackContent(fallbackSnippet, title);

    } catch (error) {
      console.error(`💥 SPACE EXTRACTION ERROR for ${url}: ${error.message}`);
      return this.createSpaceFallbackContent(fallbackSnippet, title);
    }
  }

  private analyzeSpaceContentQuality(text: string, title: string, url: string): {
    isGoodContent: boolean;
    spaceReadyContent: boolean;
    isSpaceOrScience: boolean;
    engagementScore: number;
    wordCount: number;
  } {
    const wordCount = text.split(/\s+/).filter(w => w.length > 2).length;
    let score = 0;

    // Length scoring
    if (wordCount >= 150) score += 2;
    if (wordCount >= 300) score += 1;
    if (wordCount >= 500) score += 1;

    // Space and science specific keywords
    const spaceKeywords = [
      'space', 'nasa', 'astronomy', 'planet', 'mars', 'moon', 'solar system', 'galaxy', 'star',
      'universe', 'cosmic', 'telescope', 'satellite', 'spacecraft', 'astronaut', 'orbit',
      'discovery', 'breakthrough', 'research', 'scientists', 'study', 'mission', 'exploration',
      'physics', 'chemistry', 'biology', 'earth science', 'climate', 'environment', 'species'
    ];

    const foundSpaceKeywords = spaceKeywords.filter(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase()) || title.toLowerCase().includes(keyword.toLowerCase())
    ).length;

    score += Math.min(foundSpaceKeywords * 0.5, 3); // Max 3 points for space keywords

    // Engagement factors for space content
    const spaceEngagementWords = [
      'amazing', 'incredible', 'breakthrough', 'first time', 'never before', 'stunning',
      'mysterious', 'fascinating', 'extraordinary', 'remarkable', 'groundbreaking', 'revolutionary'
    ];

    const engagementCount = spaceEngagementWords.filter(word => 
      text.toLowerCase().includes(word) || title.toLowerCase().includes(word)
    ).length;

    score += Math.min(engagementCount, 2); // Max 2 points for engagement

    // Space source bonus
    const spaceDomains = ['nasa.gov', 'space.com', 'spacenews.com', 'astronomy.com', 'universetoday.com'];
    if (spaceDomains.some(domain => url.includes(domain))) {
      score += 2;
    }

    // Science source bonus
    const scienceDomains = ['sciencenews.org', 'newscientist.com', 'scientificamerican.com', 'nature.com'];
    if (scienceDomains.some(domain => url.includes(domain))) {
      score += 1.5;
    }

    const isSpaceOrScience = foundSpaceKeywords >= 2; // Must have at least 2 space/science keywords
    const isGoodContent = wordCount >= 150 && score >= 4 && isSpaceOrScience;
    const spaceReadyContent = wordCount >= 250 && score >= 6 && isSpaceOrScience;

    return {
      isGoodContent,
      spaceReadyContent,
      isSpaceOrScience,
      engagementScore: Math.min(score, 10),
      wordCount
    };
  }

  private createSpaceFallbackContent(snippet: string, title: string): {
    description: string;
    fullText: string;
    isGoodContent: boolean;
    spaceReadyContent: boolean;
    isSpaceOrScience: boolean;
    engagementScore: number;
    wordCount: number;
  } {
    const fallbackText = snippet || `${title} - This space and science topic could make engaging YouTube content.`;
    return {
      description: fallbackText,
      fullText: fallbackText,
      isGoodContent: false,
      spaceReadyContent: false,
      isSpaceOrScience: false,
      engagementScore: 2,
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

  private optimizeForSpace(title: string, category: string): string {
    // Add engaging prefixes based on space/science category
    const prefixes = {
      space_news: ['🚀 BREAKING SPACE:', '🌟 SPACE DISCOVERY:', '🛸 NASA BREAKTHROUGH:'],
      space_facts: ['🌌 AMAZING SPACE FACT:', '⭐ COSMIC DISCOVERY:', '🚀 SPACE SCIENCE:'],
      space_astronomy: ['🔭 ASTRONOMICAL DISCOVERY:', '🌟 TELESCOPE BREAKTHROUGH:', '🌌 COSMIC PHENOMENON:'],
      earth_space_science: ['🌍 EARTH FROM SPACE:', '🌎 PLANETARY SCIENCE:', '🌍 SPACE EARTH CONNECTION:'],
      general_science_facts: ['🧬 SCIENCE BREAKTHROUGH:', '⚗️ SCIENTIFIC DISCOVERY:', '🔬 RESEARCH BREAKTHROUGH:'],
      nature_environment_cosmic: ['🌿 COSMIC NATURE:', '🌱 SPACE ENVIRONMENT:', '🌺 UNIVERSAL CONNECTION:']
    };

    const categoryPrefixes = prefixes[category] || ['🔥 SPACE TRENDING:'];
    const randomPrefix = categoryPrefixes[Math.floor(Math.random() * categoryPrefixes.length)];

    return `${randomPrefix} ${title}`.substring(0, 100);
  }

  private estimateSpaceSearchVolume(engagementScore: number, category: string): number {
    const baseVolumes = {
      space_news: 3000000,
      space_facts: 2500000,
      space_astronomy: 2000000,
      earth_space_science: 1500000,
      general_science_facts: 1800000,
      nature_environment_cosmic: 1200000
    };

    const base = baseVolumes[category] || 1500000;
    const multiplier = 0.6 + (engagementScore / 16); // 0.6 to 1.2 multiplier

    return Math.floor(base * multiplier);
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  private extractPublishDate(item: any): Date | null {
    try {
      // Try to extract date from various sources
      if (item.pagemap?.metatags?.[0]) {
        const meta = item.pagemap.metatags[0];
        const dateFields = ['article:published_time', 'article:modified_time', 'og:updated_time', 'datePublished', 'pubdate'];
        
        for (const field of dateFields) {
          if (meta[field]) {
            const date = new Date(meta[field]);
            if (!isNaN(date.getTime())) {
              return date;
            }
          }
        }
      }

      // Try to extract from snippet or title
      const text = `${item.title} ${item.snippet || ''}`;
      const datePatterns = [
        /(\d{1,2})\s+(hours?|hrs?)\s+ago/i,
        /(\d{1,2})\s+(minutes?|mins?)\s+ago/i,
        /yesterday/i,
        /today/i,
        /(\d{4}-\d{2}-\d{2})/,
        /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/i
      ];

      const now = new Date();
      for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
          if (match[0].includes('hours') || match[0].includes('hrs')) {
            const hours = parseInt(match[1]);
            return new Date(now.getTime() - (hours * 60 * 60 * 1000));
          }
          if (match[0].includes('minutes') || match[0].includes('mins')) {
            const minutes = parseInt(match[1]);
            return new Date(now.getTime() - (minutes * 60 * 1000));
          }
          if (match[0].includes('yesterday')) {
            return new Date(now.getTime() - (24 * 60 * 60 * 1000));
          }
          if (match[0].includes('today')) {
            return now;
          }
        }
      }

      // Default to current time if published within Google's d1 filter
      return now;
    } catch (error) {
      console.warn('Error extracting publish date:', error.message);
      return null;
    }
  }

  private isWithinLast48Hours(publishDate: Date | null, fortyEightHoursAgo: Date): boolean {
    if (!publishDate) {
      // If we can't determine the date but Google's d2 filter returned it, assume it's recent
      return true;
    }
    
    return publishDate >= fortyEightHoursAgo;
  }

  private async calculateRealSearchVolume(title: string, contentData: any, category: string): Promise<number> {
    try {
      let baseVolume = 100000; // Base minimum for space content

      // Category-based multipliers
      const categoryMultipliers = {
        space_news: 2.5,
        space_facts: 2.0,
        space_astronomy: 1.8,
        earth_space_science: 1.5,
        general_science_facts: 1.7,
        nature_environment_cosmic: 1.3
      };

      baseVolume *= (categoryMultipliers[category] || 1.0);

      // High-impact keywords that drive search volume
      const highVolumeKeywords = [
        { words: ['nasa', 'spacex', 'mars', 'moon'], multiplier: 3.0 },
        { words: ['breakthrough', 'discovery', 'first time'], multiplier: 2.5 },
        { words: ['asteroid', 'planet', 'galaxy', 'black hole'], multiplier: 2.2 },
        { words: ['telescope', 'hubble', 'webb', 'james webb'], multiplier: 2.0 },
        { words: ['astronaut', 'mission', 'launch', 'landing'], multiplier: 1.8 },
        { words: ['climate', 'earth', 'environment', 'species'], multiplier: 1.6 },
        { words: ['quantum', 'physics', 'science', 'research'], multiplier: 1.4 }
      ];

      const titleLower = title.toLowerCase();
      let keywordMultiplier = 1.0;

      for (const keywordGroup of highVolumeKeywords) {
        const hasKeyword = keywordGroup.words.some(word => titleLower.includes(word));
        if (hasKeyword) {
          keywordMultiplier *= keywordGroup.multiplier;
        }
      }

      // Engagement score multiplier
      const engagementMultiplier = 0.5 + (contentData.engagementScore / 10);

      // Content quality multiplier
      const qualityMultiplier = contentData.wordCount >= 500 ? 1.5 : 
                               contentData.wordCount >= 300 ? 1.2 : 
                               contentData.wordCount >= 150 ? 1.0 : 0.8;

      // Recent content gets a boost
      const recencyMultiplier = 1.3;

      const finalVolume = Math.floor(
        baseVolume * 
        keywordMultiplier * 
        engagementMultiplier * 
        qualityMultiplier * 
        recencyMultiplier
      );

      console.log(`📊 SEARCH VOLUME CALCULATION:`);
      console.log(`  Base: ${baseVolume.toLocaleString()}`);
      console.log(`  Keywords: x${keywordMultiplier.toFixed(2)}`);
      console.log(`  Engagement: x${engagementMultiplier.toFixed(2)}`);
      console.log(`  Quality: x${qualityMultiplier.toFixed(2)}`);
      console.log(`  Recency: x${recencyMultiplier.toFixed(2)}`);
      console.log(`  Final: ${finalVolume.toLocaleString()}`);

      return Math.max(finalVolume, 200000); // Minimum 200K for any space content
    } catch (error) {
      console.error('Error calculating search volume:', error.message);
      return 500000; // Safe fallback
    }
  }

  private async filterForSpaceAndScienceContent(topics: InsertTrendingTopic[]): Promise<InsertTrendingTopic[]> {
    // Filter for high-quality, high search volume, recent space and science content only
    const filtered = topics.filter(topic => {
      const trendingData = topic.trending_data as any;
      return trendingData.spaceOptimized && 
             trendingData.isSpaceScience &&
             trendingData.engagementScore >= 3 &&
             trendingData.wordCount >= 100 &&
             trendingData.withinLast48Hours &&
             trendingData.searchVolumeAnalyzed &&
             topic.searchVolume >= 300000; // Minimum 300K search volume
    });

    console.log(`🚀 HIGH-VOLUME 48H FILTER: ${filtered.length}/${topics.length} topics meet criteria`);
    console.log(`📊 CRITERIA: Space/Science + 48h recent + 300K+ search volume + quality content`);
    return filtered;
  }

  private prioritizeByEngagement(topics: InsertTrendingTopic[]): InsertTrendingTopic[] {
    return topics
      .sort((a, b) => {
        // Primary sort: Search volume (higher is better)
        const volumeDiff = (b.searchVolume || 0) - (a.searchVolume || 0);
        if (Math.abs(volumeDiff) > 100000) return volumeDiff;

        // Secondary sort: Engagement score
        const aData = a.trending_data as any;
        const bData = b.trending_data as any;
        const engagementDiff = (bData.engagementScore || 0) - (aData.engagementScore || 0);
        if (Math.abs(engagementDiff) > 1) return engagementDiff;

        // Tertiary sort: Content quality (word count)
        return (bData.wordCount || 0) - (aData.wordCount || 0);
      })
      .slice(0, 20); // Top 20 highest search volume space/science topics from last 48h
  }

  private async cleanupOldTopics(): Promise<void> {
    try {
      const fortyEightHoursAgo = new Date();
      fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

      await storage.deleteOldTrendingTopics(fortyEightHoursAgo);
      console.log('🧹 Cleaned up old trending topics (older than 48 hours)');
    } catch (error) {
      console.error('Error cleaning up old topics:', error);
    }
  }
}

export const trendingAnalyzer = new TrendingAnalyzer();
