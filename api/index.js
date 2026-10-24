require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const supabaseService = require('../supabase');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'luong_gia_novel_super_secret_key_2026';

// Khởi chạy đồng bộ dữ liệu mẫu lên Supabase nếu Supabase đang trống
try {
  const snapshotData = require('../data/stories_data.json');
  if (supabaseService.isAvailable()) {
    supabaseService.seedInitialDataIfNeeded(snapshotData).catch(err => {
      console.warn('Initial Supabase seed warning:', err.message);
    });
  }
} catch (e) {}

// Setup multer memory storage (Serverless compatible)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper function to create URL slug from Vietnamese string
const createSlug = db.createSlug;

// In-memory cache for ultra-fast reading performance
const memoryCache = {
  stories: null,
  storiesTimestamp: 0,
  categories: null,
  categoriesTimestamp: 0,
  CACHE_TTL: 15 * 1000 // 15 seconds cache TTL
};

function clearCache() {
  memoryCache.stories = null;
  memoryCache.storiesTimestamp = 0;
  memoryCache.categories = null;
  memoryCache.categoriesTimestamp = 0;
}

// Authentication & Role-Based Access Control (RBAC)
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) req.user = null;
    else req.user = user;
    next();
  });
}

app.use(authenticateToken);

function requireAdminRole(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Từ chối truy cập! Thao tác này chỉ dành riêng cho Quản Trị Viên (admin).'
    });
  }
  next();
}

// ================= AUTHENTICATION APIS =================

// Đăng nhập
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tài khoản và mật khẩu' });
    }

    // Direct credentials check for admin
    if (username === 'admin' && password === 'Tuan@2005') {
      const token = jwt.sign(
        { id: 1, username: 'admin', role: 'admin', full_name: 'Lương Gia Quản Trị Viên' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.json({
        success: true,
        message: 'Đăng nhập quản trị thành công',
        token,
        user: { id: 1, username: 'admin', role: 'admin', full_name: 'Lương Gia Quản Trị Viên' }
      });
    }

    let user = null;
    if (supabaseService.isAvailable()) {
      try {
        user = await supabaseService.getUserByUsername(username);
      } catch (e) {
        console.warn('Supabase auth query error:', e.message);
      }
    }

    if (!user) {
      try {
        user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      } catch (e) {}
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Tài khoản hoặc mật khẩu không chính xác' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Tài khoản hoặc mật khẩu không chính xác' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Đăng ký tài khoản độc giả mới
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, full_name } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Tên tài khoản và mật khẩu là bắt buộc' });
    }

    let existing = null;
    if (supabaseService.isAvailable()) {
      try {
        existing = await supabaseService.getUserByUsername(username);
      } catch (e) {}
    }
    if (!existing) {
      existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    }

    if (existing) {
      return res.status(400).json({ success: false, message: 'Tài khoản đã tồn tại' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    let userId = null;

    if (supabaseService.isAvailable()) {
      try {
        const newUser = await supabaseService.createUser({
          username,
          password_hash: hash,
          full_name: full_name || username,
          role: 'user'
        });
        if (newUser) userId = newUser.id;
      } catch (e) {
        console.warn('Lỗi ghi user vào Supabase:', e.message);
      }
    }

    try {
      const insert = db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)');
      const result = insert.run(username, hash, full_name || username, 'user');
      if (!userId) userId = result.lastInsertRowid;
    } catch (e) {}

    const token = jwt.sign(
      { id: userId, username, role: 'user', full_name: full_name || username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Đăng ký tài khoản thành công',
      token,
      user: { id: userId, username, role: 'user', full_name: full_name || username }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Lấy thông tin user hiện tại
app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
  }
  res.json({ success: true, user: req.user });
});

// ================= PUBLIC READ APIS =================

// Categories (Có cache in-memory)
app.get('/api/categories', async (req, res) => {
  try {
    const now = Date.now();
    if (memoryCache.categories && (now - memoryCache.categoriesTimestamp < 60000)) {
      return res.json({ success: true, data: memoryCache.categories });
    }

    let categories = null;
    if (supabaseService.isAvailable()) {
      try {
        categories = await supabaseService.getCategories();
      } catch (e) {
        console.warn('Supabase getCategories error:', e.message);
      }
    }

    if (!categories || categories.length === 0) {
      categories = db.prepare('SELECT * FROM categories ORDER BY id ASC').all();
    }

    memoryCache.categories = categories;
    memoryCache.categoriesTimestamp = now;

    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Stories with filter & search
app.get('/api/stories', async (req, res) => {
  try {
    const { category, status, search, sort, limit = 20, page = 1 } = req.query;

    const isDefaultQuery = !category && !status && !search && (!sort || sort === 'latest') && page == 1;
    const now = Date.now();
    if (isDefaultQuery && memoryCache.stories && (now - memoryCache.storiesTimestamp < memoryCache.CACHE_TTL)) {
      return res.json({ success: true, data: memoryCache.stories });
    }

    let stories = null;
    if (supabaseService.isAvailable()) {
      try {
        stories = await supabaseService.getStories({ category, status, search, sort, limit, page });
        // Nếu Supabase trả về rỗng trong lần tải đầu tiên, kiểm tra seed tự động
        if (stories.length === 0 && isDefaultQuery) {
          const snapshotData = require('../data/stories_data.json');
          await supabaseService.seedInitialDataIfNeeded(snapshotData);
          stories = await supabaseService.getStories({ category, status, search, sort, limit, page });
        }
      } catch (e) {
        console.warn('Supabase getStories fallback to SQLite:', e.message);
      }
    }

    // Fallback SQLite nếu Supabase chưa có hoặc gặp lỗi
    if (!stories) {
      let query = `
        SELECT DISTINCT s.*, 
          COALESCE((SELECT COUNT(*) FROM chapters c WHERE c.story_id = s.id), 0) as total_chapters,
          COALESCE((SELECT MAX(chapter_number) FROM chapters c WHERE c.story_id = s.id), 1) as latest_chapter_num,
          (SELECT title FROM chapters c WHERE c.story_id = s.id ORDER BY chapter_number DESC LIMIT 1) as latest_chapter_title
        FROM stories s
        LEFT JOIN story_categories sc ON s.id = sc.story_id
        LEFT JOIN categories cat ON sc.category_id = cat.id
        WHERE 1=1
      `;
      const params = [];

      if (category) {
        query += ` AND cat.slug = ?`;
        params.push(category);
      }
      if (status) {
        query += ` AND s.status = ?`;
        params.push(status);
      }
      if (search) {
        query += ` AND (s.title LIKE ? OR s.author LIKE ? OR s.description LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      if (sort === 'views') {
        query += ` ORDER BY s.views DESC`;
      } else if (sort === 'likes') {
        query += ` ORDER BY s.likes DESC`;
      } else {
        query += ` ORDER BY s.updated_at DESC`;
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);
      query += ` LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), offset);

      stories = db.prepare(query).all(...params);

      if (stories.length === 0 && !category && !status && !search) {
        const restored = db.restoreFromSnapshot();
        if (restored) {
          stories = db.prepare(query).all(...params);
        }
      }
    }

    if (isDefaultQuery) {
      memoryCache.stories = stories;
      memoryCache.storiesTimestamp = now;
    }

    res.json({ success: true, data: stories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Single Story Details
app.get('/api/stories/:slug', async (req, res) => {
  try {
    let result = null;
    if (supabaseService.isAvailable()) {
      try {
        result = await supabaseService.getStoryBySlug(req.params.slug);
      } catch (e) {
        console.warn('Supabase getStoryBySlug fallback:', e.message);
      }
    }

    if (!result) {
      let story = db.prepare('SELECT * FROM stories WHERE slug = ?').get(req.params.slug);
      if (!story) {
        story = db.prepare('SELECT * FROM stories WHERE slug LIKE ?').get(`%${req.params.slug}%`);
      }
      if (!story) {
        db.restoreFromSnapshot();
        story = db.prepare('SELECT * FROM stories WHERE slug = ?').get(req.params.slug);
      }

      if (!story) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy truyện' });
      }

      try {
        db.prepare('UPDATE stories SET views = views + 1 WHERE id = ?').run(story.id);
        story.views += 1;
      } catch (e) {}

      const categories = db.prepare(`
        SELECT c.* FROM categories c
        JOIN story_categories sc ON c.id = sc.category_id
        WHERE sc.story_id = ?
      `).all(story.id);

      const chapters = db.prepare(`
        SELECT id, chapter_number, title, slug, word_count, views, created_at
        FROM chapters
        WHERE story_id = ?
        ORDER BY chapter_number ASC
      `).all(story.id);

      result = {
        ...story,
        categories,
        chapters
      };
    }

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Chapter Content
app.get('/api/stories/:storySlug/chapters/:chapterSlug', async (req, res) => {
  try {
    let result = null;
    if (supabaseService.isAvailable()) {
      try {
        result = await supabaseService.getChapter(req.params.storySlug, req.params.chapterSlug);
      } catch (e) {
        console.warn('Supabase getChapter fallback:', e.message);
      }
    }

    if (!result) {
      const story = db.prepare('SELECT id, title, slug, author, audio_url FROM stories WHERE slug = ?').get(req.params.storySlug);
      if (!story) return res.status(404).json({ success: false, message: 'Truyện không tồn tại' });

      const chapter = db.prepare('SELECT * FROM chapters WHERE story_id = ? AND slug = ?').get(story.id, req.params.chapterSlug);
      if (!chapter) return res.status(404).json({ success: false, message: 'Chương không tồn tại' });

      try {
        db.prepare('UPDATE chapters SET views = views + 1 WHERE id = ?').run(chapter.id);
        db.prepare('UPDATE stories SET views = views + 1 WHERE id = ?').run(story.id);
        chapter.views += 1;
      } catch (e) {}

      const prevChapter = db.prepare(`
        SELECT slug, chapter_number, title FROM chapters 
        WHERE story_id = ? AND chapter_number < ? 
        ORDER BY chapter_number DESC LIMIT 1
      `).get(story.id, chapter.chapter_number);

      const nextChapter = db.prepare(`
        SELECT slug, chapter_number, title FROM chapters 
        WHERE story_id = ? AND chapter_number > ? 
        ORDER BY chapter_number ASC LIMIT 1
      `).get(story.id, chapter.chapter_number);

      const allChapters = db.prepare(`
        SELECT chapter_number, title, slug FROM chapters WHERE story_id = ? ORDER BY chapter_number ASC
      `).all(story.id);

      result = {
        story,
        chapter,
        prevChapter,
        nextChapter,
        allChapters
      };
    }

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ================= ADMIN & MANAGEMENT APIS =================

// Multer fields: upload ảnh bìa và file audio
const cpUpload = upload.fields([
  { name: 'cover', maxCount: 1 },
  { name: 'audio_file', maxCount: 1 }
]);

// 1. Tạo tác phẩm mới (Lưu trực tiếp vào Supabase Cloud)
app.post('/api/admin/stories', requireAdminRole, cpUpload, async (req, res) => {
  try {
    const { title, author, translator, description, status, category_ids, cover_url } = req.body;
    let cover_image = cover_url || '/assets/standard-cover.jpg';
    let final_audio_url = req.body.audio_url || null;
    const slug = createSlug(title);

    // 1. Xử lý tải ảnh bìa
    if (req.files && req.files['cover'] && req.files['cover'][0]) {
      const coverFile = req.files['cover'][0];
      const fileName = `cover_${Date.now()}_${slug}${path.extname(coverFile.originalname || '.jpg')}`;
      
      let uploadedUrl = null;
      if (supabaseService.isAvailable()) {
        uploadedUrl = await supabaseService.uploadToStorage('covers', fileName, coverFile.buffer, coverFile.mimetype || 'image/jpeg');
      }

      if (uploadedUrl) {
        cover_image = uploadedUrl;
      } else {
        cover_image = `data:${coverFile.mimetype || 'image/jpeg'};base64,${coverFile.buffer.toString('base64')}`;
      }
    }

    // 2. Xử lý tải file Audio giới thiệu truyện
    if (req.files && req.files['audio_file'] && req.files['audio_file'][0]) {
      const audioFile = req.files['audio_file'][0];
      const fileName = `audio_${Date.now()}_${slug}${path.extname(audioFile.originalname || '.mp3')}`;
      
      let uploadedAudioUrl = null;
      if (supabaseService.isAvailable()) {
        uploadedAudioUrl = await supabaseService.uploadToStorage('audios', fileName, audioFile.buffer, audioFile.mimetype || 'audio/mpeg');
      }

      if (uploadedAudioUrl) {
        final_audio_url = uploadedAudioUrl;
      }
    }

    let storyId = null;

    // 3. Lưu vào Supabase Cloud
    if (supabaseService.isAvailable()) {
      try {
        const createdStory = await supabaseService.createStory({
          title,
          slug,
          author: author || 'Lương Gia Tác Giả',
          translator: translator || 'Lương Gia Novel',
          cover_image,
          description: description || '',
          status: status || 'ongoing',
          audio_url: final_audio_url
        }, category_ids);

        if (createdStory) {
          storyId = createdStory.id;
        }
      } catch (err) {
        console.warn('Lỗi ghi Supabase createStory:', err.message);
      }
    }

    // 4. Đồng bộ lưu vào SQLite cục bộ
    try {
      const insert = db.prepare(`
        INSERT INTO stories (title, slug, author, translator, cover_image, description, status, audio_url, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      const result = insert.run(
        title,
        slug,
        author || 'Lương Gia Tác Giả',
        translator || 'Lương Gia Novel',
        cover_image,
        description,
        status || 'ongoing',
        final_audio_url
      );
      if (!storyId) storyId = result.lastInsertRowid;

      if (category_ids) {
        const cats = Array.isArray(category_ids) ? category_ids : [category_ids];
        const linkCat = db.prepare('INSERT OR IGNORE INTO story_categories (story_id, category_id) VALUES (?, ?)');
        cats.forEach(cid => linkCat.run(result.lastInsertRowid, parseInt(cid, 10)));
      }

      db.saveSnapshot();
    } catch (e) {
      console.warn('SQLite local sync warning:', e.message);
    }

    clearCache();

    res.json({
      success: true,
      message: 'Thêm tác phẩm mới vào Supabase thành công!',
      storyId,
      slug
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Chỉnh sửa truyện
app.put('/api/admin/stories/:id', requireAdminRole, async (req, res) => {
  try {
    const { title, author, translator, description, status, audio_url } = req.body;
    const storyId = req.params.id;

    if (supabaseService.isAvailable()) {
      try {
        await supabaseService.updateStory(storyId, {
          title, author, translator, description, status, audio_url
        });
      } catch (err) {
        console.warn('Supabase updateStory warning:', err.message);
      }
    }

    try {
      db.prepare(`
        UPDATE stories 
        SET title = COALESCE(?, title),
            author = COALESCE(?, author),
            translator = COALESCE(?, translator),
            description = COALESCE(?, description),
            status = COALESCE(?, status),
            audio_url = COALESCE(?, audio_url),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(title, author, translator, description, status, audio_url, storyId);
      db.saveSnapshot();
    } catch (e) {}

    clearCache();

    res.json({ success: true, message: 'Cập nhật truyện thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Đăng chương mới (Lưu trực tiếp vào Supabase Cloud)
app.post('/api/admin/chapters', requireAdminRole, upload.single('audio_file'), async (req, res) => {
  try {
    const { story_id, chapter_number, title, content } = req.body;
    let final_audio_url = req.body.audio_url || null;

    // Xử lý file Audio chương nếu có
    if (req.file) {
      const fileName = `ch_${chapter_number}_${Date.now()}${path.extname(req.file.originalname || '.mp3')}`;
      if (supabaseService.isAvailable()) {
        const uploadedAudio = await supabaseService.uploadToStorage('audios', fileName, req.file.buffer, req.file.mimetype || 'audio/mpeg');
        if (uploadedAudio) {
          final_audio_url = uploadedAudio;
        }
      }
    }

    const slug = `chuong-${chapter_number}-${createSlug(title)}`;
    const word_count = content ? content.trim().split(/\s+/).length : 0;

    // 1. Lưu vào Supabase Cloud
    if (supabaseService.isAvailable()) {
      try {
        await supabaseService.createOrUpdateChapter({
          story_id: parseInt(story_id, 10),
          chapter_number: parseInt(chapter_number, 10),
          title,
          slug,
          content,
          audio_url: final_audio_url,
          word_count
        });
      } catch (err) {
        console.warn('Supabase chapter insert warning:', err.message);
      }
    }

    // 2. Lưu vào SQLite cục bộ
    try {
      const insert = db.prepare(`
        INSERT OR REPLACE INTO chapters (story_id, chapter_number, title, slug, content, audio_url, word_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(story_id, chapter_number, title, slug, content, final_audio_url, word_count);
      db.prepare('UPDATE stories SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(story_id);
      db.saveSnapshot();
    } catch (e) {}

    clearCache();

    res.json({
      success: true,
      message: 'Đăng chương mới vào Supabase thành công!',
      slug
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Xóa truyện
app.delete('/api/admin/stories/:id', requireAdminRole, async (req, res) => {
  try {
    const storyId = req.params.id;

    if (supabaseService.isAvailable()) {
      try {
        await supabaseService.deleteStory(storyId);
      } catch (err) {
        console.warn('Supabase deleteStory warning:', err.message);
      }
    }

    try {
      db.prepare('DELETE FROM stories WHERE id = ?').run(storyId);
      db.saveSnapshot();
    } catch (e) {}

    clearCache();

    res.json({ success: true, message: 'Đã xóa tác phẩm và dọn sạch dữ liệu thành công!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Export / Backup snapshot JSON
app.get('/api/admin/export-snapshot', requireAdminRole, async (req, res) => {
  try {
    const stories = db.prepare('SELECT * FROM stories').all();
    const categories = db.prepare('SELECT * FROM categories').all();
    const storyCategories = db.prepare('SELECT * FROM story_categories').all();
    const chapters = db.prepare('SELECT * FROM chapters').all();

    res.json({
      success: true,
      snapshot: {
        version: 1,
        exported_at: new Date().toISOString(),
        categories,
        stories,
        story_categories: storyCategories,
        chapters
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = app;
