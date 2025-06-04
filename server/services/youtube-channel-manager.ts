
import { google } from 'googleapis';
import { db } from '../db';
import { youtubeChannels } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface YouTubeChannelData {
  channelName: string;
  channelId: string;
  channelUrl: string;
  subscriberCount?: number;
  videoCount?: number;
  viewCount?: number;
}

export class YouTubeChannelManager {
  private youtube;
  private oauth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:5000/auth/youtube/callback'
    );

    this.youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client,
    });
  }

  async getChannelIdFromName(channelName: string): Promise<string | null> {
    try {
      console.log(`🔍 Searching for channel: ${channelName}`);

      // Try different search patterns
      const searchQueries = [
        channelName,
        channelName.replace(/[@\s]/g, ''), // Remove @ and spaces
        channelName.replace(/@/g, ''), // Remove only @
      ];

      for (const query of searchQueries) {
        try {
          // Search for channels by name
          const searchResponse = await this.youtube.search.list({
            part: ['snippet'],
            q: query,
            type: ['channel'],
            maxResults: 10,
            key: process.env.YOUTUBE_API_KEY,
          });

          if (searchResponse.data.items && searchResponse.data.items.length > 0) {
            // Look for exact or close matches
            for (const item of searchResponse.data.items) {
              const foundChannelName = item.snippet?.title?.toLowerCase();
              const searchName = channelName.toLowerCase().replace(/@/g, '');
              
              if (foundChannelName?.includes(searchName) || searchName.includes(foundChannelName || '')) {
                const channelId = item.snippet?.channelId;
                if (channelId) {
                  console.log(`✅ Found channel: ${item.snippet?.title} (${channelId})`);
                  return channelId;
                }
              }
            }
          }
        } catch (error) {
          console.log(`Search attempt failed for "${query}":`, error.message);
        }
      }

      // If direct search fails, try searching by custom URL patterns
      if (channelName.startsWith('@')) {
        const handle = channelName.substring(1);
        try {
          const channelResponse = await this.youtube.channels.list({
            part: ['snippet', 'statistics'],
            forHandle: handle,
            key: process.env.YOUTUBE_API_KEY,
          });

          if (channelResponse.data.items && channelResponse.data.items.length > 0) {
            const channelId = channelResponse.data.items[0].id;
            console.log(`✅ Found channel by handle: ${channelResponse.data.items[0].snippet?.title} (${channelId})`);
            return channelId;
          }
        } catch (error) {
          console.log('Handle search failed:', error.message);
        }
      }

      console.log(`❌ Channel not found: ${channelName}`);
      return null;

    } catch (error) {
      console.error('❌ Error searching for channel:', error);
      throw new Error(`Failed to find channel: ${error.message}`);
    }
  }

  async getChannelData(channelId: string): Promise<YouTubeChannelData | null> {
    try {
      const response = await this.youtube.channels.list({
        part: ['snippet', 'statistics'],
        id: [channelId],
        key: process.env.YOUTUBE_API_KEY,
      });

      if (!response.data.items || response.data.items.length === 0) {
        return null;
      }

      const channel = response.data.items[0];
      return {
        channelName: channel.snippet?.title || '',
        channelId: channel.id || '',
        channelUrl: `https://www.youtube.com/channel/${channel.id}`,
        subscriberCount: parseInt(channel.statistics?.subscriberCount || '0'),
        videoCount: parseInt(channel.statistics?.videoCount || '0'),
        viewCount: parseInt(channel.statistics?.viewCount || '0'),
      };
    } catch (error) {
      console.error('❌ Error fetching channel data:', error);
      return null;
    }
  }

  async addChannel(channelName: string, accessToken?: string, refreshToken?: string): Promise<YouTubeChannelData> {
    try {
      console.log(`➕ Adding channel: ${channelName}`);

      // Extract channel ID from name
      const channelId = await this.getChannelIdFromName(channelName);
      if (!channelId) {
        throw new Error(`Channel "${channelName}" not found. Please check the channel name or URL.`);
      }

      // Get full channel data
      const channelData = await this.getChannelData(channelId);
      if (!channelData) {
        throw new Error(`Unable to fetch data for channel ID: ${channelId}`);
      }

      // Check if channel already exists
      const existingChannel = await db
        .select()
        .from(youtubeChannels)
        .where(eq(youtubeChannels.channelId, channelId))
        .limit(1);

      if (existingChannel.length > 0) {
        // Update existing channel
        await db
          .update(youtubeChannels)
          .set({
            channelName: channelData.channelName,
            channelUrl: channelData.channelUrl,
            accessToken,
            refreshToken,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(youtubeChannels.channelId, channelId));

        console.log(`✅ Updated existing channel: ${channelData.channelName}`);
      } else {
        // Insert new channel
        await db.insert(youtubeChannels).values({
          channelName: channelData.channelName,
          channelId: channelData.channelId,
          channelUrl: channelData.channelUrl,
          accessToken,
          refreshToken,
          isActive: true,
        });

        console.log(`✅ Added new channel: ${channelData.channelName}`);
      }

      return channelData;
    } catch (error) {
      console.error('❌ Error adding channel:', error);
      throw error;
    }
  }

  async getChannels(): Promise<any[]> {
    try {
      const channels = await db.select().from(youtubeChannels);
      return channels;
    } catch (error) {
      console.error('❌ Error fetching channels:', error);
      return [];
    }
  }

  async removeChannel(channelId: string): Promise<void> {
    try {
      await db
        .update(youtubeChannels)
        .set({ isActive: false })
        .where(eq(youtubeChannels.channelId, channelId));
      
      console.log(`✅ Deactivated channel: ${channelId}`);
    } catch (error) {
      console.error('❌ Error removing channel:', error);
      throw error;
    }
  }

  async updateSchedule(channelId: string, longFormTime: string, shortFormTime: string): Promise<void> {
    try {
      await db
        .update(youtubeChannels)
        .set({
          uploadScheduleLong: longFormTime,
          uploadScheduleShort: shortFormTime,
          updatedAt: new Date(),
        })
        .where(eq(youtubeChannels.channelId, channelId));

      console.log(`✅ Updated schedule for channel: ${channelId}`);
    } catch (error) {
      console.error('❌ Error updating schedule:', error);
      throw error;
    }
  }

  generateAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.force-ssl'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  async exchangeCodeForTokens(code: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (!tokens.access_token) {
        throw new Error('No access token received');
      }

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || ''
      };
    } catch (error) {
      console.error('❌ Error exchanging code for tokens:', error);
      throw error;
    }
  }
}

export const youtubeChannelManager = new YouTubeChannelManager();
