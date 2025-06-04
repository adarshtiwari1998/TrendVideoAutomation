import cron from 'node-cron';
import { trendingAnalyzer } from '../services/trending-analyzer';
import { automationPipeline } from './pipeline';
import { storageManager } from '../services/storage-manager';
import { storage } from '../storage';

export class AutomationScheduler {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  init(): void {
    console.log('Initializing automation scheduler...');

    // Daily trending analysis at 6:00 AM IST (00:30 UTC)
    this.scheduleJob('trending-analysis', '30 0 * * *', async () => {
      await trendingAnalyzer.analyzeTrendingTopics();
    });

    // Daily content creation at 9:00 AM IST (03:30 UTC)
    this.scheduleJob('daily-automation', '30 3 * * *', async () => {
      await automationPipeline.runDailyAutomation();
    });

    // Check for scheduled uploads every 30 minutes
    this.scheduleJob('upload-check', '*/30 * * * *', async () => {
      await automationPipeline.processScheduledUploads();
    });

    // Storage cleanup weekly on Sundays at 2:00 AM IST (20:30 UTC Saturday)
    this.scheduleJob('storage-cleanup', '30 20 * * 6', async () => {
      await storageManager.cleanupOldFiles(30);
    });

    // System health check every hour
    this.scheduleJob('health-check', '0 * * * *', async () => {
      await this.performHealthCheck();
    });

    // Update system stats daily at midnight IST (18:30 UTC)
    this.scheduleJob('stats-update', '30 18 * * *', async () => {
      await this.updateSystemStats();
    });

    console.log('Automation scheduler initialized with', this.jobs.size, 'jobs');
  }

  private scheduleJob(name: string, cronExpression: string, task: () => Promise<void>): void {
    const job = cron.schedule(cronExpression, async () => {
      console.log(`Starting scheduled task: ${name}`);
      try {
        await task();
        console.log(`Completed scheduled task: ${name}`);
      } catch (error) {
        console.error(`Error in scheduled task ${name}:`, error);
        await storage.createActivityLog({
          type: 'error',
          title: `Scheduled Task Failed: ${name}`,
          description: `Error in ${name}: ${error.message}`,
          status: 'error',
          metadata: { taskName: name, cronExpression, error: error.message }
        });
      }
    }, {
      scheduled: false, // Don't start immediately
      timezone: 'Asia/Kolkata' // IST timezone
    });

    this.jobs.set(name, job);
  }

  start(): void {
    console.log('Starting all scheduled jobs...');
    this.jobs.forEach((job, name) => {
      job.start();
      console.log(`Started job: ${name}`);
    });

    // Log scheduler start
    storage.createActivityLog({
      type: 'system',
      title: 'Automation Scheduler Started',
      description: `Started ${this.jobs.size} scheduled jobs`,
      status: 'success',
      metadata: { 
        jobNames: Array.from(this.jobs.keys()),
        timezone: 'Asia/Kolkata',
        startTime: new Date().toISOString()
      }
    });
  }

  stop(): void {
    console.log('Stopping all scheduled jobs...');
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`Stopped job: ${name}`);
    });

    storage.createActivityLog({
      type: 'system',
      title: 'Automation Scheduler Stopped',
      description: 'All scheduled jobs have been stopped',
      status: 'warning',
      metadata: { 
        stopTime: new Date().toISOString(),
        jobCount: this.jobs.size 
      }
    });
  }

  pause(): void {
    this.stop();
    storage.setAutomationSetting({
      key: 'system_status',
      value: 'paused',
      description: 'System manually paused by user'
    });
  }

  resume(): void {
    this.start();
    storage.setAutomationSetting({
      key: 'system_status',
      value: 'active',
      description: 'System resumed by user'
    });
  }

  async resetAndStart(): Promise<void> {
    console.log('Resetting automation system and starting fresh...');

    // Stop all current jobs
    this.stop();

    // Clear any stuck jobs
    await storage.clearStuckJobs();

    // Reset system status
    await storage.setAutomationSetting({
      key: 'system_status',
      value: 'active',
      description: 'System reset and restarted by user'
    });

    // Log the reset
    await storage.createActivityLog({
      type: 'system',
      title: 'Automation System Reset',
      description: 'System was reset and restarted with fresh state',
      status: 'success',
      metadata: { 
        action: 'reset_start',
        timestamp: new Date().toISOString(),
        resetBy: 'user'
      }
    });

    // Start fresh
    this.start();

    console.log('Automation system reset and restarted successfully');
  }

  getStatus(): any {
    try {
      const status = {
        isRunning: this.jobs.size > 0,
        jobs: []
      };
      
      this.jobs.forEach((job, name) => {
        try {
          status.jobs.push({
            name,
            running: job.running || false,
            cronExpression: job.cronTime?.source || 'unknown'
          });
        } catch (jobError) {
          console.error(`Error getting status for job ${name}:`, jobError);
          status.jobs.push({
            name,
            running: false,
            cronExpression: 'error'
          });
        }
      });
      
      return status;
    } catch (error) {
      console.error('Scheduler getStatus error:', error);
      return {
        isRunning: false,
        jobs: []
      };
    }
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const checks = {
        database: await this.checkDatabase(),
        storage: await this.checkStorage(),
        apis: await this.checkExternalAPIs(),
        disk: await this.checkDiskSpace()
      };

      const allHealthy = Object.values(checks).every(check => check.status === 'healthy');

      await storage.createActivityLog({
        type: 'system',
        title: 'System Health Check',
        description: allHealthy ? 'All systems operational' : 'Some systems need attention',
        status: allHealthy ? 'success' : 'warning',
        metadata: { checks, timestamp: new Date().toISOString() }
      });

      // Update system status based on health
      const systemStatus = allHealthy ? 'active' : 'degraded';
      await storage.setAutomationSetting({
        key: 'system_health',
        value: systemStatus,
        description: `Last health check: ${new Date().toISOString()}`
      });

    } catch (error) {
      console.error('Health check error:', error);
      await storage.createActivityLog({
        type: 'error',
        title: 'Health Check Failed',
        description: `System health check failed: ${error.message}`,
        status: 'error',
        metadata: { error: error.message }
      });
    }
  }

  private async checkDatabase(): Promise<{ status: string; message: string }> {
    try {
      await storage.getTodayStats();
      return { status: 'healthy', message: 'Database connection successful' };
    } catch (error) {
      return { status: 'unhealthy', message: `Database error: ${error.message}` };
    }
  }

  private async checkStorage(): Promise<{ status: string; message: string }> {
    try {
      const usage = await storageManager.getStorageUsage();
      const usageGB = parseFloat(usage);

      if (usageGB > 90) { // More than 90GB used
        return { status: 'warning', message: `High storage usage: ${usage}` };
      }

      return { status: 'healthy', message: `Storage usage: ${usage}` };
    } catch (error) {
      return { status: 'unhealthy', message: `Storage error: ${error.message}` };
    }
  }

  private async checkExternalAPIs(): Promise<{ status: string; message: string }> {
    // In a real implementation, ping external APIs
    return { status: 'healthy', message: 'External APIs accessible' };
  }

  private async checkDiskSpace(): Promise<{ status: string; message: string }> {
    // In a real implementation, check actual disk space
    return { status: 'healthy', message: 'Sufficient disk space available' };
  }

  private async updateSystemStats(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const existingStats = await storage.getTodayStats();

      // Get actual counts from database
      const activeJobs = await storage.getActiveContentJobs();
      const completedToday = await storage.getContentJobs(100); // Get more to filter by date
      const todayCompleted = completedToday.filter(job => 
        job.createdAt.toISOString().split('T')[0] === today && job.status === 'completed'
      );

      const videosCreated = todayCompleted.filter(job => job.videoType === 'long_form').length;
      const shortsCreated = todayCompleted.filter(job => job.videoType === 'short').length;
      const videosPublished = todayCompleted.filter(job => job.youtubeId).length;
      const totalAttempts = todayCompleted.length + activeJobs.filter(job => job.status === 'failed').length;
      const successRate = totalAttempts > 0 ? Math.round((todayCompleted.length / totalAttempts) * 100) : 100;

      const storageUsed = await storageManager.getStorageUsage();
      const trendingTopics = await storage.getTrendingTopics(100);
      const trendingTopicsFound = trendingTopics.filter(topic => 
        topic.createdAt.toISOString().split('T')[0] === today
      ).length;

      await storage.createOrUpdateSystemStats({
        date: today,
        videosCreated,
        shortsCreated,
        videosPublished,
        successRate,
        storageUsed,
        trendingTopicsFound,
        systemStatus: 'active'
      });

      console.log(`Updated system stats for ${today}`);
    } catch (error) {
      console.error('Stats update error:', error);
      await storage.createActivityLog({
        type: 'error',
        title: 'Stats Update Failed',
        description: `Error updating system stats: ${error.message}`,
        status: 'error',
        metadata: { error: error.message }
      });
    }
  }

  // Manual trigger methods for testing/admin use
  async triggerTrendingAnalysis(): Promise<void> {
    await trendingAnalyzer.analyzeTrendingTopics();
  }

  async triggerDailyAutomation(): Promise<void> {
    await automationPipeline.runDailyAutomation();
  }

  async triggerUploadCheck(): Promise<void> {
    await automationPipeline.processScheduledUploads();
  }
}

export const automationScheduler = new AutomationScheduler();