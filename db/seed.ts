import { db } from './index';
import { 
  users, 
  trendingTopics, 
  contentJobs, 
  systemStats, 
  activityLogs, 
  automationSettings 
} from '@shared/schema';

async function seed() {
  try {
    console.log('🌱 Starting database seeding...');

    // Insert initial automation settings
    await db.insert(automationSettings).values([
      {
        key: 'system_status',
        value: 'active',
        description: 'Overall system status'
      },
      {
        key: 'automation_enabled',
        value: 'true',
        description: 'Whether automation is enabled'
      },
      {
        key: 'daily_video_target',
        value: '1',
        description: 'Number of daily videos to generate'
      },
      {
        key: 'daily_short_target',
        value: '1',
        description: 'Number of daily shorts to generate'
      },
      {
        key: 'trending_analysis_frequency',
        value: '4',
        description: 'Hours between trending analysis runs'
      },
      {
        key: 'upload_schedule_long',
        value: '20:00',
        description: 'Upload time for long-form videos (IST)'
      },
      {
        key: 'upload_schedule_short',
        value: '18:00',
        description: 'Upload time for shorts (IST)'
      }
    ]).onConflictDoNothing();

    // Insert initial system stats for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await db.insert(systemStats).values({
      date: today,
      videosGenerated: 0,
      shortsGenerated: 0,
      uploadsSuccessful: 0,
      uploadsFailed: 0,
      trendingTopicsAnalyzed: 0,
      storageUsedMb: 0,
      errorCount: 0
    }).onConflictDoNothing();

    // Insert initial activity log
    await db.insert(activityLogs).values({
      type: 'system',
      title: 'System Initialized',
      description: 'Database seeded and automation system started',
      status: 'success',
      metadata: { 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    });

    // Insert sample trending topics (these will be replaced by real data from Gemini)
    await db.insert(trendingTopics).values([
      {
        title: 'Indian Cricket Team World Cup Preparation',
        description: 'Latest updates on India cricket team preparation for upcoming world cup',
        searchVolume: 85000,
        priority: 'high',
        category: 'Sports',
        source: 'Google Trends',
        status: 'pending'
      },
      {
        title: 'Bollywood Movie Reviews 2024',
        description: 'Top Bollywood movie releases and reviews this year',
        searchVolume: 65000,
        priority: 'medium',
        category: 'Entertainment',
        source: 'News API',
        status: 'pending'
      },
      {
        title: 'Indian Stock Market Analysis',
        description: 'Latest trends in Indian stock market and investment opportunities',
        searchVolume: 45000,
        priority: 'medium',
        category: 'Finance',
        source: 'Google Trends',
        status: 'pending'
      }
    ]);

    console.log('✅ Database seeding completed successfully!');
    console.log('📊 Created automation settings, system stats, and sample trending topics');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});