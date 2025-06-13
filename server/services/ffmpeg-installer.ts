
import { execSync } from 'child_process';
import fs from 'fs';

export class FFmpegInstaller {
  static async ensureFFmpeg(): Promise<void> {
    try {
      // Check if FFmpeg is already installed
      execSync('ffmpeg -version', { stdio: 'pipe' });
      console.log('✅ FFmpeg is already installed');
      return;
    } catch (error) {
      console.log('📦 Installing FFmpeg...');
      await this.installFFmpeg();
    }
  }

  private static async installFFmpeg(): Promise<void> {
    try {
      // Install FFmpeg using system package manager
      const commands = [
        'apt-get update',
        'apt-get install -y ffmpeg',
        'apt-get install -y imagemagick',
        'apt-get install -y fonts-dejavu'
      ];

      for (const command of commands) {
        console.log(`Running: ${command}`);
        execSync(command, { stdio: 'pipe' });
      }

      console.log('✅ FFmpeg and dependencies installed successfully');
    } catch (error) {
      console.error('❌ FFmpeg installation failed:', error.message);
      throw new Error('Could not install FFmpeg. Please install manually.');
    }
  }

  static async validateInstallation(): Promise<boolean> {
    try {
      execSync('ffmpeg -version', { stdio: 'pipe' });
      execSync('ffprobe -version', { stdio: 'pipe' });
      
      // Check for required fonts
      const fontPath = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
      if (fs.existsSync(fontPath)) {
        console.log('✅ All video creation dependencies are ready');
        return true;
      } else {
        console.warn('⚠️  Font files not found, text overlays may not work');
        return false;
      }
    } catch (error) {
      console.error('❌ Video creation dependencies missing:', error.message);
      return false;
    }
  }
}
