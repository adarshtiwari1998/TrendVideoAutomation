
import { google } from 'googleapis';
import { storage } from '../storage';
import fs from 'fs';

export class YouTubeChannelManager {
  private youtube: any;

  constructor() {
    const credentials = this.getCredentials();
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube'
      ],
    });

    this.youtube = google.youtube({ version: 'v3', auth });
  }

  private getCredentials() {
    try {
      if (process.env.GOOGLE_CREDENTIALS) {
        return JSON.parse(process.env.GOOGLE_CREDENTIALS);
      }
      return JSON.parse(fs.readFileSync('credentials.json', 'utf8'));
    } catch (error) {
      console.error('Credentials error:', error);
      throw new Error('Google credentials not found');
    }
  }

  async addChannelByName(channelName: string): Promise<{ channelId: string; channelUrl: string }> {
    try {
      console.log(`Searching for channel: ${channelName}`);
      
      // Search for channel by name
      const searchResponse = await this.youtube.search.list({
        part: ['snippet'],
        q: channelName,
        type: 'channel',
        maxResults: 10
      });

      if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
        throw new Error(`No channel found with name: ${channelName}`);
      }

      // Find exact match or closest match
      let targetChannel = searchResponse.data.items.find(
        item => item.snippet.title.toLowerCase() === channelName.toLowerCase()
      ) || searchResponse.data.items[0];

      const channelId = targetChannel.snippet.channelId;
      const channelUrl = `https://www.youtube.com/channel/${channelId}`;

      // Get detailed channel information
      const channelResponse = await this.youtube.channels.list({
        part: ['snippet', 'statistics', 'brandingSettings'],
        id: [channelId]
      });

      const channelDetails = channelResponse.data.items[0];
      
      // Save to database
      await storage.addYouTubeChannel({
        channelName: channelDetails.snippet.title,
        channelId,
        channelUrl,
        isActive: true,
        uploadScheduleLong: '18:30',
        uploadScheduleShort: '20:30'
      });

      await storage.createActivityLog({
        type: 'system',
        title: 'YouTube Channel Added',
        description: `Successfully added channel: ${channelDetails.snippet.title}`,
        status: 'success',
        metadata: {
          channelId,
          channelName: channelDetails.snippet.title,
          subscriberCount: channelDetails.statistics?.subscriberCount || 'N/A',
          videoCount: channelDetails.statistics?.videoCount || 'N/A'
        }
      });

      console.log(`Channel added successfully: ${channelDetails.snippet.title} (${channelId})`);
      
      return {
        channelId,
        channelUrl
      };

    } catch (error) {
      console.error('Error adding channel:', error);
      await storage.createActivityLog({
        type: 'error',
        title: 'Channel Addition Failed',
        description: `Failed to add channel: ${channelName} - ${error.message}`,
        status: 'error',
        metadata: { channelName, error: error.message }
      });
      throw error;
    }
  }

  async getChannelIdByName(channelName: string): Promise<string> {
    try {
      const searchResponse = await this.youtube.search.list({
        part: ['snippet'],
        q: channelName,
        type: 'channel',
        maxResults: 1
      });

      if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
        throw new Error(`Channel not found: ${channelName}`);
      }

      return searchResponse.data.items[0].snippet.channelId;
    } catch (error) {
      console.error('Error getting channel ID:', error);
      throw error;
    }
  }

  async validateChannelAccess(channelId: string): Promise<boolean> {
    try {
      const response = await this.youtube.channels.list({
        part: ['snippet'],
        mine: true
      });

      const ownedChannels = response.data.items || [];
      return ownedChannels.some(channel => channel.id === channelId);
    } catch (error) {
      console.error('Error validating channel access:', error);
      return false;
    }
  }

  async getActiveChannels(): Promise<any[]> {
    return await storage.getActiveYouTubeChannels();
  }

  async updateChannelSettings(channelId: string, settings: {
    uploadScheduleLong?: string;
    uploadScheduleShort?: string;
    isActive?: boolean;
  }): Promise<void> {
    await storage.updateYouTubeChannel(channelId, settings);
    
    await storage.createActivityLog({
      type: 'system',
      title: 'Channel Settings Updated',
      description: `Updated settings for channel: ${channelId}`,
      status: 'success',
      metadata: { channelId, settings }
    });
  }
}

export const youtubeChannelManager = new YouTubeChannelManager();
