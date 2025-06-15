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
      // First try to use the ffmpeg-static package
      try {
        const ffmpegStatic = require('ffmpeg-static');
        if (ffmpegStatic) {
          // Create symlink to make ffmpeg available globally
          const ffmpegPath = '/tmp/ffmpeg';
          if (!fs.existsSync(ffmpegPath)) {
            try {
              fs.symlinkSync(ffmpegStatic, ffmpegPath);
              fs.chmodSync(ffmpegPath, '755');
            } catch (linkError) {
              // If symlink fails, try copying
              fs.copyFileSync(ffmpegStatic, ffmpegPath);
              fs.chmodSync(ffmpegPath, '755');
            }
          }

          // Add to PATH
          process.env.PATH = `/tmp:${process.env.PATH}`;

          // Test if ffmpeg works
          execSync('ffmpeg -version', { stdio: 'pipe' });
          console.log('✅ FFmpeg static binary is ready');
          return;
        }
      } catch (staticError) {
        console.log('📦 ffmpeg-static not available, trying system install...');
      }

      // Try installing ffmpeg via nix
      try {
        console.log('🔧 Installing FFmpeg via nix...');
        execSync('nix-env -iA nixpkgs.ffmpeg', { stdio: 'inherit', timeout: 60000 });
        execSync('ffmpeg -version', { stdio: 'pipe' });
        console.log('✅ FFmpeg installed via nix');
        return;
      } catch (nixError) {
        console.log('⚠️  Nix install failed, trying apt...');
      }

      // Try apt-get as fallback
      try {
        console.log('🔧 Installing FFmpeg via apt...');
        execSync('apt-get update && apt-get install -y ffmpeg', { stdio: 'inherit', timeout: 60000 });
        execSync('ffmpeg -version', { stdio: 'pipe' });
        console.log('✅ FFmpeg installed via apt');
        return;
      } catch (aptError) {
        console.log('⚠️  Apt install failed');
      }

      throw new Error('All FFmpeg installation methods failed');
    } catch (error) {
      console.error('❌ FFmpeg setup failed:', error.message);
      console.log('⚠️  FFmpeg not available, will use fallback methods');
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