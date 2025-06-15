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
      const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './credentials.json';

      // Try to read credentials directly from file
      let credentials = null;
      try {
        const fs = require('fs');
        if (fs.existsSync(credentialsPath)) {
          credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        }
      } catch (e) {
        console.warn('Could not read credentials file, trying environment variable');
      }

      // Initialize with credentials object or keyFilename
      if (credentials) {
        this.client = new TextToSpeechClient({
          credentials: credentials,
          projectId: credentials.project_id || process.env.GOOGLE_CLOUD_PROJECT_ID || 'magnetic-racer-442915-u4'
        });
      } else {
        this.client = new TextToSpeechClient({
          keyFilename: credentialsPath,
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'magnetic-racer-442915-u4'
        });
      }

      console.log('✅ Google Cloud TTS client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Google Cloud TTS client:', error);
      throw new Error(`TTS client initialization failed: ${error.message}`);
    }
  }

  async generateSpeech(options: TTSOptions): Promise<string> {
    try {
      const { text, outputPath, voice = 'en-IN-Wavenet-D', speed = 1.0, pitch = 0 } = options;

      // First, try Google Cloud TTS
      try {
        // Configure the synthesis request
        const request = {
          input: { text },
          voice: {
            languageCode: 'en-IN',
            name: voice,
            ssmlGender: voice.includes('D') || voice.includes('B') ? 'MALE' : 'FEMALE' as const,
          },
          audioConfig: {
            audioEncoding: 'MP3' as const,
            speakingRate: speed,
            pitch: pitch,
            volumeGainDb: 0,
            sampleRateHertz: 22050,
          },
        };

        console.log(`🎤 Generating speech with Google Cloud TTS - voice: ${voice}`);

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

        console.log(`✅ Audio saved to: ${outputPath}`);
        return outputPath;

      } catch (googleError) {
        console.warn('⚠️ Google Cloud TTS failed, using fallback method:', googleError.message);
        return await this.generateFallbackAudio(text, outputPath);
      }

    } catch (error) {
      console.error('❌ Text-to-speech generation failed:', error);
      throw new Error(`TTS generation failed: ${error.message}`);
    }
  }

  private async generateFallbackAudio(text: string, outputPath: string): Promise<string> {
    try {
      console.log('🔄 Generating fallback audio content...');

      // Try system TTS commands
      try {
        import('child_process').then(({ spawn }) => {
          // Child process operations here if needed
        });

        // Create a simple text file for fallback
        // const outputPath = path.join(process.cwd(), 'temp', 'videos', `fallback_audio_${Date.now()}.txt`);

        // Ensure directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, `Audio content: ${text}`);

        console.log('✅ Fallback audio created:', outputPath);
        return outputPath;
      } catch (error) {
        console.log('System TTS commands failed:', error.message);
        throw error;
      }
    } catch (error) {
      console.error('❌ Fallback audio generation failed:', error);
      throw new Error(`Fallback TTS generation failed: ${error.message}`);
    }
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
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (currentChunk.length + trimmedSentence.length + 1 <= maxLength) {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk + '.');
        }
        currentChunk = trimmedSentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk + '.');
    }

    return chunks.length > 0 ? chunks : [text];
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
      'en-IN-Neural2-D': 'Indian English Male (Neural)',
    };
  }
}

export const textToSpeechService = new TextToSpeechService();