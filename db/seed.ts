
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function createTables() {
  const client = await pool.connect();
  
  try {
    console.log('🗃️ Creating database tables...');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      );
    `);

    // Trending topics table
    await client.query(`
      CREATE TABLE IF NOT EXISTS trending_topics (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        search_volume INTEGER NOT NULL,
        priority TEXT NOT NULL DEFAULT 'medium',
        category TEXT NOT NULL,
        source TEXT NOT NULL,
        trending_data JSONB,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Content jobs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS content_jobs (
        id SERIAL PRIMARY KEY,
        topic_id INTEGER REFERENCES trending_topics(id),
        video_type TEXT NOT NULL,
        title TEXT NOT NULL,
        script TEXT,
        video_path TEXT,
        thumbnail_path TEXT,
        drive_url TEXT,
        youtube_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        progress INTEGER NOT NULL DEFAULT 0,
        scheduled_time TIMESTAMP,
        published_at TIMESTAMP,
        metadata JSONB,
        error_message TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // System stats table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_stats (
        id SERIAL PRIMARY KEY,
        date TEXT NOT NULL UNIQUE,
        videos_created INTEGER NOT NULL DEFAULT 0,
        shorts_created INTEGER NOT NULL DEFAULT 0,
        videos_published INTEGER NOT NULL DEFAULT 0,
        success_rate INTEGER NOT NULL DEFAULT 0,
        storage_used TEXT NOT NULL DEFAULT '0',
        trending_topics_found INTEGER NOT NULL DEFAULT 0,
        system_status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Activity logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Automation settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS automation_settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // YouTube channels table
    await client.query(`
      CREATE TABLE IF NOT EXISTS youtube_channels (
        id SERIAL PRIMARY KEY,
        channel_name TEXT NOT NULL,
        channel_id TEXT NOT NULL UNIQUE,
        channel_url TEXT,
        access_token TEXT,
        refresh_token TEXT,
        is_active BOOLEAN DEFAULT true,
        upload_schedule_long TEXT DEFAULT '18:30',
        upload_schedule_short TEXT DEFAULT '20:30',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log('✅ All tables created successfully!');

  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function seedInitialData() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Seeding initial production settings...');

    // Clear existing data for fresh start
    await client.query('DELETE FROM automation_settings;');
    await client.query('DELETE FROM activity_logs;');
    await client.query('DELETE FROM system_stats;');
    
    // Insert production automation settings
    const settings = [
      { key: 'video_upload_time', value: '18:30', description: 'Daily long-form video upload time (24h format)' },
      { key: 'shorts_upload_time', value: '20:30', description: 'Daily shorts upload time (24h format)' },
      { key: 'trending_analysis_frequency', value: '60', description: 'How often to analyze trending topics (minutes)' },
      { key: 'video_generation_enabled', value: 'true', description: 'Enable automatic video generation' },
      { key: 'auto_upload_enabled', value: 'false', description: 'Enable automatic YouTube uploads (set to true when ready)' },
      { key: 'max_daily_videos', value: '2', description: 'Maximum videos to create per day' },
      { key: 'content_language', value: 'en-IN', description: 'Content language and voice locale' },
      { key: 'video_quality', value: '1080p', description: 'Default video quality for generation' },
      { key: 'thumbnail_style', value: 'clickbait', description: 'Thumbnail generation style' },
      { key: 'google_drive_folder', value: 'YouTube_Automation', description: 'Google Drive folder for storing videos' }
    ];

    for (const setting of settings) {
      await client.query(`
        INSERT INTO automation_settings (key, value, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (key) DO UPDATE SET 
          value = EXCLUDED.value,
          description = EXCLUDED.description,
          updated_at = NOW();
      `, [setting.key, setting.value, setting.description]);
    }

    // Insert current system stats
    const today = new Date().toISOString().split('T')[0];
    await client.query(`
      INSERT INTO system_stats (date, system_status)
      VALUES ($1, 'active')
      ON CONFLICT (date) DO UPDATE SET system_status = 'active';
    `, [today]);

    // Insert initial activity log
    await client.query(`
      INSERT INTO activity_logs (type, title, description, status, metadata)
      VALUES ('system', 'Production System Initialized', 'YouTube automation system started and ready for production use', 'success', $1);
    `, [JSON.stringify({ 
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: 'production',
      features: ['trending_analysis', 'video_generation', 'thumbnail_creation', 'google_drive_storage', 'youtube_upload']
    })]);

    console.log('✅ Production settings configured successfully!');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function seed() {
  try {
    console.log('🚀 Starting production database setup...');
    
    await createTables();
    await seedInitialData();
    
    console.log('🎉 Database setup completed successfully!');
    console.log('📊 Production YouTube automation system is ready!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Set up environment variables (Google TTS API, YouTube API, etc.)');
    console.log('2. Add your YouTube channel via the dashboard');
    console.log('3. Enable auto-upload when ready');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  } finally {
    await pool.end();
    process.exit(0);
  }
}

seed().catch((error) => {
  console.error('Database setup failed:', error);
  process.exit(1);
});
