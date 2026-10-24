// Luong Gia Novel Client Application
const state = {
  currentView: 'home', // 'home', 'detail', 'reader'
  stories: [],
  categories: [],
  currentStory: null,
  currentChapter: null,
  readingFontSize: 19,
  readingTheme: 'dark', // 'dark', 'sepia', 'light'
  readingFontFamily: 'Nunito', // 'Nunito', 'Lora'
  searchQuery: '',
  selectedCategory: '',
  token: localStorage.getItem('lgn_token') || null,
  user: JSON.parse(localStorage.getItem('lgn_user') || 'null'),
  chapterCache: new Map() // Instant reader cache & prefetch buffer
};


// SVG Icons Collection (100% lightweight pure SVG, no external fonts/heavy libraries)
const ICONS = {
  search: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
  user: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
  shield: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
  sparkle: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/></svg>`,
  book: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 7v14M3 18a1 1 0 01-1-1V4a1 1 0 011-1h5a4 4 0 014 4 4 4 0 014-4h5a1 1 0 011 1v13a1 1 0 01-1 1h-6a3 3 0 00-3 3 3 3 0 00-3-3z"/></svg>`,
  plus: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
  edit: `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
  trash: `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
  logout: `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
  chapterList: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`,
  flame: `<svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2c1.1 0 2 .9 2 2 0 .5-.2 1-.5 1.4L10 10l5-3c1.1 0 2 .9 2 2 0 4-3 7-5 9-2-2-5-5-5-9 0-1.1.9-2 2-2l5 3-3.5-4.6c-.3-.4-.5-.9-.5-1.4 0-1.1.9-2 2-2z"/></svg>`
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  loadPreferences();
  checkAuthSession();
  fetchCategories();
  handleRouting();

  window.addEventListener('popstate', handleRouting);

  const searchInput = document.getElementById('header-search');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        state.searchQuery = e.target.value;
        navigateTo('home');
        loadStories();
      }
    });
  }

  const mobileSearchInput = document.getElementById('mobile-search-input');
  if (mobileSearchInput) {
    mobileSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        state.searchQuery = e.target.value;
        closeMobileMenu();
        navigateTo('home');
        loadStories();
      }
    });
  }
});

function toggleMobileMenu() {
  const drawer = document.getElementById('mobile-drawer');
  if (drawer) {
    drawer.classList.toggle('open');
  }
}

function closeMobileMenu() {
  const drawer = document.getElementById('mobile-drawer');
  if (drawer) {
    drawer.classList.remove('open');
  }
}

function loadPreferences() {
  const savedFontSize = localStorage.getItem('lgn_font_size');
  if (savedFontSize) state.readingFontSize = parseInt(savedFontSize);

  const savedTheme = localStorage.getItem('lgn_theme');
  if (savedTheme) {
    state.readingTheme = savedTheme;
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
}

// Check session on load
async function checkAuthSession() {
  if (state.token) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
      const json = await res.json();
      if (json.success) {
        state.user = json.user;
        localStorage.setItem('lgn_user', JSON.stringify(json.user));
      } else {
        doLogout(false);
      }
    } catch {
      // offline or error
    }
  }
  renderAuthHeader();
}

function isAdmin() {
  return state.user && state.user.role === 'admin';
}

function renderAuthHeader() {
  const container = document.getElementById('auth-action-container');
  if (!container) return;

  if (state.user) {
    const isAdm = isAdmin();
    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
        ${isAdm ? `
          <button class="btn-luxury" style="padding: 7px 16px; font-size: 0.85rem;" onclick="openStoryModal()">
            ${ICONS.plus} <span>Đăng Truyện</span>
          </button>
        ` : ''}
        <div style="display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.05); padding: 5px 12px; border-radius: var(--radius-full); border: 1px solid var(--border-gold-subtle);">
          <span style="color: ${isAdm ? 'var(--gold-light)' : 'var(--text-main)'}; font-size: 0.85rem; font-weight: 700;">
            ${isAdm ? '👑 Quản Trị Viên' : state.user.username}
          </span>
          <button onclick="doLogout(true)" title="Đăng xuất" style="color: #9aa0a6; display: flex; align-items: center; padding: 2px;" onmouseover="this.style.color='#f87171'" onmouseout="this.style.color='#9aa0a6'">
            ${ICONS.logout}
          </button>
        </div>
      </div>
    `;
  } else {
    // Normal website login button
    container.innerHTML = `
      <button class="btn-secondary" style="padding: 7px 16px; font-size: 0.88rem; display: inline-flex; align-items: center; gap: 6px;" onclick="openAuthModal('login')">
        ${ICONS.user}
        <span>Đăng Nhập</span>
      </button>
    `;
  }
}


// Router
function navigateTo(view, params = {}, push = true) {
  state.currentView = view;

  let targetUrl = '/';
  if (view === 'detail') {
    targetUrl = `/truyen/${params.slug}`;
  } else if (view === 'reader') {
    targetUrl = `/truyen/${params.storySlug}/${params.chapterSlug}`;
  }

  if (push && window.location.pathname !== targetUrl) {
    window.history.pushState({ view, params }, '', targetUrl);
  }

  if (view === 'home') {
    renderHome();
  } else if (view === 'detail') {
    renderStoryDetail(params.slug);
  } else if (view === 'reader') {
    renderReader(params.storySlug, params.chapterSlug);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleRouting() {
  const path = window.location.pathname;
  const parts = path.split('/').filter(Boolean);

  if (parts.length === 0) {
    navigateTo('home', {}, false);
  } else if (parts[0] === 'truyen' && parts.length === 2) {
    navigateTo('detail', { slug: parts[1] }, false);
  } else if (parts[0] === 'truyen' && parts.length === 3) {
    navigateTo('reader', { storySlug: parts[1], chapterSlug: parts[2] }, false);
  } else {
    navigateTo('home', {}, false);
  }
}


// API Calls
async function fetchCategories() {
  try {
    const res = await fetch(`/api/categories?_t=${Date.now()}`, { cache: 'no-store' });
    const json = await res.json();
    if (json.success) {
      state.categories = json.data;
      renderCategoryPills();
    }
  } catch (err) {
    console.error('Lỗi tải thể loại:', err);
  }
}

async function loadStories() {
  try {
    const params = new URLSearchParams();
    if (state.selectedCategory) params.append('category', state.selectedCategory);
    if (state.searchQuery) params.append('search', state.searchQuery);
    params.append('_t', Date.now());

    const res = await fetch(`/api/stories?${params.toString()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      state.stories = json.data;
      renderStoryGrid();
    }
  } catch (err) {
    console.warn('Lỗi tải truyện từ server:', err);
    if (!state.stories || state.stories.length === 0) {
      renderStoryGrid();
    }
  }
}

function renderCategoryPills() {
  const container = document.getElementById('category-pills-container');
  if (!container) return;

  container.innerHTML = `
    <button class="category-pill ${!state.selectedCategory ? 'active' : ''}" onclick="selectCategory('')">Tất Cả</button>
    ${state.categories.map(cat => `
      <button class="category-pill ${state.selectedCategory === cat.slug ? 'active' : ''}" onclick="selectCategory('${cat.slug}')">${cat.name}</button>
    `).join('')}
  `;
}

function selectCategory(slug) {
  state.selectedCategory = slug;
  renderCategoryPills();
  loadStories();
}

// HOME PAGE
function renderHome() {
  const content = document.getElementById('app-content');
  const isAdm = isAdmin();

  content.innerHTML = `
    <!-- Hero Banner with Standard Gentleman Theme -->
    <div class="hero-banner">
      <div class="hero-grid">
        <div class="hero-content">
          <div class="hero-tag">
            ${ICONS.sparkle}
            Tác Phẩm Chọn Lọc Hoàng Gia
          </div>
          <h1 class="hero-title">Đế Chế Ngôn Từ <br><span class="gold-gradient-text">Lương Gia Novel</span></h1>
          <p class="hero-desc">Khám phá thế giới tiểu thuyết đặc sắc, ngôn tình tổng tài, hào môn thế gia và các tác phẩm tuyển chọn tinh tế. Trải nghiệm đọc trực tuyến hoàn mỹ trên nền phông chữ chuẩn sắc nét.</p>
          <div class="hero-actions">
            ${isAdm ? `
              <button class="btn-luxury" onclick="openStoryModal()">
                ${ICONS.plus} Đăng Tác Phẩm Mới
              </button>
            ` : `
              <button class="btn-luxury" onclick="document.getElementById('story-grid-container').scrollIntoView({ behavior: 'smooth' })">
                ${ICONS.book} Khám Phá Thư Viện
              </button>
            `}
          </div>
        </div>
        <div class="hero-visual">
          <img src="/assets/hero-banner.jpg" alt="Lương Gia Novel Cover" />
          <div class="hero-glow-overlay"></div>
        </div>
      </div>
    </div>

    <!-- Category Pills -->
    <div class="category-pills" id="category-pills-container"></div>

    <!-- Section Header -->
    <div class="section-header">
      <div class="section-title">
        <div class="section-title-icon">
          ${ICONS.flame}
        </div>
        Danh Sách Truyện Mới Cập Nhật
      </div>
      <a href="javascript:void(0)" onclick="loadStories()" class="section-link">Làm mới danh sách ›</a>
    </div>

    <div class="story-grid" id="story-grid-container">
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--gold-light);">Đang tải danh sách tác phẩm...</div>
    </div>
  `;

  renderCategoryPills();
  loadStories();
}

function renderStoryGrid() {
  const container = document.getElementById('story-grid-container');
  if (!container) return;

  if (state.stories.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-muted);">
        Không tìm thấy tác phẩm nào phù hợp.
      </div>
    `;
    return;
  }

  container.innerHTML = state.stories.map(story => `
    <article class="story-card" onclick="navigateTo('detail', {slug: '${story.slug}'})">
      <div class="story-card-cover">
        <img src="${story.cover_image || '/assets/standard-cover.jpg'}" alt="${story.title}" loading="lazy" />
        <span class="badge-status ${story.status === 'completed' ? '' : 'ongoing'}">
          ${story.status === 'completed' ? 'FULL' : 'ĐANG RA'}
        </span>
      </div>
      <h3 class="story-card-title">${story.title}</h3>
      <div class="story-card-meta">
        <span class="story-latest-ch">Ch. ${story.latest_chapter_num || 1} mới</span>
        <span>${formatTimeAgo(story.updated_at)}</span>
      </div>
    </article>
  `).join('');
}

// STORY DETAIL VIEW (SIÊU MƯỢT TỨC THÌ)
async function renderStoryDetail(slug) {
  const content = document.getElementById('app-content');
  
  // 1. Nếu đã có sẵn truyện trong state.stories hoặc state.currentStory, render ngay khung chi tiết
  const existingStory = (state.currentStory && state.currentStory.slug === slug)
    ? state.currentStory
    : (state.stories ? state.stories.find(s => s.slug === slug) : null);

  if (!existingStory) {
    content.innerHTML = `<div style="text-align: center; padding: 80px; color: var(--gold-primary);">Đang tải chi tiết tác phẩm...</div>`;
  }

  try {
    const res = await fetch(`/api/stories/${slug}`);
    const json = await res.json();
    if (!json.success) {
      content.innerHTML = `<div style="text-align: center; padding: 80px;">Không tìm thấy truyện này. <a href="javascript:navigateTo('home')" style="color:var(--gold-primary)">Về trang chủ</a></div>`;
      return;
    }

    const story = json.data;
    state.currentStory = story;
    const isAdm = isAdmin();

    content.innerHTML = `
      <div class="glass-panel" style="padding: 30px; margin-bottom: 25px;">
        <div class="story-detail-wrap" style="display: flex; gap: 35px; flex-wrap: wrap;">
          <div class="story-detail-cover" style="width: 240px; aspect-ratio: 3/4; border-radius: 16px; overflow: hidden; border: 1px solid var(--border-gold-subtle); box-shadow: var(--shadow-card); flex-shrink: 0;">
            <img src="${story.cover_image || '/assets/standard-cover.jpg'}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <div style="flex: 1; min-width: 260px;">
            <div class="story-detail-badges" style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; align-items: center;">
              ${story.categories.map(c => `<span style="font-size: 0.8rem; font-weight: 700; color: var(--gold-light); background: rgba(216,170,104,0.12); padding: 4px 12px; border-radius: 20px; border: 1px solid var(--border-gold-subtle);">${c.name}</span>`).join('')}
              <span class="badge-status" style="position: static;">${story.status === 'completed' ? 'TRỌN BỘ' : 'ĐANG TIẾP DIỄN'}</span>
              
              ${isAdm ? `
                <button class="btn-secondary" style="padding: 4px 12px; font-size: 0.78rem; border-color: var(--gold-primary); color: var(--gold-light);" onclick="openEditStoryModal(${story.id})">
                  ${ICONS.edit} Chỉnh sửa truyện
                </button>
                <button class="btn-secondary" style="padding: 4px 12px; font-size: 0.78rem; border-color: rgba(239, 68, 68, 0.4); color: #f87171;" onclick="deleteStory(${story.id})">
                  ${ICONS.trash} Xóa
                </button>
              ` : ''}
            </div>

            <h1 class="story-detail-title" style="font-family: var(--font-brand); font-size: 2.2rem; font-weight: 800; margin-bottom: 15px; color: var(--text-main);">${story.title}</h1>
            <div class="story-detail-meta" style="display: flex; gap: 24px; font-size: 0.92rem; color: var(--text-muted); margin-bottom: 20px;">
              <div>Tác giả: <strong style="color: var(--gold-light);">${story.author}</strong></div>
              <div>Team dịch: <strong style="color: var(--gold-light);">${story.translator}</strong></div>
              <div>Lượt xem: <strong style="color: var(--gold-light);">${story.views.toLocaleString()}</strong></div>
            </div>
            <p style="font-size: 1rem; line-height: 1.8; color: var(--text-muted); margin-bottom: 28px; white-space: pre-line;">${story.description}</p>
            
            <div class="story-detail-actions" style="display: flex; gap: 14px; flex-wrap: wrap;">
              ${story.chapters.length > 0 ? `
                <button class="btn-luxury" onclick="navigateTo('reader', {storySlug: '${story.slug}', chapterSlug: '${story.chapters[0].slug}'})">
                  ${ICONS.book} Đọc Từ Đầu (Ch. 1)
                </button>
                <button class="btn-secondary" onclick="navigateTo('reader', {storySlug: '${story.slug}', chapterSlug: '${story.chapters[story.chapters.length - 1].slug}'})">
                  Đọc Mới Nhất (Ch. ${story.chapters[story.chapters.length - 1].chapter_number})
                </button>
              ` : `<div style="color: var(--text-dim);">Chưa có chương nào được đăng.</div>`}
              
              ${isAdm ? `
                <button class="btn-luxury" style="background: rgba(216,170,104,0.2); border: 1px solid var(--gold-primary); color: var(--gold-light);" onclick="openChapterUploadModal(${story.id})">
                  ${ICONS.plus} Thêm Chương Mới
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- Chapter List -->
      <div class="glass-panel" style="padding: 30px;">
        <h3 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 20px; color: var(--gold-light); display: flex; align-items: center; gap: 10px;">
          ${ICONS.chapterList}
          Danh Sách Các Chương (${story.chapters.length})
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">
          ${story.chapters.map(ch => `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-gold-subtle); border-radius: 12px; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s;"
                 onmouseover="this.style.borderColor='var(--gold-primary)'; this.style.background='rgba(216,170,104,0.1)'"
                 onmouseout="this.style.borderColor='var(--border-gold-subtle)'; this.style.background='rgba(255,255,255,0.03)'"
                 onclick="navigateTo('reader', {storySlug: '${story.slug}', chapterSlug: '${ch.slug}'})">
              <span style="font-weight: 600; font-size: 0.95rem; color: var(--text-main);">${ch.title}</span>
              <span style="font-size: 0.8rem; color: var(--text-dim);">${ch.views} đọc</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
  }
}

// READER VIEW (CHẤT LƯỢNG NUNITO CHUẨN TRUYENEDIT - TỐC ĐỘ SIÊU TỐC)
async function renderReader(storySlug, chapterSlug) {
  const content = document.getElementById('app-content');
  const cacheKey = `${storySlug}/${chapterSlug}`;

  let chapterData = state.chapterCache.get(cacheKey);
  if (!chapterData) {
    content.innerHTML = `<div style="text-align: center; padding: 80px; color: var(--gold-primary);"><div style="display:inline-block; margin-bottom:12px; animation:spin 1s linear infinite;">⏳</div><br>Đang tải chương truyện...</div>`;
    try {
      const res = await fetch(`/api/stories/${storySlug}/chapters/${chapterSlug}`);
      const json = await res.json();
      if (!json.success) {
        content.innerHTML = `<div style="text-align: center; padding: 80px;">Chương truyện không tồn tại. <a href="javascript:navigateTo('detail', {slug:'${storySlug}'})" style="color:var(--gold-primary)">Quay lại</a></div>`;
        return;
      }
      chapterData = json.data;
      state.chapterCache.set(cacheKey, chapterData);
    } catch (err) {
      console.error(err);
      content.innerHTML = `<div style="text-align: center; padding: 80px;">Lỗi tải nội dung. Vui lòng thử lại.</div>`;
      return;
    }
  }

  try {
    const { story, chapter, prevChapter, nextChapter, allChapters } = chapterData;
    state.currentStory = story;
    state.currentChapter = chapter;

    // Tự động tải trước (Prefetch) ngầm chương tiếp theo vào bộ nhớ cache để độc giả bấm qua chương sau lập tức hiện ngay 0ms
    if (nextChapter && !state.chapterCache.has(`${storySlug}/${nextChapter.slug}`)) {
      fetch(`/api/stories/${storySlug}/chapters/${nextChapter.slug}`)
        .then(r => r.json())
        .then(res => {
          if (res.success && res.data) {
            state.chapterCache.set(`${storySlug}/${nextChapter.slug}`, res.data);
          }
        })
        .catch(() => {});
    }

    const paragraphs = chapter.content.split(/\n\s*\n/).map(p => `<p>${p.trim()}</p>`).join('');


    content.innerHTML = `
      <div class="reader-wrapper">
        <div class="reader-toolbar">
          <div class="reader-settings-group">
            <button class="btn-secondary" style="padding: 6px 14px; font-size: 0.85rem;" onclick="navigateTo('detail', {slug: '${story.slug}'})">
              ‹ Về Mục Lục
            </button>
            <select class="form-select" style="padding: 6px 10px; font-size: 0.85rem; width: auto;" onchange="navigateTo('reader', {storySlug: '${story.slug}', chapterSlug: this.value})">
              ${allChapters.map(c => `
                <option value="${c.slug}" ${c.slug === chapter.slug ? 'selected' : ''}>Chương ${c.chapter_number}</option>
              `).join('')}
            </select>
          </div>

          <div class="reader-settings-group">
            <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.85rem;" onclick="toggleReadingFont()" title="Đổi Font (Nunito / Lora Serif)">
              <span id="font-family-badge">Font: ${state.readingFontFamily}</span>
            </button>

            <button class="btn-secondary" style="padding: 6px 12px; font-weight: bold;" onclick="adjustFontSize(-1)">A-</button>
            <span style="font-size: 0.85rem; font-weight: bold; color: var(--gold-light);" id="font-size-display">${state.readingFontSize}px</span>
            <button class="btn-secondary" style="padding: 6px 12px; font-weight: bold;" onclick="adjustFontSize(1)">A+</button>

            <div style="display: flex; gap: 6px; margin-left: 6px;">
              <button onclick="setTheme('dark')" style="width: 24px; height: 24px; border-radius: 50%; background: #0b0c10; border: 2px solid ${state.readingTheme==='dark'?'var(--gold-primary)':'#444'};" title="Tối"></button>
              <button onclick="setTheme('sepia')" style="width: 24px; height: 24px; border-radius: 50%; background: #f4ecd8; border: 2px solid ${state.readingTheme==='sepia'?'var(--gold-primary)':'#bbb'};" title="Vàng nhạt / Sepia"></button>
              <button onclick="setTheme('light')" style="width: 24px; height: 24px; border-radius: 50%; background: #ffffff; border: 2px solid ${state.readingTheme==='light'?'var(--gold-primary)':'#ccc'};" title="Sáng"></button>
            </div>
          </div>
        </div>

        <!-- AUDIO NOVEL PLAYER (THÍNH GIẢ NGHE TRUYỆN AUDIO) -->
        ${(chapter.audio_url || story.audio_url) ? `
          <div class="glass-panel" style="padding: 18px 24px; margin-bottom: 24px; border: 1px solid var(--gold-primary); background: rgba(22, 25, 34, 0.95);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--gold-gradient); display: flex; align-items: center; justify-content: center; color: #11141a;">
                  <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
                </div>
                <div>
                  <div style="font-weight: 700; color: var(--gold-light); font-size: 0.95rem;">Lương Gia Audio Player</div>
                  <div style="font-size: 0.8rem; color: var(--text-muted);">Thính giả nghe đọc bản Audio thay vì đọc chữ</div>
                </div>
              </div>

              <!-- Speed Controls -->
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.82rem; color: var(--text-muted);">Tốc độ:</span>
                <button class="btn-secondary audio-speed-btn" style="padding: 3px 8px; font-size: 0.78rem;" onclick="setAudioSpeed(0.8)">0.8x</button>
                <button class="btn-secondary audio-speed-btn active" style="padding: 3px 8px; font-size: 0.78rem; background: var(--gold-primary); color: #11141a; font-weight: bold;" onclick="setAudioSpeed(1.0)">1.0x</button>
                <button class="btn-secondary audio-speed-btn" style="padding: 3px 8px; font-size: 0.78rem;" onclick="setAudioSpeed(1.25)">1.25x</button>
                <button class="btn-secondary audio-speed-btn" style="padding: 3px 8px; font-size: 0.78rem;" onclick="setAudioSpeed(1.5)">1.5x</button>
                <button class="btn-secondary audio-speed-btn" style="padding: 3px 8px; font-size: 0.78rem;" onclick="setAudioSpeed(2.0)">2.0x</button>
              </div>
            </div>

            <!-- HTML5 Audio Element with Luxury Styling -->
            <audio id="novel-audio-player" controls style="width: 100%; border-radius: 8px; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4));">
              <source src="${chapter.audio_url || story.audio_url}" type="audio/mpeg">
              Trình duyệt của bạn không hỗ trợ phát audio.
            </audio>
          </div>
        ` : ''}

        <article class="reader-content" id="reader-body" style="font-size: ${state.readingFontSize}px; font-family: ${state.readingFontFamily === 'Nunito' ? 'var(--font-reading)' : 'var(--font-serif-reader)'};">
          <div class="reader-header">
            <div class="reader-story-title">${story.title}</div>
            <h1 class="reader-chapter-title">${chapter.title}</h1>
            <div style="font-size: 0.85rem; color: var(--text-dim); margin-top: 10px;">
              ${chapter.word_count} chữ • ${chapter.views} lượt xem • Cập nhật lúc ${new Date(chapter.created_at).toLocaleDateString('vi-VN')}
            </div>
          </div>

          <div class="reader-paragraphs">
            ${paragraphs}
          </div>

          <div class="reader-nav-buttons">
            ${prevChapter ? `
              <button class="btn-luxury" onclick="navigateTo('reader', {storySlug: '${story.slug}', chapterSlug: '${prevChapter.slug}'})">
                ‹ Chương Trước
              </button>
            ` : `<div></div>`}

            <button class="btn-secondary" onclick="navigateTo('detail', {slug: '${story.slug}'})">
              Mục Lục
            </button>

            ${nextChapter ? `
              <button class="btn-luxury" onclick="navigateTo('reader', {storySlug: '${story.slug}', chapterSlug: '${nextChapter.slug}'})">
                Chương Sau ›
              </button>
            ` : `<button class="btn-secondary" disabled style="opacity: 0.5;">Đã hết chương</button>`}
          </div>
        </article>
      </div>
    `;
  } catch (err) {
    console.error(err);
  }
}

// FONT & THEME CONTROLS
function adjustFontSize(delta) {
  state.readingFontSize = Math.max(14, Math.min(32, state.readingFontSize + delta));
  localStorage.setItem('lgn_font_size', state.readingFontSize);
  const body = document.getElementById('reader-body');
  const display = document.getElementById('font-size-display');
  if (body) body.style.fontSize = `${state.readingFontSize}px`;
  if (display) display.innerText = `${state.readingFontSize}px`;
}

function toggleReadingFont() {
  state.readingFontFamily = state.readingFontFamily === 'Nunito' ? 'Lora' : 'Nunito';
  const body = document.getElementById('reader-body');
  const badge = document.getElementById('font-family-badge');
  if (body) {
    body.style.fontFamily = state.readingFontFamily === 'Nunito' ? 'var(--font-reading)' : 'var(--font-serif-reader)';
  }
  if (badge) badge.innerText = `Font: ${state.readingFontFamily}`;
}

function setTheme(theme) {
  state.readingTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('lgn_theme', theme);
  if (state.currentView === 'reader') {
    renderReader(state.currentStory.slug, state.currentChapter.slug);
  }
}

// ================= MODAL AUTH (GIAO DIỆN ĐĂNG NHẬP CHUẨN THƯỜNG THẤY) =================
function openAuthModal(mode = 'login') {
  closeModal('auth-modal');
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'auth-modal';
  
  modal.innerHTML = `
    <div class="modal-card" style="max-width: 420px; text-align: center;">
      <div style="display: flex; justify-content: flex-end;">
        <button onclick="closeModal('auth-modal')" style="color: var(--text-dim); font-size: 1.5rem;">&times;</button>
      </div>

      <div style="margin-bottom: 24px;">
        <div style="width: 52px; height: 52px; border-radius: 50%; background: rgba(216, 170, 104, 0.15); border: 1px solid var(--border-gold-subtle); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px; color: var(--gold-primary);">
          ${ICONS.user}
        </div>
        <h2 style="font-family: var(--font-brand); color: var(--gold-light); font-size: 1.5rem;">
          ${mode === 'login' ? 'Đăng Nhập Tài Khoản' : 'Đăng Ký Thành Viên'}
        </h2>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
          ${mode === 'login' ? 'Đăng nhập vào hệ thống Lương Gia Novel' : 'Tạo tài khoản để lưu truyện và tham gia bình luận'}
        </p>
      </div>

      <form id="auth-form" onsubmit="handleAuthSubmit(event, '${mode}')" style="text-align: left;">
        ${mode === 'register' ? `
          <div class="form-group">
            <label class="form-label">Họ Tên / Biệt Danh</label>
            <input type="text" name="full_name" class="form-input" placeholder="Tên hiển thị..." />
          </div>
        ` : ''}
        
        <div class="form-group">
          <label class="form-label">Tài Khoản</label>
          <input type="text" name="username" class="form-input" required placeholder="Nhập tên đăng nhập..." autocomplete="username" />
        </div>
        
        <div class="form-group">
          <label class="form-label">Mật Khẩu</label>
          <input type="password" name="password" class="form-input" required placeholder="Nhập mật khẩu..." autocomplete="current-password" />
        </div>

        <div id="auth-error-msg" style="color: #f87171; font-size: 0.85rem; margin-bottom: 15px; display: none;"></div>

        <button type="submit" class="btn-luxury" style="width: 100%; justify-content: center; padding: 12px; margin-top: 5px;">
          ${mode === 'login' ? 'Đăng Nhập' : 'Tạo Tài Khoản'}
        </button>

        <div style="margin-top: 20px; text-align: center; font-size: 0.88rem; color: var(--text-muted);">
          ${mode === 'login' ? `
            Chưa có tài khoản? <a href="javascript:void(0)" onclick="openAuthModal('register')" style="color: var(--gold-light); font-weight: 700;">Đăng ký ngay</a>
          ` : `
            Đã có tài khoản? <a href="javascript:void(0)" onclick="openAuthModal('login')" style="color: var(--gold-light); font-weight: 700;">Đăng nhập</a>
          `}
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

async function handleAuthSubmit(e, mode) {
  e.preventDefault();
  const form = e.target;
  const username = form.username.value.trim();
  const password = form.password.value;
  const full_name = form.full_name ? form.full_name.value.trim() : '';
  const errorMsg = document.getElementById('auth-error-msg');

  const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
  const payload = { username, password, full_name };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      state.token = json.token;
      state.user = json.user;
      localStorage.setItem('lgn_token', json.token);
      localStorage.setItem('lgn_user', JSON.stringify(json.user));

      closeModal('auth-modal');
      renderAuthHeader();

      // Refresh view to toggle admin controls if user is admin
      if (state.currentView === 'home') renderHome();
      else if (state.currentView === 'detail' && state.currentStory) renderStoryDetail(state.currentStory.slug);

      if (json.user.role === 'admin') {
        alert('Đăng nhập thành công với quyền Quản Trị Viên (Admin)! Các chức năng Đăng truyện và Quản lý đã được kích hoạt.');
      } else {
        alert(`Chào mừng ${json.user.full_name || json.user.username} quay trở lại!`);
      }
    } else {
      if (errorMsg) {
        errorMsg.innerText = json.message || 'Thao tác không thành công';
        errorMsg.style.display = 'block';
      }
    }
  } catch (err) {
    if (errorMsg) {
      errorMsg.innerText = 'Lỗi kết nối máy chủ: ' + err.message;
      errorMsg.style.display = 'block';
    }
  }
}

function doLogout(confirmPrompt = true) {
  if (confirmPrompt && !confirm('Bạn có muốn đăng xuất khỏi tài khoản?')) return;
  state.token = null;
  state.user = null;
  localStorage.removeItem('lgn_token');
  localStorage.removeItem('lgn_user');
  renderAuthHeader();
  if (state.currentView === 'home') renderHome();
  else if (state.currentView === 'detail' && state.currentStory) renderStoryDetail(state.currentStory.slug);
}

function setAudioSpeed(speed) {
  const audio = document.getElementById('novel-audio-player');
  if (audio) {
    audio.playbackRate = speed;
  }
  document.querySelectorAll('.audio-speed-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.style.background = 'rgba(255, 255, 255, 0.05)';
    btn.style.color = 'var(--text-main)';
  });
  if (event && event.target) {
    event.target.classList.add('active');
    event.target.style.background = 'var(--gold-primary)';
    event.target.style.color = '#11141a';
  }
}

// ================= MODAL ADMIN: THÊM & CHỈNH SỬA TRUYỆN =================
function openStoryModal() {
  if (!isAdmin()) {
    openAuthModal('login');
    return;
  }
  closeModal('story-modal');
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'story-modal';
  modal.innerHTML = `
    <div class="modal-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="font-family: var(--font-brand); color: var(--gold-light); font-size: 1.5rem;">Đăng Tác Phẩm Mới</h2>
        <button onclick="closeModal('story-modal')" style="color: var(--text-dim); font-size: 1.5rem;">&times;</button>
      </div>

      <form id="create-story-form" onsubmit="submitNewStory(event)">
        <div class="form-group">
          <label class="form-label">Tên Truyện *</label>
          <input type="text" name="title" class="form-input" required placeholder="Ví dụ: Hoàng Kim Mệnh Số..." />
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div class="form-group">
            <label class="form-label">Tác Giả</label>
            <input type="text" name="author" class="form-input" value="Lương Gia Tác Giả" />
          </div>
          <div class="form-group">
            <label class="form-label">Tình Trạng</label>
            <select name="status" class="form-select">
              <option value="ongoing">Đang Ra</option>
              <option value="completed">Trọn Bộ (FULL)</option>
            </select>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div class="form-group">
            <label class="form-label">Ảnh Bìa (Tùy chọn tải lên)</label>
            <input type="file" name="cover" accept="image/*" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">Link Audio Giới Thiệu (Tùy chọn)</label>
            <input type="text" name="audio_url" class="form-input" placeholder="Dán link nếu có (Hoặc up file ở từng chương)..." />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Thể Loại</label>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            ${state.categories.map(c => `
              <label style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--text-main);">
                <input type="checkbox" name="category_ids" value="${c.id}" /> ${c.name}
              </label>
            `).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Giới Thiệu Nội Dung</label>
          <textarea name="description" rows="4" class="form-textarea" placeholder="Tóm tắt nội dung cuốn truyện..."></textarea>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 25px;">
          <button type="button" class="btn-secondary" onclick="closeModal('story-modal')">Hủy</button>
          <button type="submit" class="btn-luxury">Lưu Tác Phẩm</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

function openEditStoryModal(storyId) {
  if (!isAdmin()) return;
  const story = state.currentStory;
  closeModal('edit-story-modal');

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'edit-story-modal';
  modal.innerHTML = `
    <div class="modal-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="font-family: var(--font-brand); color: var(--gold-light); font-size: 1.5rem;">Chỉnh Sửa Truyện</h2>
        <button onclick="closeModal('edit-story-modal')" style="color: var(--text-dim); font-size: 1.5rem;">&times;</button>
      </div>

      <form onsubmit="submitEditStory(event, ${storyId})">
        <div class="form-group">
          <label class="form-label">Tên Truyện *</label>
          <input type="text" name="title" class="form-input" required value="${story.title}" />
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div class="form-group">
            <label class="form-label">Tác Giả</label>
            <input type="text" name="author" class="form-input" value="${story.author || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Tình Trạng</label>
            <select name="status" class="form-select">
              <option value="ongoing" ${story.status==='ongoing'?'selected':''}>Đang Ra</option>
              <option value="completed" ${story.status==='completed'?'selected':''}>Trọn Bộ (FULL)</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Giới Thiệu Nội Dung</label>
          <textarea name="description" rows="5" class="form-textarea">${story.description || ''}</textarea>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 25px;">
          <button type="button" class="btn-secondary" onclick="closeModal('edit-story-modal')">Hủy</button>
          <button type="submit" class="btn-luxury">Lưu Cập Nhật</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

async function submitEditStory(e, storyId) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    title: form.title.value,
    author: form.author.value,
    status: form.status.value,
    description: form.description.value
  };

  try {
    const res = await fetch(`/api/admin/stories/${storyId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      alert('Đã cập nhật thông tin truyện!');
      closeModal('edit-story-modal');
      renderStoryDetail(state.currentStory.slug);
    } else {
      alert('Lỗi: ' + json.message);
    }
  } catch (err) {
    alert('Lỗi gửi dữ liệu: ' + err.message);
  }
}

async function deleteStory(storyId) {
  if (!confirm('Bạn có chắc chắn muốn xóa tác phẩm này vĩnh viễn?')) return;
  try {
    const res = await fetch(`/api/admin/stories/${storyId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const json = await res.json();
    if (json.success) {
      alert('Đã xóa truyện thành công');
      navigateTo('home');
    } else {
      alert('Lỗi: ' + json.message);
    }
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

function openChapterUploadModal(storyId) {
  if (!isAdmin()) {
    openAuthModal('login');
    return;
  }
  closeModal('chapter-modal');
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'chapter-modal';
  modal.innerHTML = `
    <div class="modal-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="font-family: var(--font-brand); color: var(--gold-light); font-size: 1.5rem;">Thêm Chương Mới</h2>
        <button onclick="closeModal('chapter-modal')" style="color: var(--text-dim); font-size: 1.5rem;">&times;</button>
      </div>

      <!-- Quick TXT File Picker -->
      <div style="background: rgba(216, 170, 104, 0.08); border: 1.5px dashed var(--gold-primary); border-radius: 14px; padding: 16px 20px; margin-bottom: 20px; text-align: center;">
        <div style="font-weight: 700; color: var(--gold-light); font-size: 0.95rem; margin-bottom: 6px;">
          ⚡ Chọn File .txt Từ Máy Tính Để Tự Động Điền & Làm Sạch
        </div>
        <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 12px;">
          Hệ thống sẽ tự động bóc tách đúng Tên chương, Số thứ tự và làm sạch 100% phần giới thiệu thừa, bạn không cần phải gõ tay!
        </p>
        <label class="btn-luxury" style="cursor: pointer; display: inline-flex; font-size: 0.85rem; padding: 7px 20px;">
          📁 Chọn File .txt Chương Truyện
          <input type="file" accept=".txt,text/plain" style="display: none;" onchange="handleTxtFileSelect(event)" />
        </label>
      </div>

      <form id="create-chapter-form" onsubmit="submitNewChapter(event, ${storyId})">
        <div style="display: grid; grid-template-columns: 120px 1fr; gap: 15px;">
          <div class="form-group">
            <label class="form-label">Số Thứ Tự *</label>
            <input type="number" id="chapter-number-input" name="chapter_number" class="form-input" required value="${(state.currentStory?.chapters?.length || 0) + 1}" />
          </div>
          <div class="form-group">
            <label class="form-label">Tiêu Đề Chương *</label>
            <input type="text" id="chapter-title-input" name="title" class="form-input" required placeholder="Ví dụ: Chương 1: VẬT THỬ SỐ BỐN MƯƠI BẢY" />
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div class="form-group">
            <label class="form-label">Chọn File Audio Chương (MP3/M4A)</label>
            <input type="file" name="audio_file" accept="audio/*" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">Hoặc Dán Link Audio Trực Tiếp</label>
            <input type="text" name="audio_url" class="form-input" placeholder="Dán link nếu có..." />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Nội Dung Chương * (Đã được lọc sạch tự động)</label>
          <textarea id="chapter-content-input" name="content" rows="12" class="form-textarea" required placeholder="Nội dung truyện sẽ tự động điền vào đây khi bạn chọn file .txt hoặc dán trực tiếp..."></textarea>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 25px;">
          <button type="button" class="btn-secondary" onclick="closeModal('chapter-modal')">Hủy</button>
          <button type="submit" class="btn-luxury">Đăng Chương Lên Web</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

// Hàm đọc và bóc tách trực tiếp file .txt người dùng chọn ngay tại trình duyệt
function handleTxtFileSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const rawText = e.target.result || '';
    const fallbackName = file.name.replace(/\.[^/.]+$/, '');

    let title = fallbackName;
    let chapterNum = 1;
    let cleanContent = rawText;

    // 1. Tìm tiêu đề CHƯƠNG: ... trong nội dung file txt
    const titleMatch = rawText.match(/^(?:CHƯƠNG|CHUONG)\s*(\d+)[\s:.-]*(.*)$/im);
    if (titleMatch) {
      chapterNum = parseInt(titleMatch[1], 10);
      const subTitle = (titleMatch[2] || '').trim();
      title = `Chương ${chapterNum}` + (subTitle ? `: ${subTitle}` : '');
    } else {
      const numMatch = fallbackName.match(/\d+/);
      if (numMatch) {
        chapterNum = parseInt(numMatch[0], 10);
        title = `Chương ${chapterNum}`;
      }
    }

    // 2. Tách bỏ phần Header (TÁC PHẨM, TẬP, CHƯƠNG và các dải gạch ngang =================)
    const dividerRegex = /[=\-]{5,}/g;
    const matches = [...cleanContent.matchAll(dividerRegex)];
    if (matches.length >= 2) {
      const secondDividerEnd = matches[1].index + matches[1][0].length;
      cleanContent = cleanContent.slice(secondDividerEnd);
    } else {
      cleanContent = cleanContent.replace(/^(?:TÁC\s+PHẨM|TAC\s+PHAM|TẬP|TAP|CHƯƠNG|CHUONG)[^\n]*\n?/gim, '');
      cleanContent = cleanContent.replace(/^[=\-]{3,}[^\n]*\n?/gm, '');
    }

    // 3. Tách bỏ phần Footer cuối truyện
    cleanContent = cleanContent.replace(/\[\s*HẾT\s+CHƯƠNG[^\n\]]*\][\s\S]*$/i, '');
    cleanContent = cleanContent.replace(/\[\s*HET\s+CHUONG[^\n\]]*\][\s\S]*$/i, '');
    cleanContent = cleanContent.replace(/Cảm\s+ơn\s+quý\s+độc\s+giả[\s\S]*$/i, '');
    cleanContent = cleanContent.replace(/Cam\s+on\s+quy\s+doc\s+gia[\s\S]*$/i, '');
    cleanContent = cleanContent.replace(/Đón\s+đọc\s+tiếp[\s\S]*$/i, '');
    cleanContent = cleanContent.replace(/[=\-]{5,}[\s\S]*$/, '');

    cleanContent = cleanContent.trim();

    // Điền tự động vào các ô input trên form
    const titleInput = document.getElementById('chapter-title-input');
    const numInput = document.getElementById('chapter-number-input');
    const contentInput = document.getElementById('chapter-content-input');

    if (titleInput) titleInput.value = title;
    if (numInput) numInput.value = chapterNum;
    if (contentInput) contentInput.value = cleanContent;
  };
  reader.readAsText(file, 'UTF-8');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

async function submitNewStory(e) {
  e.preventDefault();
  if (!isAdmin()) {
    openAuthModal('login');
    return;
  }

  const form = e.target;
  const formData = new FormData(form);
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;

  // Khóa nút ngay lập tức và hiển thị animation đang xử lý để chống bấm nhiều lần
  submitBtn.disabled = true;
  submitBtn.style.opacity = '0.7';
  submitBtn.style.cursor = 'not-allowed';
  submitBtn.innerHTML = `
    <span style="display: inline-flex; align-items: center; gap: 8px;">
      <svg class="spin-animation" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
      </svg>
      Đang Khởi Tạo Kho Lưu Trữ & Đồng Bộ...
    </span>
  `;

  // Tự động nén ảnh bìa xuống kích thước tiêu chuẩn sách (tối đa 800px) để gửi cực nhanh và không bao giờ vượt giới hạn Vercel
  const coverInput = form.querySelector('input[name="cover"]');
  if (coverInput && coverInput.files && coverInput.files[0]) {
    const file = coverInput.files[0];
    try {
      const compressedBlob = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 800;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.85);
        };
        img.onerror = () => resolve(file);
        img.src = URL.createObjectURL(file);
      });
      formData.set('cover', compressedBlob, 'cover.jpg');
    } catch (err) {
      console.warn('Lỗi nén ảnh:', err);
    }
  }

  try {
    const res = await fetch('/api/admin/stories', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${state.token}` },
      body: formData
    });
    
    if (!res.ok) {
      const errText = await res.text();
      let msg = 'Lỗi máy chủ (' + res.status + ')';
      try {
        const parsed = JSON.parse(errText);
        msg = parsed.message || msg;
      } catch (e) {
        if (res.status === 413) msg = 'File ảnh hoặc dữ liệu gửi lên quá lớn (vượt quá 4.5MB). Vui lòng chọn file nhẹ hơn!';
      }
      throw new Error(msg);
    }

    const json = await res.json();
    if (json.success) {
      closeModal('story-modal');
      alert(json.message || 'Tạo truyện mới thành công!');
      await loadStories();
      navigateTo('detail', { slug: json.slug });
    } else {
      alert('Lỗi: ' + json.message);
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
      submitBtn.innerHTML = originalText;
    }
  } catch (err) {
    alert(err.message);
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
    submitBtn.style.cursor = 'pointer';
    submitBtn.innerHTML = originalText;
  }
}

async function submitNewChapter(e, storyId) {
  e.preventDefault();
  if (!isAdmin()) {
    openAuthModal('login');
    return;
  }

  const form = e.target;
  const audioInput = form.querySelector('input[name="audio_file"]');
  
  // Kiểm tra giới hạn Payload của nền tảng Vercel Serverless (Tối đa 4.5MB)
  if (audioInput && audioInput.files && audioInput.files[0]) {
    const audioFile = audioInput.files[0];
    const sizeInMB = (audioFile.size / (1024 * 1024)).toFixed(1);
    if (audioFile.size > 4.2 * 1024 * 1024) {
      alert(`⚠️ File Audio "${audioFile.name}" có dung lượng ${sizeInMB}MB (vượt quá giới hạn tải trực tiếp 4.2MB của server).\n\n💡 Vui lòng dán link file audio trực tiếp vào ô "Hoặc Dán Link Audio Trực Tiếp" bên cạnh để phát mượt mà.`);
      return;
    }
  }

  const formData = new FormData(form);
  formData.append('story_id', storyId);

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerText;
  submitBtn.innerText = 'Đang tải lên & Lưu trữ...';
  submitBtn.disabled = true;

  try {
    const res = await fetch('/api/admin/chapters', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${state.token}`
      },
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text();
      let msg = 'Lỗi máy chủ (' + res.status + ')';
      try {
        const parsed = JSON.parse(errText);
        msg = parsed.message || msg;
      } catch (e) {
        if (res.status === 413) msg = 'File Audio quá lớn (vượt quá 4.5MB). Vui lòng dán link audio trực tiếp vào ô bên cạnh!';
      }
      throw new Error(msg);
    }

    const json = await res.json();
    if (json.success) {
      alert(json.message || 'Thêm chương mới thành công!');
      closeModal('chapter-modal');
      await loadStories();
      renderStoryDetail(state.currentStory.slug);
    } else {
      alert('Lỗi: ' + json.message);
    }
  } catch (err) {
    alert(err.message);
  } finally {
    submitBtn.innerText = originalText;
    submitBtn.disabled = false;
  }
}

function formatTimeAgo(dateString) {
  if (!dateString) return 'Vừa xong';
  const diff = Date.now() - new Date(dateString).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'Vừa xong';
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}
