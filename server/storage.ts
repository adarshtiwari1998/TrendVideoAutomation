import { 
  trendingTopics, 
  contentJobs, 
  systemStats, 
  activityLogs, 
  automationSettings, 
  users,
  youtubeChannels,
  type TrendingTopic, 
  type InsertTrendingTopic,
  type ContentJob, 
  type InsertContentJob,
  type SystemStats, 
  type InsertSystemStats,
  type ActivityLog, 
  type InsertActivityLog,
  type AutomationSetting, 
  type InsertAutomationSetting,
  type User, 
  type InsertUser 
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, sql, isNotNull, or } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Trending Topics
  createTrendingTopic(topic: InsertTrendingTopic): Promise<TrendingTopic>;
  getTrendingTopics(limit?: number): Promise<TrendingTopic[]>;
  updateTrendingTopicStatus(id: number, status: string): Promise<void>;
  getTrendingTopicsByPriority(priority: string): Promise<TrendingTopic[]>;
  deleteTrendingTopic(id: number): Promise<void>;
  deleteOldTrendingTopics(beforeDate: Date): Promise<void>;

  // Content Jobs
  createContentJob(job: InsertContentJob): Promise<ContentJob>;
  getContentJobs(limit?: number): Promise<ContentJob[]>;
  getContentJobById(id: number): Promise<ContentJob | undefined>;
  updateContentJob(id: number, updates: Partial<ContentJob>): Promise<void>;
  getActiveContentJobs(): Promise<ContentJob[]>;
  getScheduledContentJobs(): Promise<ContentJob[]>;

  // System Stats
  createOrUpdateSystemStats(stats: InsertSystemStats): Promise<SystemStats>;
  getTodayStats(): Promise<SystemStats | undefined>;
  getWeeklyStats(): Promise<SystemStats[]>;

  // Activity Logs
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getRecentActivityLogs(limit?: number): Promise<ActivityLog[]>;

  // Pipeline Logs
  createPipelineLog(log: {
    jobId: number;
    step: string;
    status: 'starting' | 'progress' | 'completed' | 'error';
    message: string;
    details?: string;
    progress?: number;
    metadata?: any;
  }): Promise<any>;
  getPipelineLogs(limit?: number, jobId?: number): Promise<any[]>;
  clearPipelineLogs(): Promise<void>;

  // Automation Settings
  getAutomationSetting(key: string): Promise<AutomationSetting | undefined>;
  setAutomationSetting(setting: InsertAutomationSetting): Promise<AutomationSetting>;
  getAllAutomationSettings(): Promise<AutomationSetting[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createTrendingTopic(topic: InsertTrendingTopic): Promise<TrendingTopic> {
    const [created] = await db
      .insert(trendingTopics)
      .values(topic)
      .returning();
    return created;
  }

  async getTrendingTopics(limit = 10): Promise<TrendingTopic[]> {
    return await db
      .select()
      .from(trendingTopics)
      .orderBy(desc(trendingTopics.searchVolume))
      .limit(limit);
  }

  async updateTrendingTopicStatus(id: number, status: string): Promise<void> {
    await db
      .update(trendingTopics)
      .set({ status })
      .where(eq(trendingTopics.id, id));
  }

  async getTrendingTopicsByPriority(priority: string): Promise<TrendingTopic[]> {
    return await db
      .select()
      .from(trendingTopics)
      .where(eq(trendingTopics.priority, priority))
      .orderBy(desc(trendingTopics.searchVolume));
  }

  async deleteTrendingTopic(id: number): Promise<void> {
    // First delete any content jobs that reference this trending topic
    await db
      .delete(contentJobs)
      .where(eq(contentJobs.topicId, id));

    // Then delete the trending topic
    await db
      .delete(trendingTopics)
      .where(eq(trendingTopics.id, id));
  }

  async deleteOldTrendingTopics(beforeDate: Date): Promise<void> {
    // First, get IDs of trending topics to be deleted
    const topicsToDelete = await db
      .select({ id: trendingTopics.id })
      .from(trendingTopics)
      .where(sql`${trendingTopics.createdAt} < ${beforeDate.toISOString()}`);

    const topicIds = topicsToDelete.map(t => t.id);

    if (topicIds.length > 0) {
      // Delete related content jobs first
      await db
        .delete(contentJobs)
        .where(sql`${contentJobs.topicId} IN (${sql.join(topicIds, sql`, `)})`);

      // Then delete the trending topics
      await db
        .delete(trendingTopics)
        .where(sql`${trendingTopics.createdAt} < ${beforeDate.toISOString()}`);
    }
  }

  async createContentJob(job: InsertContentJob): Promise<ContentJob> {
    const [created] = await db
      .insert(contentJobs)
      .values(job)
      .returning();
    return created;
  }

  async getContentJobs(limit = 20): Promise<ContentJob[]> {
    return await db
      .select()
      .from(contentJobs)
      .orderBy(desc(contentJobs.createdAt))
      .limit(limit);
  }

  async getContentJobById(id: number): Promise<ContentJob | undefined> {
    const [job] = await db.select().from(contentJobs).where(eq(contentJobs.id, id));
    return job || undefined;
  }

  async updateContentJob(id: number, updates: Partial<ContentJob>): Promise<void> {
    await db
      .update(contentJobs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contentJobs.id, id));
  }

  async getActiveContentJobs(): Promise<ContentJob[]> {
    return await db
      .select()
      .from(contentJobs)
      .where(
        and(
          sql`${contentJobs.status} NOT IN ('completed', 'failed')`,
        )
      )
      .orderBy(desc(contentJobs.createdAt));
  }

  async getScheduledContentJobs(): Promise<ContentJob[]> {
    return await db.select().from(contentJobs)
      .where(
        and(
          or(
            eq(contentJobs.status, 'completed'),
            eq(contentJobs.status, 'ready_for_upload')
          ),
          isNotNull(contentJobs.scheduledTime),
          isNotNull(contentJobs.driveUrl) // Ensure Google Drive upload is complete
        )
      )
      .orderBy(contentJobs.scheduledTime);
  }

  async createOrUpdateSystemStats(stats: InsertSystemStats): Promise<SystemStats> {
    const existing = await db
      .select()
      .from(systemStats)
      .where(eq(systemStats.date, stats.date))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(systemStats)
        .set(stats)
        .where(eq(systemStats.date, stats.date))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(systemStats)
        .values(stats)
        .returning();
      return created;
    }
  }

  async getTodayStats(): Promise<SystemStats | undefined> {
    const today = new Date().toISOString().split('T')[0];
    const [stats] = await db
      .select()
      .from(systemStats)
      .where(eq(systemStats.date, today));
    return stats || undefined;
  }

  async getWeeklyStats(): Promise<SystemStats[]> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    return await db
      .select()
      .from(systemStats)
      .where(gte(systemStats.date, weekAgoStr))
      .orderBy(desc(systemStats.date));
  }

  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [created] = await db
      .insert(activityLogs)
      .values(log)
      .returning();
    return created;
  }

  async getRecentActivityLogs(limit = 50): Promise<ActivityLog[]> {
    return await db
      .select()
      .from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  async getAutomationSetting(key: string): Promise<AutomationSetting | undefined> {
    const [setting] = await db
      .select()
      .from(automationSettings)
      .where(eq(automationSettings.key, key));
    return setting || undefined;
  }

  async setAutomationSetting(setting: InsertAutomationSetting): Promise<AutomationSetting> {
    const existing = await this.getAutomationSetting(setting.key);

    if (existing) {
      const [updated] = await db
        .update(automationSettings)
        .set({ ...setting, updatedAt: new Date() })
        .where(eq(automationSettings.key, setting.key))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(automationSettings)
        .values(setting)
        .returning();
      return created;
    }
  }

  async getAllAutomationSettings(): Promise<AutomationSetting[]> {
    return await db.select().from(automationSettings);
  }

  // User methods
  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return user || null;
  }

  // YouTube Channel methods
  async addYouTubeChannel(channelData: {
    channelName: string;
    channelId: string;
    channelUrl?: string;
    isActive?: boolean;
    uploadScheduleLong?: string;
    uploadScheduleShort?: string;
  }): Promise<any> {
    const [channel] = await db.insert(youtubeChannels).values({
      ...channelData,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return channel;
  }

  async getActiveYouTubeChannels(): Promise<any[]> {
    return await db.select().from(youtubeChannels).where(eq(youtubeChannels.isActive, true));
  }

  async getYouTubeChannelById(channelId: string): Promise<any | null> {
    const [channel] = await db.select().from(youtubeChannels)
      .where(eq(youtubeChannels.channelId, channelId)).limit(1);
    return channel || null;
  }

  async updateYouTubeChannel(channelId: string, updates: {
    uploadScheduleLong?: string;
    uploadScheduleShort?: string;
    isActive?: boolean;
  }): Promise<void> {
    await db.update(youtubeChannels)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(youtubeChannels.channelId, channelId));
  }

  async clearStuckJobs(): Promise<void> {
    // Reset any jobs that are stuck in processing states
    await db.execute(sql`
      UPDATE content_jobs 
      SET status = 'failed', 
          progress = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE status IN ('script_generation', 'video_creation', 'thumbnail_generation', 'uploading')
      AND updated_at < NOW() - INTERVAL '1 hour'
    `);

    console.log('Cleared stuck jobs from previous sessions');
  }

  async clearAllData(): Promise<void> {
    try {
      // Clear all content jobs
      await db.execute(sql`DELETE FROM content_jobs`);

      // Clear all trending topics
      await db.execute(sql`DELETE FROM trending_topics`);

      // Clear activity logs (keep recent system logs)
      await db.execute(sql`
        DELETE FROM activity_logs 
        WHERE created_at < NOW() - INTERVAL '1 day'
        OR type NOT IN ('system')
      `);

      console.log('Cleared all content data for fresh start');
    } catch (error) {
      console.error('Error clearing data:', error);
      throw error;
    }
  }

  async clearTrendingTopics(): Promise<void> {
    // First delete all content jobs that reference trending topics
    await db.execute(sql`DELETE FROM content_jobs WHERE topic_id IS NOT NULL`);
    // Then delete all trending topics
    await db.execute(sql`DELETE FROM trending_topics`);
    console.log('Cleared all trending topics and related content jobs');
  }

  async clearContentJobs(): Promise<void> {
    await db.execute(sql`DELETE FROM content_jobs`);
    console.log('Cleared all content jobs');
  }

  // Pipeline Logs (using activity logs table for now)
  async getPipelineLogs(limit: number = 50, jobId?: number): Promise<any[]> {
    try {
      let query;
      if (jobId) {
        query = db.execute(sql`
          SELECT * FROM pipeline_logs 
          WHERE job_id = ${jobId}
          ORDER BY created_at DESC 
          LIMIT ${limit}
        `);
      } else {
        query = db.execute(sql`
          SELECT * FROM pipeline_logs 
          ORDER BY created_at DESC 
          LIMIT ${limit}
        `);
      }

      const result = await query;
      const logs = result.rows || [];

      return logs.map(log => ({
        id: log.id,
        jobId: log.job_id,
        step: log.step,
        status: log.status,
        message: log.message,
        details: log.details,
        progress: log.progress,
        timestamp: log.created_at,
        metadata: log.metadata ? (typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata) : {}
      }));
    } catch (error) {
      console.error('Error fetching pipeline logs:', error);
      return [];
    }
  }

  async getPipelineLogsByJob(jobId: number, limit: number = 50): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM pipeline_logs 
        WHERE job_id = ${jobId}
        ORDER BY created_at DESC 
        LIMIT ${limit}
      `);

      const logs = result.rows || [];

      return logs.map(log => ({
        id: log.id,
        jobId: log.job_id,
        step: log.step,
        status: log.status,
        message: log.message,
        details: log.details,
        progress: log.progress,
        timestamp: log.created_at,
        metadata: log.metadata ? (typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata) : {}
      }));
    } catch (error) {
      console.error('Error fetching pipeline logs by job:', error);
      return [];
    }
  }

  async createPipelineLog(log: {
    jobId: number;
    step: string;
    status: 'starting' | 'progress' | 'completed' | 'error';
    message: string;
    details?: string;
    progress?: number;
    metadata?: any;
  }): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO pipeline_logs (job_id, step, status, message, details, progress, metadata)
        VALUES (${log.jobId}, ${log.step}, ${log.status}, ${log.message}, ${log.details || null}, ${log.progress || null}, ${JSON.stringify(log.metadata || {})})
      `);
    } catch (error) {
      console.error('Failed to create pipeline log:', error);
    }
  }

  async getPipelineLogsByJob(jobId: number): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM pipeline_logs 
        WHERE job_id = ${jobId}
        ORDER BY created_at DESC
      `);
      return result.rows || [];
    } catch (error) {
      console.error('Failed to get pipeline logs by job:', error);
      return [];
    }
  }

  async getPipelineLogs(limit: number = 50): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT pl.*, cj.title as job_title, cj.video_type 
        FROM pipeline_logs pl
        LEFT JOIN content_jobs cj ON pl.job_id = cj.id
        ORDER BY pl.created_at DESC
        LIMIT ${limit}
      `);
      return result.rows || [];
    } catch (error) {
      console.error('Failed to get pipeline logs:', error);
      return [];
    }
  }

  async clearPipelineLogs(): Promise<void> {
    try {
      await db.execute(sql`DELETE FROM pipeline_logs`);
      console.log('Cleared all pipeline logs');
    } catch (error) {
      console.error('Failed to clear pipeline logs:', error);
    }
  }
}

export const storage = new DatabaseStorage();