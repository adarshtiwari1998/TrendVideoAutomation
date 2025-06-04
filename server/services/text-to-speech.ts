
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import fs from 'fs';
import path from 'path';

export class TextToSpeechService {
  private client: TextToSpeechClient;

  constructor() {
    const credentials = this.getCredentials();
    this.client = new TextToSpeechClient({
      projectId: credentials.project_id,
      keyFilename: 'credentials.json'
    });
  }

  private getCredentials() {
    try {
      if (process.env.GOOGLE_CREDENTIALS) {
        return JSON.parse(process.env.GOOGLE_CREDENTIALS);
      }
      return JSON.parse(fs.readFileSync('credentials.json', 'utf8'));
    } catch (error) {
      console.error('TTS Credentials error:', error);
      throw new Error('Google Cloud credentials not found');
    }
  }

  async generateSpeech(text: string, outputPath: string, options: {
    voice?: string;
    languageCode?: string;
    gender?: 'NEUTRAL' | 'FEMALE' | 'MALE';
    audioEncoding?: 'MP3' | 'WAV' | 'OGG';
    speakingRate?: number;
    pitch?: number;
  } = {}): Promise<string> {
    try {
      const {
        voice = 'en-IN-Standard-D', // Indian English voice
        languageCode = 'en-IN',
        gender = 'NEUTRAL',
        audioEncoding = 'MP3',
        speakingRate = 1.0,
        pitch = 0.0
      } = options;

      const request = {
        input: { text },
        voice: {
          languageCode,
          name: voice,
          ssmlGender: gender,
        },
        audioConfig: {
          audioEncoding,
          speakingRate,
          pitch,
          volumeGainDb: 0.0,
          sampleRateHertz: 22050,
        },
      };

      console.log(`Generating speech for text: ${text.substring(0, 100)}...`);
      
      const [response] = await this.client.synthesizeSpeech(request);
      
      if (!response.audioContent) {
        throw new Error('No audio content received from TTS service');
      }

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Write audio content to file
      fs.writeFileSync(outputPath, response.audioContent, 'binary');
      
      console.log(`Audio content written to file: ${outputPath}`);
      return outputPath;

    } catch (error) {
      console.error('TTS generation error:', error);
      throw new Error(`Text-to-speech generation failed: ${error.message}`);
    }
  }

  async generateMultipleSegments(
    segments: { text: string; outputPath: string }[],
    options = {}
  ): Promise<string[]> {
    const results = await Promise.all(
      segments.map(segment => 
        this.generateSpeech(segment.text, segment.outputPath, options)
      )
    );
    return results;
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
    };
  }
}

export const textToSpeechService = new TextToSpeechService();
