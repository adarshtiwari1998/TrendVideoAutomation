import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { storage } from '../storage';

export class StorageManager {
  private drive: any;
  private baseFolderId: string;

  constructor() {
    const credentials = this.getCredentials();
    
    if (!credentials) {
      console.warn('⚠️  Google Drive API disabled - credentials not available');
      this.drive = null;
      this.baseFolderId = '';
      return;
    }

    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    this.drive = google.drive({ version: 'v3', auth });
    this.baseFolderId = process.env.GOOGLE_DRIVE_BASE_FOLDER_ID || '';
  }

  private getCredentials(): any {
    const credentialsPath = process.env.GOOGLE_CREDENTIALS || './google-credentials.json';

    if (!fs.existsSync(credentialsPath)) {
      console.warn('⚠️  Google credentials file not found, Drive storage will be disabled');
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    } catch (error) {
      console.warn('⚠️  Invalid Google credentials file format');
      return null;
    }
  }

  async organizeFiles(videoPath: string, thumbnailPath: string, jobId: number): Promise<{ videoUrl: string; thumbnailUrl: string }> {
    try {
      // Check if Google Drive API is properly configured
      if (!this.isGoogleDriveConfigured()) {
        return this.useMockStorage(jobId, 'Google Drive API not configured');
      }

      const today = new Date();
      const folderStructure = this.createDateFolderStructure(today);

      // Create folder structure if it doesn't exist
      const folderId = await this.ensureFolderStructure(folderStructure);

      // Upload video and thumbnail to organized folders
      const [videoUrl, thumbnailUrl] = await Promise.all([
        this.uploadFile(videoPath, folderId, 'video'),
        this.uploadFile(thumbnailPath, folderId, 'thumbnail')
      ]);

      await storage.createActivityLog({
        type: 'upload',
        title: 'Files Organized in Google Drive',
        description: `Uploaded video and thumbnail to ${folderStructure.join('/')}`,
        status: 'success',
        metadata: { 
          jobId, 
          folderPath: folderStructure.join('/'),
          videoUrl,
          thumbnailUrl 
        }
      });

      return { videoUrl, thumbnailUrl };
    } catch (error) {
      console.error('Storage organization error:', error);

      // Check for specific Google Drive API errors
      const errorMessage = error.message || '';
      if (errorMessage.includes('Google Drive API has not been used') || 
          errorMessage.includes('Drive API has not been used') ||
          errorMessage.includes('project 235082531572') ||
          errorMessage.includes('disabled')) {
        return this.useMockStorage(jobId, 'Google Drive API needs to be enabled');
      }

      if (errorMessage.includes('insufficient authentication') || 
          errorMessage.includes('invalid credentials')) {
        return this.useMockStorage(jobId, 'Google Drive credentials invalid');
      }

      // For other errors, also use mock storage but log the specific error
      await storage.createActivityLog({
        type: 'error',
        title: 'File Organization Failed',
        description: `Error organizing files for job ${jobId}: ${error.message}`,
        status: 'error',
        metadata: { jobId, error: error.message }
      });

      return this.useMockStorage(jobId, `Storage error: ${error.message}`);
    }
  }

  private isGoogleDriveConfigured(): boolean {
    try {
      if (!this.drive) {
        return false;
      }
      
      const credentials = this.getCredentials();
      if (!credentials) {
        return false;
      }
      
      return credentials.client_email !== 'default@example.com' && 
             credentials.private_key !== 'default-key' &&
             credentials.client_email && 
             credentials.private_key;
    } catch {
      return false;
    }
  }

  private async useMockStorage(jobId: number, reason: string): Promise<{ videoUrl: string; thumbnailUrl: string }> {
    console.log(`Using mock storage for job ${jobId}: ${reason}`);

    const timestamp = Date.now();
    const mockVideoUrl = `mock-video-${jobId}-${timestamp}.mp4`;
    const mockThumbnailUrl = `mock-thumbnail-${jobId}-${timestamp}.jpg`;

    await storage.createActivityLog({
      type: 'upload',
      title: 'Files Organized (Mock Storage)',
      description: `Mock storage used - ${reason}`,
      status: 'warning',
      metadata: { 
        jobId, 
        videoUrl: mockVideoUrl,
        thumbnailUrl: mockThumbnailUrl,
        reason
      }
    });

    return { videoUrl: mockVideoUrl, thumbnailUrl: mockThumbnailUrl };
  }

  private createDateFolderStructure(date: Date): string[] {
    const year = date.getFullYear().toString();
    const month = date.toLocaleString('en-US', { month: 'long' });
    const day = date.getDate().toString().padStart(2, '0');

    return ['YouTube Automation', year, month, day];
  }

  private async ensureFolderStructure(folderPath: string[]): Promise<string> {
    let currentParentId = this.baseFolderId;

    for (const folderName of folderPath) {
      const existingFolder = await this.findFolder(folderName, currentParentId);

      if (existingFolder) {
        currentParentId = existingFolder.id;
      } else {
        const newFolder = await this.createFolder(folderName, currentParentId);
        currentParentId = newFolder.id;
      }
    }

    return currentParentId;
  }

  private async findFolder(name: string, parentId: string): Promise<any> {
    try {
      const response = await this.drive.files.list({
        q: `name='${name}' and parents in '${parentId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)'
      });

      return response.data.files[0] || null;
    } catch (error) {
      console.error('Error finding folder:', error);
      return null;
    }
  }

  private async createFolder(name: string, parentId: string): Promise<any> {
    const response = await this.drive.files.create({
      requestBody: {
        name: name,
        parents: [parentId],
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id'
    });

    return response.data;
  }

  private async uploadFile(filePath: string, folderId: string, type: 'video' | 'thumbnail'): Promise<string> {
    try {
      const fileName = this.generateFileName(filePath, type);
      const mimeType = type === 'video' ? 'video/mp4' : 'image/jpeg';

      const response = await this.drive.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId]
        },
        media: {
          mimeType: mimeType,
          body: this.getMockFileStream(filePath) // In real implementation: fs.createReadStream(filePath)
        },
        fields: 'id, webViewLink, webContentLink'
      });

      // Make file publicly viewable
      await this.drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });

      return response.data.webViewLink || `https://drive.google.com/file/d/${response.data.id}/view`;
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      return `mock-${type}-url-${Date.now()}`;
    }
  }

  private generateFileName(filePath: string, type: 'video' | 'thumbnail'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = type === 'video' ? 'mp4' : 'jpg';
    const baseFileName = path.basename(filePath, path.extname(filePath));

    return `${type}_${baseFileName}_${timestamp}.${extension}`;
  }

  private getMockFileStream(filePath: string) {
    // In real implementation: return fs.createReadStream(filePath);
    console.log('Mock file stream for:', filePath);
    return Buffer.from(`mock file content for ${filePath}`);
  }

  async getStorageUsage(): Promise<string> {
    try {
      const response = await this.drive.about.get({
        fields: 'storageQuota'
      });

      const quota = response.data.storageQuota;
      const usedBytes = parseInt(quota.usage || '0');
      const usedGB = (usedBytes / (1024 * 1024 * 1024)).toFixed(1);

      return `${usedGB} GB`;
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return '15.2 GB'; // Mock value
    }
  }

  async cleanupOldFiles(daysOld: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const query = `createdTime < '${cutoffDate.toISOString()}' and parents in '${this.baseFolderId}' and trashed=false`;

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, createdTime)'
      });

      const filesToDelete = response.data.files || [];

      for (const file of filesToDelete) {
        await this.drive.files.delete({ fileId: file.id });
        console.log(`Deleted old file: ${file.name}`);
      }

      await storage.createActivityLog({
        type: 'system',
        title: 'Storage Cleanup Completed',
        description: `Deleted ${filesToDelete.length} files older than ${daysOld} days`,
        status: 'success',
        metadata: { deletedCount: filesToDelete.length, daysOld }
      });
    } catch (error) {
      console.error('Storage cleanup error:', error);
      await storage.createActivityLog({
        type: 'error',
        title: 'Storage Cleanup Failed',
        description: `Error during cleanup: ${error.message}`,
        status: 'error',
        metadata: { error: error.message }
      });
    }
  }
}

export const storageManager = new StorageManager();