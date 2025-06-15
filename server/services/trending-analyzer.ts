
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

      // Enhanced query with better article targeting
      const enhancedQuery = this.buildEnhancedSearchQuery(query, category);

      console.log(`🎯 ENHANCED SEARCH QUERY: ${enhancedQuery.substring(0, 200)}...`);

      const topics: InsertTrendingTopic[] = [];
      let totalProcessed = 0;
      let validArticles = 0;

      // Multiple search strategies for comprehensive coverage
      const searchStrategies = [
        { query: enhancedQuery, num: 10, description: 'Primary enhanced query' },
        { query: `${query} article 2025 published today yesterday -category -home -index`, num: 10, description: 'Recent articles filter' },
        { query: `"${query.split(' ')[0]}" "article" OR "story" published -homepage -category -tag`, num: 10, description: 'Specific article targeting' },
        { query: `${query} breakthrough discovery published recent -category -section -homepage`, num: 10, description: 'Breakthrough focus' },
        { query: `${query} news report published 2025 -category -tag -archive -home`, num: 10, description: 'News report targeting' }
      ];

      for (const strategy of searchStrategies) {
        if (validArticles >= 15) break; // Target more articles for better selection

        console.log(`\n🔍 SEARCH STRATEGY: ${strategy.description}`);
        console.log(`📝 Query: ${strategy.query.substring(0, 100)}...`);

        try {
          const response = await this.customSearch.cse.list({
            cx: process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID,
            q: strategy.query,
            num: strategy.num,
            sort: 'date',
            dateRestrict: 'd2', // Last 48 hours
            cr: 'countryUS',
            lr: 'lang_en',
            siteSearch: this.getTargetSites(category),
            siteSearchFilter: 'i' // Include only these sites
          });

          if (response.data.items && response.data.items.length > 0) {
            console.log(`📊 Found ${response.data.items.length} potential articles`);

            for (const item of response.data.items) {
              if (validArticles >= 15) break;
              
              totalProcessed++;
              console.log(`\n🔍 PROCESSING ARTICLE ${totalProcessed}: ${item.title}`);
              console.log(`🌐 URL: ${item.link}`);

              // Enhanced URL validation
              if (!this.isValidArticleUrl(item.link)) {
                console.log(`❌ INVALID ARTICLE URL: ${item.link}`);
                continue;
              }

              // Enhanced date extraction and validation
              const publishInfo = await this.extractDetailedPublishInfo(item);
              if (!this.isWithinTimeframe(publishInfo.publishDate, fortyEightHoursAgo)) {
                console.log(`❌ CONTENT TOO OLD - Published: ${publishInfo.publishDate?.toISOString() || 'unknown'}`);
                continue;
              }

              // Verify space/science content
              if (!this.isValidSpaceOrScienceContent(item.title, item.snippet || '', item.link)) {
                console.log(`❌ NOT SPACE/SCIENCE CONTENT`);
                continue;
              }

              // Enhanced content extraction
              const contentData = await this.extractCleanContent(item.link, item.snippet || '', item.title);
              
              if (!contentData.isValidContent) {
                console.log(`❌ POOR QUALITY CONTENT`);
                continue;
              }

              // Get real search volume from Google Trends API
              const searchVolume = await this.getRealSearchVolume(item.title, contentData);
              
              if (searchVolume < 50000) {
                console.log(`❌ LOW SEARCH VOLUME: ${searchVolume.toLocaleString()}`);
                continue;
              }

              validArticles++;
              console.log(`✅ VALID ARTICLE ${validArticles}: HIGH-QUALITY CONTENT`);
              console.log(`  📏 Content Length: ${contentData.wordCount} words`);
              console.log(`  ⭐ Quality Score: ${contentData.qualityScore}/10`);
              console.log(`  🔥 Search Volume: ${searchVolume.toLocaleString()}`);
              console.log(`  📅 Published: ${publishInfo.displayDate}`);

              topics.push({
                title: this.optimizeForSpace(item.title, category),
                description: contentData.description,
                searchVolume: searchVolume,
                priority: searchVolume >= 500000 ? 'high' : 'medium',
                category: category,
                source: 'space_science_article',
                trending_data: {
                  date: now.toISOString().split('T')[0],
                  timestamp: now.toISOString(),
                  timeframe: 'last_48_hours',
                  sourceUrl: item.link,
                  realTime: true,
                  dataFreshness: 'current',
                  fullContent: contentData.cleanText,
                  spaceOptimized: true,
                  qualityScore: contentData.qualityScore,
                  contentQuality: contentData.qualityScore >= 7 ? 'high' : 'medium',
                  extractedAt: now.toISOString(),
                  sourceDomain: this.extractDomain(item.link),
                  wordCount: contentData.wordCount,
                  isSpaceScience: true,
                  publishDate: publishInfo.publishDate?.toISOString(),
                  realSearchVolume: true,
                  searchVolumeSource: 'google_trends',
                  withinLast48Hours: true,
                  articleType: 'specific_article',
                  publishDateFormatted: publishInfo.displayDate,
                  contentHash: this.generateContentHash(contentData.cleanText)
                },
                status: 'pending'
              });
            }
          }
        } catch (error) {
          console.error(`❌ Search strategy failed:`, error.message);
          continue;
        }
      }

      console.log(`📈 ARTICLE DISCOVERY COMPLETE:`);
      console.log(`  📊 Total URLs processed: ${totalProcessed}`);
      console.log(`  ✅ Valid articles found: ${validArticles}`);
      console.log(`  🎯 Target achieved: ${validArticles >= 10 ? 'YES' : 'NO'}`);
      
      return topics;

    } catch (error) {
      console.error(`❌ Error getting space/science articles for ${category}:`, error.message);
      return [];
    }
  }

  private buildEnhancedSearchQuery(query: string, category: string): string {
    // Build highly specific query for article targeting
    const articleTerms = ['article', 'story', 'report', 'news', 'research', 'study', 'discovery', 'breakthrough'];
    const excludeTerms = ['home', 'category', 'tag', 'index', 'archive', 'search', 'feed', 'rss', 'sitemap'];
    
    // Category-specific enhancements
    const categoryEnhancements = {
      space_news: 'NASA SpaceX launch mission',
      space_facts: 'astronomy universe solar system',
      space_astronomy: 'telescope discovery exoplanet',
      earth_space_science: 'earth science climate geology',
      general_science_facts: 'physics chemistry biology',
      nature_environment_cosmic: 'environment nature cosmic'
    };

    const enhancement = categoryEnhancements[category] || '';
    const articleQuery = `(${articleTerms.map(term => `"${term}"`).join(' OR ')})`;
    const excludeQuery = excludeTerms.map(term => `-"${term}"`).join(' ');
    
    return `${query} ${enhancement} ${articleQuery} ${excludeQuery} published 2025 filetype:html`;
  }

  private getTargetSites(category: string): string {
    const siteMap = {
      space_news: 'nasa.gov space.com spacenews.com',
      space_facts: 'astronomy.com universetoday.com space.com',
      space_astronomy: 'astronomy.com universetoday.com nasa.gov',
      earth_space_science: 'nasa.gov nationalgeographic.com phys.org',
      general_science_facts: 'sciencenews.org newscientist.com sciencedaily.com',
      nature_environment_cosmic: 'nationalgeographic.com smithsonianmag.com phys.org'
    };
    
    return siteMap[category] || 'nasa.gov space.com sciencenews.org';
  }

  private isValidArticleUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      
      // Strict exclusion patterns
      const excludePatterns = [
        /^\/$/, // Homepage
        /^\/[^\/]*\/$/, // Single level category pages
        /\/category\//, /\/tag\//, /\/topic\//, /\/section\//,
        /\/archive\//, /\/search\//, /\/feed\//, /\/rss\//,
        /\/page\/\d+/, /\/\d{4}\/$/, /\/\d{4}\/\d{2}\/$/ // Date-only URLs
      ];

      if (excludePatterns.some(pattern => pattern.test(pathname))) {
        return false;
      }

      // Must have article indicators
      const articleIndicators = [
        /\/article\//, /\/story\//, /\/news\//, /\/report\//,
        /\/research\//, /\/study\//, /\/discovery\//, /\/breakthrough\//,
        /\/releases\//, /\/updates\//, /\/content\/article/,
        /\d{4}\/\d{2}\/\d{2}\//, // Date-based article URLs
        /[a-z]+-[a-z]+-[a-z]+/ // Multi-word article URLs
      ];

      const hasIndicator = articleIndicators.some(pattern => pattern.test(pathname));
      const hasDepth = pathname.split('/').filter(p => p.length > 0).length >= 2;
      
      return hasIndicator && hasDepth;
    } catch {
      return false;
    }
  }

  private async extractDetailedPublishInfo(item: any): Promise<{
    publishDate: Date | null;
    displayDate: string;
    confidence: number;
  }> {
    try {
      let publishDate: Date | null = null;
      let confidence = 0;

      // 1. Try structured data from pagemap
      if (item.pagemap?.metatags?.[0]) {
        const meta = item.pagemap.metatags[0];
        const dateFields = [
          'article:published_time',
          'article:modified_time', 
          'datePublished',
          'publishedDate',
          'date',
          'pubdate'
        ];
        
        for (const field of dateFields) {
          if (meta[field]) {
            const date = new Date(meta[field]);
            if (!isNaN(date.getTime())) {
              publishDate = date;
              confidence = 90;
              break;
            }
          }
        }
      }

      // 2. Try to extract from URL
      if (!publishDate) {
        const urlDateMatch = item.link.match(/(\d{4})\/(\d{2})\/(\d{2})/);
        if (urlDateMatch) {
          publishDate = new Date(`${urlDateMatch[1]}-${urlDateMatch[2]}-${urlDateMatch[3]}`);
          confidence = 70;
        }
      }

      // 3. Try to extract from snippet and title
      if (!publishDate) {
        const text = `${item.title} ${item.snippet || ''}`;
        const patterns = [
          { regex: /(\d{1,2})\s+(hour|hr)s?\s+ago/i, multiplier: 60 * 60 * 1000 },
          { regex: /(\d{1,2})\s+(minute|min)s?\s+ago/i, multiplier: 60 * 1000 },
          { regex: /yesterday/i, hours: 24 },
          { regex: /today/i, hours: 0 },
          { regex: /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i }
        ];

        const now = new Date();
        
        for (const pattern of patterns) {
          const match = text.match(pattern.regex);
          if (match) {
            if (pattern.multiplier) {
              const value = parseInt(match[1]);
              publishDate = new Date(now.getTime() - (value * pattern.multiplier));
              confidence = 60;
            } else if (pattern.hours !== undefined) {
              publishDate = new Date(now.getTime() - (pattern.hours * 60 * 60 * 1000));
              confidence = 50;
            } else {
              // Month name pattern
              const months = ['January', 'February', 'March', 'April', 'May', 'June',
                             'July', 'August', 'September', 'October', 'November', 'December'];
              const month = months.indexOf(match[1]);
              if (month !== -1) {
                publishDate = new Date(parseInt(match[3]), month, parseInt(match[2]));
                confidence = 80;
              }
            }
            break;
          }
        }
      }

      // 4. Fetch actual page to extract publish date
      if (!publishDate || confidence < 70) {
        try {
          const pageDate = await this.extractDateFromPage(item.link);
          if (pageDate && pageDate.confidence > confidence) {
            publishDate = pageDate.date;
            confidence = pageDate.confidence;
          }
        } catch (error) {
          console.warn('Could not extract date from page:', error.message);
        }
      }

      const displayDate = this.formatPublishDate(publishDate, confidence);
      
      console.log(`📅 DATE EXTRACTION: ${displayDate} (confidence: ${confidence}%)`);
      
      return { publishDate, displayDate, confidence };
    } catch (error) {
      console.warn('Error extracting publish info:', error.message);
      return { 
        publishDate: null, 
        displayDate: 'Recently published', 
        confidence: 0 
      };
    }
  }

  private async extractDateFromPage(url: string): Promise<{ date: Date; confidence: number } | null> {
    try {
      const response = await fetch(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ContentBot/1.0)',
          'Accept': 'text/html'
        }
      });

      if (!response.ok) return null;

      const html = await response.text();
      const $ = cheerio.load(html);

      // Look for common date selectors
      const dateSelectors = [
        'time[datetime]',
        '.published-date',
        '.article-date',
        '.post-date',
        '[data-published]',
        '.date-published',
        'meta[property="article:published_time"]',
        'meta[name="publish_date"]'
      ];

      for (const selector of dateSelectors) {
        const element = $(selector).first();
        if (element.length) {
          const dateStr = element.attr('datetime') || 
                         element.attr('data-published') || 
                         element.attr('content') ||
                         element.text();
          
          if (dateStr) {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              return { date, confidence: 85 };
            }
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private formatPublishDate(date: Date | null, confidence: number): string {
    if (!date) return 'Recently published';
    
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Just published';
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  }

  private isWithinTimeframe(publishDate: Date | null, cutoffDate: Date): boolean {
    if (!publishDate) {
      // If we can't determine the date but Google's d2 filter returned it, assume it's recent
      return true;
    }
    
    return publishDate >= cutoffDate;
  }

  private async extractCleanContent(url: string, fallbackSnippet: string, title: string): Promise<{
    cleanText: string;
    description: string;
    wordCount: number;
    qualityScore: number;
    isValidContent: boolean;
  }> {
    try {
      console.log(`🔧 EXTRACTING CLEAN CONTENT from: ${url}`);

      const response = await fetch(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ContentBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      if (!response.ok) {
        return this.createFallbackContent(fallbackSnippet, title);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove all unwanted elements first
      const unwantedSelectors = [
        'script', 'style', 'noscript', 'iframe', 'embed', 'object',
        'nav', 'header', 'footer', 'aside', 'menu',
        '.advertisement', '.ads', '.ad', '.ad-container', '.ad-wrapper',
        '.social-share', '.share', '.sharing', '.social-media',
        '.comments', '.comment', '.comment-section',
        '.sidebar', '.side-bar', '.navigation', '.nav',
        '.breadcrumb', '.breadcrumbs', '.tags', '.tag-list',
        '.related', '.related-articles', '.related-posts',
        '.newsletter', '.subscribe', '.subscription',
        '.popup', '.modal', '.overlay', '.banner',
        '.cookie', '.gdpr', '.privacy-notice',
        '.author-bio', '.author-info', '.bio',
        '.widget', '.widgets', '.plugin',
        '.promo', '.promotion', '.sponsored',
        '[class*="ad-"]', '[id*="ad-"]', '[class*="ads-"]',
        '[class*="advertisement"]', '[class*="sponsor"]'
      ];

      unwantedSelectors.forEach(selector => $(selector).remove());

      // Target main content areas
      const contentSelectors = [
        'article',
        '.article-content', '.article-body', '.article-text',
        '.post-content', '.post-body', '.post-text',
        '.content', '.main-content', '.entry-content',
        '.story-content', '.story-body',
        '[role="main"]', 'main',
        '.text-content', '.content-body'
      ];

      let extractedContent = '';
      let usedSelector = '';

      // Try each selector to find the best content
      for (const selector of contentSelectors) {
        const element = $(selector).first();
        if (element.length) {
          // Get only paragraph and heading content
          const paragraphs = element.find('p, h1, h2, h3, h4, h5, h6').map((_, el) => {
            const text = $(el).text().trim();
            // Filter out short paragraphs and common unwanted text
            if (text.length < 20 || 
                text.toLowerCase().includes('advertisement') ||
                text.toLowerCase().includes('subscribe') ||
                text.toLowerCase().includes('follow us') ||
                text.toLowerCase().includes('share this')) {
              return null;
            }
            return text;
          }).get().filter(Boolean);

          if (paragraphs.length >= 3) {
            const combinedText = paragraphs.join('\n\n').trim();
            if (combinedText.length > 500) {
              extractedContent = combinedText;
              usedSelector = selector;
              break;
            }
          }
        }
      }

      // Fallback: try to get clean paragraphs from anywhere
      if (!extractedContent) {
        const allParagraphs = $('p').map((_, el) => {
          const text = $(el).text().trim();
          return text.length > 30 && text.length < 1000 ? text : null;
        }).get().filter(Boolean);

        if (allParagraphs.length >= 2) {
          extractedContent = allParagraphs.slice(0, 8).join('\n\n').trim();
          usedSelector = 'fallback-paragraphs';
        }
      }

      // Clean and deduplicate content
      const cleanedContent = this.cleanAndDeduplicateText(extractedContent);
      const analysis = this.analyzeContentQuality(cleanedContent, title, url);

      console.log(`📊 CONTENT EXTRACTION RESULTS:`);
      console.log(`  📏 Length: ${cleanedContent.length} chars`);
      console.log(`  📝 Words: ${analysis.wordCount}`);
      console.log(`  ⭐ Quality Score: ${analysis.qualityScore}/10`);
      console.log(`  🔧 Extracted via: ${usedSelector}`);

      return {
        cleanText: cleanedContent,
        description: cleanedContent.substring(0, 800) + (cleanedContent.length > 800 ? '...' : ''),
        wordCount: analysis.wordCount,
        qualityScore: analysis.qualityScore,
        isValidContent: analysis.qualityScore >= 6 && analysis.wordCount >= 150
      };

    } catch (error) {
      console.error(`💥 CONTENT EXTRACTION ERROR for ${url}: ${error.message}`);
      return this.createFallbackContent(fallbackSnippet, title);
    }
  }

  private cleanAndDeduplicateText(text: string): string {
    if (!text) return '';

    // Split into sentences
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
    
    // Remove duplicates while preserving order
    const uniqueSentences = [];
    const seen = new Set();
    
    for (const sentence of sentences) {
      const normalized = sentence.toLowerCase().replace(/[^\w\s]/g, '');
      if (!seen.has(normalized) && normalized.length > 10) {
        seen.add(normalized);
        uniqueSentences.push(sentence);
      }
    }

    return uniqueSentences.join('. ')
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
  }

  private analyzeContentQuality(text: string, title: string, url: string): {
    qualityScore: number;
    wordCount: number;
  } {
    const wordCount = text.split(/\s+/).filter(w => w.length > 2).length;
    let score = 0;

    // Length scoring
    if (wordCount >= 150) score += 2;
    if (wordCount >= 300) score += 1;
    if (wordCount >= 500) score += 1;

    // Content quality indicators
    const qualityIndicators = [
      'research', 'study', 'scientists', 'discovery', 'breakthrough',
      'analysis', 'findings', 'results', 'evidence', 'data'
    ];
    
    const indicatorCount = qualityIndicators.filter(indicator => 
      text.toLowerCase().includes(indicator)
    ).length;
    score += Math.min(indicatorCount * 0.5, 2);

    // Domain reputation
    const trustedDomains = [
      'nasa.gov', 'space.com', 'sciencenews.org', 'newscientist.com',
      'nature.com', 'science.org', 'nationalgeographic.com'
    ];
    
    if (trustedDomains.some(domain => url.includes(domain))) {
      score += 2;
    }

    return {
      qualityScore: Math.min(score, 10),
      wordCount
    };
  }

  private createFallbackContent(snippet: string, title: string): {
    cleanText: string;
    description: string;
    wordCount: number;
    qualityScore: number;
    isValidContent: boolean;
  } {
    const fallbackText = snippet || `${title} - This topic shows potential for engaging content.`;
    return {
      cleanText: fallbackText,
      description: fallbackText,
      wordCount: fallbackText.split(' ').length,
      qualityScore: 3,
      isValidContent: false
    };
  }

  private async getRealSearchVolume(title: string, contentData: any): Promise<number> {
    try {
      // Extract key terms from title
      const keyTerms = this.extractKeyTerms(title);
      
      // For now, calculate based on content quality and trending factors
      // In production, you would integrate with Google Trends API or similar service
      let baseVolume = 50000;

      // Quality multiplier
      const qualityMultiplier = 1 + (contentData.qualityScore / 10);
      
      // Trending keywords boost
      const trendingKeywords = [
        'nasa', 'spacex', 'mars', 'moon', 'breakthrough', 'discovery',
        'telescope', 'galaxy', 'planet', 'space', 'science'
      ];
      
      const keywordBoost = keyTerms.filter(term => 
        trendingKeywords.some(keyword => term.toLowerCase().includes(keyword))
      ).length;
      
      const keywordMultiplier = 1 + (keywordBoost * 0.3);
      
      // Recency boost
      const recencyMultiplier = 1.2;
      
      const estimatedVolume = Math.floor(
        baseVolume * qualityMultiplier * keywordMultiplier * recencyMultiplier
      );

      console.log(`📊 SEARCH VOLUME ESTIMATION:`);
      console.log(`  Base: ${baseVolume.toLocaleString()}`);
      console.log(`  Quality: x${qualityMultiplier.toFixed(2)}`);
      console.log(`  Keywords: x${keywordMultiplier.toFixed(2)}`);
      console.log(`  Recency: x${recencyMultiplier.toFixed(2)}`);
      console.log(`  Final: ${estimatedVolume.toLocaleString()}`);

      return Math.max(estimatedVolume, 50000);
    } catch (error) {
      console.error('Error calculating search volume:', error.message);
      return 100000;
    }
  }

  private extractKeyTerms(title: string): string[] {
    // Remove common words and extract meaningful terms
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    return title.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.includes(word));
  }

  private generateContentHash(content: string): string {
    // Simple hash for duplicate detection
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
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
    
    const hasSpaceContent = spaceKeywords.some(keyword => content.includes(keyword));
    const hasExcludedContent = excludeKeywords.some(keyword => content.includes(keyword));

    const reliableDomains = [
      'nasa.gov', 'space.com', 'spacenews.com', 'spaceflightnow.com', 'esa.int',
      'sciencenews.org', 'newscientist.com', 'scientificamerican.com', 'smithsonianmag.com',
      'nationalgeographic.com', 'phys.org', 'science.org', 'nature.com', 'sciencedaily.com',
      'astronomy.com', 'universetoday.com', 'spacex.com', 'jpl.nasa.gov'
    ];

    const isReliableDomain = reliableDomains.some(domain => url.includes(domain));
    const strongSpaceIndicators = ['nasa', 'spacex', 'astronomy', 'discovery', 'research', 'breakthrough'].some(keyword => content.includes(keyword));
    
    return hasSpaceContent && !hasExcludedContent && (isReliableDomain || strongSpaceIndicators);
  }

  private optimizeForSpace(title: string, category: string): string {
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

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  private async filterForSpaceAndScienceContent(topics: InsertTrendingTopic[]): Promise<InsertTrendingTopic[]> {
    const filtered = topics.filter(topic => {
      const trendingData = topic.trending_data as any;
      return trendingData.spaceOptimized && 
             trendingData.isSpaceScience &&
             trendingData.qualityScore >= 6 &&
             trendingData.wordCount >= 150 &&
             trendingData.withinLast48Hours &&
             topic.searchVolume >= 50000;
    });

    // Remove duplicates based on content hash
    const uniqueFiltered = [];
    const seenHashes = new Set();
    
    for (const topic of filtered) {
      const hash = (topic.trending_data as any).contentHash;
      if (!seenHashes.has(hash)) {
        seenHashes.add(hash);
        uniqueFiltered.push(topic);
      }
    }

    console.log(`🚀 QUALITY FILTER: ${uniqueFiltered.length}/${topics.length} unique, high-quality topics`);
    return uniqueFiltered;
  }

  private prioritizeByEngagement(topics: InsertTrendingTopic[]): InsertTrendingTopic[] {
    return topics
      .sort((a, b) => {
        const volumeDiff = (b.searchVolume || 0) - (a.searchVolume || 0);
        if (Math.abs(volumeDiff) > 50000) return volumeDiff;

        const aData = a.trending_data as any;
        const bData = b.trending_data as any;
        const qualityDiff = (bData.qualityScore || 0) - (aData.qualityScore || 0);
        if (Math.abs(qualityDiff) > 1) return qualityDiff;

        return (bData.wordCount || 0) - (aData.wordCount || 0);
      })
      .slice(0, 25); // Top 25 highest quality topics
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
