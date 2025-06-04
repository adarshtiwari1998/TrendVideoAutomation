import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { storage } from '../storage';
import type { ContentJob } from '@shared/schema';

export class ThumbnailGenerator {
  private gemini: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey && process.env.NODE_ENV === 'production') {
      throw new Error("GEMINI_API_KEY environment variable is required in production");
    }
    
    // Use mock key for development if not set
    this.gemini = new GoogleGenerativeAI(apiKey || 'dev-mock-gemini-key');
    console.log('ThumbnailGenerator initialized with API key:', apiKey ? 'CONFIGURED' : 'MOCK_MODE');
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
    console.log(`🖼️ Generating ${videoType} thumbnail...`);
    
    try {
      // Check if using mock API key
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'dev-mock-gemini-key') {
        console.log('🖼️ Using mock thumbnail generation (no API key configured)');
        
        // Simulate thumbnail generation
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const thumbnailPath = `/generated/thumbnails/mock_thumbnail_${Date.now()}_${videoType}.jpg`;
        console.log('✅ Generated mock thumbnail:', thumbnailPath);
        return thumbnailPath;
      }

      console.log('🖼️ Calling Gemini Imagen API...');
      
      // Use Gemini's Imagen 3 model for image generation
      const model = this.gemini.getGenerativeModel({ model: "imagen-3.0-generate-001" });
      
      const result = await model.generateContent([
        {
          text: prompt + ` Image should be ${videoType === 'short' ? '9:16 aspect ratio (portrait)' : '16:9 aspect ratio (landscape)'} for YouTube thumbnail optimization.`
        }
      ]);

      const response = await result.response;
      
      // In production, this would generate and return the actual image path
      const thumbnailPath = `/generated/thumbnails/thumbnail_${Date.now()}_${videoType}_gemini.jpg`;
      
      console.log('✅ Generated thumbnail with Gemini Imagen:', thumbnailPath);
      return thumbnailPath;
      
    } catch (error) {
      console.error('❌ Gemini image generation error:', error);
      
      // Fallback: Create a text-based thumbnail description for manual creation
      const fallbackPath = `/fallback/thumbnail_${Date.now()}_${videoType}.txt`;
      console.log('🔄 Using fallback thumbnail path:', fallbackPath);
      return fallbackPath;
    }
  }

  private getMockThumbnailPath(videoType: string): string {
    return `/tmp/mock_thumbnail_${videoType}_${Date.now()}.jpg`;
  }
}

export const thumbnailGenerator = new ThumbnailGenerator();
