# Hướng Dẫn Vận Hành & Khởi Chạy Website Lương Gia Novel

Hệ thống website đọc truyện **Lương Gia Novel** đã được xây dựng và **triển khai trực tiếp (Live Production) trên Vercel**:

🌐 **Trang chủ chính thức (Live Vercel)**: **[https://luong-gia-novel.vercel.app](https://luong-gia-novel.vercel.app)**  
🔗 **Kho mã nguồn GitHub**: **[https://github.com/LuongLeTanTuan/LuongGiaNovel](https://github.com/LuongLeTanTuan/LuongGiaNovel)**

---

## 1. Cơ sở dữ liệu Supabase Cloud (Lưu trữ trực tiếp & Siêu tốc)

Hệ thống đã loại bỏ hoàn toàn các logic liên quan tới Google Drive và chuyển sang lưu trữ dữ liệu tập trung trực tiếp trên **Supabase Cloud (PostgreSQL)**:

### Các bước thiết lập Supabase:
1. Tạo một dự án mới trên [Supabase](https://supabase.com).
2. Vào mục **SQL Editor** trong Supabase Dashboard, copy toàn bộ nội dung file `supabase_schema.sql` và nhấn **RUN** để tạo các bảng (`stories`, `chapters`, `categories`, `users`, `story_categories`), thiết lập phân quyền RLS và cấu hình Storage Buckets (`covers`, `audios`).
3. Tạo file `.env` tại thư mục gốc dự án (hoặc cấu hình Environment Variables trên Vercel) với các biến:
   ```env
   SUPABASE_URL=https://<your-project-id>.supabase.co
   SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   JWT_SECRET=luong_gia_novel_super_secret_key_2026
   PORT=3000
   ```
4. Khi khởi chạy, hệ thống sẽ tự động kết nối Supabase và đồng bộ sẵn dữ liệu truyện mẫu nếu database trên Supabase đang trống.

---

## 2. Khởi chạy cục bộ (Local Development)

Mở PowerShell tại thư mục dự án `d:\làm việc\LuongGiaNovel` và gõ:

```bash
npm start
```

Sau đó truy cập trình duyệt tại địa chỉ: **`http://localhost:3000`**

---

## 3. Tài khoản quản trị & Đăng truyện (Admin)

Để đăng truyện mới hoặc thêm chương vào tác phẩm, hệ thống yêu cầu xác thực quyền Quản trị viên:

- **Tài khoản (Username)**: `admin`
- **Mật khẩu (Password)**: `Tuan@2005`

> **Cơ chế bảo mật Backend**: Mọi API đăng tải (`POST /api/admin/stories`, `POST /api/admin/chapters`, `DELETE /api/admin/stories/:id`) đều được bảo vệ bởi middleware `requireAdmin` với token JWT bảo mật cao, chặn hoàn toàn truy cập trái phép từ bên ngoài.

---

## 4. Các tính năng nổi bật đã tích hợp

1. **Bộ Nhận Diện & Logo**:
   - Sử dụng ảnh chuẩn cao cấp quý ông lịch lãm đồng bộ làm banner và bìa truyện.
   - Logo Vector SVG vàng kim (Gold Foil) sang trọng với **Vương miện**, họa tiết sóng âm cách điệu và chữ **LƯƠNG GIA NOVEL**.
   - Tone màu chủ đạo: Đen tuyền hoàng gia (`#0b0c10`), Than chì lịch lãm (`#13151b`), Vàng gold lá (`#d8aa68`), Nâu cognac quý tộc.
   
2. **Typography chuẩn Truyện Edit**:
   - Tích hợp chuẩn **`Nunito`** (font chữ mặc định chuẩn của nền tảng truyenedit.com) giúp trải nghiệm đọc nhẹ nhàng, chống mỏi mắt.
   - Bổ sung tùy chọn phông chữ Serif hoài cổ **`Lora`** cho độc giả thích phong cách sách in truyền thống.

3. **Giao Diện Đọc Truyện (Reader)**:
   - Tăng/giảm kích thước chữ tức thì (`A-` / `A+`).
   - Đổi nền đọc linh hoạt 3 chế độ: **Ban đêm (Dark Mode)**, **Màu giấy cổ / Vàng dịu mắt (Sepia Mode)**, **Ban ngày (Light Mode)**.
   - Điều hướng chương trước / chương sau và danh sách nhảy chương nhanh.

4. **Hệ thống Backend & Quản trị**:
   - Nút **`+ Đăng Truyện`**: Thêm tác phẩm mới, phân loại thể loại, ảnh bìa, audio giới thiệu trực tiếp vào Supabase.
   - Nút **`+ Thêm Chương Mới`**: Đăng tải từng chương trực tiếp vào Supabase ngay trên trang chi tiết truyện.
   - Hỗ trợ cơ chế dự phòng SQLite offline và snapshot JSON tự động.
