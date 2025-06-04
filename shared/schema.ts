import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const trendingTopics = pgTable("trending_topics", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  searchVolume: integer("search_volume").notNull(),
  priority: text("priority").notNull().default("medium"), // high, medium, low
  category: text("category").notNull(), // technology, sports, news, global, etc.
  source: text("source").notNull(), // google_trends, news_api, twitter_api
  trending_data: jsonb("trending_data"), // raw API response
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contentJobs = pgTable("content_jobs", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").references(() => trendingTopics.id),
  videoType: text("video_type").notNull(), // long_form, short
  title: text("title").notNull(),
  script: text("script"),
  videoPath: text("video_path"),
  thumbnailPath: text("thumbnail_path"),
  driveUrl: text("drive_url"),
  youtubeId: text("youtube_id"),
  status: text("status").notNull().default("pending"), // pending, script_generation, video_creation, thumbnail_generation, uploading, completed, failed
  progress: integer("progress").notNull().default(0),
  scheduledTime: timestamp("scheduled_time"),
  publishedAt: timestamp("published_at"),
  metadata: jsonb("metadata"), // video details, SEO data, etc.
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const systemStats = pgTable("system_stats", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(), // YYYY-MM-DD format
  videosCreated: integer("videos_created").notNull().default(0),
  shortsCreated: integer("shorts_created").notNull().default(0),
  videosPublished: integer("videos_published").notNull().default(0),
  successRate: integer("success_rate").notNull().default(0), // percentage
  storageUsed: text("storage_used").notNull().default("0"), // in GB
  trendingTopicsFound: integer("trending_topics_found").notNull().default(0),
  systemStatus: text("system_status").notNull().default("active"), // active, paused, error
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // upload, generation, trending, error, system
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull(), // success, error, warning, info
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const automationSettings = pgTable("automation_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const youtubeChannels = pgTable("youtube_channels", {
  id: serial("id").primaryKey(),
  channelName: text("channel_name").notNull(),
  channelId: text("channel_id").notNull().unique(),
  channelUrl: text("channel_url"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  isActive: boolean("is_active").notNull().default(true),
  uploadScheduleLong: text("upload_schedule_long").notNull().default("18:30"),
  uploadScheduleShort: text("upload_schedule_short").notNull().default("20:30"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schemas
export const insertTrendingTopicSchema = createInsertSchema(trendingTopics).omit({
  id: true,
  createdAt: true,
});

export const insertContentJobSchema = createInsertSchema(contentJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSystemStatsSchema = createInsertSchema(systemStats).omit({
  id: true,
  createdAt: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export const insertAutomationSettingSchema = createInsertSchema(automationSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Types
export type InsertTrendingTopic = z.infer<typeof insertTrendingTopicSchema>;
export type TrendingTopic = typeof trendingTopics.$inferSelect;

export type InsertContentJob = z.infer<typeof insertContentJobSchema>;
export type ContentJob = typeof contentJobs.$inferSelect;

export type InsertSystemStats = z.infer<typeof insertSystemStatsSchema>;
export type SystemStats = typeof systemStats.$inferSelect;

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

export type InsertAutomationSetting = z.infer<typeof insertAutomationSettingSchema>;
export type AutomationSetting = typeof automationSettings.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export interface ActivityLog {
  id: number;
  type: 'generation' | 'upload' | 'error' | 'system';
  title: string;
  description: string;
  timestamp: string;
  status: 'success' | 'error' | 'warning' | 'info';
  metadata?: Record<string, any>;
}

export interface PipelineLog {
  id: number;
  jobId: number;
  step: string;
  status: 'starting' | 'progress' | 'completed' | 'error';
  message: string;
  details?: string;
  progress?: number;
  timestamp: string;
  metadata?: Record<string, any>;
}