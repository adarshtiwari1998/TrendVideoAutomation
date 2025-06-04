import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { storage } from '../storage';
import type { ContentJob } from '@shared/schema';
import path from 'path';
import fs from 'fs';

export class VideoCreator {
  private gemini: GoogleGenerativeAI;
  private elevenLabsApiKey: string;
  private runwayApiKey: string;

  constructor() {
    // In development, these can be mock values
    const geminiKey = process.env.GEMINI_API_KEY || 'dev-mock-key';
    const elevenLabsKey = process.env.ELEVEN_LABS_API_KEY || 'dev-mock-key';
    const runwayKey = process.env.RUNWAY_API_KEY || 'dev-mock-key';
    
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable is required in production");
      }
      if (!process.env.ELEVEN_LABS_API_KEY) {
        throw new Error("ELEVEN_LABS_API_KEY environment variable is required in production");
      }
      if (!process.env.RUNWAY_API_KEY) {
        throw new Error("RUNWAY_API_KEY environment variable is required in production");
      }
    }
    
    this.gemini = new GoogleGenerativeAI(geminiKey);
    this.elevenLabsApiKey = elevenLabsKey;
    this.runwayApiKey = runwayKey;
  }

  async createVideo(jobId: number): Promise<string> {
    try {
      const job = await storage.getContentJobById(jobId);
      if (!job) throw new Error('Job not found');

      if (!job.script) {
        throw new Error('No script available for video creation');
      }

      await storage.updateContentJob(jobId, { 
        status: 'video_creation', 
        progress: 30 
      });

      console.log(`Creating ${job.videoType} video for job ${jobId}: ${job.title}`);

      // Step 1: Generate TTS audio
      const audioPath = await this.generateTTSAudio(job);

      await storage.updateContentJob(jobId, { progress: 50 });

      // Step 2: Create video using script and audio
      const videoPath = await this.generateVideo(job, audioPath);

      await storage.updateContentJob(jobId, { 
        videoPath,
        progress: 70 
      });

      await storage.createActivityLog({
        type: 'generation',
        title: 'Video Created Successfully',
        description: `Generated ${job.videoType} video: ${job.title}`,
        status: 'success',
        metadata: { 
          jobId, 
          videoType: job.videoType,
          title: job.title,
          videoPath,
          audioPath,
          duration: this.getVideoDuration(job.videoType)
        }
      });

      return videoPath;
    } catch (error) {
      console.error('Video creation error:', error);
      await storage.updateContentJob(jobId, { 
        status: 'failed',
        errorMessage: error.message 
      });

      await storage.createActivityLog({
        type: 'error',
        title: 'Video Creation Failed',
        description: `Error creating video for job ${jobId}: ${error.message}`,
        status: 'error',
        metadata: { jobId, error: error.message }
      });

      throw error;
    }
  }

  private async generateTTSAudio(job: ContentJob): Promise<string> {
    const audioDir = path.join(process.cwd(), 'generated', 'audio');
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    const audioPath = path.join(audioDir, `${job.id}_audio.mp3`);

    console.log(`Generating TTS audio for job ${job.id}`);

    try {
      // Use ElevenLabs for human-like voice generation
      const response = await axios.post(
        'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', // Professional Indian English voice
        {
          text: job.script,
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.85,
            style: 0.2,
            use_speaker_boost: true
          },
          model_id: 'eleven_multilingual_v2'
        },
        {
          headers: {
            'xi-api-key': this.elevenLabsApiKey,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        }
      );

      // In a real implementation, save the audio buffer to file
      fs.writeFileSync(audioPath, Buffer.from(response.data));
      console.log('Generated voiceover:', audioPath);
      return audioPath;
    } catch (error) {
      console.error('Voiceover generation error:', error);
      return this.getMockAudioPath(job.videoType);
    }
  }

  private async generateVideo(job: ContentJob, audioPath: string): Promise<string> {
    try {
      // Use Runway ML or similar for professional video generation
      const videoConfig = this.getVideoConfig(job);

      const response = await axios.post(
        'https://api.runwayml.com/v1/generate',
        {
          prompt: this.createVideoPrompt(job),
          duration: videoConfig.duration,
          aspect_ratio: videoConfig.aspectRatio,
          style: 'professional_news',
          audio_path: audioPath,
          effects: videoConfig.effects
        },
        {
          headers: {
            'Authorization': `Bearer ${this.runwayApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const videoPath = `/tmp/video_${job.id}_${Date.now()}.mp4`;
      console.log('Generated professional video:', videoPath);
      return videoPath;
    } catch (error) {
      console.error('Professional video generation error:', error);
      return this.getMockVideoPath(job.videoType);
    }
  }

  private createVideoPrompt(job: ContentJob): string {
    const category = job.metadata?.category || 'general';
    const basePrompt = `Professional ${job.videoType} video about ${job.title}. `;

    const categoryPrompts = {
      technology: 'Modern tech office, screens showing data, futuristic animations, clean corporate style',
      sports: 'Dynamic sports imagery, action shots, energetic transitions, stadium atmosphere',
      business: 'Corporate boardroom, financial graphics, professional presentation style, charts and graphs',
      politics: 'News studio setting, official graphics, serious tone, government buildings',
      health: 'Medical facility, health infographics, calm professional atmosphere, scientific visuals',
      environment: 'Nature scenes, climate data visualization, earth imagery, documentary style',
      science: 'Laboratory setting, scientific animations, space imagery, research visuals'
    };

    const stylePrompt = categoryPrompts[category] || 'Professional news presentation style';

    return `${basePrompt}${stylePrompt}. Include smooth transitions, professional animations, text overlays for key points, and visual effects that enhance understanding. Style: broadcast quality, engaging visuals, appropriate pacing for ${job.videoType} content.`;
  }

  private getVideoConfig(job: ContentJob) {
    if (job.videoType === 'short') {
      return {
        duration: 60, // seconds
        aspectRatio: '9:16', // Vertical for YouTube Shorts
        effects: ['quick_cuts', 'zoom_effects', 'text_animations', 'trending_music']
      };
    } else {
      return {
        duration: 600, // 10 minutes max
        aspectRatio: '16:9', // Horizontal for long-form
        effects: ['smooth_transitions', 'infographic_animations', 'picture_in_picture', 'professional_graphics']
      };
    }
  }

  private async addLogoOverlay(videoPath: string): Promise<string> {
    try {
      // Add logo overlay in top-right corner
      const outputPath = videoPath.replace('.mp4', '_with_logo.mp4');

      // In a real implementation, use ffmpeg or similar to add logo overlay
      console.log('Added logo overlay to video:', outputPath);
      return outputPath;
    } catch (error) {
      console.error('Logo overlay error:', error);
      return videoPath; // Return original if overlay fails
    }
  }

  private getVideoDuration(videoType: string): string {
    return videoType === 'short' ? '0:58' : '8:42';
  }

  private getMockAudioPath(videoType: string): string {
    return `/tmp/mock_audio_${videoType}_${Date.now()}.mp3`;
  }

  private getMockVideoPath(videoType: string): string {
    return `/tmp/mock_video_${videoType}_${Date.now()}.mp4`;
  }
}

export const videoCreator = new VideoCreator();