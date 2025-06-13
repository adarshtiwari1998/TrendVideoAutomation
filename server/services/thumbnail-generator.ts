
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { storage } from '../storage';
import type { ContentJob } from '@shared/schema';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

export class ThumbnailGenerator {
  private gemini: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || 'dev-mock-gemini-key';
    this.gemini = new GoogleGenerativeAI(apiKey);
    console.log('ThumbnailGenerator initialized');
  }

  async generateThumbnail(jobId: number): Promise<string> {
    try {
      const job = await storage.getContentJobById(jobId);
      if (!job) throw new Error('Job not found');

      await storage.updateContentJob(jobId, { 
        status: 'thumbnail_generation', 
        progress: 80 
      });

      console.log(`🖼️ Creating professional YouTube thumbnail for: ${job.title}`);

      const thumbnailPath = await this.createYouTubeThumbnail(job);

      await storage.updateContentJob(jobId, { 
        thumbnailPath,
        status: 'thumbnail_generation',
        progress: 90 
      });

      await storage.createActivityLog({
        type: 'generation',
        title: 'YouTube Thumbnail Created',
        description: `Created professional thumbnail for "${job.title}"`,
        status: 'success',
        metadata: { jobId, thumbnailPath, videoType: job.videoType }
      });

      console.log('✅ YouTube-compatible thumbnail created:', thumbnailPath);
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

  private async createYouTubeThumbnail(job: ContentJob): Promise<string> {
    const thumbnailDir = path.join(process.cwd(), 'generated', 'thumbnails');
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    const thumbnailPath = path.join(thumbnailDir, `${job.id}_youtube_thumbnail.jpg`);
    const category = job.metadata?.category || 'general';

    // Create professional YouTube thumbnail using FFmpeg
    await this.createProfessionalThumbnail(job, thumbnailPath, category);

    // Verify thumbnail is YouTube compatible
    await this.validateYouTubeThumbnail(thumbnailPath);

    return thumbnailPath;
  }

  private async createProfessionalThumbnail(job: ContentJob, outputPath: string, category: string): Promise<void> {
    console.log('🎨 Creating professional thumbnail with FFmpeg...');

    // Get background image for category
    const backgroundPath = await this.getBackgroundImage(category);
    
    // Determine dimensions based on video type
    const dimensions = job.videoType === 'short' ? '1080x1920' : '1280x720';
    const isVertical = job.videoType === 'short';

    // Create thumbnail title - limit to 60 characters for readability
    const thumbnailTitle = this.createThumbnailTitle(job.title);

    // Build FFmpeg command for professional thumbnail
    const ffmpegCommand = this.buildThumbnailCommand(
      backgroundPath,
      thumbnailTitle,
      outputPath,
      dimensions,
      category,
      isVertical
    );

    try {
      execSync(ffmpegCommand, { stdio: 'pipe' });
      console.log('✅ Professional thumbnail created with FFmpeg');
    } catch (error) {
      console.error('FFmpeg thumbnail creation failed:', error);
      // Fallback to simple thumbnail
      await this.createFallbackThumbnail(outputPath, thumbnailTitle, dimensions, category);
    }
  }

  private buildThumbnailCommand(
    backgroundPath: string,
    title: string,
    outputPath: string,
    dimensions: string,
    category: string,
    isVertical: boolean
  ): string {
    const [width, height] = dimensions.split('x').map(Number);
    const fontSize = isVertical ? Math.min(80, width / 12) : Math.min(60, width / 20);
    const titleY = isVertical ? height * 0.15 : height * 0.2;
    
    // Get category-specific colors
    const colors = this.getCategoryColors(category);
    
    // Escape title for FFmpeg
    const escapedTitle = title.replace(/'/g, "\\'").replace(/"/g, '\\"');

    return `ffmpeg -i "${backgroundPath}" ` +
      `-vf "scale=${dimensions}:force_original_aspect_ratio=increase,crop=${dimensions},` +
      `drawtext=text='${escapedTitle}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:` +
      `fontsize=${fontSize}:fontcolor=${colors.text}:x=(w-text_w)/2:y=${titleY}:` +
      `bordercolor=${colors.border}:borderw=4:shadowcolor=black:shadowx=2:shadowy=2,` +
      `drawbox=x=0:y=${titleY - 20}:w=w:h=${fontSize + 40}:color=${colors.bg}@0.7:t=fill"` +
      ` -frames:v 1 -q:v 2 "${outputPath}" -y`;
  }

  private async getBackgroundImage(category: string): Promise<string> {
    const backgroundDir = path.join(process.cwd(), 'generated', 'backgrounds');
    if (!fs.existsSync(backgroundDir)) {
      fs.mkdirSync(backgroundDir, { recursive: true });
    }

    const backgroundPath = path.join(backgroundDir, `${category}_bg.jpg`);

    // Check if background already exists
    if (fs.existsSync(backgroundPath)) {
      return backgroundPath;
    }

    try {
      // Get high-quality background from Unsplash
      const keywords = this.getCategoryKeywords(category);
      const imageUrl = `https://source.unsplash.com/1920x1080/?${encodeURIComponent(keywords)}`;
      
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      fs.writeFileSync(backgroundPath, response.data);
      
      console.log(`✅ Downloaded background for ${category}`);
      return backgroundPath;
    } catch (error) {
      console.warn('Failed to download background, creating solid color:', error.message);
      return await this.createSolidBackground(category, backgroundPath);
    }
  }

  private async createSolidBackground(category: string, outputPath: string): Promise<string> {
    const color = this.getCategoryColors(category).bg;
    
    try {
      // Try FFmpeg first
      const ffmpegCommand = `ffmpeg -f lavfi -i "color=${color}:size=1920x1080:duration=1" "${outputPath}" -y`;
      execSync(ffmpegCommand, { stdio: 'pipe' });
      return outputPath;
    } catch (ffmpegError) {
      console.warn('FFmpeg not available for background creation, using ImageMagick fallback...');
      
      try {
        // Try ImageMagick as fallback
        execSync(`convert -size 1920x1080 xc:"${color}" "${outputPath}"`, { stdio: 'pipe' });
        return outputPath;
      } catch (magickError) {
        console.warn('ImageMagick not available, creating minimal image file...');
        
        // Final fallback: create a minimal JPEG file programmatically
        return await this.createMinimalImage(outputPath, color);
      }
    }
  }

  private async createFallbackThumbnail(outputPath: string, title: string, dimensions: string, category: string): Promise<void> {
    const colors = this.getCategoryColors(category);
    const escapedTitle = title.replace(/'/g, "\\'");
    
    // Create simple but professional looking thumbnail
    const ffmpegCommand = `ffmpeg -f lavfi -i "color=${colors.bg}:size=${dimensions}:duration=1" ` +
      `-vf "drawtext=text='${escapedTitle}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:` +
      `fontsize=48:fontcolor=${colors.text}:x=(w-text_w)/2:y=(h-text_h)/2:` +
      `bordercolor=${colors.border}:borderw=3" ` +
      `-frames:v 1 -q:v 2 "${outputPath}" -y`;
    
    execSync(ffmpegCommand, { stdio: 'pipe' });
  }

  private createThumbnailTitle(originalTitle: string): string {
    // Optimize title for thumbnail readability
    let title = originalTitle.replace(/[^\w\s!?-]/g, '').trim();
    
    if (title.length > 60) {
      title = title.substring(0, 57) + '...';
    }

    // Make it more clickable
    if (!title.includes('!') && !title.includes('?')) {
      title = title + '!';
    }

    return title.toUpperCase();
  }

  private getCategoryKeywords(category: string): string {
    const keywords = {
      technology: 'technology innovation digital modern',
      sports: 'sports action dynamic stadium',
      business: 'business corporate professional success',
      politics: 'government politics news serious',
      health: 'healthcare medical wellness clean',
      environment: 'nature environment green sustainability',
      science: 'science research laboratory discovery'
    };
    
    return keywords[category] || 'professional modern background';
  }

  private getCategoryColors(category: string): any {
    const colorSchemes = {
      technology: { bg: '#1e40af', text: '#ffffff', border: '#000000' },
      sports: { bg: '#dc2626', text: '#ffffff', border: '#000000' },
      business: { bg: '#059669', text: '#ffffff', border: '#000000' },
      politics: { bg: '#7c2d12', text: '#ffffff', border: '#000000' },
      health: { bg: '#0891b2', text: '#ffffff', border: '#000000' },
      environment: { bg: '#166534', text: '#ffffff', border: '#000000' },
      science: { bg: '#581c87', text: '#ffffff', border: '#000000' }
    };
    
    return colorSchemes[category] || { bg: '#1f2937', text: '#ffffff', border: '#000000' };
  }

  private async validateYouTubeThumbnail(thumbnailPath: string): Promise<void> {
    try {
      // Check file exists and has reasonable size
      const stats = fs.statSync(thumbnailPath);
      
      if (stats.size < 1000) {
        throw new Error('Thumbnail file too small');
      }

      if (stats.size > 2 * 1024 * 1024) {
        // Compress if larger than 2MB (YouTube limit)
        await this.compressThumbnail(thumbnailPath);
      }

      console.log('✅ Thumbnail validated for YouTube compatibility');
    } catch (error) {
      throw new Error(`Thumbnail validation failed: ${error.message}`);
    }
  }

  private async compressThumbnail(thumbnailPath: string): Promise<void> {
    const compressedPath = thumbnailPath.replace('.jpg', '_compressed.jpg');
    
    const ffmpegCommand = `ffmpeg -i "${thumbnailPath}" -q:v 8 "${compressedPath}" -y`;
    
    try {
      execSync(ffmpegCommand, { stdio: 'pipe' });
      fs.renameSync(compressedPath, thumbnailPath);
      console.log('✅ Thumbnail compressed for YouTube compatibility');
    } catch (error) {
      console.warn('Thumbnail compression failed:', error.message);
    }
  }

  private async createMinimalImage(outputPath: string, color: string): Promise<string> {
    try {
      // Create a minimal valid JPEG file with solid color
      // This is a very basic 1x1 pixel JPEG that we'll reference as a thumbnail
      const minimalJPEG = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
        0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
        0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
        0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
        0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xFF, 0xC4, 0x00, 0x14,
        0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x08, 0xFF, 0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C, 0x03, 0x01, 0x00, 0x02,
        0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x8A, 0x28, 0xFF, 0xD9
      ]);
      
      await fs.writeFile(outputPath, minimalJPEG);
      console.log(`📱 Created minimal thumbnail fallback: ${outputPath}`);
      return outputPath;
    } catch (error) {
      throw new Error(`Failed to create minimal image: ${error.message}`);
    }
  }
}

export const thumbnailGenerator = new ThumbnailGenerator();
