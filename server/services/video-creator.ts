import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { storage } from '../storage';
import { textToSpeechService } from './text-to-speech';
import { FFmpegInstaller } from './ffmpeg-installer';

const execAsync = promisify(exec);

export class VideoCreator {
  private outputDir = path.join(process.cwd(), 'temp', 'videos');
  private assetsDir = path.join(process.cwd(), 'temp', 'assets');

  constructor() {
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(this.assetsDir, { recursive: true });
  }

  async createVideo(jobId: number): Promise<string> {
    try {
      // Fetch job details
      const jobData = await storage.getContentJobById(jobId);
      
      if (!jobData) {
        throw new Error(`Job ${jobId} not found`);
      }

      // Ensure FFmpeg is available
      const ffmpegAvailable = await FFmpegInstaller.ensureFFmpeg();

      console.log(`🎬 Starting video creation for job ${jobData.id}`);

      if (ffmpegAvailable) {
        // Create audio from script
        const audioPath = await this.generateAudio(jobData.script, jobId);

        // Generate visual content
        const visualPath = await this.createVisualContent(jobData, audioPath);

        // Combine audio and visuals
        const editedPath = await this.applyProfessionalEditing(visualPath, audioPath, jobData);

        // Final encoding and optimization
        const finalPath = await this.finalizeVideo(editedPath, jobData);

        console.log(`✅ Video created successfully: ${finalPath}`);
        return finalPath;
      } else {
        // Fallback: create simple audio-only content
        console.log('🔄 Using fallback video creation method');
        return await this.createFallbackVideo(jobData.script, jobId);
      }
    } catch (error) {
      console.error(`❌ Video creation failed for job ${jobId}:`, error);
      throw error;
    }
  }

  private async createFallbackVideo(script: string, jobId: number): Promise<string> {
    try {
      // Try to generate audio first
      let audioPath;
      try {
        audioPath = await this.generateAudio(script, jobId);
        console.log('📱 Created audio-only content (fallback mode)');
        return audioPath;
      } catch (audioError) {
        console.warn('⚠️ Audio generation failed, creating text-only video:', audioError.message);
        
        // Create a simple text-based video without audio
        return await this.createTextOnlyVideo(script, jobId);
      }
    } catch (error) {
      console.error('Fallback video creation failed:', error);
      throw error;
    }
  }

  private async createTextOnlyVideo(script: string, jobId: number): Promise<string> {
    try {
      const outputPath = path.join(this.outputDir, `text_only_${jobId}.txt`);
      
      // Create a text file with the script content
      const content = `Video Script for Job ${jobId}\n\n${script}\n\nNote: This is a text-only fallback due to TTS unavailability.`;
      
      await fs.writeFile(outputPath, content, 'utf8');
      
      console.log('📝 Created text-only content as final fallback');
      return outputPath;
    } catch (error) {
      console.error('Text-only video creation failed:', error);
      throw error;
    }
  }

  private async generateAudio(script: string, jobId: number): Promise<string> {
    try {
      // Use enhanced TTS with natural Indian accent
      const audioPath = await textToSpeechService.generateSpeech({
        text: script,
        outputPath: path.join(this.outputDir, `audio_${jobId}.mp3`),
        voice: 'en-IN-Wavenet-A', // Indian English female voice
        speed: 0.95,
        pitch: 0.0
      });

      // Enhance audio quality with noise reduction and normalization
      const enhancedAudioPath = path.join(this.outputDir, `audio_enhanced_${jobId}.mp3`);

      await execAsync(`ffmpeg -i "${audioPath}" ` +
        `-af "highpass=f=200,lowpass=f=3000,dynaudnorm=f=500:g=31,volume=1.2" ` +
        `-b:a 128k "${enhancedAudioPath}" -y`);

      return enhancedAudioPath;
    } catch (error) {
      console.error('Audio generation failed:', error);
      throw error;
    }
  }

  private async createVisualContent(job: any, audioPath: string): Promise<string> {
    try {
      // Get audio duration for video length
      const { stdout } = await execAsync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`);
      const duration = parseFloat(stdout.trim());

      const isShort = job.videoType === 'short';
      const dimensions = isShort ? '1080:1920' : '1920:1080'; // Portrait for shorts, landscape for long

      // Create dynamic background with animated gradients
      const backgroundPath = await this.createDynamicBackground(job.id, duration, isShort);

      // Add animated text overlays with script content
      const textOverlayPath = await this.addTextOverlays(backgroundPath, job.script, duration, isShort);

      // Add engaging visual elements
      const visualEffectsPath = await this.addVisualEffects(textOverlayPath, duration, isShort);

      return visualEffectsPath;
    } catch (error) {
      console.error('Visual content creation failed:', error);
      throw error;
    }
  }

  private async createDynamicBackground(jobId: number, duration: number, isShort: boolean): Promise<string> {
    const outputPath = path.join(this.outputDir, `background_${jobId}.mp4`);
    const dimensions = isShort ? '1080:1920' : '1920:1080';

    // Create animated gradient background with particle effects
    const command = `ffmpeg -f lavfi -i color=c=0x1a1a2e:size=${dimensions}:duration=${duration}:rate=30 ` +
      `-vf "` +
      `geq=` +
      `r='128+128*sin(2*PI*t/10+x/50+y/50)':` +
      `g='128+128*sin(2*PI*t/8+x/40+y/60)':` +
      `b='128+128*sin(2*PI*t/12+x/60+y/40)',` +
      `noise=alls=20:allf=t+u,` +
      `fade=in:0:30,fade=out:${Math.max(0, duration*30-30)}:30` +
      `" -c:v libx264 -preset medium -crf 23 "${outputPath}" -y`;

    await execAsync(command);
    return outputPath;
  }

  private async addTextOverlays(backgroundPath: string, script: string, duration: number, isShort: boolean): Promise<string> {
    const outputPath = path.join(this.outputDir, `with_text_${Date.now()}.mp4`);

    // Split script into segments for dynamic text display
    const sentences = script.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const segmentDuration = duration / sentences.length;

    let textFilters = '';
    const fontSize = isShort ? 48 : 36;
    const maxWidth = isShort ? 900 : 1200;

    sentences.forEach((sentence, index) => {
      const startTime = index * segmentDuration;
      const endTime = (index + 1) * segmentDuration;
      const escapedText = sentence.trim().replace(/'/g, "'").replace(/"/g, '\\"');

      if (index > 0) textFilters += ',';

      textFilters += `drawtext=text='${escapedText}':` +
        `fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:` +
        `fontsize=${fontSize}:fontcolor=white:` +
        `x=(w-text_w)/2:y=${isShort ? 'h*0.7' : 'h*0.8'}:` +
        `bordercolor=black:borderw=3:` +
        `shadowcolor=black:shadowx=2:shadowy=2:` +
        `enable='between(t,${startTime},${endTime})':` +
        `textw=${maxWidth}`;
    });

    const command = `ffmpeg -i "${backgroundPath}" ` +
      `-vf "${textFilters}" ` +
      `-c:v libx264 -preset medium -crf 23 "${outputPath}" -y`;

    await execAsync(command);
    return outputPath;
  }

  private async addVisualEffects(inputPath: string, duration: number, isShort: boolean): Promise<string> {
    const outputPath = path.join(this.outputDir, `with_effects_${Date.now()}.mp4`);

    // Add zoom, pan, and transition effects
    const effectsFilter = [
      // Slow zoom effect
      `zoompan=z='min(zoom+0.0015,1.5)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`,

      // Color correction and enhancement
      `eq=contrast=1.2:brightness=0.05:saturation=1.3`,

      // Subtle motion blur for professional look
      `convolution=0 -1 0 -1 5 -1 0 -1 0:0 -1 0 -1 5 -1 0 -1 0:0 -1 0 -1 5 -1 0 -1 0:0 -1 0 -1 5 -1 0 -1 0:5:5:5:5:0:128:128:128`,

      // Film grain for cinematic feel
      `noise=alls=3:allf=t+u`
    ].join(',');

    const command = `ffmpeg -i "${inputPath}" ` +
      `-vf "${effectsFilter}" ` +
      `-c:v libx264 -preset medium -crf 21 "${outputPath}" -y`;

    await execAsync(command);
    return outputPath;
  }

  private async applyProfessionalEditing(visualPath: string, audioPath: string, job: any): Promise<string> {
    const outputPath = path.join(this.outputDir, `edited_${job.id}.mp4`);
    const isShort = job.videoType === 'short';

    // Professional color grading and audio mixing
    const videoFilters = [
      // Professional color grading (cinematic look)
      'colorbalance=rs=0.1:gs=-0.1:bs=-0.2:rm=0.2:gm=0.0:bm=-0.1:rh=0.1:gh=0.0:bh=-0.1',

      // Lens correction and vignette
      'lenscorrection=cx=0.5:cy=0.5:k1=-0.227:k2=-0.022',
      'vignette=PI/4',

      // Final sharpening
      'unsharp=5:5:1.0:5:5:0.0'
    ].join(',');

    const audioFilters = [
      // Audio enhancement
      'highpass=f=80',
      'lowpass=f=10000',
      'dynaudnorm=f=500:g=31',
      'volume=0.9'
    ].join(',');

    const command = `ffmpeg -i "${visualPath}" -i "${audioPath}" ` +
      `-vf "${videoFilters}" ` +
      `-af "${audioFilters}" ` +
      `-c:v libx264 -preset slow -crf 20 ` +
      `-c:a aac -b:a 128k ` +
      `-shortest "${outputPath}" -y`;

    await execAsync(command);
    return outputPath;
  }

  private async finalizeVideo(inputPath: string, job: any): Promise<string> {
    const finalPath = path.join(this.outputDir, `final_${job.id}.mp4`);
    const isShort = job.videoType === 'short';

    // Final optimization for YouTube upload
    const command = `ffmpeg -i "${inputPath}" ` +
      `-c:v libx264 -preset slow -crf 18 ` +
      `-maxrate ${isShort ? '8M' : '15M'} -bufsize ${isShort ? '16M' : '30M'} ` +
      `-c:a aac -b:a 192k -ar 48000 ` +
      `-pix_fmt yuv420p ` +
      `-movflags +faststart ` +
      `"${finalPath}" -y`;

    await execAsync(command);

    // Verify the output file
    const stats = await fs.stat(finalPath);
    if (stats.size === 0) {
      throw new Error('Generated video file is empty');
    }

    return finalPath;
  }

  async getVideoInfo(videoPath: string): Promise<any> {
    try {
      const { stdout } = await execAsync(`ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`);
      return JSON.parse(stdout);
    } catch (error) {
      console.error('Failed to get video info:', error);
      return null;
    }
  }

  async cleanup(jobId: number): Promise<void> {
    try {
      const tempFiles = await fs.readdir(this.outputDir);
      const jobFiles = tempFiles.filter(file => file.includes(`_${jobId}`));

      for (const file of jobFiles) {
        await fs.unlink(path.join(this.outputDir, file));
      }

      console.log(`Cleaned up ${jobFiles.length} temporary files for job ${jobId}`);
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }
}

export const videoCreator = new VideoCreator();