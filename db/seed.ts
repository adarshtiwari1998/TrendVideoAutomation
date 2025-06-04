
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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
    console.log('🌱 Seeding initial data...');

    // Insert automation settings
    await client.query(`
      INSERT INTO automation_settings (key, value, description) 
      VALUES 
        ('system_status', 'active', 'Overall system status'),
        ('automation_enabled', 'true', 'Whether automation is enabled'),
        ('daily_video_target', '1', 'Number of daily videos to generate'),
        ('daily_short_target', '1', 'Number of daily shorts to generate'),
        ('trending_analysis_frequency', '4', 'Hours between trending analysis runs'),
        ('upload_schedule_long', '18:30', 'Upload time for long-form videos (IST)'),
        ('upload_schedule_short', '20:30', 'Upload time for shorts (IST)'),
        ('google_tts_voice', 'en-IN-Standard-D', 'Google TTS voice for Indian accent'),
        ('video_quality', '1080p', 'Default video quality'),
        ('thumbnail_style', 'modern', 'Thumbnail generation style')
      ON CONFLICT (key) DO NOTHING;
    `);

    // Insert initial system stats for today
    const today = new Date().toISOString().split('T')[0];
    await client.query(`
      INSERT INTO system_stats (date, videos_created, shorts_created, videos_published, success_rate, storage_used, trending_topics_found, system_status)
      VALUES ($1, 0, 0, 0, 100, '0 GB', 0, 'active')
      ON CONFLICT (date) DO NOTHING;
    `, [today]);

    // Insert initial activity log
    await client.query(`
      INSERT INTO activity_logs (type, title, description, status, metadata)
      VALUES ('system', 'System Initialized', 'Production system started successfully', 'success', $1);
    `, [JSON.stringify({ 
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: 'production'
    })]);

    console.log('✅ Initial data seeded successfully!');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function seed() {
  try {
    console.log('🚀 Starting database seeding process...');
    
    await createTables();
    await seedInitialData();
    
    console.log('🎉 Database seeding completed successfully!');
    console.log('📊 Production system is ready to use');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await pool.end();
    process.exit(0);
  }
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
