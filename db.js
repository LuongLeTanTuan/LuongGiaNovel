const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// On Vercel Serverless (AWS Lambda), only /tmp is writable
const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const dbDir = isVercel ? '/tmp' : __dirname;
const dbPath = path.join(dbDir, 'luonggianovel.db');

// If on Vercel and db exists in source directory, copy it to /tmp
const sourceDb = path.join(__dirname, 'luonggianovel.db');
if (isVercel && fs.existsSync(sourceDb) && !fs.existsSync(dbPath)) {
  try {
    fs.copyFileSync(sourceDb, dbPath);
  } catch (e) {
    console.warn('Copy DB error:', e.message);
  }
}

const db = new Database(dbPath);

// On serverless, WAL mode may fail on read-only environments, use standard memory/delete mode
if (isVercel) {
  db.pragma('journal_mode = MEMORY');
} else {
  db.pragma('journal_mode = WAL');
}
db.pragma('foreign_keys = ON');

// Helper function to create URL slug from Vietnamese string with complete accent handling
function createSlug(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
    .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
    .replace(/[ìíịỉĩ]/g, 'i')
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
    .replace(/[ùúụủũưừứựửữ]/g, 'u')
    .replace(/[ỳýỵỷỹ]/g, 'y')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Function to dump database state to a permanent JSON file in data/stories_data.json
function saveSnapshot() {
  try {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const stories = db.prepare('SELECT * FROM stories').all();
    const categories = db.prepare('SELECT * FROM categories').all();
    const storyCategories = db.prepare('SELECT * FROM story_categories').all();
    const chapters = db.prepare('SELECT * FROM chapters').all();

    const snapshot = {
      version: 1,
      updated_at: new Date().toISOString(),
      categories,
      stories,
      story_categories: storyCategories,
      chapters
    };

    const snapshotPath = path.join(dataDir, 'stories_data.json');
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.warn('Lỗi ghi snapshot JSON:', err.message);
    return false;
  }
}

// Function to restore database state from data/stories_data.json
function restoreFromSnapshot() {
  try {
    const snapshotPath = path.join(__dirname, 'data', 'stories_data.json');
    if (!fs.existsSync(snapshotPath)) return false;

    const raw = fs.readFileSync(snapshotPath, 'utf8');
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.stories)) return false;

    const insertCat = db.prepare('INSERT OR IGNORE INTO categories (id, name, slug, description) VALUES (?, ?, ?, ?)');
    if (Array.isArray(data.categories)) {
      for (const c of data.categories) {
        insertCat.run(c.id, c.name, c.slug, c.description || null);
      }
    }

    const insertStory = db.prepare(`
      INSERT OR REPLACE INTO stories (id, title, slug, author, translator, cover_image, description, status, audio_url, views, likes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const s of data.stories) {
      insertStory.run(
        s.id,
        s.title,
        s.slug || createSlug(s.title),
        s.author || 'Lương Gia Tác Giả',
        s.translator || 'Lương Gia Novel',
        s.cover_image || '/assets/standard-cover.jpg',
        s.description || '',
        s.status || 'ongoing',
        s.audio_url || null,
        s.views || 0,
        s.likes || 0,
        s.created_at || new Date().toISOString(),
        s.updated_at || new Date().toISOString()
      );
    }

    if (Array.isArray(data.story_categories)) {
      const linkCat = db.prepare('INSERT OR IGNORE INTO story_categories (story_id, category_id) VALUES (?, ?)');
      for (const sc of data.story_categories) {
        linkCat.run(sc.story_id, sc.category_id);
      }
    }

    if (Array.isArray(data.chapters)) {
      const insertChap = db.prepare(`
        INSERT OR REPLACE INTO chapters (id, story_id, chapter_number, title, slug, content, audio_url, word_count, views, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const ch of data.chapters) {
        insertChap.run(
          ch.id,
          ch.story_id,
          ch.chapter_number,
          ch.title,
          ch.slug,
          ch.content,
          ch.audio_url || null,
          ch.word_count || 0,
          ch.views || 0,
          ch.created_at || new Date().toISOString()
        );
      }
    }

    console.log(`✓ Đã nạp thành công ${data.stories.length} truyện và ${data.chapters?.length || 0} chương từ data/stories_data.json`);
    return true;
  } catch (err) {
    console.warn('Lỗi khôi phục từ snapshot JSON:', err.message);
    return false;
  }
}

function initDb() {
  db.exec(`
    -- Users and Roles
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT DEFAULT 'Độc Giả',
      role TEXT DEFAULT 'user', -- 'admin', 'editor', 'user'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      author TEXT DEFAULT 'Lương Gia Tác Giả',
      translator TEXT DEFAULT 'Lương Gia Novel Team',
      cover_image TEXT,
      description TEXT,
      status TEXT DEFAULT 'ongoing', -- 'ongoing' or 'completed'
      audio_url TEXT, -- Audiobook Stream URL (Optional)
      views INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS story_categories (
      story_id INTEGER,
      category_id INTEGER,
      PRIMARY KEY (story_id, category_id),
      FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id INTEGER NOT NULL,
      chapter_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      content TEXT NOT NULL,
      audio_url TEXT, -- Chapter-specific Audio MP3 Stream URL
      word_count INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
      UNIQUE(story_id, chapter_number)
    );

    CREATE INDEX IF NOT EXISTS idx_sq_stories_slug ON stories(slug);
    CREATE INDEX IF NOT EXISTS idx_sq_chapters_story_id ON chapters(story_id);
    CREATE INDEX IF NOT EXISTS idx_sq_chapters_slug ON chapters(story_id, slug);
  `);


  // Ensure Admin user exists with hashed password
  const checkAdmin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('Tuan@2005', salt);

  if (!checkAdmin) {
    db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)').run(
      'admin',
      adminHash,
      'Lương Gia Quản Trị Viên',
      'admin'
    );
  } else {
    // Keep admin password synchronized
    db.prepare('UPDATE users SET password_hash = ?, role = ? WHERE username = ?').run(
      adminHash,
      'admin',
      'admin'
    );
  }

  // Ensure normal demo user exists for regular login testing
  const checkUser = db.prepare('SELECT * FROM users WHERE username = ?').get('docgia1');
  if (!checkUser) {
    const userHash = bcrypt.hashSync('123456', salt);
    db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)').run(
      'docgia1',
      userHash,
      'Độc Giả Thân Thiết',
      'user'
    );
  }

  // Categories default setup
  const countCat = db.prepare('SELECT count(*) as count FROM categories').get();
  if (countCat.count === 0) {
    const insertCat = db.prepare('INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)');
    insertCat.run('Ngôn Tình Tổng Tài', 'ngon-tinh-tong-tai', 'Những câu chuyện hào môn thế gia, tổng tài bá đạo');
    insertCat.run('Đô Thị Hào Môn', 'do-thi-hao-mon', 'Giới thượng lưu, quyền mưu và tình duyên giới tinh hoa');
    insertCat.run('Trọng Sinh Báo Thù', 'trong-sinh-bao-thu', 'Kiếp trước bi kịch, kiếp này trở lại nghịch thiên cải mệnh');
    insertCat.run('Truyện Zhihu Edit', 'truyen-zhihu-edit', 'Những mẩu truyện ngắn sâu sắc, bất ngờ và cuốn hút phong cách Zhihu');
    insertCat.run('Cổ Đại Cung Đấu', 'co-dai-cung-dau', 'Quyền biến, cung đình và ái tình cổ phong');
    insertCat.run('Huyền Huyễn Tu Chân', 'huyen-huyen-tu-chan', 'Đại đạo mênh mông, cường giả vi tôn');
  }

  // Nếu bảng stories chưa có dữ liệu (ví dụ deploy mới trên Vercel hoặc /tmp rỗng):
  // Tự động khôi phục dữ liệu tức thời từ data/stories_data.json trong 1ms!
  const countStories = db.prepare('SELECT count(*) as count FROM stories').get();
  if (countStories.count === 0) {
    restoreFromSnapshot();
  }
}

initDb();

// Gắn các hàm tiện ích vào đối tượng db
db.createSlug = createSlug;
db.saveSnapshot = saveSnapshot;
db.restoreFromSnapshot = restoreFromSnapshot;

module.exports = db;
