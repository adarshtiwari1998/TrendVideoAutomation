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
      const targetDuration = isShort ? 120 : 640; // 2 min for shorts, 10+ min for long-form

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

      console.log(`✅ PROFESSIONAL video created: ${finalPath}`);
      return finalPath;

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
    console.log(`🎙️ Enhancing script for narration. Original length: ${script.length}`);
    console.log(`🎙️ Original script preview: "${script.substring(0, 200)}..."`);

    // Preserve the complete script content and enhance for narration
    let enhanced = script
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\. /g, '. ') // Ensure proper sentence spacing
      .replace(/! /g, '! ') // Excitement emphasis
      .replace(/\? /g, '? ') // Question emphasis
      .replace(/\bimportant\b/gi, 'very important') // Add emphasis
      .replace(/\bbreaking\b/gi, 'breaking news') // News style
      .replace(/\btoday\b/gi, 'today\'s update'); // Professional tone

    // Add professional intro if not present
    if (!enhanced.toLowerCase().includes('welcome') && 
        !enhanced.toLowerCase().includes('hello')) {
      enhanced = `Welcome to today's comprehensive update. ${enhanced}`;
    }

    // Add professional outro with strong call-to-action
    const hasOutro = enhanced.toLowerCase().includes('subscribe') || 
                     enhanced.toLowerCase().includes('thank you for watching');
    
    if (!hasOutro) {
      enhanced += ` That's all for today's comprehensive update. If you found this information valuable and insightful, please give this video a thumbs up and subscribe to our channel for more in-depth analysis and updates. Hit the notification bell to stay informed about our latest content. Share this video with others who might benefit from this information. Thank you so much for watching, and we'll see you in the next video!`;
    }

    console.log(`✅ Enhanced script length: ${enhanced.length} characters`);
    console.log(`🎙️ Enhanced script preview: "${enhanced.substring(0, 300)}..."`);
    
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
      // Check if file exists and is readable
      const stats = await fs.stat(audioPath);
      if (stats.size < 1000) {
        throw new Error('Audio file too small');
      }

      const { stdout } = await execAsync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`);
      const duration = parseFloat(stdout.trim());

      if (isNaN(duration)) {
        throw new Error('Could not parse audio duration');
      }

      if (duration < 5) {
        console.warn(`⚠️ Audio duration very short: ${duration}s`);
        return Math.max(30, duration); // Minimum 30 seconds
      }

      console.log(`🎵 Audio duration detected: ${duration}s`);
      return duration;

    } catch (error) {
      console.warn('Could not get accurate audio duration, using file-based estimate...');
      
      try {
        const stats = await fs.stat(audioPath);
        // More accurate estimation: ~1KB per second for compressed audio
        const estimatedDuration = Math.max(30, Math.min(600, stats.size / 16000));
        console.log(`📊 Estimated duration from file size: ${estimatedDuration}s`);
        return estimatedDuration;
      } catch (fsError) {
        console.error('Cannot access audio file:', fsError);
        return 60; // Default fallback
      }
    }
  }

  private async createVideoScenes(jobData: any, duration: number, isShort: boolean): Promise<VideoScene[]> {
    const sentences = jobData.script.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const scenes: VideoScene[] = [];

    // Optimized scene settings for professional videos
    const maxScenes = isShort ? 6 : 12; // Reduced scenes for better quality
    const minSceneDuration = isShort ? 15 : 30; // Longer scenes for better readability
    
    // Calculate optimal scene count based on duration and limits
    const optimalSceneCount = Math.min(
      maxScenes,
      Math.max(3, Math.floor(duration / minSceneDuration))
    );
    
    const sceneDuration = duration / optimalSceneCount;
    
    console.log(`🎬 Creating ${optimalSceneCount} scenes with ${sceneDuration.toFixed(1)}s duration each`);

    // Group sentences into scenes with better text management
    const sentencesPerScene = Math.max(2, Math.floor(sentences.length / optimalSceneCount));
    
    for (let i = 0; i < optimalSceneCount; i++) {
      const startSentenceIndex = i * sentencesPerScene;
      const endSentenceIndex = i === optimalSceneCount - 1 
        ? sentences.length 
        : (i + 1) * sentencesPerScene;
      
      let sceneText = sentences
        .slice(startSentenceIndex, endSentenceIndex)
        .map(s => s.trim())
        .join('. ') + '.';

      // Limit text length per scene for readability
      if (sceneText.length > 200) {
        const words = sceneText.split(' ');
        sceneText = words.slice(0, 30).join(' ') + '...';
      }

      const startTime = i * sceneDuration;

      scenes.push({
        segments: [{
          text: sceneText,
          startTime,
          duration: sceneDuration,
          animation: 'fadeIn', // Use consistent animation for professionalism
          position: 'center' // Always center for best readability
        }],
        transition: 'fade', // Use consistent transitions
        effects: this.getSceneEffects(i, isShort)
      });
    }

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
      let backgroundPath: string;

      try {
        // Try to download high-quality background image
        const imageUrl = await this.getUnsplashImage(category, i);
        const imagePath = path.join(this.backgroundsDir, `scene_${i}_bg.jpg`);

        await this.downloadImage(imageUrl, imagePath);
        console.log(`✅ Downloaded background for scene ${i}`);
        backgroundPath = imagePath;
      } catch (error) {
        console.warn(`Failed to download background for scene ${i}, creating professional fallback`);
        
        try {
          // Create a high-quality gradient background
          backgroundPath = await this.createProfessionalGradientBackground(category, i);
          console.log(`✅ Created professional gradient for scene ${i}`);
        } catch (gradientError) {
          console.warn(`Professional gradient failed for scene ${i}, using simple background`);
          // Final fallback - simple solid background
          backgroundPath = await this.createSimpleBackground(i);
        }
      }

      assets.push(backgroundPath);
    }

    return assets;
  }

  private async getUnsplashImage(category: string, sceneIndex: number): Promise<string> {
    const keywords = this.getCategoryKeywords(category);
    const query = keywords[sceneIndex % keywords.length];

    // Try multiple image sources in order of preference
    const imageSources = [
      `https://picsum.photos/1920/1080?random=${Date.now() + sceneIndex}`,
      `https://source.unsplash.com/1920x1080/?${encodeURIComponent(query)}`,
      `https://picsum.photos/1920/1080?blur=1&random=${sceneIndex}`,
      `https://source.unsplash.com/1920x1080/?abstract,colorful`
    ];

    for (let i = 0; i < imageSources.length; i++) {
      try {
        const response = await axios.get(imageSources[i], {
          responseType: 'arraybuffer',
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; VideoGenerator/1.0)',
            'Accept': 'image/*'
          }
        });

        if (response.status === 200 && response.data.byteLength > 5000) {
          return imageSources[i];
        }
      } catch (error) {
        console.warn(`Image source ${i + 1} failed:`, error.message);
        continue;
      }
    }

    // All sources failed, return null to trigger local fallback creation
    throw new Error('All image sources failed');
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
      const response = await axios.get(url, { 
        responseType: 'arraybuffer', 
        timeout: 20000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VideoGenerator/1.0)',
          'Accept': 'image/jpeg,image/png,image/*'
        },
        maxRedirects: 5
      });

      if (!response.data || response.data.byteLength < 5000) {
        throw new Error('Downloaded image is too small or corrupted');
      }

      await fs.writeFile(outputPath, response.data);

      // Verify the downloaded file is a valid image
      try {
        await execAsync(`ffmpeg -i "${outputPath}" -frames:v 1 -f null - 2>/dev/null`);
      } catch (verifyError) {
        await fs.unlink(outputPath).catch(() => {});
        throw new Error('Downloaded file is not a valid image');
      }

    } catch (error) {
      throw new Error(`Failed to download image: ${error.message}`);
    }
  }

  private async createProfessionalGradientBackground(category: string, sceneIndex: number): Promise<string> {
    const outputPath = path.join(this.backgroundsDir, `pro_${category}_${sceneIndex}_bg.jpg`);

    // Check if this background already exists
    if (fs.existsSync(outputPath)) {
      try {
        const stats = await fs.stat(outputPath);
        if (stats.size > 1000) {
          return outputPath;
        }
      } catch (error) {
        // File exists but corrupted, recreate it
      }
    }

    // Category-specific professional color schemes
    const colorSchemes = {
      'technology': ['#1a365d', '#2b77e6', '#4299e1'],
      'science': ['#2d3748', '#38a169', '#68d391'],
      'business': ['#1a202c', '#e53e3e', '#fc8181'],
      'news': ['#2c5282', '#3182ce', '#63b3ed'],
      'general': ['#2d3748', '#4a5568', '#718096']
    };

    const colors = colorSchemes[category] || colorSchemes['general'];
    const baseColor = colors[sceneIndex % colors.length];

    try {
      // Create professional gradient background with FFmpeg
      const command = `ffmpeg -f lavfi ` +
        `-i "color=c=${baseColor}:size=1920x1080:duration=1" ` +
        `-vf "geq=r='255*sin(X/50)*sin(Y/50)*0.1+${parseInt(baseColor.slice(1, 3), 16)}':` +
        `g='255*cos(X/40)*cos(Y/40)*0.1+${parseInt(baseColor.slice(3, 5), 16)}':` +
        `b='255*sin(X/60)*cos(Y/60)*0.1+${parseInt(baseColor.slice(5, 7), 16)}'" ` +
        `-frames:v 1 -q:v 2 "${outputPath}" -y`;

      await execAsync(command);

      // Verify the created file
      const stats = await fs.stat(outputPath);
      if (stats.size > 1000) {
        return outputPath;
      }
    } catch (error) {
      console.warn('Professional gradient creation failed, using simple background');
    }

    // Fallback to simple gradient
    return await this.createGradientBackground(sceneIndex);
  }

  private async createGradientBackground(sceneIndex: number): Promise<string> {
    const outputPath = path.join(this.backgroundsDir, `gradient_${sceneIndex}_bg.jpg`);

    const gradients = [
      '#1a1a2e', '#16213e', '#0f172a', '#2d1b69', '#8360c3',
      '#ee0979', '#0f0c29', '#1a365d', '#2d3748', '#2c5282'
    ];

    const color = gradients[sceneIndex % gradients.length];

    const command = `ffmpeg -f lavfi -i "color=c=${color}:size=1920x1080:duration=1" ` +
      `-frames:v 1 "${outputPath}" -y`;

    await execAsync(command);
    return outputPath;
  }

  private async createSimpleBackground(sceneIndex: number): Promise<string> {
    const outputPath = path.join(this.backgroundsDir, `simple_${sceneIndex}_bg.jpg`);

    const colors = [
      '#1a1a2e', // Deep blue
      '#2d1b69', // Purple
      '#8360c3', // Light purple
      '#ee0979', // Pink
      '#0f0c29'  // Dark blue
    ];

    const color = colors[sceneIndex % colors.length];

    // Create the simplest possible background - just a solid color
    const command = `ffmpeg -f lavfi -i "color=c=${color}:size=1920x1080" ` +
      `-t 1 -frames:v 1 "${outputPath}" -y`;

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

    console.log(`🎥 Rendering professional video: ${scenes.length} scenes`);

    // Use ultra-simple rendering to prevent FFmpeg command failures
    return await this.renderVideoUltraSimple(scenes, backgroundAssets, duration, isShort, jobId);
  }

  private async renderVideoUltraSimple(
    scenes: VideoScene[], 
    backgroundAssets: string[], 
    duration: number, 
    isShort: boolean,
    jobId: number
  ): Promise<string> {
    const outputPath = path.join(this.outputDir, `professional_render_${jobId}.mp4`);
    const dimensions = isShort ? '1080:1920' : '1920:1080';
    
    console.log(`🎥 Using ultra-simple rendering for ${scenes.length} scenes`);
    
    const sceneDuration = duration / scenes.length;
    const fontSize = isShort ? 48 : 36;
    
    // Create a single video with all text overlays
    const backgroundImage = backgroundAssets[0] || await this.createSimpleBackground(0);
    
    // Combine all scene texts into one
    const allText = scenes.map(scene => scene.segments[0].text).join(' ');
    
    // Clean text for FFmpeg safety
    const safeText = allText
      .replace(/['"]/g, '')
      .replace(/[()]/g, '')
      .replace(/[&|<>$`\\]/g, '')
      .substring(0, 100) + '...';
    
    // Single, simple FFmpeg command
    const command = `ffmpeg -loop 1 -i "${backgroundImage}" ` +
      `-vf "scale=${dimensions}:force_original_aspect_ratio=increase,crop=${dimensions}," +
      `drawtext=text='${safeText}':` +
      `fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:` +
      `fontsize=${fontSize}:fontcolor=white:x=(w-text_w)/2:y=h*0.8:` +
      `bordercolor=black:borderw=2" ` +
      `-t ${duration} -r 30 -c:v libx264 -preset fast -crf 23 ` +
      `-pix_fmt yuv420p "${outputPath}" -y`;
    
    console.log('🎬 Executing ultra-simple video command...');
    await execAsync(command);
    
    const stats = await fs.stat(outputPath);
    console.log(`✅ Ultra-simple video rendered: ${Math.round(stats.size / 1024)}KB`);
    
    return outputPath;
  }

  private async renderLongVideoSimple(
    scenes: VideoScene[], 
    backgroundAssets: string[], 
    duration: number, 
    isShort: boolean,
    jobId: number
  ): Promise<string> {
    const outputPath = path.join(this.outputDir, `professional_render_${jobId}.mp4`);
    const dimensions = isShort ? '1080:1920' : '1920:1080';
    const tempDir = path.join(this.outputDir, `temp_scenes_${jobId}`);
    
    console.log(`🎥 Using simple rendering approach for ${scenes.length} scenes`);
    
    // Create temp directory for individual scene videos
    await fs.mkdir(tempDir, { recursive: true });
    
    const sceneVideos: string[] = [];
    const sceneDuration = duration / scenes.length;
    
    // Create individual scene videos
    for (let i = 0; i < scenes.length; i++) {
      const sceneOutputPath = path.join(tempDir, `scene_${i}.mp4`);
      const backgroundImage = backgroundAssets[i] || backgroundAssets[0];
      const segment = scenes[i].segments[0];
      
      const fontSize = isShort ? 64 : 48;
      const textY = isShort ? 'h*0.75' : 'h*0.8';
      
      // Create individual scene with text overlay
      const sceneCommand = `ffmpeg -loop 1 -i "${backgroundImage}" ` +
        `-vf "scale=${dimensions}:force_original_aspect_ratio=increase,crop=${dimensions},` +
        `drawtext=text='${segment.text.replace(/'/g, "\\'")}':` +
        `fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:` +
        `fontsize=${fontSize}:fontcolor=white:x=(w-text_w)/2:y=${textY}:` +
        `bordercolor=black:borderw=3:shadowcolor=#000000:shadowx=3:shadowy=3" ` +
        `-t ${sceneDuration} -r 30 -c:v libx264 -preset fast -crf 22 ` +
        `-pix_fmt yuv420p "${sceneOutputPath}" -y`;
      
      await execAsync(sceneCommand);
      sceneVideos.push(sceneOutputPath);
      
      if (i % 5 === 0) {
        console.log(`🎬 Rendered scene ${i + 1}/${scenes.length}`);
      }
    }
    
    // Concatenate all scene videos
    const fileListPath = path.join(tempDir, 'scenes.txt');
    const fileList = sceneVideos.map(video => `file '${video}'`).join('\n');
    await fs.writeFile(fileListPath, fileList);
    
    const concatCommand = `ffmpeg -f concat -safe 0 -i "${fileListPath}" ` +
      `-c copy "${outputPath}" -y`;
    
    await execAsync(concatCommand);
    
    // Cleanup temp files
    for (const video of sceneVideos) {
      await fs.unlink(video).catch(() => {});
    }
    await fs.unlink(fileListPath).catch(() => {});
    await fs.rmdir(tempDir).catch(() => {});
    
    const stats = await fs.stat(outputPath);
    console.log(`✅ Long video rendered: ${Math.round(stats.size / 1024)}KB`);
    
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
    // Professional text settings
    const fontSize = isShort ? 48 : 36; // Smaller for better compatibility
    const textColor = 'white';
    const borderColor = 'black';

    // Always center text for professional appearance
    const x = '(w-text_w)/2';
    const y = isShort ? 'h*0.75' : 'h*0.8';

    // CRITICAL: Clean text thoroughly to prevent FFmpeg command failures
    const cleanText = segment.text
      .replace(/['"]/g, '') // Remove quotes completely
      .replace(/[()[\]{}]/g, '') // Remove all brackets
      .replace(/[&|<>$`\\]/g, '') // Remove shell metacharacters
      .replace(/[^\w\s.,!?-]/g, ' ') // Keep only safe characters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();

    // Limit text length to prevent command line issues
    const words = cleanText.split(' ');
    const maxWords = isShort ? 6 : 8; // Shorter text for reliability
    const displayText = words.length > maxWords 
      ? words.slice(0, maxWords).join(' ') + '...' 
      : cleanText;

    // Use simple text overlay without complex effects to avoid FFmpeg errors
    return `drawtext=text='${displayText}':` +
      `fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:` +
      `fontsize=${fontSize}:fontcolor=${textColor}:` +
      `x=${x}:y=${y}:` +
      `bordercolor=${borderColor}:borderw=3:` +
      `enable=between\\(t\\,${startTime}\\,${startTime + duration}\\)`;
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
    const outputPath = path.join(this.outputDir, `professional_final_${jobId}.mp4`);

    console.log(`🔊 Combining video with audio...`);

    try {
      // Get actual audio duration
      const audioDuration = await this.getAudioDuration(audioPath);
      console.log(`🎵 Detected audio duration: ${audioDuration}s`);

      // Verify audio file is valid and not silent
      const audioStats = await fs.stat(audioPath);
      console.log(`🎵 Audio file size: ${Math.round(audioStats.size / 1024)}KB`);
      
      if (audioStats.size < 10000) {
        throw new Error('Audio file too small - likely silent or corrupted');
      }

      // Simple, reliable audio-video combination
      const command = `ffmpeg -i "${videoPath}" -i "${audioPath}" ` +
        `-c:v copy -c:a aac -b:a 192k ` +
        `-shortest -avoid_negative_ts make_zero ` +
        `"${outputPath}" -y`;

      console.log('🔄 Executing audio-video combination...');
      await execAsync(command);

      // Verify the final output
      const { stdout: videoInfo } = await execAsync(`ffprobe -v quiet -print_format json -show_streams "${outputPath}"`);
      const streams = JSON.parse(videoInfo).streams;
      const audioStream = streams.find(stream => stream.codec_type === 'audio');
      const videoStream = streams.find(stream => stream.codec_type === 'video');

      if (!audioStream) {
        throw new Error('Final video missing audio stream');
      }

      if (!videoStream) {
        throw new Error('Final video missing video stream');
      }

      const finalStats = await fs.stat(outputPath);
      console.log(`✅ Final video created: ${outputPath}`);
      console.log(`📊 File size: ${Math.round(finalStats.size / (1024 * 1024))}MB`);
      console.log(`📊 Audio duration: ${Math.round(parseFloat(audioStream.duration || '0'))}s`);
      console.log(`📊 Video duration: ${Math.round(parseFloat(videoStream.duration || '0'))}s`);
      
      return outputPath;

    } catch (error) {
      console.error('❌ Video-audio combination failed:', error);
      
      // If combination fails, at least return the video with a warning
      console.warn('⚠️ Returning video without audio due to combination failure');
      return videoPath;
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