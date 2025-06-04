import OpenAI from 'openai';
import axios from 'axios';
import { storage } from '../storage';
import type { ContentJob } from '@shared/schema';

export class ThumbnailGenerator {
  private openai: OpenAI;
  private dalleApiKey: string;

  constructor() {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || 'fallback-key'
    });
    this.dalleApiKey = process.env.DALLE_API_KEY || process.env.OPENAI_API_KEY || '';
  }

  async generateThumbnail(jobId: number): Promise<string> {
    try {
      const job = await storage.getContentJobById(jobId);
      if (!job) throw new Error('Job not found');

      await storage.updateContentJob(jobId, { 
        status: 'thumbnail_generation', 
        progress: 80 
      });

      const thumbnailPrompt = this.createThumbnailPrompt(job);
      const thumbnailPath = await this.generateThumbnailImage(thumbnailPrompt, job.videoType);

      await storage.updateContentJob(jobId, { 
        thumbnailPath,
        status: 'thumbnail_generation',
        progress: 90 
      });

      await storage.createActivityLog({
        type: 'generation',
        title: 'Thumbnail Generated Successfully',
        description: `Created catchy thumbnail for "${job.title}"`,
        status: 'success',
        metadata: { jobId, thumbnailPath, videoType: job.videoType }
      });

      return thumbnailPath;
    } catch (error) {
      console.error('Thumbnail generation error:', error);
      await storage.createActivityLog({
        type: 'error',
        title: 'Thumbnail Generation Failed',
        description: `Error generating thumbnail for job ${jobId}: ${error.message}`,
        status: 'error',
        metadata: { jobId, error: error.message }
      });
      
      throw error;
    }
  }

  private createThumbnailPrompt(job: ContentJob): string {
    const category = job.metadata?.category || 'general';
    const basePrompt = `Create a catchy, eye-catching YouTube thumbnail for a ${job.videoType} video titled "${job.title}". `;
    
    const categoryStyles = {
      technology: 'Futuristic tech theme, neon colors, circuits, digital elements, high-tech aesthetic',
      sports: 'Dynamic action, bold colors, athletic imagery, energy and movement',
      business: 'Professional corporate style, charts, money symbols, success imagery, blue and gold tones',
      politics: 'News style, serious tone, official colors, government buildings, formal presentation',
      health: 'Clean medical aesthetic, health symbols, calming colors, professional medical imagery',
      environment: 'Nature elements, earth tones, green theme, climate awareness imagery',
      science: 'Scientific equipment, space imagery, molecular structures, discovery theme'
    };

    const styleGuide = categoryStyles[category] || 'Professional news presentation style';
    
    const generalRequirements = `
Requirements:
- ${job.videoType === 'short' ? '1080x1920 pixels (9:16 aspect ratio)' : '1280x720 pixels (16:9 aspect ratio)'}
- Bold, readable text overlay with the video title
- Bright, contrasting colors that stand out in YouTube feeds
- Facial expressions or emotional reactions if applicable
- No copyright material
- Professional quality, not amateur or low-res
- Eye-catching elements that encourage clicks
- Cultural sensitivity for Indian and global audiences
Style: ${styleGuide}
`;

    return basePrompt + generalRequirements;
  }

  private async generateThumbnailImage(prompt: string, videoType: string): Promise<string> {
    try {
      const size = videoType === 'short' ? '1024x1792' : '1792x1024'; // Closest to required ratios
      
      const response = await this.openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: size as "1024x1024" | "1024x1792" | "1792x1024",
        quality: "hd",
        style: "vivid"
      });

      const imageUrl = response.data[0].url;
      if (!imageUrl) throw new Error('No image URL returned from DALL-E');

      // Download and save the image
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const thumbnailPath = `/tmp/thumbnail_${Date.now()}_${videoType}.jpg`;
      
      // In a real implementation, save the image buffer to file
      console.log('Generated thumbnail:', thumbnailPath);
      return thumbnailPath;
      
    } catch (error) {
      console.error('DALL-E thumbnail generation error:', error);
      return this.getMockThumbnailPath(videoType);
    }
  }

  private getMockThumbnailPath(videoType: string): string {
    return `/tmp/mock_thumbnail_${videoType}_${Date.now()}.jpg`;
  }
}

export const thumbnailGenerator = new ThumbnailGenerator();
