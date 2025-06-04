import { storage } from '../storage';
import { contentGenerator } from '../services/content-generator';
import { videoCreator } from '../services/video-creator';
import { thumbnailGenerator } from '../services/thumbnail-generator';
import { youtubeUploader } from '../services/youtube-uploader';
import { storageManager } from '../services/storage-manager';
import type { TrendingTopic, ContentJob } from '@shared/schema';

export class AutomationPipeline {
  private isRunning: boolean = false;

  async processTrendingTopic(topicId: number, videoType: 'long_form' | 'short'): Promise<ContentJob> {
    try {
      console.log(`Starting pipeline for topic ${topicId}, type: ${videoType}`);
      
      // Step 1: Generate script
      const job = await contentGenerator.createContentJob(topicId, videoType);
      console.log(`Script generated for job ${job.id}`);
      
      // Step 2: Create video with professional editing
      const videoPath = await videoCreator.createVideo(job.id);
      console.log(`Video created: ${videoPath}`);
      
      // Step 3: Generate catchy thumbnail
      const thumbnailPath = await thumbnailGenerator.generateThumbnail(job.id);
      console.log(`Thumbnail generated: ${thumbnailPath}`);
      
      // Step 4: Organize files in Google Drive
      const { videoUrl, thumbnailUrl } = await storageManager.organizeFiles(
        videoPath, 
        thumbnailPath, 
        job.id
      );
      
      await storage.updateContentJob(job.id, {
        driveUrl: videoUrl,
        status: 'completed',
        progress: 100
      });
      
      // Step 5: Schedule for optimal upload time
      const optimalTime = youtubeUploader.getOptimalUploadTime(videoType);
      await storage.updateContentJob(job.id, {
        scheduledTime: optimalTime
      });
      
      console.log(`Pipeline completed for job ${job.id}. Scheduled for: ${optimalTime}`);
      
      await storage.createActivityLog({
        type: 'system',
        title: 'Pipeline Completed Successfully',
        description: `${videoType} video "${job.title}" ready for upload`,
        status: 'success',
        metadata: { 
          jobId: job.id, 
          videoType, 
          scheduledTime: optimalTime.toISOString(),
          driveUrl: videoUrl 
        }
      });

      return job;
    } catch (error) {
      console.error('Pipeline error:', error);
      await storage.createActivityLog({
        type: 'error',
        title: 'Pipeline Failed',
        description: `Error processing topic ${topicId}: ${error.message}`,
        status: 'error',
        metadata: { topicId, videoType, error: error.message }
      });
      throw error;
    }
  }

  async processScheduledUploads(): Promise<void> {
    try {
      const scheduledJobs = await storage.getScheduledContentJobs();
      const now = new Date();
      
      console.log(`Checking ${scheduledJobs.length} scheduled jobs for upload`);
      
      for (const job of scheduledJobs) {
        if (job.scheduledTime && job.scheduledTime <= now) {
          console.log(`Uploading scheduled job ${job.id}: ${job.title}`);
          
          try {
            const youtubeId = await youtubeUploader.uploadVideo(job.id);
            console.log(`Successfully uploaded job ${job.id} to YouTube: ${youtubeId}`);
          } catch (uploadError) {
            console.error(`Upload failed for job ${job.id}:`, uploadError);
            // Continue with other uploads even if one fails
          }
        }
      }
    } catch (error) {
      console.error('Scheduled uploads error:', error);
      await storage.createActivityLog({
        type: 'error',
        title: 'Scheduled Upload Processing Failed',
        description: `Error processing scheduled uploads: ${error.message}`,
        status: 'error',
        metadata: { error: error.message }
      });
    }
  }

  async runDailyAutomation(): Promise<void> {
    if (this.isRunning) {
      console.log('Daily automation already running, skipping...');
      return;
    }

    try {
      this.isRunning = true;
      console.log('Starting daily automation process...');

      await storage.createActivityLog({
        type: 'system',
        title: 'Daily Automation Started',
        description: 'Automated cron job initiated - target: 1 long video + 1 short',
        status: 'info',
        metadata: { target: '1 long video + 1 short', startTime: new Date().toISOString() }
      });

      // Get high priority trending topics
      const highPriorityTopics = await storage.getTrendingTopicsByPriority('high');
      
      if (highPriorityTopics.length === 0) {
        console.log('No high priority topics found, using medium priority');
        const mediumPriorityTopics = await storage.getTrendingTopicsByPriority('medium');
        if (mediumPriorityTopics.length >= 2) {
          await this.processTopicsForDay(mediumPriorityTopics.slice(0, 2));
        }
      } else if (highPriorityTopics.length >= 2) {
        await this.processTopicsForDay(highPriorityTopics.slice(0, 2));
      } else {
        // Mix of high and medium priority
        const mediumTopics = await storage.getTrendingTopicsByPriority('medium');
        const selectedTopics = [...highPriorityTopics, ...mediumTopics].slice(0, 2);
        await this.processTopicsForDay(selectedTopics);
      }

      await storage.createActivityLog({
        type: 'system',
        title: 'Daily Automation Completed',
        description: 'Successfully created daily content batch',
        status: 'success',
        metadata: { 
          completedAt: new Date().toISOString(),
          totalJobs: 2 
        }
      });

      console.log('Daily automation completed successfully');
    } catch (error) {
      console.error('Daily automation error:', error);
      await storage.createActivityLog({
        type: 'error',
        title: 'Daily Automation Failed',
        description: `Error during daily automation: ${error.message}`,
        status: 'error',
        metadata: { error: error.message }
      });
    } finally {
      this.isRunning = false;
    }
  }

  private async processTopicsForDay(topics: TrendingTopic[]): Promise<void> {
    const jobs: Promise<ContentJob>[] = [];
    
    // Create one long-form video from first topic
    if (topics[0]) {
      jobs.push(this.processTrendingTopic(topics[0].id, 'long_form'));
    }
    
    // Create one short from second topic (or same topic if only one available)
    const shortTopic = topics[1] || topics[0];
    if (shortTopic) {
      jobs.push(this.processTrendingTopic(shortTopic.id, 'short'));
    }
    
    // Process both in parallel
    const completedJobs = await Promise.all(jobs);
    console.log(`Created ${completedJobs.length} videos for today`);
  }

  async getActivePipelineStatus(): Promise<any> {
    const activeJobs = await storage.getActiveContentJobs();
    const scheduledJobs = await storage.getScheduledContentJobs();
    
    return {
      active: activeJobs.map(job => ({
        id: job.id,
        title: job.title,
        videoType: job.videoType,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt
      })),
      scheduled: scheduledJobs.map(job => ({
        id: job.id,
        title: job.title,
        videoType: job.videoType,
        scheduledTime: job.scheduledTime,
        status: 'ready'
      })),
      isRunning: this.isRunning
    };
  }
}

export const automationPipeline = new AutomationPipeline();
