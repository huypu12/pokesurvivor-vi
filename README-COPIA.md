# PokéSurvivor — bản sao riêng (không chính thức)

Đây là bản sao cá nhân của **PokéSurvivor** do JPTER78 làm, tạo từ mã nguồn công khai
(https://github.com/JPTER78/pokesurvivor, commit `6f0f440`). Không liên quan tới tác giả,
Nintendo, Creatures hay GAME FREAK. **Web chính thức duy nhất: https://pokesurvivor.com**

## Ghép các phần (bản này được chia thành 4 file zip)

Hình Pokémon rất nặng (~100 MB) nên bản sao được chia thành 4 file: `pokesurvivor-parte-1-de-4.zip` (mã game)
và `parte-2`, `parte-3`, `parte-4` (hình Pokémon). **Phải giải nén cả 4 vào cùng một chỗ** để ra một thư mục
`pokesurvivor-copia` duy nhất:

- **Windows (7-Zip):** bỏ cả 4 file vào một thư mục, chọn hết → chuột phải → 7-Zip → *Extract Here*.
- **macOS / Linux (Terminal):** `cd` tới thư mục chứa 4 file zip rồi chạy
  `for f in pokesurvivor-parte-*.zip; do unzip -oq "$f"; done`

Kiểm tra nhanh: thư mục `pokesurvivor-copia/assets/pokemon` phải có đúng **966** thư mục con. Nếu Pokémon bị
mất hình trong game nghĩa là chưa giải nén đủ 4 phần.

## Cách chạy

1. Sau khi ghép xong, vào thư mục `pokesurvivor-copia`.
2. Cách dễ nhất: bấm đúp `index.html`.
3. Cách tốt hơn: mở terminal trong thư mục và chạy `python -m http.server 8000`,
   rồi vào http://localhost:8000
4. Bấm vào màn hình một lần ("Pulsa para empezar") để game khởi động.

Game chơi ngang màn hình. Muốn chơi trên điện thoại trong cùng mạng Wi-Fi: chạy
`python -m http.server 8000` trên máy tính rồi mở `http://<địa chỉ IP của máy tính>:8000` bằng điện thoại.
(Bấm đúp `index.html` vẫn chạy được; trình duyệt chỉ báo cảnh báo nhỏ về việc preload font trong console.)

## Khác gì so với bản gốc

- **Chế độ cục bộ:** `js/core/firebase-config.js` để `null`, nên bản này không kết nối tới
  Firebase/server của tác giả. Không có tài khoản đám mây, bạn bè, bảng xếp hạng, co-op online.
- Tiến trình lưu trong trình duyệt (localStorage). Tạo tài khoản cục bộ ("Sign up") để giữ dữ liệu;
  "Play as guest" không lưu. Xoá dữ liệu trình duyệt là mất save.
- `js/app.min.js` được build lại bằng `tools/build.js --sin-seo` nhưng **không nén/làm rối mã**
  (môi trường tạo bản sao không tải được terser/obfuscator từ npm). Chức năng giống hệt.
- Đã bỏ: `CNAME`, `.firebaserc`, `.github/`, `CLAUDE.md`, `sitemap.xml`, các trang SEO
  (guia, pokedex, en...). `robots.txt` và thẻ `noindex` để bản sao không bị công cụ tìm kiếm lập chỉ mục.

## Giấy phép (bắt buộc giữ lại)

- Mã nguồn: **PolyForm Noncommercial 1.0.0** (`LICENSE`, `LICENSE-NONCOMMERCIAL.md`).
  Được dùng, nghiên cứu, sửa đổi và chia sẻ **không vì mục đích thương mại**: không bán, không thu tiền,
  không gắn quảng cáo. Khi chia sẻ bản sao phải kèm các file giấy phép và dòng
  `Required Notice: Copyright 2026 JPTER78 (https://github.com/JPTER78/pokesurvivor)`.
- Sprite: SpriteCollab, **CC BY-NC 4.0**, cần ghi công (xem `CREDITS.md`).
- Font Pixelify Sans: SIL OFL 1.1 (`assets/fonts/OFL.txt`). Dữ liệu Pokédex: PokeAPI.
- Pokémon và các tên liên quan là nhãn hiệu của Nintendo / Creatures Inc. / GAME FREAK.

Tác giả nói rõ chỉ có pokesurvivor.com là web chính thức và game không cho chạy trong iframe của
web khác. Vì vậy hãy dùng bản này cho cá nhân, đừng đăng công khai như thể là bản chính thức.
