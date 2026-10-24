require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

// Nhập ứng dụng Express đã được tối ưu hóa toàn diện từ api/index.js
const app = require('./api/index');
const PORT = process.env.PORT || 3000;

// Khởi tạo thư mục uploads nếu chưa tồn tại
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Phục vụ các tài nguyên tĩnh
app.use(express.static(path.join(__dirname, 'public')));

// Fallback Single Page Application (SPA) cho các view routes như /truyen/:slug
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  LƯƠNG GIA NOVEL - CƠ CẤU DỮ LIỆU SIÊU MƯỢT 2026`);
  console.log(`  Server đang hoạt động tại: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
