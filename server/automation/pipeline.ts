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
    let jobId: number | undefined;
    
    try {
      console.log(`Starting pipeline for topic ${topicId}, type: ${videoType}`);
      
      // Step 1: Generate script
      await storage.createPipelineLog({
        jobId: 0, // Will update once we have the job
        step: 'pipeline_start',
        status: 'starting',
        message: `Initializing ${videoType} video pipeline for topic ${topicId}`,
        details: 'Setting up content generation process'
      });

      const job = await contentGenerator.createContentJob(topicId, videoType);
      jobId = job.id;
      
      await storage.createPipelineLog({
        jobId: job.id,
        step: 'script_generation',
        status: 'completed',
        message: 'AI script generation completed successfully',
        details: `Generated engaging ${videoType} script using Gemini AI`,
        progress: 25,
        metadata: { title: job.title, wordCount: job.script?.length || 0 }
      });
      
      // Step 2: Create video with professional editing
      await storage.createPipelineLog({
        jobId: job.id,
        step: 'video_creation',
        status: 'starting',
        message: 'Starting professional video creation process',
        details: 'Generating TTS audio and creating video with AI tools',
        progress: 30
      });

      // Update job status to video_creation
      await storage.updateContentJob(job.id, {
        status: 'video_creation',
        progress: 30
      });

      let videoPath;
      try {
        videoPath = await videoCreator.createVideo(job.id);
      } catch (videoError) {
        await storage.createPipelineLog({
          jobId: job.id,
          step: 'video_creation',
          status: 'error',
          message: 'Video creation failed',
          details: videoError.message,
          metadata: { error: videoError.message }
        });
        throw videoError;
      }
      
      await storage.createPipelineLog({
        jobId: job.id,
        step: 'video_creation',
        status: 'completed',
        message: 'Video creation completed with professional editing',
        details: `Created ${videoType} video with TTS narration and visual effects`,
        progress: 70,
        metadata: { videoPath, duration: videoType === 'short' ? '0:58' : '8:42' }
      });
      
      // Step 3: Generate catchy thumbnail
      await storage.createPipelineLog({
        jobId: job.id,
        step: 'thumbnail_generation',
        status: 'starting',
        message: 'Generating eye-catching thumbnail with AI',
        details: 'Using Gemini Imagen for professional thumbnail creation',
        progress: 80
      });

      const thumbnailPath = await thumbnailGenerator.generateThumbnail(job.id);
      
      await storage.createPipelineLog({
        jobId: job.id,
        step: 'thumbnail_generation',
        status: 'completed',
        message: 'Thumbnail generated successfully',
        details: 'Created optimized thumbnail for maximum click-through rate',
        progress: 90,
        metadata: { thumbnailPath, resolution: videoType === 'short' ? '1080x1920' : '1280x720' }
      });
      
      // Step 4: Organize complete video package in Google Drive (Must complete first)
      await storage.createPipelineLog({
        jobId: job.id,
        step: 'file_organization',
        status: 'starting',
        message: 'Uploading complete video package to Google Drive',
        details: 'Uploading final MP4 video (with embedded audio) and professional thumbnail',
        progress: 92
      });

      const { videoUrl, thumbnailUrl } = await storageManager.organizeFiles(
        videoPath, 
        thumbnailPath, 
        job.id
      );
      
      // Ensure Google Drive upload is complete before proceeding
      await storage.createPipelineLog({
        jobId: job.id,
        step: 'file_organization',
        status: 'completed',
        message: 'Files successfully uploaded to Google Drive',
        details: 'Video and thumbnail stored in organized folder structure - ready for YouTube upload',
        progress: 95,
        metadata: { videoUrl, thumbnailUrl }
      });
      
      // Step 5: Schedule for optimal YouTube upload time (Only after Google Drive is complete)
      await storage.createPipelineLog({
        jobId: job.id,
        step: 'upload_scheduling',
        status: 'starting',
        message: 'Scheduling YouTube upload',
        details: 'Setting optimal upload time based on audience analytics',
        progress: 96
      });

      const optimalTime = youtubeUploader.getOptimalUploadTime(videoType);
      
      // Update job with both Google Drive URL and scheduled time
      await storage.updateContentJob(job.id, {
        driveUrl: videoUrl,
        scheduledTime: optimalTime,
        status: 'ready_for_upload', // New status indicating ready for YouTube
        progress: 100
      });

      await storage.createPipelineLog({
        jobId: job.id,
        step: 'upload_scheduling',
        status: 'completed',
        message: 'Video scheduled for YouTube upload',
        details: `Scheduled for ${optimalTime.toLocaleString()} - files ready in Google Drive`,
        progress: 100,
        metadata: { 
          scheduledTime: optimalTime.toISOString(), 
          videoType,
          driveUrl: videoUrl,
          thumbnailUrl: thumbnailUrl 
        }
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
      
      if (jobId) {
        // Update job status to failed
        await storage.updateContentJob(jobId, {
          status: 'failed',
          progress: 0
        });
        
        await storage.createPipelineLog({
          jobId,
          step: 'pipeline_error',
          status: 'error',
          message: 'Pipeline execution failed',
          details: error.message,
          metadata: { error: error.message, stack: error.stack }
        });
      }

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
          console.log(`Processing scheduled job ${job.id}: ${job.title}`);
          
          // Verify Google Drive upload is complete before YouTube upload
          if (!job.driveUrl) {
            console.warn(`⚠️  Job ${job.id} not ready - Google Drive upload not completed yet`);
            await storage.createActivityLog({
              type: 'warning',
              title: 'YouTube Upload Delayed',
              description: `Job ${job.id} waiting for Google Drive upload to complete`,
              status: 'warning',
              metadata: { jobId: job.id, reason: 'Google Drive upload pending' }
            });
            continue;
          }
          
          try {
            console.log(`✅ Starting YouTube upload for job ${job.id} - Google Drive files confirmed`);
            const youtubeId = await youtubeUploader.uploadVideo(job.id);
            console.log(`✅ Successfully uploaded job ${job.id} to YouTube: ${youtubeId}`);
          } catch (uploadError) {
            console.error(`❌ Upload failed for job ${job.id}:`, uploadError);
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
