
import { GoogleGenerativeAI } from '@google/generative-ai';
import { storage } from '../storage';
import type { TrendingTopic, ContentJob } from '@shared/schema';

export class ContentGenerator {
  private gemini: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey && process.env.NODE_ENV === 'production') {
      throw new Error("GEMINI_API_KEY environment variable is required in production");
    }

    // Use mock key for development if not set
    this.gemini = new GoogleGenerativeAI(apiKey || 'dev-mock-gemini-key');
    console.log('ContentGenerator initialized with API key:', apiKey ? 'CONFIGURED' : 'MOCK_MODE');
  }

  async generateScript(topic: TrendingTopic, videoType: 'long_form' | 'short'): Promise<string> {
    console.log(`🤖 Generating ${videoType} script for topic: ${topic.title}`);

    try {
      const prompt = this.createPrompt(topic, videoType);
      console.log('📝 Created prompt, calling Gemini API...');

      const model = this.gemini.getGenerativeModel({ model: "gemini-1.5-pro" });

      const result = await model.generateContent([
        this.getSystemPrompt(videoType),
        prompt
      ]);

      const response = await result.response;
      const text = response.text();

      console.log('✅ Gemini API response received, length:', text.length);

      // Clean and filter the content to remove Gemini's own commentary
      const cleanedScript = this.cleanAndFilterScript(text, topic, videoType);

      // Try to parse JSON response first
      try {
        const parsed = JSON.parse(cleanedScript);
        console.log('📄 Parsed JSON response successfully');
        return this.validateAndCleanScript(parsed.script || cleanedScript);
      } catch {
        console.log('📄 Using cleaned plain text response');
        return this.validateAndCleanScript(cleanedScript);
      }

    } catch (error) {
      console.error('❌ Gemini script generation error:', error.message);
      console.log('🔄 Using intelligent fallback script generation...');
      return this.getIntelligentFallbackScript(topic, videoType);
    }
  }

  private cleanAndFilterScript(rawScript: string, topic: TrendingTopic, videoType: 'long_form' | 'short'): string {
    console.log(`🧹 Cleaning raw script for ${videoType} video...`);
    console.log(`📊 Raw script length: ${rawScript.length} characters`);

    if (!rawScript || rawScript.trim().length < 50) {
      console.warn('⚠️ Script too short or empty, using fallback');
      return '';
    }

    // Remove all non-content elements and AI commentary
    let cleaned = rawScript
      // Remove AI system responses and instructions
      .replace(/^(I'll create|I'll help|I'll generate|Here's a|Here's the|Sure, I can|Certainly).*$/gm, '')
      .replace(/^\s*\[.*?\]\s*$/gm, '') // Remove stage directions
      .replace(/^\s*\(.*?\)\s*$/gm, '') // Remove parenthetical notes
      .replace(/^\s*\*\*.*?\*\*\s*$/gm, '') // Remove markdown formatting
      .replace(/^\s*#{1,6}\s+.*$/gm, '') // Remove markdown headers
      .replace(/^\s*[-*•]\s+/gm, '') // Remove bullet points
      .replace(/^(Note:|Remember:|Important:|Warning:|Meta:|System:).*$/gm, '') // Remove system notes
      .replace(/^\d+\.\s*/gm, '') // Remove numbered lists
      .replace(/\(upbeat.*?\)/gi, '') // Remove music/sound cues
      .replace(/\[.*?\]/g, '') // Remove all bracketed content
      .replace(/\(.*?\)/g, '') // Remove all parenthetical content
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 15 && // Keep only substantial lines
               !trimmed.match(/^(transcript|script|content|video|audio):/i) && // Remove labels
               !trimmed.match(/^(welcome to|thanks for watching|don't forget to)/i); // Remove generic phrases
      })
      .join(' ')
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Ensure proper sentence structure for TTS
    cleaned = cleaned
      .replace(/([.!?])\s*([a-z])/g, '$1 $2') // Space after punctuation
      .replace(/([a-zA-Z])([A-Z])/g, '$1. $2') // Add periods between sentences
      .replace(/\s+/g, ' ') // Final whitespace cleanup
      .replace(/([a-zA-Z])\s*$/g, '$1.'); // Add period at end

    console.log(`✅ Cleaned script length: ${cleaned.length} characters`);

    const words = cleaned.split(' ').filter(w => w.length > 2);
    const estimatedDuration = words.length / 2.5; // ~2.5 words per second
    console.log(`📊 Word count: ${words.length}, Estimated speech duration: ${Math.round(estimatedDuration)}s`);

    if (videoType === 'long_form') {
      // For long-form videos: minimum 10 minutes (1500 words)
      if (words.length >= 1500 && estimatedDuration >= 600) {
        console.log(`✅ Long-form script validated: ${Math.round(estimatedDuration/60)} minutes`);
        return cleaned;
      } else {
        console.warn(`⚠️ Long-form script too short (${Math.round(estimatedDuration/60)} min), extending with intelligent content`);
        // Generate more content based on the original topic
        const extension = this.generateExtensiveContent(topic, cleaned);
        return cleaned + ' ' + extension;
      }
    } else {
      // For short videos: minimum 2 minutes (300 words)
      if (words.length >= 300 && estimatedDuration >= 120) {
        console.log(`✅ Short script validated: ${Math.round(estimatedDuration)} seconds`);
        return cleaned;
      } else {
        console.warn(`⚠️ Short script too short (${Math.round(estimatedDuration)}s), extending with focused content`);
        const extension = this.generateFocusedContent(topic, cleaned);
        return cleaned + ' ' + extension;
      }
    }
  }

  private validateAndCleanScript(script: string): string {
    console.log(`🔍 Validating script: "${script.substring(0, 100)}..."`);

    if (!script || script.trim().length < 50) {
      console.warn('⚠️ Empty or very short script received');
      return '';
    }

    // Light validation - only remove obvious system responses
    const systemPatterns = [
      /^(I'll create|I'll help|I'll generate)/i,
      /^(Here's a script|Here's the script)/i,
      /^(Sure, I can|Certainly, I can)/i,
    ];

    let isSystemResponse = false;
    for (const pattern of systemPatterns) {
      if (pattern.test(script.substring(0, 50))) {
        console.warn('⚠️ Detected AI system response, extracting content...');
        isSystemResponse = true;
        break;
      }
    }

    // If it's a system response, try to extract the actual script content
    if (isSystemResponse) {
      // Look for script content after common AI response patterns
      const contentMatch = script.match(/(?:script|content):\s*["']?(.*?)["']?$/is) ||
                          script.match(/(?:here's|here is)\s+(?:the\s+)?(?:script|content):\s*(.*)/is) ||
                          script.match(/\n\n(.*)/s);

      if (contentMatch && contentMatch[1]) {
        script = contentMatch[1].trim();
        console.log('✅ Extracted script content from AI response');
      } else {
        console.warn('⚠️ Could not extract script content');
        return '';
      }
    }

    // Minimal cleaning to preserve content
    let cleaned = script
      .replace(/^\s*["'`]/g, '') // Remove leading quotes
      .replace(/["'`]\s*$/g, '') // Remove trailing quotes
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Ensure proper sentence structure for TTS
    cleaned = cleaned
      .replace(/([.!?])\s*([a-z])/g, '$1 $2') // Space after punctuation
      .replace(/\s+/g, ' ') // Final whitespace cleanup
      .replace(/([a-zA-Z])\s*$/g, '$1.'); // Add period at end

    console.log(`✅ Minimally cleaned script length: ${cleaned.length} characters`);

    // Very basic validation - just ensure we have some content
    if (cleaned.length < 100) {
      console.warn('⚠️ Script too short after cleaning');
      return '';
    }

    const words = cleaned.split(' ').filter(w => w.length > 2);
    const estimatedDuration = words.length / 2.5; // ~2.5 words per second
    console.log(`📊 Word count: ${words.length}, Estimated speech duration: ${Math.round(estimatedDuration)}s`);

    return cleaned;
  }

  private createPrompt(topic: TrendingTopic, videoType: 'long_form' | 'short'): string {
    const duration = videoType === 'long_form' ? '10-15 minutes' : '2-3 minutes';
    const wordCount = videoType === 'long_form' ? '1500-2000 words' : '300-400 words';

    return `
Create a ${duration} YouTube video script about "${topic.title}".

ORIGINAL CONTENT: ${topic.description}
CATEGORY: ${topic.category}

SCRIPT REQUIREMENTS:
- Write EXACTLY ${wordCount} of pure, informative content
- Use simple, clear language that anyone can understand
- Be engaging and conversational like talking to a friend
- Cover ALL key information from the original content
- Remove any fluff, filler, or unnecessary commentary
- Focus on facts, explanations, and useful insights

${videoType === 'long_form' ? `
LONG-FORM STRUCTURE (1500-2000 words):
1. Brief engaging introduction (50 words)
2. Background and context explanation (200-300 words)
3. Main content broken into 5-6 detailed sections (1000-1200 words)
4. Real-world implications and impact (150-200 words)
5. Future outlook and predictions (100-150 words)
6. Conclusion with key takeaways (50-100 words)

EXPAND EACH SECTION WITH:
- Detailed explanations of concepts
- Multiple examples and analogies
- Different perspectives and viewpoints
- Practical applications and benefits
- Expert opinions and research findings
- Historical context where relevant
` : `
SHORT-FORM STRUCTURE (300-400 words):
1. Hook and introduction (30-50 words)
2. Main explanation of the topic (180-250 words)
3. Why it matters and implications (50-80 words)
4. Conclusion and call to action (20-30 words)

FOCUS ON:
- Core facts and key points
- Simple explanations
- Practical relevance
- Clear benefits or impact
`}

CONTENT QUALITY RULES:
- Extract valuable information from the original content
- Explain complex ideas in simple terms
- Use everyday examples people can relate to
- Maintain accuracy while being accessible
- Include specific details and facts
- Avoid generic statements or filler content

OUTPUT: Provide ONLY the script content - no stage directions, music cues, or formatting instructions. Write as if speaking directly to the audience.
    `;
  }

  private generateExtensiveContent(topic: TrendingTopic, existingContent: string): string {
    // Generate comprehensive content for long-form videos (10+ minutes)
    const { title, description, category } = topic;
    
    return `Let me break this down into more detail for you. ${description} This discovery is particularly significant because it represents a major breakthrough in ${category}. 

To understand why this matters, we need to look at the bigger picture. For years, researchers have been working on this exact problem, and now we finally have a solution that could change everything.

The scientific process behind this breakthrough is fascinating. Teams of experts from around the world collaborated to gather data, run experiments, and analyze results. What they found exceeded all expectations.

This discovery has several important implications. First, it solves long-standing problems that have puzzled scientists for decades. Second, it opens up new possibilities for future research and development. Third, it could lead to practical applications that benefit millions of people.

Let's talk about the real-world impact. In the healthcare field, this could revolutionize how we approach treatment and prevention. In technology, it might lead to more efficient and powerful devices. In environmental science, it could help us better understand and protect our planet.

The economic implications are equally impressive. This breakthrough could create new industries, generate jobs, and drive innovation across multiple sectors. Companies are already investing billions of dollars to develop applications based on this discovery.

From a global perspective, this represents human ingenuity at its finest. It shows what we can achieve when we work together toward common goals. Countries around the world are now collaborating to ensure this discovery benefits everyone.

Looking toward the future, this is just the beginning. The next five to ten years will be crucial as we move from laboratory success to real-world implementation. The challenges are significant, but so is the potential for positive change.

What makes this particularly exciting is the potential for unexpected applications. Often, the most impactful uses of new discoveries are ones that nobody initially predicted. We might see innovations that completely transform how we live and work.

This breakthrough also highlights the importance of continued investment in research and education. It shows that when we support science and innovation, we create opportunities for discoveries that can change the world.

The international scientific community is buzzing with excitement about the possibilities. Researchers are already planning follow-up studies and exploring new directions inspired by this work.

In conclusion, this discovery represents a turning point in ${category}. It demonstrates the power of human curiosity, determination, and collaboration. As we move forward, it will be exciting to see how this breakthrough shapes our future and creates new opportunities for generations to come.`;
  }

  private generateFocusedContent(topic: TrendingTopic, existingContent: string): string {
    // Generate focused content for short videos (2+ minutes)
    const { title, description, category } = topic;
    
    return `Here's why this matters to you. ${description} This breakthrough in ${category} could directly impact your daily life in ways you might not expect.

The research behind this discovery involved cutting-edge technology and innovative approaches that have never been tried before. What makes it special is how it solves real problems that affect millions of people.

Think about the practical applications. This could lead to better products, more efficient services, and solutions to challenges we face every day. The potential is enormous.

Industry experts are calling this a game-changer. It represents years of hard work and collaboration between top researchers from around the world. The timing couldn't be better, as we're facing many global challenges that need innovative solutions.

What's really exciting is how this discovery opens doors to future innovations. It's like finding a key that unlocks new possibilities we never knew existed. The next few years will be incredibly interesting as we see how this gets implemented.

This breakthrough also shows the importance of investing in science and research. When we support innovation, we create opportunities for discoveries that can improve life for everyone.

So what can you expect moving forward? Keep an eye on developments in this field, because this is just the beginning. The applications and benefits will likely extend far beyond what we can imagine today.`;
  }

  private getIntelligentFallbackScript(topic: TrendingTopic, videoType: 'long_form' | 'short'): string {
    // Create intelligent content based on topic details
    const { title, description, category } = topic;

    if (videoType === 'short') {
      return `Hello friends! Today something really interesting happened. Let me tell you about ${title} in a super simple way.

So basically, what happened is this: ${description}. But what does this mean for us? Let me explain it like this.

Imagine you have a big puzzle, and scientists just found a very important piece! This piece helps us understand ${category} much better than before.

Why should you care? Well, think of it like this - when smart people discover new things, it can make our lives better in many ways. This discovery might help solve problems we face every day.

Here's the cool part: This could change how we do things in the future. It's like when someone invented the smartphone - it changed everything!

The best part is, this is just the beginning. More amazing discoveries are coming, and they will make our world even better.

What do you think about this? Tell me in the comments! And don't forget to like this video and subscribe for more simple explanations of amazing discoveries!`;
    } else {
      return `Hello everyone! Welcome back to our channel. Today I'm going to tell you about something really amazing that happened recently. It's about ${title}, and I'm going to explain it in the simplest way possible.

First, let me tell you what actually happened. ${description}. Now, I know this might sound complicated, but let me break it down for you step by step.

Think of it like this - you know how sometimes you learn something new that changes how you see the world? That's exactly what happened here. Scientists and researchers discovered something in ${category} that nobody knew before.

But why is this important? Let me give you a simple example. Imagine you've been trying to solve a really hard puzzle for years. Then suddenly, you find the missing piece that makes everything clear. That's what this discovery is like.

Now, let's talk about what this means for you and me. This breakthrough could change many things in our daily lives. It's like when the internet was invented - nobody knew back then how much it would change everything we do.

Here's what makes this discovery so special. First, it solves problems that people have been working on for a very long time. Second, it opens up new possibilities that we never thought were possible before. And third, it could make life better for millions of people around the world.

Let me explain how this might affect you personally. In the future, because of this discovery, things that are difficult today might become much easier. Problems that seem impossible to solve might have simple solutions.

The amazing thing is, this is just the beginning. When scientists make one big discovery, it usually leads to many more discoveries. It's like opening a door to a room full of treasures.

From a bigger picture, this discovery comes at a perfect time. Our world faces many challenges today, and new discoveries like this give us hope and new ways to solve these challenges.

The people who study this field are very excited. They say this could lead to new inventions, new ways of doing things, and new opportunities for everyone.

What's really exciting is thinking about what comes next. The next few years are going to be very interesting as we see how this discovery gets used in real life.

But here's the best part - often, the most amazing uses of new discoveries are things nobody even thought of at first. So there might be surprises waiting for us that are even better than what we can imagine now.

This discovery shows us something important about humans - we never stop learning, we never stop trying to make things better, and we never give up on solving difficult problems.

The effects of this discovery will probably go far beyond just ${category}. It might change how we think about many different things and help us solve problems in areas we haven't even thought of yet.

I really encourage you to keep learning about this topic. The world of science and discovery is moving very fast these days, and there are always new and exciting things happening.

So, what do you think about all this? Do you think this discovery will make a big difference in your life? How do you think it might change things in the future? I really want to hear your thoughts, so please share them in the comments below.

If this explanation helped you understand this topic better, please give this video a thumbs up. It really helps me know that you're enjoying the content. And if you want to see more videos where I explain complicated things in simple ways, please subscribe to our channel and ring the notification bell.

Thank you so much for watching today. I really appreciate you taking the time to learn something new with me. I'll see you in the next video with more amazing discoveries explained simply!`;
    }
  }

  private getSystemPrompt(videoType: 'long_form' | 'short'): string {
    return `You are a master content creator who specializes in making complex news and information extremely simple and easy to understand. Your unique skill is taking complicated topics and explaining them so clearly that even a young child can follow along.

Your core principles:
- SIMPLICITY FIRST: Use the simplest words possible
- COMPLETE COVERAGE: Never skip important information, but explain it simply
- CHILD-FRIENDLY: Write as if explaining to a curious 2-year-old
- COMPREHENSIVE: Cover all key points without overwhelming
- ENGAGING: Keep it interesting and conversational
- CLEAR AUDIO: Perfect for text-to-speech conversion

Your writing style:
- Use everyday language and simple vocabulary
- Break complex ideas into bite-sized pieces
- Use analogies from daily life (like comparing things to toys, food, family)
- Short, clear sentences that flow naturally
- Friendly, warm tone like talking to a younger sibling
- Explain technical terms immediately in simple words
- Use phrases like "imagine if...", "it's like when...", "think about..."
- Perfect rhythm for audio narration

Your mission: Transform any complex news story into a simple, complete, and engaging explanation that preserves all important information while being accessible to everyone.`;
  }

  private getFallbackScript(topic: TrendingTopic, videoType: 'long_form' | 'short'): string {
    if (videoType === 'short') {
      // Generate script for 2-minute duration (approximately 300 words)
      return `🔥 BREAKING NEWS: ${topic.title}

Friends, you won't believe what's happening right now in ${topic.category}. This is absolutely mind-blowing and will change everything we know about this topic.

Let me tell you exactly what's going on. ${topic.description}

This development is revolutionary because it affects millions of people worldwide. The implications are staggering when you really think about it.

Here's what makes this so important:

First, this breakthrough solves problems that have puzzled experts for years. Scientists and researchers are calling it a game-changer.

Second, the practical applications are endless. From everyday technology to major industrial processes, everything could be transformed.

Third, the timing couldn't be better. With current global challenges, this discovery offers hope and new possibilities.

But here's what really excites me - the potential for innovation is unlimited. We're looking at the beginning of a new era in ${topic.category}.

What do you think about this development? Drop your thoughts in the comments below! 

Don't forget to LIKE this video if you found it informative, and SUBSCRIBE for more breaking news and trending topics!

#${topic.category} #BreakingNews #Trending #Innovation`;
    } else {
      // Generate script for 10-minute duration (approximately 1500 words)
      return `Welcome back to our channel, friends! I'm thrilled to share with you today something absolutely extraordinary that's happening in the world of ${topic.category}. 

Today we're diving deep into ${topic.title}, and I promise you, by the end of this video, you'll have a completely new perspective on this fascinating topic.

[INTRODUCTION - Setting the Stage]

Before we begin, let me ask you something. Have you ever wondered how breakthroughs in ${topic.category} actually happen? Most people think it's just luck or sudden inspiration, but the reality is far more complex and interesting.

What we're discussing today represents years of research, countless experiments, and the dedication of brilliant minds working tirelessly to push the boundaries of human knowledge.

${topic.description} - and this is just the beginning of an incredible story.

[MAIN CONTENT - The Deep Dive]

Let me break this down into digestible pieces so you can really understand the magnitude of what we're dealing with here.

First, let's understand the historical context. For decades, experts in ${topic.category} have been working towards this exact breakthrough. The journey hasn't been easy - there have been countless setbacks, failed experiments, and moments when even the most optimistic researchers questioned whether this was possible.

But persistence pays off, and here we are today, witnessing something that will be remembered as a turning point in the field.

The scientific principles behind this discovery are fascinating. Without getting too technical, let me explain the core concepts that make this possible. The researchers utilized cutting-edge methodologies and innovative approaches that nobody had tried before.

What makes this particularly exciting is how it builds upon previous work while simultaneously challenging conventional wisdom. It's the perfect example of how scientific progress happens - not in isolation, but as part of a continuous chain of discoveries.

[REAL-WORLD IMPLICATIONS]

Now, you might be wondering, "This sounds amazing, but how does it actually affect my daily life?" That's an excellent question, and the answer might surprise you.

The applications of this breakthrough extend far beyond the laboratory. We're looking at potential improvements in technology, healthcare, environmental solutions, and even economic opportunities.

Imagine a world where the problems we face today in ${topic.category} become things of the past. That's not science fiction - that's the potential future we're looking at with this development.

Industry experts are already discussing how this could revolutionize manufacturing processes, reduce costs, and create entirely new markets. The economic impact alone could be in the billions of dollars.

[GLOBAL PERSPECTIVE]

From a global standpoint, this discovery couldn't come at a better time. With the challenges our world faces today - climate change, resource scarcity, technological limitations - breakthroughs like this offer hope and concrete solutions.

Countries around the world are already investing heavily in related research, recognizing that this could give them a significant competitive advantage in the coming decades.

The collaboration between international research teams has been remarkable. It shows what humanity can achieve when we work together towards common goals.

[FUTURE OUTLOOK]

Looking ahead, the next five to ten years will be crucial in determining how quickly we can move from laboratory success to real-world implementation. The challenges are significant, but so is the potential.

Researchers are already working on the next phase of development, addressing practical concerns like scalability, cost-effectiveness, and safety protocols.

What excites me most is the potential for unexpected applications. Often, the most impactful uses of new discoveries are ones that nobody initially predicted.

[CONCLUSION]

So, what does all this mean for us? We're witnessing history in the making. This breakthrough in ${topic.title} represents more than just scientific progress - it's a testament to human ingenuity and our endless capacity for innovation.

The implications stretch far beyond ${topic.category}, potentially affecting how we approach challenges in multiple fields. We're at the beginning of a new chapter in human advancement.

I encourage you to stay informed about developments in this area. The pace of progress is accelerating, and new discoveries are happening regularly.

What are your thoughts on this breakthrough? Do you think it will live up to its potential? How do you see it affecting your life or work? I'd love to hear your perspectives in the comments below.

If you found this deep dive valuable, please give this video a thumbs up. It really helps me know what content resonates with you. And if you're not already subscribed, hit that subscribe button and ring the notification bell so you never miss our latest content.

Thank you for joining me today, and I'll see you in the next video where we'll continue exploring the fascinating world of science and innovation!

#${topic.category} #Science #Innovation #Breakthrough #Technology #Future`;
    }
  }

  async createContentJob(topicId: number, videoType: 'long_form' | 'short'): Promise<ContentJob> {
    const topic = await storage.getTrendingTopics(100);
    const selectedTopic = topic.find(t => t.id === topicId);

    if (!selectedTopic) {
      throw new Error('Topic not found');
    }

    console.log(`📝 Original content for topic ${topicId}:`, selectedTopic.description);
    console.log(`📋 Topic title: ${selectedTopic.title}`);
    console.log(`🏷️ Category: ${selectedTopic.category}`);

    // Use full extracted content if available from trending_data
    let originalContent = selectedTopic.description;
    let hasFullContent = false;

    try {
      if (selectedTopic.trending_data && typeof selectedTopic.trending_data === 'object') {
        const trendingData = selectedTopic.trending_data as any;
        if (trendingData.fullContent && trendingData.fullContent.length > originalContent.length) {
          originalContent = trendingData.fullContent;
          hasFullContent = true;
          console.log(`📰 Using full extracted content: ${originalContent.length} characters`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not parse trending_data, using description');
    }

    if (!hasFullContent) {
      console.log(`📄 Using topic description: ${originalContent.length} characters`);
    }

    // Create enhanced topic object with full content for script generation
    const enhancedTopic = {
      ...selectedTopic,
      description: originalContent,
      hasFullContent: hasFullContent
    };

    const script = await this.generateScript(enhancedTopic, videoType);
    const title = this.generateVideoTitle(enhancedTopic, videoType);

    const job = await storage.createContentJob({
      topicId,
      videoType,
      title,
      script,
      status: 'script_generation',
      progress: 25,
      metadata: {
        topic: selectedTopic.title,
        category: selectedTopic.category,
        originalContent: originalContent,
        hasFullContent: hasFullContent,
        targetDuration: videoType === 'long_form' ? '10-15 minutes' : '45-60 seconds'
      }
    });

    // Calculate script metrics
    const wordCount = script.split(' ').filter(w => w.length > 2).length;
    const estimatedDuration = wordCount * 60 / 150; // ~150 words per minute

    console.log(`✅ Storing original content: ${originalContent.length} characters (${hasFullContent ? 'FULL' : 'SNIPPET'})`);
    console.log(`✅ Generated script: ${script.length} characters`);

    // Create pipeline log for script generation completion with both original and final content
    await storage.createPipelineLog({
      jobId: job.id,
      step: 'script_generation',
      status: 'completed',
      message: `Script generation completed successfully${hasFullContent ? ' (using full extracted content)' : ' (using snippet content)'}`,
      details: `Generated ${wordCount} words for ${videoType} video from ${hasFullContent ? 'full article content' : 'topic description'}`,
      progress: 100,
      metadata: {
        finalScript: script,
        originalContent: originalContent,
        hasFullContent: hasFullContent,
        wordCount,
        estimatedDuration,
        topicTitle: selectedTopic.title,
        contentTransformation: {
          originalLength: originalContent.length,
          finalLength: script.length,
          expansion: script.length > originalContent.length ? 'expanded' : 'condensed',
          contentType: hasFullContent ? 'full_article' : 'snippet'
        }
      }
    });

    await storage.createActivityLog({
      type: 'generation',
      title: 'Script Generated Successfully',
      description: `Created ${videoType} script for "${selectedTopic.title}"${hasFullContent ? ' (full content)' : ' (snippet)'}`,
      status: 'success',
      metadata: { 
        jobId: job.id, 
        videoType, 
        topicTitle: selectedTopic.title,
        finalScript: script,
        originalContent: originalContent,
        hasFullContent: hasFullContent,
        wordCount,
        estimatedDuration
      }
    });

    return job;
  }

  private generateVideoTitle(topic: TrendingTopic, videoType: 'long_form' | 'short'): string {
    const titles = {
      long_form: [
        `${topic.title}: Complete Analysis & Impact`,
        `Everything You Need to Know About ${topic.title}`,
        `BREAKING: ${topic.title} - Full Story Explained`,
        `${topic.title}: The Truth Behind the Headlines`
      ],
      short: [
        `🔥 ${topic.title} - Quick Facts!`,
        `SHOCKING: ${topic.title} in 60 Seconds`,
        `${topic.title} - You Won't Believe This!`,
        `VIRAL: ${topic.title} Explained`
      ]
    };

    const options = titles[videoType];
    return options[Math.floor(Math.random() * options.length)];
  }

  private enhanceScriptForNaturalSpeech(script: string): string {
    // Minimal enhancement to preserve content and prevent TTS issues
    if (!script || script.length < 50) {
      console.warn('⚠️ Script too short or empty');
      return script;
    }

    console.log(`📝 Original script length: ${script.length} characters`);

    // Clean the script for TTS compatibility
    let enhanced = script
      .replace(/[^\w\s.,!?'-]/g, ' ') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Add simple intro only if missing
    if (!enhanced.toLowerCase().includes('hello') && !enhanced.toLowerCase().includes('welcome')) {
      enhanced = `Hello everyone, welcome back to our channel. ${enhanced}`;
    }

    // Add simple outro only if missing
    if (!enhanced.toLowerCase().includes('subscribe') && !enhanced.toLowerCase().includes('thank you')) {
      enhanced += ` Thank you for watching! Please like and subscribe for more content.`;
    }

    console.log(`✅ Enhanced script length: ${enhanced.length} characters`);
    console.log(`📝 Estimated duration: ~${Math.ceil(enhanced.length / 15)} seconds`);

    return enhanced;
  }
}

export const contentGenerator = new ContentGenerator();
