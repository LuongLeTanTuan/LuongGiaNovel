require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey && !supabaseUrl.includes('your-project')) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log('✓ Đã kết nối thành công tới Supabase Cloud!');
  } catch (err) {
    console.error('❌ Lỗi khởi tạo Supabase Client:', err.message);
    supabase = null;
  }
} else {
  console.log('ℹ Supabase chưa được cấu hình. Hệ thống đang sử dụng cơ sở dữ liệu SQLite cục bộ siêu tốc.');
}

function isAvailable() {
  return supabase !== null;
}

/**
 * Tải file lên Supabase Storage (covers hoặc audios) và lấy Public URL trực tiếp
 */
async function uploadToStorage(bucketName, filePath, buffer, mimeType) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      console.warn(`Supabase Storage upload warning [${bucketName}]:`, error.message);
      return null;
    }

    const { data: pubData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return pubData ? pubData.publicUrl : null;
  } catch (err) {
    console.warn(`Supabase Storage error [${bucketName}]:`, err.message);
    return null;
  }
}

/**
 * Lấy danh sách thể loại từ Supabase
 */
async function getCategories() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('id', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Lấy danh sách truyện kèm phân trang, tìm kiếm, lọc theo thể loại và sắp xếp
 */
async function getStories({ category, status, search, sort, limit = 20, page = 1 } = {}) {
  if (!supabase) return null;

  let query = supabase
    .from('stories')
    .select(`
      id, title, slug, author, translator, cover_image, description, status, audio_url, views, likes, created_at, updated_at,
      chapters(id, chapter_number, title)
    `);

  // Lọc theo thể loại
  if (category) {
    const { data: catData } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', category)
      .maybeSingle();

    if (catData) {
      const { data: scData } = await supabase
        .from('story_categories')
        .select('story_id')
        .eq('category_id', catData.id);

      const storyIds = (scData || []).map(r => r.story_id);
      if (storyIds.length === 0) return [];
      query = query.in('id', storyIds);
    } else {
      return [];
    }
  }

  // Lọc theo trạng thái
  if (status) {
    query = query.eq('status', status);
  }

  // Tìm kiếm theo từ khóa
  if (search) {
    query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%,description.ilike.%${search}%`);
  }

  // Sắp xếp
  if (sort === 'views') {
    query = query.order('views', { ascending: false });
  } else if (sort === 'likes') {
    query = query.order('likes', { ascending: false });
  } else {
    query = query.order('updated_at', { ascending: false });
  }

  // Phân trang
  const numLimit = parseInt(limit, 10) || 20;
  const numPage = parseInt(page, 10) || 1;
  const offset = (numPage - 1) * numLimit;
  query = query.range(offset, offset + numLimit - 1);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(s => {
    const chList = (s.chapters || []).sort((a, b) => a.chapter_number - b.chapter_number);
    const latestCh = chList.length > 0 ? chList[chList.length - 1] : null;
    return {
      id: s.id,
      title: s.title,
      slug: s.slug,
      author: s.author,
      translator: s.translator,
      cover_image: s.cover_image,
      description: s.description,
      status: s.status,
      audio_url: s.audio_url,
      views: s.views,
      likes: s.likes,
      created_at: s.created_at,
      updated_at: s.updated_at,
      total_chapters: chList.length,
      latest_chapter_num: latestCh ? latestCh.chapter_number : 1,
      latest_chapter_title: latestCh ? latestCh.title : null
    };
  });
}

/**
 * Lấy thông tin chi tiết một truyện theo slug
 */
async function getStoryBySlug(slug) {
  if (!supabase) return null;

  let { data: story, error } = await supabase
    .from('stories')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (!story) {
    const { data: fallbackStories } = await supabase
      .from('stories')
      .select('*')
      .ilike('slug', `%${slug}%`)
      .limit(1);

    if (fallbackStories && fallbackStories.length > 0) {
      story = fallbackStories[0];
    }
  }

  if (!story) return null;

  // Tăng lượt xem truyện ngầm (không chặn luồng trả dữ liệu về người dùng)
  supabase
    .from('stories')
    .update({ views: (story.views || 0) + 1 })
    .eq('id', story.id)
    .then(() => {})
    .catch(() => {});

  // Lấy song song (Parallel) danh sách thể loại liên kết và danh sách chương
  const [scResult, chaptersResult] = await Promise.all([
    supabase
      .from('story_categories')
      .select('category_id, categories(*)')
      .eq('story_id', story.id),
    supabase
      .from('chapters')
      .select('id, chapter_number, title, slug, word_count, views, created_at')
      .eq('story_id', story.id)
      .order('chapter_number', { ascending: true })
  ]);

  const categories = (scResult.data || []).map(item => item.categories).filter(Boolean);
  const chapters = chaptersResult.data || [];

  return {
    ...story,
    views: (story.views || 0) + 1,
    categories,
    chapters
  };
}


/**
 * Lấy nội dung chương truyện kèm chương trước / chương sau
 */
async function getChapter(storySlug, chapterSlug) {
  if (!supabase) return null;

  const { data: story } = await supabase
    .from('stories')
    .select('id, title, slug, author, audio_url')
    .eq('slug', storySlug)
    .maybeSingle();

  if (!story) return null;

  const { data: chapter } = await supabase
    .from('chapters')
    .select('*')
    .eq('story_id', story.id)
    .eq('slug', chapterSlug)
    .maybeSingle();

  if (!chapter) return null;

  // Tăng lượt xem ngầm (không chặn phản hồi về người dùng)
  Promise.all([
    supabase.from('chapters').update({ views: (chapter.views || 0) + 1 }).eq('id', chapter.id),
    supabase.from('stories').update({ views: (story.views || 0) + 1 }).eq('id', story.id)
  ]).catch(() => {});

  // Lấy song song: chương trước, chương sau và danh sách rút gọn các chương
  const [prevRes, nextRes, allChaptersRes] = await Promise.all([
    supabase
      .from('chapters')
      .select('slug, chapter_number, title')
      .eq('story_id', story.id)
      .lt('chapter_number', chapter.chapter_number)
      .order('chapter_number', { ascending: false })
      .limit(1),
    supabase
      .from('chapters')
      .select('slug, chapter_number, title')
      .eq('story_id', story.id)
      .gt('chapter_number', chapter.chapter_number)
      .order('chapter_number', { ascending: true })
      .limit(1),
    supabase
      .from('chapters')
      .select('chapter_number, title, slug')
      .eq('story_id', story.id)
      .order('chapter_number', { ascending: true })
  ]);

  const prevList = prevRes.data;
  const nextList = nextRes.data;
  const allChapters = allChaptersRes.data;

  return {
    story,
    chapter: {
      ...chapter,
      views: (chapter.views || 0) + 1
    },
    prevChapter: prevList && prevList.length > 0 ? prevList[0] : null,
    nextChapter: nextList && nextList.length > 0 ? nextList[0] : null,
    allChapters: allChapters || []
  };
}


/**
 * Tạo truyện mới trong Supabase
 */
async function createStory(storyData, categoryIds = []) {
  if (!supabase) return null;

  const { data: inserted, error } = await supabase
    .from('stories')
    .insert([{
      ...storyData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select()
    .single();

  if (error) throw error;

  if (categoryIds && categoryIds.length > 0) {
    const cats = Array.isArray(categoryIds) ? categoryIds : [categoryIds];
    const rows = cats.map(cid => ({
      story_id: inserted.id,
      category_id: parseInt(cid, 10)
    }));
    await supabase.from('story_categories').insert(rows);
  }

  return inserted;
}

/**
 * Cập nhật thông tin truyện
 */
async function updateStory(id, storyData) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('stories')
    .update({
      ...storyData,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Xóa truyện và toàn bộ chương liên kết
 */
async function deleteStory(id) {
  if (!supabase) return null;

  const { error } = await supabase
    .from('stories')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

/**
 * Đăng hoặc cập nhật chương truyện
 */
async function createOrUpdateChapter(chapterData) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('chapters')
    .upsert(chapterData, { onConflict: 'story_id,chapter_number' })
    .select()
    .single();

  if (error) throw error;

  // Cập nhật updated_at của truyện
  await supabase
    .from('stories')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', chapterData.story_id);

  return data;
}

/**
 * Quản lý người dùng qua Supabase
 */
async function getUserByUsername(username) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  return data;
}

async function createUser(userData) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('users')
    .insert([userData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Tự động nạp dữ liệu mẫu từ snapshot lên Supabase nếu bảng stories còn rỗng
 */
async function seedInitialDataIfNeeded(snapshot) {
  if (!supabase) return;
  try {
    const { count, error } = await supabase
      .from('stories')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.warn('ℹ Bảng Supabase chưa khởi tạo hoặc đang chờ chạy supabase_schema.sql:', error.message);
      return;
    }

    if (count === 0 && snapshot && Array.isArray(snapshot.stories) && snapshot.stories.length > 0) {
      console.log('🔄 Đang tự động nạp dữ liệu từ snapshot lên Supabase Cloud...');

      if (Array.isArray(snapshot.categories)) {
        for (const cat of snapshot.categories) {
          await supabase.from('categories').upsert({
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            description: cat.description || null
          }, { onConflict: 'slug' });
        }
      }

      for (const st of snapshot.stories) {
        await supabase.from('stories').upsert({
          id: st.id,
          title: st.title,
          slug: st.slug,
          author: st.author || 'Lương Gia Tác Giả',
          translator: st.translator || 'Lương Gia Novel',
          cover_image: st.cover_image || '/assets/standard-cover.jpg',
          description: st.description || '',
          status: st.status || 'ongoing',
          audio_url: st.audio_url || null,
          views: st.views || 0,
          likes: st.likes || 0,
          created_at: st.created_at || new Date().toISOString(),
          updated_at: st.updated_at || new Date().toISOString()
        }, { onConflict: 'id' });
      }

      if (Array.isArray(snapshot.story_categories)) {
        for (const sc of snapshot.story_categories) {
          await supabase.from('story_categories').upsert({
            story_id: sc.story_id,
            category_id: sc.category_id
          }, { onConflict: 'story_id,category_id' });
        }
      }

      if (Array.isArray(snapshot.chapters)) {
        for (const ch of snapshot.chapters) {
          await supabase.from('chapters').upsert({
            id: ch.id,
            story_id: ch.story_id,
            chapter_number: ch.chapter_number,
            title: ch.title,
            slug: ch.slug,
            content: ch.content,
            audio_url: ch.audio_url || null,
            word_count: ch.word_count || 0,
            views: ch.views || 0,
            created_at: ch.created_at || new Date().toISOString()
          }, { onConflict: 'id' });
        }
      }

      console.log('✓ Đã đồng bộ thành công dữ liệu truyện mẫu lên Supabase Cloud!');
    }
  } catch (err) {
    console.warn('Lỗi kiểm tra/đồng bộ dữ liệu lên Supabase:', err.message);
  }
}

module.exports = {
  client: supabase,
  isAvailable,
  uploadToStorage,
  getCategories,
  getStories,
  getStoryBySlug,
  getChapter,
  createStory,
  updateStory,
  deleteStory,
  createOrUpdateChapter,
  getUserByUsername,
  createUser,
  seedInitialDataIfNeeded
};
