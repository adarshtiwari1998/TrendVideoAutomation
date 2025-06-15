import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { storage } from '../storage';
import { textToSpeechService } from './text-to-speech';
import axios from 'axios';

const execAsync = promisify(exec);

export interface VideoSegment {
  text: string;
  startTime: number;
  duration: number;
  animation: 'slideIn' | 'fadeIn' | 'typewriter' | 'scaleIn' | 'bounceIn';
  position: 'center' | 'bottom' | 'top' | 'left' | 'right';
}

export interface VideoScene {
  backgroundImage?: string;
  backgroundVideo?: string;
  segments: VideoSegment[];
  transition: 'fade' | 'slide' | 'zoom' | 'dissolve' | 'wipe';
  effects: string[];
}

export class ProfessionalVideoCreator {
  private outputDir = path.join(process.cwd(), 'temp', 'videos');
  private assetsDir = path.join(process.cwd(), 'temp', 'assets');
  private backgroundsDir = path.join(process.cwd(), 'generated', 'backgrounds');

  constructor() {
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(this.assetsDir, { recursive: true });
    await fs.mkdir(this.backgroundsDir, { recursive: true });
  }

  async createProfessionalVideo(jobId: number): Promise<string> {
    try {
      const jobData = await storage.getContentJobById(jobId);
      if (!jobData) {
        throw new Error(`Job ${jobId} not found`);
      }

      console.log(`🎬 Starting PROFESSIONAL video creation for job ${jobData.id}`);

      const isShort = jobData.videoType === 'short';
      const targetDuration = isShort ? 120 : 600; // 2 min for shorts, 10 min for long-form

      // Step 1: Generate high-quality audio with natural speech
      const audioPath = await this.generateProfessionalAudio(jobData.script, jobId);

      // Step 2: Get actual audio duration
      const actualDuration = await this.getAudioDuration(audioPath);
      console.log(`🎵 Audio duration: ${actualDuration}s`);

      // Step 3: Create video scenes with professional editing
      const scenes = await this.createVideoScenes(jobData, actualDuration, isShort);

      // Step 4: Download and prepare background assets
      const backgroundAssets = await this.prepareBackgroundAssets(scenes, jobData.metadata?.category || 'general');

      // Step 5: Create professional video with advanced effects
      const videoPath = await this.renderProfessionalVideo(scenes, backgroundAssets, actualDuration, isShort, jobId);

      // Step 6: Combine with audio using advanced audio processing
      const finalPath = await this.combineVideoWithAudio(videoPath, audioPath, jobId, isShort);

      // Step 7: Apply final post-processing effects
      const enhancedPath = await this.applyPostProcessingEffects(finalPath, jobId, isShort);

      console.log(`✅ PROFESSIONAL video created: ${enhancedPath}`);
      return enhancedPath;

    } catch (error) {
      console.error(`❌ Professional video creation failed for job ${jobId}:`, error);
      throw error;
    }
  }

  private async generateProfessionalAudio(script: string, jobId: number): Promise<string> {
    try {
      console.log(`🎙️ Generating professional audio for job ${jobId}...`);

      // Enhanced script for natural speech
      const enhancedScript = this.enhanceScriptForNarration(script);

      const audioPath = await textToSpeechService.generateSpeech({
        text: enhancedScript,
        outputPath: path.join(this.outputDir, `professional_audio_${jobId}.mp3`),
        voice: 'en-IN-Neural2-B', // Professional male voice
        speed: 0.95, // Optimal speaking rate
        pitch: -1.5 // Authority and clarity
      });

      // Validate and enhance audio
      const stats = await fs.stat(audioPath);
      if (stats.size < 100000) {
        throw new Error('Audio file too small, regenerating...');
      }

      // Apply professional audio enhancement
      const enhancedAudioPath = await this.enhanceAudioQuality(audioPath, jobId);

      return enhancedAudioPath;
    } catch (error) {
      console.error('Professional audio generation failed:', error);
      throw error;
    }
  }

  private enhanceScriptForNarration(script: string): string {
    // Add natural pauses and emphasis for professional narration
    let enhanced = script
      .replace(/\. /g, '... ') // Natural pauses
      .replace(/! /g, '! ') // Excitement emphasis
      .replace(/\? /g, '? ') // Question emphasis
      .replace(/important/gi, 'very important') // Add emphasis
      .replace(/breaking/gi, 'breaking news') // News style
      .replace(/today/gi, 'today\'s update'); // Professional tone

    // Add professional intro and outro
    enhanced = `Welcome to today's comprehensive update. ${enhanced}`;
    enhanced += ` That's all for today's update. For more insights and analysis, make sure to subscribe and hit the notification bell. Thank you for watching.`;

    return enhanced;
  }

  private async enhanceAudioQuality(audioPath: string, jobId: number): Promise<string> {
    const enhancedPath = path.join(this.outputDir, `enhanced_audio_${jobId}.mp3`);

    try {
      // Professional audio enhancement: EQ, compression, noise reduction
      const command = `ffmpeg -i "${audioPath}" ` +
        `-af "` +
        `highpass=f=80,` + // Remove low-frequency noise
        `lowpass=f=12000,` + // Remove high-frequency noise
        `acompressor=threshold=-18dB:ratio=3:attack=5:release=50,` + // Dynamic compression
        `adeclick,` + // Remove clicks and pops
        `afftdn=nr=20,` + // Noise reduction
        `volume=1.8,` + // Optimal volume
        `aresample=48000` + // Professional sample rate
        `" -c:a libmp3lame -b:a 320k "${enhancedPath}" -y`;

      await execAsync(command);

      const stats = await fs.stat(enhancedPath);
      if (stats.size > 50000) {
        console.log(`✅ Audio enhanced: ${enhancedPath} (${Math.round(stats.size / 1024)}KB)`);
        return enhancedPath;
      }
    } catch (error) {
      console.warn('Audio enhancement failed, using original:', error.message);
    }

    return audioPath;
  }

  private async getAudioDuration(audioPath: string): Promise<number> {
    try {
      const { stdout } = await execAsync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`);
      const duration = parseFloat(stdout.trim());

      if (isNaN(duration) || duration < 10) {
        throw new Error('Invalid audio duration');
      }

      return duration;
    } catch (error) {
      console.warn('Could not get audio duration, estimating...');
      // Estimate based on file size
      const stats = await fs.stat(audioPath);
      return Math.max(60, Math.min(600, stats.size / 24000)); // Rough estimation
    }
  }

  private async createVideoScenes(jobData: any, duration: number, isShort: boolean): Promise<VideoScene[]> {
    const sentences = jobData.script.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const scenes: VideoScene[] = [];

    const sceneDuration = duration / Math.max(sentences.length, 3); // At least 3 scenes

    sentences.forEach((sentence, index) => {
      const startTime = index * sceneDuration;

      scenes.push({
        segments: [{
          text: sentence.trim(),
          startTime,
          duration: sceneDuration,
          animation: this.getRandomAnimation(),
          position: index % 2 === 0 ? 'center' : 'bottom'
        }],
        transition: this.getRandomTransition(),
        effects: this.getSceneEffects(index, isShort)
      });
    });

    return scenes;
  }

  private getRandomAnimation(): VideoSegment['animation'] {
    const animations: VideoSegment['animation'][] = ['slideIn', 'fadeIn', 'typewriter', 'scaleIn', 'bounceIn'];
    return animations[Math.floor(Math.random() * animations.length)];
  }

  private getRandomTransition(): VideoScene['transition'] {
    const transitions: VideoScene['transition'][] = ['fade', 'slide', 'zoom', 'dissolve', 'wipe'];
    return transitions[Math.floor(Math.random() * transitions.length)];
  }

  private getSceneEffects(sceneIndex: number, isShort: boolean): string[] {
    const baseEffects = [
      'colorBalance=rs=0.1:gs=0.0:bs=-0.1',
      'eq=contrast=1.2:brightness=0.05:saturation=1.3',
      'unsharp=5:5:1.0:5:5:0.0'
    ];

    // Add dynamic effects based on scene
    if (sceneIndex % 3 === 0) {
      baseEffects.push('zoompan=z=\'min(zoom+0.0015,1.5)\':d=1');
    }

    if (sceneIndex % 4 === 0) {
      baseEffects.push('vignette=PI/6');
    }

    return baseEffects;
  }

  private async prepareBackgroundAssets(scenes: VideoScene[], category: string): Promise<string[]> {
    const assets: string[] = [];

    for (let i = 0; i < scenes.length; i++) {
      try {
        // Download relevant images from Unsplash
        const imageUrl = await this.getUnsplashImage(category, i);
        const imagePath = path.join(this.backgroundsDir, `scene_${i}_bg.jpg`);

        await this.downloadImage(imageUrl, imagePath);
        assets.push(imagePath);
      } catch (error) {
        console.warn(`Failed to download background for scene ${i}, using fallback`);
        // Create a professional gradient background as fallback
        const fallbackPath = await this.createGradientBackground(i);
        assets.push(fallbackPath);
      }
    }

    return assets;
  }

  private async getUnsplashImage(category: string, sceneIndex: number): Promise<string> {
    const keywords = this.getCategoryKeywords(category);
    const query = keywords[sceneIndex % keywords.length];

    try {
      // Using Unsplash API or direct URL pattern
      const response = await axios.get(`https://source.unsplash.com/1920x1080/?${query}`, {
        responseType: 'arraybuffer',
        timeout: 10000
      });

      if (response.status === 200) {
        return response.request.res.responseUrl;
      }
    } catch (error) {
      console.warn('Unsplash request failed, using fallback');
    }

    // Fallback to curated images
    return `https://source.unsplash.com/1920x1080/?nature,technology,business`;
  }

  private getCategoryKeywords(category: string): string[] {
    const keywordMap: { [key: string]: string[] } = {
      'technology': ['technology', 'innovation', 'digital', 'future', 'AI', 'computer'],
      'science': ['science', 'research', 'laboratory', 'discovery', 'space', 'nature'],
      'business': ['business', 'finance', 'corporate', 'economy', 'growth', 'success'],
      'news': ['news', 'media', 'journalism', 'world', 'global', 'breaking'],
      'general': ['modern', 'abstract', 'clean', 'professional', 'blue', 'gradient']
    };

    return keywordMap[category] || keywordMap['general'];
  }

  private async downloadImage(url: string, outputPath: string): Promise<void> {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
      await fs.writeFile(outputPath, response.data);
    } catch (error) {
      throw new Error(`Failed to download image: ${error.message}`);
    }
  }

  private async createGradientBackground(sceneIndex: number): Promise<string> {
    const outputPath = path.join(this.backgroundsDir, `gradient_${sceneIndex}_bg.jpg`);

    const gradients = [
      '#1a1a2e,#16213e,#0f172a', // Deep blue
      '#2d1b69,#11998e,#38ef7d', // Blue to green
      '#8360c3,#2ebf91,#52c9a6', // Purple to teal
      '#ee0979,#ff6a00,#ffcc00', // Pink to orange
      '#0f0c29,#302b63,#24243e'  // Dark professional
    ];

    const gradient = gradients[sceneIndex % gradients.length];
    const colors = gradient.split(',');

    const command = `ffmpeg -f lavfi -i "color=c=${colors[0]}:size=1920x1080:duration=1" ` +
      `-vf "geq=r='128+64*sin(2*PI*t/10+x/100)':g='64+32*sin(2*PI*t/8+y/80)':b='192+64*sin(2*PI*t/12)'" ` +
      `-frames:v 1 "${outputPath}" -y`;

    await execAsync(command);
    return outputPath;
  }

  private async renderProfessionalVideo(
    scenes: VideoScene[], 
    backgroundAssets: string[], 
    duration: number, 
    isShort: boolean,
    jobId: number
  ): Promise<string> {
    const outputPath = path.join(this.outputDir, `professional_render_${jobId}.mp4`);
    const dimensions = isShort ? '1080x1920' : '1920x1080';

    console.log(`🎥 Rendering professional video: ${scenes.length} scenes`);

    // Create complex filter for professional video
    let filterComplex = '';
    let inputs = '';

    // Add all background images as inputs
    backgroundAssets.forEach((asset, index) => {
      inputs += `-loop 1 -i "${asset}" `;
    });

    // Create sophisticated filter chain
    filterComplex = this.buildProfessionalFilterChain(scenes, backgroundAssets.length, duration, isShort);

    const command = `ffmpeg ${inputs} ` +
      `-filter_complex "${filterComplex}" ` +
      `-map "[final]" ` +
      `-c:v libx264 -preset slow -crf 18 ` +
      `-pix_fmt yuv420p ` +
      `-t ${duration} ` +
      `-r 30 ` +
      `"${outputPath}" -y`;

    console.log(`🔧 Executing professional render command...`);
    await execAsync(command);

    const stats = await fs.stat(outputPath);
    console.log(`✅ Professional video rendered: ${Math.round(stats.size / 1024)}KB`);

    return outputPath;
  }

  private buildProfessionalFilterChain(scenes: VideoScene[], inputCount: number, duration: number, isShort: boolean): string {
    let filter = '';
    const sceneDuration = duration / scenes.length;

    // Scale and prepare each background
    for (let i = 0; i < inputCount; i++) {
      const dimensions = isShort ? '1080:1920' : '1920:1080';
      filter += `[${i}:v]scale=${dimensions},setsar=1,fps=30[bg${i}];`;
    }

    // Create scene transitions and effects
    scenes.forEach((scene, index) => {
      const startTime = index * sceneDuration;
      const endTime = startTime + sceneDuration;

      // Add professional text overlay with animations
      const textEffect = this.createTextAnimation(scene.segments[0], isShort, startTime, sceneDuration);

      if (index === 0) {
        filter += `[bg${index}]${textEffect}[scene${index}];`;
      } else {
        // Add transition between scenes
        const transition = this.createSceneTransition(scene.transition, index, sceneDuration);
        filter += `[scene${index-1}][bg${index}]${transition}${textEffect}[scene${index}];`;
      }
    });

    // Apply final professional effects
    const finalIndex = scenes.length - 1;
    filter += `[scene${finalIndex}]` +
      `colorbalance=rs=0.1:gs=0.0:bs=-0.1:rm=0.2:gm=0.0:bm=-0.1,` +
      `eq=contrast=1.15:brightness=0.02:saturation=1.25:gamma=0.95,` +
      `unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=1.2,` +
      `vignette=PI/6,` +
      `fade=in:0:30:alpha=1,fade=out:${Math.max(0, duration*30-30)}:30:alpha=1` +
      `[final]`;

    return filter;
  }

  private createTextAnimation(segment: VideoSegment, isShort: boolean, startTime: number, duration: number): string {
    const fontSize = isShort ? 64 : 48;
    const textColor = '#FFFFFF';
    const borderColor = '#000000';

    let x = '(w-text_w)/2'; // center by default
    let y = isShort ? 'h*0.75' : 'h*0.8';

    // Adjust position based on segment position
    switch (segment.position) {
      case 'top':
        y = isShort ? 'h*0.15' : 'h*0.1';
        break;
      case 'bottom':
        y = isShort ? 'h*0.85' : 'h*0.9';
        break;
      case 'left':
        x = 'w*0.1';
        break;
      case 'right':
        x = 'w*0.9-text_w';
        break;
    }

    // Create animation based on type
    let animationEffect = '';
    switch (segment.animation) {
      case 'slideIn':
        animationEffect = `:x='if(lt(t,${startTime}),w,${x})'`;
        break;
      case 'fadeIn':
        animationEffect = `:alpha='if(lt(t,${startTime}),0,if(lt(t,${startTime+1}),(t-${startTime}),1))'`;
        break;
      case 'scaleIn':
        animationEffect = `:fontsize='${fontSize}*if(lt(t,${startTime}),0.1,if(lt(t,${startTime+0.5}),${fontSize}*(t-${startTime})*2,${fontSize}))'`;
        break;
      case 'typewriter':
        const textLength = segment.text.length;
        animationEffect = `:text='${segment.text.substring(0, Math.floor(textLength * Math.min(1, Math.max(0, (1 - startTime) / duration))))}'`;
        break;
      default:
        animationEffect = '';
    }

    return `drawtext=text='${segment.text.replace(/'/g, "\\'")}':` +
      `fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:` +
      `fontsize=${fontSize}:fontcolor=${textColor}:` +
      `x=${x}:y=${y}:` +
      `bordercolor=${borderColor}:borderw=3:` +
      `shadowcolor=#000000:shadowx=3:shadowy=3:` +
      `enable='between(t,${startTime},${startTime + duration})'` +
      animationEffect + ',';
  }

  private createSceneTransition(transition: VideoScene['transition'], sceneIndex: number, duration: number): string {
    const startTime = (sceneIndex - 1) * duration;
    const transitionDuration = 1.0; // 1 second transition

    switch (transition) {
      case 'fade':
        return `blend=all_expr='A*(1-${transitionDuration})+B*${transitionDuration}':`;
      case 'slide':
        return `overlay=x='if(lt(t,${startTime}),0,w*(t-${startTime})/${transitionDuration})':`;
      case 'zoom':
        return `zoompan=z='if(lt(t,${startTime}),1,1+(t-${startTime})*0.5)':d=${transitionDuration}:`;
      case 'dissolve':
        return `blend=all_mode=dissolve:all_opacity=0.5:`;
      case 'wipe':
        return `overlay=x='if(lt(t,${startTime}),-w,w*(t-${startTime})/${transitionDuration}-w)':`;
      default:
        return '';
    }
  }

  private async combineVideoWithAudio(videoPath: string, audioPath: string, jobId: number, isShort: boolean): Promise<string> {
    const outputPath = path.join(this.outputDir, `final_with_audio_${jobId}.mp4`);

    console.log(`🔊 Combining video with professional audio...`);

    try {
      // Get audio duration to ensure video matches
      const audioDuration = await this.getAudioDuration(audioPath);

      const command = `ffmpeg -i "${videoPath}" -i "${audioPath}" ` +
        `-filter_complex "` +
        `[0:v]scale=${isShort ? '1080:1920' : '1920:1080'}:force_original_aspect_ratio=increase,` +
        `crop=${isShort ? '1080:1920' : '1920:1080'}[v];` +
        `[1:a]volume=1.0,highpass=f=80,lowpass=f=12000,acompressor=threshold=-16dB:ratio=3[a]" ` +
        `-map "[v]" -map "[a]" ` +
        `-c:v libx264 -preset medium -crf 18 ` +
        `-c:a aac -b:a 192k -ar 48000 ` +
        `-t ${audioDuration} ` +
        `-movflags +faststart ` +
        `"${outputPath}" -y`;

      await execAsync(command);

      // Verify audio is embedded
      const { stdout: videoInfo } = await execAsync(`ffprobe -v quiet -print_format json -show_streams "${outputPath}"`);
      const streams = JSON.parse(videoInfo).streams;
      const hasAudio = streams.some(stream => stream.codec_type === 'audio');

      if (!hasAudio) {
        throw new Error('Audio embedding failed');
      }

      console.log(`✅ Video with audio combined successfully`);
      return outputPath;

    } catch (error) {
      console.error('Video-audio combination failed:', error);
      throw error;
    }
  }

  private async applyPostProcessingEffects(inputPath: string, jobId: number, isShort: boolean): Promise<string> {
    const outputPath = path.join(this.outputDir, `professional_final_${jobId}.mp4`);

    console.log(`✨ Applying final post-processing effects...`);

    const command = `ffmpeg -i "${inputPath}" ` +
      `-vf "` +
      // Professional color grading
      `curves=vintage,` +
      `colorbalance=rs=0.05:gs=0.0:bs=-0.05:rm=0.1:gm=0.0:bm=-0.1,` +
      // Sharpening for crisp details
      `unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=1.5:chroma_msize_x=3:chroma_msize_y=3:chroma_amount=1.0,` +
      // Final contrast and saturation boost
      `eq=contrast=1.1:brightness=0.02:saturation=1.2:gamma=0.98,` +
      // Professional vignette
      `vignette=PI/4:mode=backward,` +
      // Noise reduction for clean output
      `hqdn3d=2:1:2:1` +
      `" ` +
      `-c:v libx264 -preset slow -crf 16 ` +
      `-c:a copy ` +
      `-maxrate ${isShort ? '8M' : '15M'} -bufsize ${isShort ? '16M' : '30M'} ` +
      `-pix_fmt yuv420p ` +
      `-movflags +faststart ` +
      `"${outputPath}" -y`;

    await execAsync(command);

    const stats = await fs.stat(outputPath);
    console.log(`✅ PROFESSIONAL video completed: ${Math.round(stats.size / (1024 * 1024))}MB`);

    return outputPath;
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
        await fs.unlink(path.join(this.outputDir, file)).catch(() => {});
      }

      console.log(`🧹 Cleaned up ${jobFiles.length} temporary files for job ${jobId}`);
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }
}

// Update the main VideoCreator class to use the new professional system
export class VideoCreator {
  private professionalCreator: ProfessionalVideoCreator;

  constructor() {
    this.professionalCreator = new ProfessionalVideoCreator();
  }

  async createVideo(jobId: number): Promise<string> {
    try {
      console.log(`🚀 Starting PROFESSIONAL video creation for job ${jobId}`);

      // Always use the professional video creator
      const videoPath = await this.professionalCreator.createProfessionalVideo(jobId);

      // Verify the output is production-ready
      const videoInfo = await this.professionalCreator.getVideoInfo(videoPath);

      if (!videoInfo) {
        throw new Error('Failed to create valid video file');
      }

      // Check if audio track exists
      const hasAudio = videoInfo.streams?.some((stream: any) => stream.codec_type === 'audio');
      if (!hasAudio) {
        throw new Error('Video missing audio track - not production ready');
      }

      // Check video duration is appropriate
      const duration = parseFloat(videoInfo.format?.duration || '0');
      const jobData = await storage.getContentJobById(jobId);
      const expectedDuration = jobData?.videoType === 'short' ? 120 : 600;

      if (duration < expectedDuration * 0.8) {
        console.warn(`⚠️ Video duration ${duration}s shorter than expected ${expectedDuration}s`);
      }

      console.log(`✅ PRODUCTION-READY video created: ${videoPath}`);
      console.log(`📊 Video specs: ${duration}s, ${hasAudio ? 'WITH AUDIO' : 'NO AUDIO'}, ${Math.round(parseInt(videoInfo.format?.size || '0') / (1024 * 1024))}MB`);

      return videoPath;

    } catch (error) {
      console.error(`❌ Professional video creation failed for job ${jobId}:`, error);
      throw error;
    }
  }

  async cleanup(jobId: number): Promise<void> {
    await this.professionalCreator.cleanup(jobId);
  }

  async getVideoInfo(videoPath: string): Promise<any> {
    return await this.professionalCreator.getVideoInfo(videoPath);
  }
}

export const videoCreator = new VideoCreator();