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
      const cleanedScript = this.cleanAndFilterScript(text);
      
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

  private cleanAndFilterScript(rawText: string): string {
    // Remove Gemini's meta-commentary and system responses
    let cleaned = rawText
      // Remove JSON wrapper if it exists but keep the content
      .replace(/^```json\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      // Remove Gemini's explanatory text at the beginning
      .replace(/^Here's a.*?script.*?[:.][\s\n]*/i, '')
      .replace(/^I'll create.*?for you.*?[:.][\s\n]*/i, '')
      .replace(/^This script.*?includes.*?[:.][\s\n]*/i, '')
      .replace(/^I'll.*?script.*?[:.][\s\n]*/i, '')
      .replace(/^Sure.*?here.*?[:.][\s\n]*/i, '')
      .replace(/^Certainly.*?[:.][\s\n]*/i, '')
      // Remove system notes
      .replace(/Note:.*?\n/gi, '')
      .replace(/Remember:.*?\n/gi, '')
      .replace(/Important:.*?\n/gi, '')
      // Remove system instructions that leaked through
      .replace(/Return JSON format:.*$/i, '')
      .replace(/\{"script":\s*"/i, '')
      .replace(/",\s*"visual_cues":.*$/i, '')
      // Remove meta instructions
      .replace(/Write ONLY.*?\./gi, '')
      .replace(/Structure.*?:/gi, '')
      .replace(/STRICT REQUIREMENTS.*?\./gi, '')
      // Clean up multiple newlines and spaces
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

    // If it looks like JSON, try to extract just the script content
    if (cleaned.includes('"script"')) {
      try {
        const jsonMatch = cleaned.match(/\{"script":\s*"(.*?)"/s);
        if (jsonMatch) {
          cleaned = jsonMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }
      } catch (e) {
        // Continue with text cleaning
      }
    }

    // If the cleaned text is still system-like, return empty to trigger fallback
    if (cleaned.length < 100 || 
        /^(I'll|I'm|Here's|This is|Sure|Certainly)/i.test(cleaned) ||
        cleaned.includes('API') || 
        cleaned.includes('Gemini') ||
        cleaned.includes('model')) {
      console.warn('⚠️ Detected system text in cleaned script, returning empty for fallback');
      return '';
    }

    return cleaned;
  }

  private validateAndCleanScript(script: string): string {
    // Ensure the script is actual content, not system messages
    const invalidPatterns = [
      /^(I'll|I'm|Here's|This is)/i,
      /^(Sure|Certainly|Of course)/i,
      /^(Let me|I can)/i,
      /(API|Gemini|model|generate|create)/i
    ];

    // Check if script contains invalid patterns at the start
    for (const pattern of invalidPatterns) {
      if (pattern.test(script.substring(0, 100))) {
        console.warn('⚠️ Detected system text in script, using fallback');
        return '';
      }
    }

    // Clean the script content
    return script
      .replace(/\[.*?\]/g, '') // Remove stage directions
      .replace(/\(.*?\)/g, '') // Remove parenthetical notes
      .replace(/^\s*[-*]\s*/gm, '') // Remove bullet points
      .replace(/^Step \d+:.*$/gm, '') // Remove step indicators
      .replace(/^\d+\.\s*/gm, '') // Remove numbered lists
      .split('\n')
      .filter(line => line.trim().length > 0)
      .filter(line => !line.match(/^(Note:|Remember:|Important:)/i))
      .join('\n')
      .trim();
  }

  private createPrompt(topic: TrendingTopic, videoType: 'long_form' | 'short'): string {
    const duration = videoType === 'long_form' ? '8-12 minutes' : '45-60 seconds';
    
    return `
You are a YouTube content creator making a ${duration} video about "${topic.title}".

Topic details: ${topic.description}
Category: ${topic.category}

Start speaking directly to your audience right now. Begin with an engaging hook and provide the actual content they came to learn about.

${videoType === 'long_form' ? `
Your video should be 600-800 words covering:
- Compelling opening hook
- Detailed explanation with facts and examples  
- Real-world applications and impact
- Engaging conclusion with call to action

Make it educational, entertaining, and valuable for viewers interested in ${topic.category}.
` : `
Your video should be 150-200 words covering:
- Immediate attention-grabbing opening
- Key facts and insights quickly delivered
- Strong, memorable conclusion

Make it fast-paced, informative, and perfect for short-form content.
`}

Write the complete script as if you're speaking directly to your YouTube audience. Use natural conversational tone that works well for Indian English speakers.
    `;
  }

  private getIntelligentFallbackScript(topic: TrendingTopic, videoType: 'long_form' | 'short'): string {
    // Create intelligent content based on topic details
    const { title, description, category } = topic;
    
    if (videoType === 'short') {
      return `Breaking news about ${title}! 

This development in ${category} is absolutely significant. ${description}

Here's what makes this important: This breakthrough affects millions of people and represents a major advancement in the field.

The implications are far-reaching. Industry experts are calling this a game-changer that could transform how we approach ${category}.

What's particularly exciting is the potential for real-world applications. This discovery opens up new possibilities and solutions to existing challenges.

This is just the beginning. We're witnessing history in the making with ${title}.

What are your thoughts on this development? Share in the comments below! Don't forget to like and subscribe for more breaking news and trending topics!`;
    } else {
      return `Welcome back! Today we're diving deep into something truly remarkable: ${title}.

This breakthrough in ${category} represents a significant advancement that deserves our attention. ${description}

Let me break this down for you. The significance of this development cannot be overstated. It's the result of years of research and represents a major step forward in our understanding.

The technical aspects are fascinating. Researchers have made discoveries that challenge conventional thinking and open up entirely new possibilities. This isn't just theoretical - it has real-world applications that could benefit millions of people.

From a global perspective, this development comes at a crucial time. With the challenges we face today, innovations like this offer hope and concrete solutions.

Industry experts are already discussing the potential impact. We're looking at applications in multiple sectors, from technology to healthcare to environmental solutions.

The economic implications alone are significant. This could create new markets, reduce costs, and generate substantial opportunities for growth and development.

Looking ahead, the next few years will be critical. The transition from research to practical implementation will determine how quickly we can realize the benefits of this breakthrough.

What excites me most is the potential for unexpected applications. Often, the most impactful uses of new discoveries are ones nobody initially predicted.

This represents more than just scientific progress - it's a testament to human ingenuity and our capacity for innovation.

The implications extend far beyond ${category}, potentially affecting how we approach challenges across multiple fields.

I encourage you to stay informed about developments in this area. The pace of progress is accelerating, and new discoveries are happening regularly.

What are your thoughts on this breakthrough? How do you think it might affect your life or work? I'd love to hear your perspectives in the comments.

If you found this analysis valuable, please give this video a thumbs up. And if you haven't already, subscribe and hit the notification bell for more in-depth coverage of science and innovation.

Thank you for watching, and I'll see you in the next video!`;
    }
  }

  private getSystemPrompt(videoType: 'long_form' | 'short'): string {
    return `You are a professional YouTube content creator specializing in ${videoType} videos for Indian and global audiences. 

Your expertise:
- Creating viral, engaging content that resonates with Indian viewers
- Understanding cultural nuances and current trends
- Crafting scripts that work well with AI video generation
- Optimizing for YouTube algorithm and audience retention
- Balancing entertainment with information

Writing style:
- Conversational and relatable
- Use storytelling techniques
- Include cultural references when appropriate
- Avoid overly formal or academic language
- Natural flow that sounds human when converted to speech
- Strategic placement of pauses for visual elements`;
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

    const script = await this.generateScript(selectedTopic, videoType);
    const title = this.generateVideoTitle(selectedTopic, videoType);

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
        targetDuration: videoType === 'long_form' ? '8-12 minutes' : '45-60 seconds'
      }
    });

    await storage.createActivityLog({
      type: 'generation',
      title: 'Script Generated Successfully',
      description: `Created ${videoType} script for "${selectedTopic.title}"`,
      status: 'success',
      metadata: { jobId: job.id, videoType, topicTitle: selectedTopic.title }
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
}

export const contentGenerator = new ContentGenerator();
