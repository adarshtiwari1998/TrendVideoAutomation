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
      // Get job data to determine video type
      const jobData = await storage.getContentJobById(jobId);
      const isShort = jobData?.videoType === 'short';
      const duration = isShort ? 120 : 600; // 2 minutes for shorts, 10 minutes for long-form
      
      console.log(`🔄 Creating fallback video: ${duration}s duration for ${jobData?.videoType}`);
      
      // Create a proper video file instead of text-only
      return await this.createMinimalVideo(script, jobId, duration, isShort);
    } catch (error) {
      console.error('Fallback video creation failed:', error);
      throw error;
    }
  }

  private async createMinimalVideo(script: string, jobId: number, duration: number, isShort: boolean): Promise<string> {
    try {
      const outputPath = path.join(this.outputDir, `minimal_video_${jobId}.mp4`);
      const dimensions = isShort ? '1080x1920' : '1920x1080';
      
      // Create a minimal video with text overlay and proper duration
      const command = `ffmpeg -f lavfi -i "color=c=#1a1a2e:size=${dimensions}:duration=${duration}:rate=30" ` +
        `-vf "drawtext=text='${script.substring(0, 200).replace(/'/g, "\\'")}...':` +
        `fontsize=48:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:` +
        `bordercolor=black:borderw=2" ` +
        `-c:v libx264 -preset fast -crf 23 ` +
        `-t ${duration} "${outputPath}" -y`;

      await execAsync(command);
      
      // Verify file was created and has proper size
      const stats = await fs.stat(outputPath);
      console.log(`📹 Created minimal video: ${outputPath} (${Math.round(stats.size / 1024)}KB)`);
      
      if (stats.size < 1000) {
        throw new Error('Generated video file is too small');
      }
      
      return outputPath;
    } catch (error) {
      console.error('Minimal video creation failed:', error);
      // Final fallback - create text file
      return await this.createTextOnlyVideo(script, jobId);
    }
  }

  private async createTextOnlyVideo(script: string, jobId: number): Promise<string> {
    try {
      const outputPath = path.join(this.outputDir, `text_only_${jobId}.txt`);
      
      // Create a text file with the script content
      const content = `Video Script for Job ${jobId}\n\n${script}\n\nNote: This is a text-only fallback due to video generation failure.`;
      
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
      // Use natural Indian accent with conversational tone
      const audioPath = await textToSpeechService.generateSpeech({
        text: this.enhanceScriptForNaturalSpeech(script),
        outputPath: path.join(this.outputDir, `audio_${jobId}.mp3`),
        voice: 'en-IN-Neural2-D', // Premium Indian English male voice
        speed: 0.92, // Slightly slower for better comprehension
        pitch: -1.0 // Slightly lower pitch for authority
      });

      // Professional audio enhancement - broadcast quality
      const enhancedAudioPath = path.join(this.outputDir, `audio_enhanced_${jobId}.mp3`);

      await execAsync(`ffmpeg -i "${audioPath}" ` +
        `-af "highpass=f=85,lowpass=f=8000,compand=.3|.3:1|1:-90/-60|-60/-40|-40/-30|-20/-20:6:0:-90:0.2,` +
        `equalizer=f=200:width_type=h:width=100:g=2,` +
        `equalizer=f=1000:width_type=h:width=200:g=1,` +
        `dynaudnorm=f=75:g=25:p=0.95,volume=1.3" ` +
        `-b:a 192k "${enhancedAudioPath}" -y`);

      return enhancedAudioPath;
    } catch (error) {
      console.error('Audio generation failed:', error);
      throw error;
    }
  }

  private enhanceScriptForNaturalSpeech(script: string): string {
    // Add natural pauses and emphasis for Indian speaking style
    let enhanced = script
      .replace(/\. /g, '... ') // Add pauses after sentences
      .replace(/\, /g, ', ') // Natural comma pauses
      .replace(/\! /g, '! ') // Excitement emphasis
      .replace(/\? /g, '? ') // Question emphasis
      .replace(/India/g, 'भारत') // Use Hindi name occasionally
      .replace(/important/g, 'very important') // Add emphasis
      .replace(/amazing/g, 'truly amazing'); // Natural expressions

    // Add natural Indian expressions
    enhanced = `Namaste friends! ${enhanced}`;
    enhanced += ` Thank you for watching, and don't forget to like and subscribe for more updates!`;

    return enhanced;
  }

  private async createVisualContent(job: any, audioPath: string): Promise<string> {
    try {
      // Get audio duration for video length
      const { stdout } = await execAsync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`);
      const duration = parseFloat(stdout.trim());

      const isShort = job.videoType === 'short';
      const dimensions = isShort ? '1080:1920' : '1920:1080';

      // Create professional broadcast-style background
      const backgroundPath = await this.createBroadcastBackground(job, duration, isShort);

      // Add professional lower thirds and text animations
      const textOverlayPath = await this.addProfessionalTextOverlays(backgroundPath, job, duration, isShort);

      // Add broadcast-quality visual effects and transitions
      const visualEffectsPath = await this.addBroadcastEffects(textOverlayPath, duration, isShort);

      // Add professional graphics and branding
      const brandedPath = await this.addProfessionalBranding(visualEffectsPath, job, duration, isShort);

      return brandedPath;
    } catch (error) {
      console.error('Visual content creation failed:', error);
      throw error;
    }
  }

  private async createBroadcastBackground(job: any, duration: number, isShort: boolean): Promise<string> {
    const outputPath = path.join(this.outputDir, `broadcast_bg_${job.id}.mp4`);
    const dimensions = isShort ? '1080x1920' : '1920x1080';
    const category = job.metadata?.category || 'general';

    // Professional news-style animated background
    const command = `ffmpeg -f lavfi ` +
      `-i "color=c=#0a1428:size=${dimensions}:duration=${duration}:rate=30" ` +
      `-f lavfi -i "color=c=#1e3a8a:size=${dimensions}:duration=${duration}:rate=30" ` +
      `-filter_complex "` +
      `[0][1]blend=all_mode=multiply:all_opacity=0.3,` +
      `geq=r='128+64*sin(2*PI*t/15+x/100)':g='64+32*sin(2*PI*t/12+y/80)':b='192+64*sin(2*PI*t/10)',` +
      `noise=alls=15:allf=t+u:c0f=0.2,` +
      `drawgrid=width=iw/20:height=ih/20:thickness=1:color=white@0.05,` +
      `fade=in:0:30:alpha=1,fade=out:${Math.max(0, duration*30-30)}:30:alpha=1` +
      `" -c:v libx264 -preset medium -crf 18 "${outputPath}" -y`;

    await execAsync(command);
    return outputPath;
  }

  private async addProfessionalTextOverlays(backgroundPath: string, job: any, duration: number, isShort: boolean): Promise<string> {
    const outputPath = path.join(this.outputDir, `professional_text_${job.id}.mp4`);
    
    // Split script into meaningful segments
    const sentences = job.script.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const segmentDuration = duration / sentences.length;

    let textFilters = '';
    const fontSize = isShort ? 52 : 42;
    const titleFontSize = isShort ? 72 : 56;

    // Add main title at the beginning
    textFilters += `drawtext=text='${job.title.replace(/'/g, "\\'")}':` +
      `fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:` +
      `fontsize=${titleFontSize}:fontcolor=#FFD700:` +
      `x=(w-text_w)/2:y=${isShort ? 'h*0.15' : 'h*0.12'}:` +
      `bordercolor=#000000:borderw=4:shadowcolor=#000000:shadowx=3:shadowy=3:` +
      `enable='between(t,1,4)',`;

    // Add animated text segments
    sentences.forEach((sentence, index) => {
      const startTime = 4 + (index * segmentDuration); // Start after title
      const endTime = 4 + ((index + 1) * segmentDuration);
      const cleanText = sentence.trim().replace(/'/g, "\\'").replace(/"/g, '\\"');

      textFilters += `drawtext=text='${cleanText}':` +
        `fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:` +
        `fontsize=${fontSize}:fontcolor=#FFFFFF:` +
        `x=(w-text_w)/2:y=${isShort ? 'h*0.75' : 'h*0.82'}:` +
        `bordercolor=#000000:borderw=3:shadowcolor=#000000:shadowx=2:shadowy=2:` +
        `enable='between(t,${startTime},${endTime})':` +
        `alpha='if(lt(t,${startTime+0.5}),(t-${startTime})/0.5,if(gt(t,${endTime-0.5}),(${endTime}-t)/0.5,1))'`;

      if (index < sentences.length - 1) textFilters += ',';
    });

    const command = `ffmpeg -i "${backgroundPath}" ` +
      `-vf "${textFilters}" ` +
      `-c:v libx264 -preset medium -crf 18 "${outputPath}" -y`;

    await execAsync(command);
    return outputPath;
  }

  private async addBroadcastEffects(inputPath: string, duration: number, isShort: boolean): Promise<string> {
    const outputPath = path.join(this.outputDir, `broadcast_effects_${Date.now()}.mp4`);

    // Professional broadcast effects
    const effectsFilter = [
      // Subtle zoom and pan for engagement
      `zoompan=z='if(lte(zoom,1.0),1.5,max(1.001,zoom-0.0015))':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`,
      
      // Professional color grading
      `curves=psfile=/dev/stdin:interp=cubic`,
      `colorbalance=rs=0.1:gs=0.0:bs=-0.1:rm=0.05:gm=0.0:bm=-0.05`,
      
      // Broadcast-style sharpening
      `unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=1.2:chroma_msize_x=3:chroma_msize_y=3:chroma_amount=0.8`,
      
      // Professional noise reduction
      `hqdn3d=2:1:2:1`,
      
      // Subtle vignette for focus
      `vignette=PI/6`,
      
      // Final color enhancement
      `eq=contrast=1.15:brightness=0.02:saturation=1.25:gamma=0.95`
    ].join(',');

    const command = `ffmpeg -i "${inputPath}" ` +
      `-vf "${effectsFilter}" ` +
      `-c:v libx264 -preset slow -crf 16 "${outputPath}" -y`;

    await execAsync(command);
    return outputPath;
  }

  private async addProfessionalBranding(inputPath: string, job: any, duration: number, isShort: boolean): Promise<string> {
    const outputPath = path.join(this.outputDir, `branded_${job.id}.mp4`);

    // Add subscribe button and channel branding
    const brandingFilter = [
      // Channel watermark in corner
      `drawtext=text='YOUR CHANNEL':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:` +
      `fontsize=24:fontcolor=white@0.7:x=w-tw-20:y=20:bordercolor=black@0.5:borderw=2`,

      // Subscribe reminder
      `drawtext=text='SUBSCRIBE for Daily Updates':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:` +
      `fontsize=${isShort ? 28 : 32}:fontcolor=#FF0000:` +
      `x=(w-text_w)/2:y=${isShort ? 'h-100' : 'h-80'}:` +
      `bordercolor=white:borderw=2:enable='between(t,${duration-8},${duration-3})'`
    ].join(',');

    const command = `ffmpeg -i "${inputPath}" ` +
      `-vf "${brandingFilter}" ` +
      `-c:v libx264 -preset medium -crf 18 "${outputPath}" -y`;

    await execAsync(command);
    return outputPath;
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