
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export class FFmpegInstaller {
  static async ensureFFmpeg(): Promise<void> {
    try {
      // Check if FFmpeg is already available
      execSync('ffmpeg -version', { stdio: 'pipe' });
      console.log('✅ FFmpeg is already installed');
      return;
    } catch (error) {
      console.log('📦 Setting up FFmpeg...');
      await this.setupFFmpeg();
    }
  }

  private static async setupFFmpeg(): Promise<void> {
    try {
      // Use ffmpeg-static package which provides static binaries
      const ffmpegStatic = require('ffmpeg-static');
      
      if (ffmpegStatic) {
        // Create symlink to make ffmpeg available globally
        const ffmpegPath = '/tmp/ffmpeg';
        if (!fs.existsSync(ffmpegPath)) {
          fs.symlinkSync(ffmpegStatic, ffmpegPath);
        }
        
        // Add to PATH
        process.env.PATH = `/tmp:${process.env.PATH}`;
        
        console.log('✅ FFmpeg static binary is ready');
      } else {
        throw new Error('FFmpeg static binary not found');
      }
    } catch (error) {
      console.error('❌ FFmpeg setup failed:', error.message);
      console.log('🔧 Trying alternative approach...');
      
      // Alternative: just proceed without FFmpeg and use fallback methods
      console.log('⚠️  FFmpeg not available, will use fallback video processing');
    }
  }

  static async validateInstallation(): Promise<boolean> {
    try {
      execSync('ffmpeg -version', { stdio: 'pipe' });
      console.log('✅ All video creation dependencies are ready');
      return true;
    } catch (error) {
      console.warn('⚠️  FFmpeg not available, using fallback methods');
      return false;
    }
  }
}
