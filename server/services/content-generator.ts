import { GoogleGenerativeAI } from '@google/generative-ai';
import { storage } from '../storage';
import type { TrendingTopic, ContentJob } from '@shared/schema';

export class ContentGenerator {
  private gemini: GoogleGenerativeAI;

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  async generateScript(topic: TrendingTopic, videoType: 'long_form' | 'short'): Promise<string> {
    try {
      const prompt = this.createPrompt(topic, videoType);
      
      // Use OpenAI GPT-4o (the newest OpenAI model released May 13, 2024. do not change this unless explicitly requested by the user)
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: this.getSystemPrompt(videoType)
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: videoType === 'long_form' ? 4000 : 1000,
        temperature: 0.7
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result.script || this.getFallbackScript(topic, videoType);
      
    } catch (error) {
      console.error('OpenAI script generation error:', error);
      return this.getFallbackScript(topic, videoType);
    }
  }

  private createPrompt(topic: TrendingTopic, videoType: 'long_form' | 'short'): string {
    const duration = videoType === 'long_form' ? '8-12 minutes' : '45-60 seconds';
    const audience = 'Indian and global audience interested in ' + topic.category;
    
    return `
Create a ${duration} ${videoType} video script about: "${topic.title}"

Topic Details:
- Description: ${topic.description}
- Category: ${topic.category}
- Search Volume: ${topic.searchVolume.toLocaleString()}
- Priority: ${topic.priority}

Requirements:
1. Target audience: ${audience}
2. Tone: Engaging, informative, conversational (human-like, not robotic)
3. Structure: Hook → Main content → Call to action
4. Include specific facts, statistics, and examples
5. Make it suitable for professional video editing with visual cues
6. Include natural pauses for animation/effect placement
7. End with engagement prompts (like, subscribe, comment)

${videoType === 'long_form' ? `
For long-form content:
- Break into 3-4 main sections
- Include detailed explanations and examples
- Add storytelling elements
- Include multiple engagement hooks throughout
` : `
For YouTube Shorts:
- Grab attention in first 3 seconds
- One clear main message
- Quick facts and statistics
- Strong visual storytelling
- Trending hashtags suggestion
`}

Return JSON format: {"script": "your_script_here", "visual_cues": ["cue1", "cue2"], "hashtags": ["#tag1", "#tag2"]}
    `;
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
      return `🔥 BREAKING: ${topic.title}

Did you know ${topic.description}? 

This is HUGE for India and here's why...

[Visual cue: Show key statistics]

The impact on everyday Indians is incredible because:
✅ Point 1
✅ Point 2  
✅ Point 3

What do you think? Drop your thoughts below! 
👇 FOLLOW for more trending updates
#India #Trending #${topic.category}`;
    } else {
      return `Welcome back to our channel! Today we're diving deep into ${topic.title}.

[INTRO - Hook]
You won't believe what's happening in ${topic.category} right now. ${topic.description}

[MAIN CONTENT]
Let me break this down for you:

First, let's understand the background...
[Visual cue: Show timeline/infographic]

The key points you need to know:
1. [Point 1 with explanation]
2. [Point 2 with examples]
3. [Point 3 with impact analysis]

[CONCLUSION]
So what does this mean for us? The implications are far-reaching...

Don't forget to LIKE this video if it helped you understand ${topic.category} better, SUBSCRIBE for more trending topics, and let me know in the COMMENTS what topic you'd like us to cover next!

#${topic.category} #India #Trending`;
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
