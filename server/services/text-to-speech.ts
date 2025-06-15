import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import fs from 'fs/promises';
import path from 'path';

export interface TTSOptions {
  text: string;
  outputPath: string;
  voice?: string;
  speed?: number;
  pitch?: number;
}

export class TextToSpeechService {
  private client: TextToSpeechClient;

  constructor() {
    try {
      // Initialize Google Cloud TTS client with proper credential handling
      let credentials = null;
      let projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'magnetic-racer-442915-u4';

      // Try multiple credential sources
      const credentialSources = [
        './google-credentials.json',
        './credentials.json',
        process.env.GOOGLE_APPLICATION_CREDENTIALS
      ];

      for (const source of credentialSources) {
        if (source && typeof source === 'string') {
          try {
            const fs = require('fs');
            if (fs.existsSync(source)) {
              const credData = fs.readFileSync(source, 'utf8');
              credentials = JSON.parse(credData);
              projectId = credentials.project_id || projectId;
              console.log(`✅ Found Google credentials at: ${source}`);
              break;
            }
          } catch (e) {
            console.warn(`Could not read credentials from ${source}:`, e.message);
          }
        }
      }

      // Initialize with explicit credentials
      if (credentials) {
        this.client = new TextToSpeechClient({
          credentials: credentials,
          projectId: projectId
        });
        console.log('✅ Google Cloud TTS client initialized with explicit credentials');
      } else {
        // Fallback to environment-based auth
        this.client = new TextToSpeechClient({
          projectId: projectId
        });
        console.log('✅ Google Cloud TTS client initialized with environment auth');
      }

    } catch (error) {
      console.error('❌ Failed to initialize Google Cloud TTS client:', error);
      throw new Error(`TTS client initialization failed: ${error.message}`);
    }
  }

  async generateSpeech(options: TTSOptions): Promise<string> {
    try {
      const { text, outputPath, voice = 'en-IN-Neural2-B', speed = 0.92, pitch = -1.0 } = options;

      console.log(`🎤 Starting Google Cloud TTS generation for text: "${text.substring(0, 100)}..."`);

      // Use Google Cloud TTS directly
      try {
        const chunks = this.splitTextIntoChunks(text, 4000);

        if (chunks.length === 1) {
          return await this.generateSingleChunk(chunks[0], outputPath, voice, speed, pitch);
        } else {
          return await this.generateAndCombineChunks(chunks, outputPath, voice, speed, pitch);
        }

      } catch (googleError) {
        console.error('❌ Google Cloud TTS failed:', googleError);
        
        // Only use fallback if absolutely necessary and log the issue
        console.warn('⚠️ Using emergency fallback audio - this will NOT contain your script content');
        console.warn('⚠️ Please fix Google Cloud TTS authentication to get proper speech synthesis');
        
        // Create a simple MP3 with appropriate duration but log the issue clearly
        return await this.createEmergencyFallback(text, outputPath);
      }

    } catch (error) {
      console.error('❌ Text-to-speech generation failed:', error);
      throw new Error(`TTS generation failed: ${error.message}`);
    }
  }

  

  private async generateSingleChunk(text: string, outputPath: string, voice: string, speed: number, pitch: number): Promise<string> {
    // Correct voice gender mapping for Google Cloud TTS voices
    const getVoiceGender = (voiceName: string): 'MALE' | 'FEMALE' => {
      const maleVoices = ['en-IN-Neural2-B', 'en-IN-Wavenet-B', 'en-IN-Standard-B', 'en-IN-Standard-D'];
      const femaleVoices = ['en-IN-Neural2-A', 'en-IN-Neural2-C', 'en-IN-Neural2-D', 'en-IN-Wavenet-A', 'en-IN-Wavenet-C', 'en-IN-Standard-A', 'en-IN-Standard-C'];

      if (maleVoices.includes(voiceName)) return 'MALE';
      if (femaleVoices.includes(voiceName)) return 'FEMALE';
      return 'MALE'; // Default fallback
    };

    const voiceGender = getVoiceGender(voice);

    // Clean the text to ensure it's actual content
    const cleanText = this.cleanTextForSpeech(text);

    console.log(`🎤 Processing text for TTS - Length: ${cleanText.length} chars`);
    console.log(`🎤 Text to synthesize: "${cleanText.substring(0, 100)}..."`);

    const request = {
      input: { text: cleanText },
      voice: {
        languageCode: 'en-IN',
        name: voice,
        ssmlGender: voiceGender,
      },
      audioConfig: {
        audioEncoding: 'MP3' as const,
        speakingRate: speed,
        pitch: pitch,
        volumeGainDb: 2.0,
        sampleRateHertz: 24000,
        effectsProfileId: ['telephony-class-application'],
      },
    };

    console.log(`🎤 Generating speech with Google Cloud TTS - voice: ${voice} (${voiceGender})`);
    console.log(`🎤 Expected audio duration: ~${Math.ceil(cleanText.length / 14)} seconds (based on ~14 chars/second)`);

    // Perform the text-to-speech request
    const [response] = await this.client.synthesizeSpeech(request);

    if (!response.audioContent) {
      throw new Error('No audio content received from Google TTS');
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Write the audio content to file
    await fs.writeFile(outputPath, response.audioContent as Buffer);

    // Verify the audio file was created properly
    const stats = await fs.stat(outputPath);
    console.log(`✅ Audio saved to: ${outputPath} (${Math.round(stats.size / 1024)}KB)`);
    
    return outputPath;
  }

  private cleanTextForSpeech(text: string): string {
    console.log(`📝 Cleaning text for speech. Original length: ${text.length}`);
    console.log(`📝 First 200 chars: "${text.substring(0, 200)}..."`);
    
    // Clean and preserve ALL content for TTS
    let cleaned = text
      // Remove only problematic formatting that breaks TTS
      .replace(/^\[.*?\]\s*/gm, '') // Remove stage directions
      .replace(/\n{3,}/g, ' ') // Convert multiple newlines to single space
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s.,!?'-]/g, ' ') // Remove special characters that break TTS
      .replace(/\s+/g, ' ') // Final whitespace cleanup
      .trim();

    console.log(`📝 Cleaned text length: ${cleaned.length}`);
    
    // Ensure we have substantial content
    if (cleaned.length < 100) {
      console.warn('⚠️ Text too short after cleaning');
      throw new Error('Insufficient content for TTS');
    }
    
    console.log(`📝 Final text for TTS: "${cleaned.substring(0, 200)}..."`);
    console.log(`🎤 Expected TTS duration: ~${Math.ceil(cleaned.length / 15)} seconds (${Math.ceil(cleaned.length / 900)} minutes)`);
    
    return cleaned;
  }

  private async generateAndCombineChunks(chunks: string[], outputPath: string, voice: string, speed: number, pitch: number): Promise<string> {
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    const chunkFiles: string[] = [];

    // Generate audio for each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunkPath = path.join(outputDir, `chunk_${i}_${Date.now()}.mp3`);
      await this.generateSingleChunk(chunks[i], chunkPath, voice, speed, pitch);
      chunkFiles.push(chunkPath);
    }

    // Combine chunks using FFmpeg
    if (chunkFiles.length > 1) {
      try {
        const { execSync } = require('child_process');
        const fileList = chunkFiles.map(f => `file '${f}'`).join('\n');
        const listPath = path.join(outputDir, `filelist_${Date.now()}.txt`);

        await fs.writeFile(listPath, fileList);

        const combineCommand = `ffmpeg -f concat -safe 0 -i "${listPath}" -c copy "${outputPath}" -y`;
        execSync(combineCommand, { stdio: 'pipe' });

        // Cleanup
        await fs.unlink(listPath);
        for (const chunkFile of chunkFiles) {
          await fs.unlink(chunkFile).catch(() => {});
        }

        console.log(`✅ Combined audio chunks into: ${outputPath}`);
        return outputPath;
      } catch (combineError) {
        console.warn('Failed to combine chunks, using first chunk:', combineError.message);
        await fs.copyFile(chunkFiles[0], outputPath);

        // Cleanup
        for (const chunkFile of chunkFiles) {
          await fs.unlink(chunkFile).catch(() => {});
        }

        return outputPath;
      }
    } else {
      // Single chunk, just rename
      await fs.rename(chunkFiles[0], outputPath);
      return outputPath;
    }
  }

  private async createEmergencyFallback(text: string, outputPath: string): Promise<string> {
    try {
      console.log('🚨 CREATING EMERGENCY FALLBACK - THIS IS NOT YOUR SCRIPT CONTENT!');
      console.log('🚨 PLEASE FIX GOOGLE CLOUD TTS AUTHENTICATION TO GET ACTUAL SPEECH');

      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Calculate proper duration based on text length
      const wordCount = text.split(' ').length;
      const estimatedDuration = Math.max(30, Math.min(300, (wordCount / 150) * 60));

      // Create a simple silence MP3 with proper duration
      await this.createSilentMp3(outputPath, estimatedDuration);

      console.log(`⚠️ Emergency fallback created: ${outputPath} (${estimatedDuration}s silence)`);
      console.log('⚠️ This file contains SILENCE, not your script content!');
      
      return outputPath;

    } catch (error) {
      console.error('❌ Emergency fallback creation failed:', error);
      throw new Error(`Emergency fallback creation failed: ${error.message}`);
    }
  }

  private async createSilentMp3(outputPath: string, duration: number): Promise<void> {
    // Create a proper silent MP3 file
    const sampleRate = 44100;
    const channels = 1;
    const samples = Math.floor(duration * sampleRate);
    
    // Create WAV header for silence
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + samples * 2, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);  // PCM
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(samples * 2, 40);

    // Create silent audio data
    const audioData = Buffer.alloc(samples * 2, 0);

    // Combine header and data
    const completeAudio = Buffer.concat([header, audioData]);
    await fs.writeFile(outputPath, completeAudio);
  }

  private async generateSpeechLikeAudio(duration: number, sampleRate: number): Promise<Buffer> {
    const numSamples = Math.floor(duration * sampleRate);
    const audioBuffer = Buffer.alloc(numSamples * 2); // 16-bit audio

    // Generate speech-like waveform with varying frequencies and amplitude
    for (let i = 0; i < numSamples; i++) {
      const time = i / sampleRate;

      // Create speech-like frequency modulation
      const baseFreq = 150 + 50 * Math.sin(2 * Math.PI * time * 0.5); // Fundamental frequency
      const harmonic1 = Math.sin(2 * Math.PI * baseFreq * time) * 0.5;
      const harmonic2 = Math.sin(2 * Math.PI * baseFreq * 2 * time) * 0.3;
      const harmonic3 = Math.sin(2 * Math.PI * baseFreq * 3 * time) * 0.2;

      // Add some noise for naturalness
      const noise = (Math.random() - 0.5) * 0.1;

      // Amplitude modulation (speech envelope)
      const envelope = 0.8 + 0.2 * Math.sin(2 * Math.PI * time * 3);

      const sample = (harmonic1 + harmonic2 + harmonic3 + noise) * envelope * 16384;
      const clampedSample = Math.max(-32768, Math.min(32767, sample));

      audioBuffer.writeInt16LE(clampedSample, i * 2);
    }

    // Create WAV header
    const wavHeader = this.createWavHeader(numSamples * 2, sampleRate);
    return Buffer.concat([wavHeader, audioBuffer]);
  }

  private createWavHeader(dataSize: number, sampleRate: number): Buffer {
    const header = Buffer.alloc(44);

    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);

    // fmt chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // chunk size
    header.writeUInt16LE(1, 20);  // audio format (PCM)
    header.writeUInt16LE(1, 22);  // num channels
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28); // byte rate
    header.writeUInt16LE(2, 32);  // block align
    header.writeUInt16LE(16, 34); // bits per sample

    // data chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return header;
  }

  private async createWebAudioStyleMp3(outputPath: string, duration: number): Promise<void> {
    // Create a more sophisticated MP3-like structure
    const sampleRate = 44100;
    const bitRate = 192000;
    const frameSize = 1152; // MP3 frame size
    const framesNeeded = Math.floor(duration * sampleRate / frameSize);

    // MP3 header structure
    const mp3Header = Buffer.from([
      0xFF, 0xFB, 0x92, 0x00, // MP3 sync + header for 44.1kHz, 192kbps
      0x00, 0x00, 0x00, 0x00  // Additional header bytes
    ]);

    // Generate audio data with better structure
    const frameData = Buffer.alloc(417); // Standard MP3 frame size for 192kbps

    // Fill with pseudo-random but structured data
    for (let i = 0; i < frameData.length; i++) {
      frameData[i] = Math.floor(Math.random() * 256);
    }

    // Combine header with repeated frame data
    const frames = [];
    for (let i = 0; i < framesNeeded; i++) {
      frames.push(mp3Header);
      frames.push(frameData);
    }

    const completeAudio = Buffer.concat(frames);
    await fs.writeFile(outputPath, completeAudio);
  }

  private async createMinimalMp3(outputPath: string, text: string): Promise<void> {
    // Calculate duration based on text
    const wordCount = text.split(' ').length;
    const duration = Math.max(30, Math.min(600, (wordCount / 150) * 60));

    // Create a proper MP3 header and data
    const mp3Header = Buffer.from([
      0xFF, 0xFB, 0x90, 0x00, // MP3 sync word and header
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00
    ]);

    // Create audio data (silence)
    const frameSize = 417; // Standard MP3 frame size for 44.1kHz
    const framesNeeded = Math.floor(duration * 38.28); // ~38.28 frames per second
    const audioData = Buffer.alloc(framesNeeded * frameSize, 0x00);

    // Combine header and data
    const completeAudio = Buffer.concat([mp3Header, audioData]);

    await fs.writeFile(outputPath, completeAudio);
  }

  async generateNarration(script: string, outputDir: string, videoId: string): Promise<string> {
    const outputPath = path.join(outputDir, `${videoId}_narration.mp3`);

    // Split long scripts into chunks for better synthesis
    const chunks = this.splitTextIntoChunks(script, 4000); // Google TTS has character limits
    const audioFiles: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunkPath = path.join(outputDir, `${videoId}_chunk_${i}.mp3`);
      await this.generateSpeech({
        text: chunks[i],
        outputPath: chunkPath,
        voice: 'en-IN-Wavenet-D', // Male Indian English voice
        speed: 1.1, // Slightly faster for engagement
        pitch: 0
      });
      audioFiles.push(chunkPath);
    }

    // If multiple chunks, we would need to combine them (requires ffmpeg)
    // For now, return the first chunk or implement audio concatenation
    if (audioFiles.length === 1) {
      await fs.rename(audioFiles[0], outputPath);
      return outputPath;
    } else {
      // TODO: Implement audio concatenation using ffmpeg
      // For now, just use the first chunk
      await fs.rename(audioFiles[0], outputPath);

      // Clean up remaining chunks
      for (let i = 1; i < audioFiles.length; i++) {
        await fs.unlink(audioFiles[i]).catch(() => {});
      }

      return outputPath;
    }
  }

  private splitTextIntoChunks(text: string, maxLength: number): string[] {
    console.log(`📝 Splitting text into chunks. Total length: ${text.length}, Max chunk: ${maxLength}`);
    
    // For very long scripts, use smaller chunks to ensure complete processing
    const chunkSize = Math.min(maxLength, 3000); // Smaller chunks for reliability
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      const testChunk = currentChunk ? `${currentChunk}. ${trimmedSentence}` : trimmedSentence;
      
      if (testChunk.length <= chunkSize) {
        currentChunk = testChunk;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk + '.');
          console.log(`📝 Created chunk ${chunks.length}: ${currentChunk.length} chars`);
        }
        currentChunk = trimmedSentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk + '.');
      console.log(`📝 Created final chunk ${chunks.length}: ${currentChunk.length} chars`);
    }

    const totalChunks = chunks.length || 1;
    console.log(`📝 Split into ${totalChunks} chunks for TTS processing`);
    
    return chunks.length > 0 ? chunks : [text.substring(0, chunkSize)];
  }

  private createNaturalSSML(text: string, voice: string): string {
    // Add natural emphasis and pauses for Indian speaking style
    let ssmlText = text
      // Add emphasis on important words
      .replace(/\b(important|amazing|incredible|breaking|latest)\b/gi, '<emphasis level="strong">$1</emphasis>')
      // Add pauses for natural flow
      .replace(/\. /g, '.<break time="0.8s"/> ')
      .replace(/, /g, ',<break time="0.3s"/> ')
      .replace(/! /g, '!<break time="0.5s"/> ')
      .replace(/\? /g, '?<break time="0.6s"/> ')
      // Add prosody for emotional delivery
      .replace(/\b(shocking|surprising|unbelievable)\b/gi, '<prosody rate="slow" pitch="+2st">$1</prosody>')
      // Add breathing pauses
      .replace(/(\w+)(\. )(\w+)/g, '$1$2<break time="0.4s"/>$3');

    // Wrap in SSML tags with Indian pronunciation hints
    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-IN">
      <prosody rate="0.92" pitch="-1st" volume="+2dB">
        ${ssmlText}
      </prosody>
    </speak>`;
  }

  getAvailableVoices() {
    return {
      'en-IN-Standard-A': 'Indian English Female',
      'en-IN-Standard-B': 'Indian English Male',
      'en-IN-Standard-C': 'Indian English Female',
      'en-IN-Standard-D': 'Indian English Male',
      'en-IN-Wavenet-A': 'Indian English Female (Premium)',
      'en-IN-Wavenet-B': 'Indian English Male (Premium)',
      'en-IN-Wavenet-C': 'Indian English Female (Premium)',
      'en-IN-Wavenet-D': 'Indian English Male (Premium)',
      'en-IN-Neural2-A': 'Indian English Female (Neural)',
      'en-IN-Neural2-B': 'Indian English Male (Neural)',
      'en-IN-Neural2-C': 'Indian English Female (Neural)',
      'en-IN-Neural2-D': 'Indian English Female (Neural)', // Corrected: This is actually female
    };
  }

  private enhanceScriptForNaturalSpeech(script: string): string {
    // Ensure we have actual content to enhance
    if (!script || script.length < 50) {
      console.warn('⚠️ Script too short or empty, cannot enhance');
      throw new Error('Script content is insufficient for enhancement');
    }

    console.log(`📝 Original script to enhance: "${script.substring(0, 200)}..."`);
    console.log(`📝 Full script length before enhancement: ${script.length} characters`);

    // PRESERVE ALL ORIGINAL CONTENT - minimal modifications only
    let enhanced = script.trim();

    // Only add intro if clearly missing (very conservative check)
    const hasIntro = enhanced.toLowerCase().includes('hello') || 
                     enhanced.toLowerCase().includes('welcome') ||
                     enhanced.toLowerCase().includes('namaste') ||
                     enhanced.toLowerCase().includes('hi ') ||
                     enhanced.toLowerCase().includes('greetings');
    
    if (!hasIntro && enhanced.length < 2000) { // Only add intro for shorter content
      enhanced = `Hello friends, welcome back to our channel! ${enhanced}`;
    }

    // Only add outro if clearly missing and content is reasonable length
    const hasOutro = enhanced.toLowerCase().includes('subscribe') || 
                     enhanced.toLowerCase().includes('like and subscribe') ||
                     enhanced.toLowerCase().includes('thank you for watching') ||
                     enhanced.toLowerCase().includes('see you next time');
    
    if (!hasOutro && enhanced.length < 3000) { // Only add outro for shorter content
      enhanced += ` Thank you so much for watching this video! If you found this information helpful, please give this video a thumbs up and subscribe to our channel for more amazing content. Hit the notification bell so you never miss our latest updates. Until next time, take care and see you in the next video!`;
    }

    console.log(`✅ Enhanced script length: ${enhanced.length} characters`);
    console.log(`📝 Content growth: +${enhanced.length - script.length} characters`);
    console.log(`📝 Enhanced script preview: "${enhanced.substring(0, 300)}..."`);
    
    return enhanced;
  }
}

export const textToSpeechService = new TextToSpeechService();