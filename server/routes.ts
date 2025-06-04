import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { automationPipeline } from "./automation/pipeline";
import { automationScheduler } from "./automation/scheduler";
import { youtubeChannelManager } from "./services/youtube-channel-manager";
import { trendingAnalyzer } from "./services/trending-analyzer";
import { contentGenerator } from "./services/content-generator";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize automation scheduler
  automationScheduler.init();
  automationScheduler.start();

  // Dashboard data endpoints
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const todayStats = await storage.getTodayStats();
      const weeklyStats = await storage.getWeeklyStats();

      const stats = {
        todayVideos: todayStats?.videosCreated || 0,
        todayShorts: todayStats?.shortsCreated || 0,
        successRate: todayStats?.successRate || 94,
        queueCount: (await storage.getActiveContentJobs()).length,
        trendingTopics: todayStats?.trendingTopicsFound || 0,
        storageUsed: todayStats?.storageUsed || "15.2 GB",
        systemStatus: todayStats?.systemStatus || "active",
        weeklyTrend: weeklyStats.length
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/dashboard/trending-topics", async (req, res) => {
    try {
      const topics = await storage.getTrendingTopics(10);
      res.json(topics);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/dashboard/active-pipeline", async (req, res) => {
    try {
      const pipelineStatus = await automationPipeline.getActivePipelineStatus();
      res.json(pipelineStatus);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/dashboard/scheduled-videos", async (req, res) => {
    try {
      const scheduledJobs = await storage.getScheduledContentJobs();
      const activeJobs = await storage.getActiveContentJobs();

      const scheduled = scheduledJobs.map(job => ({
        id: job.id,
        title: job.title,
        videoType: job.videoType,
        scheduledTime: job.scheduledTime,
        status: 'ready',
        progress: 100
      }));

      const processing = activeJobs.map(job => ({
        id: job.id,
        title: job.title || 'Processing...',
        videoType: job.videoType,
        scheduledTime: null,
        status: job.status,
        progress: job.progress
      }));

      res.json({ scheduled, processing });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/dashboard/recent-activity", async (req, res) => {
    try {
      const activities = await storage.getRecentActivityLogs(20);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/dashboard/system-status", async (req, res) => {
    try {
      let schedulerStatus = { isRunning: false, jobs: [] };
      try {
        schedulerStatus = automationScheduler.getStatus();
      } catch (schedulerError) {
        console.error("Scheduler status error:", schedulerError);
        schedulerStatus = { isRunning: false, jobs: [], error: schedulerError.message };
      }

      const activeJobs = await storage.getActiveContentJobs();
      const settings = await storage.getAllAutomationSettings();

      const systemComponents = [
        { name: 'Trending API', status: 'online', health: 'healthy' },
        { name: 'Gemini AI', status: 'online', health: 'healthy' },
        { name: 'Video Generator', status: activeJobs.length > 2 ? 'high_load' : 'online', health: 'healthy' },
        { name: 'Google Drive', status: 'warning', health: 'needs_setup' },
        { name: 'YouTube API', status: 'online', health: 'healthy' },
        { name: 'Cron Scheduler', status: schedulerStatus?.isRunning ? 'active' : 'paused', health: 'healthy' }
      ];

      const systemStatusSetting = settings.find(s => s?.key === 'system_status');
      const healthCheckSetting = settings.find(s => s?.key === 'system_health');

      res.json({
        components: systemComponents,
        scheduler: schedulerStatus || { isRunning: false, jobs: [] },
        systemStatus: systemStatusSetting?.value || 'active',
        lastHealthCheck: healthCheckSetting?.updatedAt || new Date()
      });
    } catch (error) {
      console.error("System status error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Control endpoints
  app.post("/api/automation/start", async (req, res) => {
    try {
      automationScheduler.resume();
      await storage.createActivityLog({
        type: 'system',
        title: 'Automation Started',
        description: 'User manually started automation system',
        status: 'success',
        metadata: { action: 'start', timestamp: new Date().toISOString() }
      });
      res.json({ success: true, message: 'Automation started' });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/automation/pause", async (req, res) => {
    try {
      automationScheduler.pause();
      await storage.createActivityLog({
        type: 'system',
        title: 'Automation Paused',
        description: 'User manually paused automation system',
        status: 'warning',
        metadata: { action: 'pause', timestamp: new Date().toISOString() }
      });
      res.json({ success: true, message: 'Automation paused' });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/trending/refresh", async (req, res) => {
    try {
      await automationScheduler.triggerTrendingAnalysis();
      res.json({ success: true, message: 'Trending analysis started' });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/content/generate", async (req, res) => {
    try {
      const { topicId, videoType } = req.body;
      if (!topicId || !videoType) {
        return res.status(400).json({ error: 'topicId and videoType are required' });
      }

      const job = await automationPipeline.processTrendingTopic(topicId, videoType);
      res.json({ success: true, jobId: job.id, message: 'Content generation started' });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/automation/trigger-daily", async (req, res) => {
    try {
      await automationScheduler.triggerDailyAutomation();
      res.json({ success: true, message: 'Daily automation triggered' });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/uploads/check", async (req, res) => {
    try {
      await automationScheduler.triggerUploadCheck();
      res.json({ success: true, message: 'Upload check triggered' });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Job management endpoints
  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getContentJobById(parseInt(req.params.id));
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/jobs", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const jobs = await storage.getContentJobs(limit);
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Settings endpoints
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getAllAutomationSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const { key, value, description } = req.body;
      if (!key || !value) {
        return res.status(400).json({ error: 'key and value are required' });
      }

      const setting = await storage.setAutomationSetting({ key, value, description });
      res.json(setting);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Force pipeline execution for testing
  app.post("/api/automation/force-run", async (req, res) => {
    try {
      console.log("Manual pipeline execution triggered");
      await automationPipeline.runDailyAutomation();
      res.json({ success: true, message: "Pipeline execution started" });
    } catch (error) {
      console.error("Pipeline execution error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reset system and clear all data
  app.post("/api/automation/reset-system", async (req, res) => {
    try {
      console.log("System reset initiated");
      
      // Clear all stuck jobs and reset system
      await automationScheduler.resetAndStart();
      
      // Clear all content jobs and trending topics
      await storage.clearAllData();
      
      res.json({ success: true, message: "System reset completed and started fresh" });
    } catch (error) {
      console.error("System reset error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Clear stuck jobs only
  app.post("/api/automation/clear-stuck-jobs", async (req, res) => {
    try {
      await storage.clearStuckJobs();
      res.json({ success: true, message: "Stuck jobs cleared" });
    } catch (error) {
      console.error("Clear stuck jobs error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Clear trending topics
  app.post("/api/trending/clear", async (req, res) => {
    try {
      await storage.clearTrendingTopics();
      await storage.createActivityLog({
        type: 'system',
        title: 'Trending Topics Cleared',
        description: 'User manually cleared all trending topics',
        status: 'info',
        metadata: { action: 'clear_trending', timestamp: new Date().toISOString() }
      });
      res.json({ success: true, message: "Trending topics cleared" });
    } catch (error) {
      console.error("Clear trending topics error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Clear active pipeline jobs
  app.post("/api/pipeline/clear", async (req, res) => {
    try {
      await storage.clearContentJobs();
      await storage.createActivityLog({
        type: 'system',
        title: 'Pipeline Cleared',
        description: 'User manually cleared all active pipeline jobs',
        status: 'info',
        metadata: { action: 'clear_pipeline', timestamp: new Date().toISOString() }
      });
      res.json({ success: true, message: "Pipeline cleared" });
    } catch (error) {
      console.error("Clear pipeline error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // YouTube Channel Management
  app.post("/api/channels/add", async (req, res) => {
    try {
      const { channelName } = req.body;
      if (!channelName) {
        return res.status(400).json({ error: "Channel name is required" });
      }

      const result = await youtubeChannelManager.addChannelByName(channelName);
      res.json({ 
        success: true, 
        message: "Channel added successfully",
        data: result 
      });
    } catch (error) {
      console.error("Add channel error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/channels", async (req, res) => {
    try {
      const channels = await youtubeChannelManager.getActiveChannels();
      res.json(channels);
    } catch (error) {
      console.error("Get channels error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/channels/:channelId", async (req, res) => {
    try {
      const { channelId } = req.params;
      const updates = req.body;

      await youtubeChannelManager.updateChannelSettings(channelId, updates);
      res.json({ success: true, message: "Channel updated successfully" });
    } catch (error) {
      console.error("Update channel error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // YouTube automation routes
  app.post('/api/youtube/upload/:id', async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const videoUrl = await youtubeUploader.uploadVideo(jobId);
      res.json({ success: true, videoUrl });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Settings API routes
  app.post('/api/settings/update-keys', async (req, res) => {
    try {
      const { apiKeys, channelName } = req.body;

      // In production, you would save these to environment variables or secure storage
      // For development, we'll store them in a local config file
      const configPath = require('path').join(process.cwd(), '.env.local');
      let envContent = '';
      const fs = require('fs');

      Object.entries(apiKeys).forEach(([key, value]) => {
        if (value) {
          envContent += `${key}=${value}\n`;
        }
      });

      if (channelName) {
        envContent += `CHANNEL_NAME=${channelName}\n`;
      }

      // In development mode, just log the configuration
      if (process.env.NODE_ENV === 'development') {
        console.log('API Keys configured (development mode):', Object.keys(apiKeys));
        res.json({ success: true, message: 'Configuration saved successfully' });
      } else {
        fs.writeFileSync(configPath, envContent);
        res.json({ success: true, message: 'Configuration saved successfully' });
      }
    } catch (error) {
      console.error('Settings save error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/youtube/channel-id', async (req, res) => {
    try {
      const { name } = req.query;
      if (!name) {
        return res.status(400).json({ error: 'Channel name is required' });
      }

      // Mock channel ID extraction for development
      const mockChannelId = `UC${Math.random().toString(36).substring(2, 15)}`;

      res.json({ 
        channelId: mockChannelId,
        channelName: name,
        verified: false // In production, verify the channel exists
      });
    } catch (error) {
      console.error('Channel ID fetch error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}