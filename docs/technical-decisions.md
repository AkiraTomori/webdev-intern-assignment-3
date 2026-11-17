# G-Scores — Tổng hợp quyết định kỹ thuật

## Mục lục

1. [Nguyên tắc nền](#1-nguyên-tắc-nền)
2. [Stack và kiến trúc](#2-stack-và-kiến-trúc)
3. [Hành vi sản phẩm](#3-hành-vi-sản-phẩm)
4. [Dữ liệu: schema và migration](#4-dữ-liệu-schema-và-migration)
5. [OOP môn học](#5-oop-môn-học)
6. [Seeder](#6-seeder)
7. [API](#7-api)
8. [Frontend](#8-frontend)
9. [Đối chiếu số liệu với CSV](#9-đối-chiếu-số-liệu-với-csv)
10. [README nộp bài](#10-readme-nộp-bài)
11. [Responsive và Docker](#11-responsive-và-docker)
12. [Thư viện và phiên bản ghim](#12-thư-viện-và-phiên-bản-ghim)
13. [Quy trình và git](#13-quy-trình-và-git)

---

## 1. Nguyên tắc nền

| Nguyên tắc | Hệ quả |
|---|---|
| Ô trống không phải 0 | Lưu NULL; thống kê chỉ đếm dòng có điểm |
| CSV chỉ đọc; CSDL dựng lại được từ CSV | Migration + seeder trong repo; `sha256` của CSV không đổi sau khi seed |
| SBD là chuỗi 8 ký tự | Không ép sang số ở bất kỳ tầng nào (giữ số `0` đầu) |
| Môn học là đối tượng, định nghĩa ở một nơi | Mọi danh sách môn dựng từ `SubjectRegistry`, không viết cứng nhiều chỗ |
| Tính ở CSDL, số chính xác, khớp CSV | Truy vấn tổng hợp; dùng `NUMERIC`, không dùng số dấu phẩy động |

## 2. Stack và kiến trúc

| Quyết định | Lựa chọn | Lý do chính |
|---|---|---|
| Tổ chức repo | Monorepo, ứng dụng **monolithic**, **npm workspaces** | Quy mô nhỏ, một CSDL chỉ đọc; không cần microservice, hàng đợi hay cache phân tán |
| Backend | **Express + TypeScript**, phân tầng `router → controller → service → model`, không tổ chức theo tính năng | Đề ưu tiên TypeScript cho Node; cấu trúc đơn giản, dễ giải thích |
| CSDL | **PostgreSQL 17** | `NUMERIC` chính xác; `COUNT(*) FILTER` gọn cho 4 mức điểm |
| Mô hình dữ liệu | **Một bảng `candidates`, mỗi môn một cột nullable** | Đơn giản, khớp CSV, tra cứu một dòng. Phương án bảng `scores` chuẩn hoá theo môn đã được cân nhắc rồi bỏ |
| ORM | **Prisma** | Đề bắt buộc dùng ORM |
| Frontend | **Next.js + TypeScript** (React Hooks) | Đề yêu cầu Hooks khi dùng React |
| Biểu đồ | **Recharts** | Component React khai báo; vẽ SVG nên đổi màu sáng/tối bằng biến CSS; có sẵn nhãn và tooltip |
| Validate backend | **Zod** | Không tin dữ liệu từ client |
| Nạp 1 triệu dòng | **SQL thô có tham số qua Prisma (`$executeRaw`)**, insert theo lô | Hiệu năng; vẫn đi qua kết nối Prisma |
| Chỉ mục | `sbd` là khoá chính; **không thêm chỉ mục** cho top 10 | Đo thực tế đã đủ nhanh |
| Cache | **Không cache, kể cả Redis** | Đo thực tế đã đủ nhanh |

**Bố cục thư mục:**
- Lớp miền môn học ở `backend/domain/`, tách khỏi `backend/model/`; `domain/` không phụ thuộc Zod, Prisma hay Express.
- `database/` là thư mục tài nguyên (không phải package): `schema.prisma`, migration, seeder, script đối chiếu. Không dùng vị trí mặc định `backend/prisma/`.
- Truy cập CSDL chỉ qua Prisma ở `backend/model/`; SQL thô chỉ được nằm ở `model/`, mỗi chỗ có ghi lý do.
- `backend/model/client.ts` là nơi duy nhất dựng `PrismaClient`.
- Backend dùng ESM (`"type": "module"`) vì Prisma 7 yêu cầu.

## 3. Hành vi sản phẩm

| Vấn đề | Quyết định |
|---|---|
| Top 10 khối A khi bằng tổng điểm | Trả **đúng `limit` dòng**; hoà thì xếp theo **SBD tăng dần**; không thêm người đồng hạng. Cùng yêu cầu luôn ra cùng kết quả |
| Validate SBD | **Đúng 8 chữ số** (`^\d{8}$`); lỗi định dạng **khác** thông báo "không tìm thấy"; kiểm ở cả frontend và backend |
| Mã ngoại ngữ (`ma_ngoai_ngu`) | Hiển thị **mã** `N1`…`N7`, **không** tự suy ra tên ngôn ngữ |
| Số môn trong báo cáo | **9 môn**; `ngoai_ngu` gộp mọi mã ngoại ngữ |
| Chạy seed lần hai | **Bỏ qua** nếu bảng đã đủ dữ liệu; chỉ cờ `--fresh` mới xoá và nạp lại |
| Thứ tự phần Nice to have | **Responsive → Docker → Deploy**, chỉ làm sau khi phần bắt buộc xong và đã kiểm |
| Đa ngôn ngữ (bổ sung ngoài đề) | Giao diện **Việt/Anh**. Điểm luôn dùng **dấu chấm thập phân** ở cả hai ngôn ngữ (`8.4`) |
| Giao diện sáng/tối (bổ sung ngoài đề) | Chế độ **sáng / tối / theo hệ thống**, không nháy màu khi tải trang |

## 4. Dữ liệu: schema và migration

| Vấn đề | Quyết định |
|---|---|
| Kiểu `sbd` | `CHAR(8)` khoá chính + CHECK `^[0-9]{8}$` |
| Kiểu điểm | `NUMERIC(4,2)`, NULL được, **không DEFAULT** (ô trống không thể thành 0), CHECK `0–10` mỗi cột |
| `ma_ngoai_ngu` | `VARCHAR(2)`; CHECK "có mã khi và chỉ khi có điểm ngoại ngữ"; không liệt kê `N1…N7` trong CHECK |
| Đặt tên | **Một tên cho mỗi môn**: tên cột CSV = cột CSDL = trường Prisma = khoá JSON, viết `snake_case`; không dùng `camelCase` + `@map` |
| An toàn SQL thô | Tên cột chỉ lấy từ whitelist `SubjectRegistry`; giá trị luôn tham số hoá |
| Migration | `prisma migrate dev --create-only` rồi sửa tay SQL để thêm CHECK (Prisma không biểu diễn được CHECK) |
| Phân vai kiểm tra | Lớp miền từ chối và báo lý do từng dòng; CSDL là chốt chặn cuối. Lý do: `NUMERIC(4,2)` làm tròn âm thầm `8.255 → 8.26` |
| Prisma 7 | Dùng driver adapter `@prisma/adapter-pg` + `pg`; ghim **7.10.1** (không dùng `latest` vì đang trỏ tới bản `8.0.0-rc`) |
| Biến môi trường | `.env` ở gốc repo; đọc bằng `process.loadEnvFile`, **không** thêm `dotenv`. `prisma.config.ts` dùng `process.env.DATABASE_URL ?? ""` để `prisma generate` chạy được khi thiếu URL |
| PostgreSQL local | Docker `postgres:17-alpine`, cổng `127.0.0.1:5433`, hai CSDL `g_scores` và `g_scores_test`; compose ở `infrastructure/docker-compose.yaml` |
| Dọn CSDL test | `DROP SCHEMA public CASCADE` bằng `pg` rồi `migrate deploy`, không dùng `migrate reset --force` |

## 5. OOP môn học

| Vấn đề | Quyết định |
|---|---|
| Hình dạng lớp | Lớp cơ sở `Subject` + duy nhất một lớp con `ForeignLanguageSubject` (môn có hành vi thật sự khác). Không tạo 9 lớp con rỗng |
| Thành phần | `Subject`, `ForeignLanguageSubject`, `SubjectRegistry` (theo thứ tự cột CSV, chặn mã trùng/sai), `SubjectGroup` (`GROUP_A` = toán, vật lí, hoá học), `ScoreLevel` (4 mức nửa mở, ngưỡng ở một nơi), `Score` |
| Kiểu điểm trong miền | `Score` là số nguyên phần trăm (8,4 → 840), cộng chính xác mà không cần thư viện |
| Điểm nghiêm ngặt | Hơn 2 chữ số thập phân (kể cả `8.250`) bị từ chối |
| Luật SBD | Đặt ở schema Zod `backend/schema/sbd.ts` (seeder và API dùng chung), không ở `domain/` |
| Test | Vitest tách hai project: `unit` (không cần PostgreSQL) và `db`. Có test đối chiếu cột bảng `candidates` với danh sách môn |

## 6. Seeder

| Vấn đề | Quyết định |
|---|---|
| Chạy TypeScript | `tsx` (dùng chung cho server dev và server trong Docker) |
| Đọc CSV | **Không dùng thư viện**: `node:readline` + `split(",")`; từ chối dòng có dấu `"` hoặc khác 11 trường |
| Dòng lỗi | **Hai lượt**: lượt 1 đọc và kiểm toàn file, có lỗi thì báo cáo và dừng **trước khi ghi**; lượt 2 mới nạp. Không bao giờ để bảng dở dang |
| Cỡ lô | **1.000 dòng**. Lô 5.000 hết bộ nhớ vì `@prisma/debug` giữ đối số của 100 lần gọi gần nhất; lô 1.000 có trần khoảng 110 MB rồi phẳng |
| Thời gian nạp | Không đặt ngưỡng. Số đo tham khảo: 19–21 s trên CSDL test, 35 s lần đầu vào CSDL chính |
| `COPY` | Chưa dùng (cần thêm thư viện) |

## 7. API

**Endpoint:** `GET /api/candidates/:sbd`, `GET /api/reports/score-levels`, `GET /api/reports/top-group-a?limit=`, `GET /api/health`.

| Vấn đề | Quyết định |
|---|---|
| Express | **5.3.0** (tự xử lý handler `async` bị reject) |
| Test HTTP | `listen(0)` + `fetch` có sẵn của Node; không dùng `supertest` |
| SBD rỗng | `/api/candidates` và `/api/candidates/` trả `400 INVALID_SBD` |
| Đường dẫn không tồn tại | `404 NOT_FOUND`, vẫn trả JSON |
| Mã lỗi | `INVALID_SBD`, `CANDIDATE_NOT_FOUND`, `INVALID_PARAMETER`, `NOT_FOUND`, `INTERNAL_ERROR`; một dạng phản hồi lỗi thống nhất, không lộ chi tiết nội bộ |
| `/api/health` | `SELECT 1` qua `$queryRaw`, trả 200 hoặc 503 |
| CORS | Không dùng `cors`: frontend gọi qua `rewrites` của Next.js, cùng origin |
| `limit` của top khối A | Mặc định 10, khoảng **1–20**; sai thì `400 INVALID_PARAMETER` |
| Báo cáo 4 mức | **Một câu SQL thô, một lần quét bảng** (`COUNT(*) FILTER`) thay vì 36 lần `count` qua ORM; ngưỡng lấy từ `ScoreLevel` |
| Hiệu năng | Mục tiêu: báo cáo ≤ 1 s, top khối A ≤ 500 ms. Đo thực tế: **0,51 s** và **0,07 s**, nên không cần chỉ mục hay cache |

## 8. Frontend

| Vấn đề | Quyết định |
|---|---|
| Thứ tự làm | Dựng khung chung (i18n, theme, điều hướng) **trước** các màn hình |
| Ngôn ngữ | `next-intl`, không đưa ngôn ngữ vào URL: lưu ở cookie `NEXT_LOCALE`, đổi xong vẽ lại tại chỗ. Lần đầu luôn là **tiếng Việt**, không đọc `Accept-Language` |
| Theme | `next-themes`, `attribute="data-theme"` |
| Trang | `/` là **trang chủ thật** (không chuyển hướng), cùng `/lookup`, `/reports`, `/top-group-a`. Menu **4 mục**, Trang chủ đứng đầu |
| Validate form | **JustValidate** bọc trong hook React; không dùng lại schema Zod của backend, nên có test đối chiếu luật với backend |
| Kiểm phản hồi API | **Hàm kiểm kiểu tự viết** (type guard), không dùng thư viện |
| Gọi API | Trình duyệt gọi `/api/*` cùng origin; `rewrites` chuyển sang backend; `BACKEND_URL` chỉ đọc ở một chỗ (`next.config.ts`) |
| Test E2E | Không dùng Playwright; kiểm tay có ghi lại bằng chứng |
| Biểu đồ | Cột nhóm 9 môn × 4 mức; luôn có **bảng số dưới biểu đồ** |
| Định dạng số đếm | **Theo ngôn ngữ**: tiếng Việt `1.045.613`, tiếng Anh `1,045,613` |
| SBD có dấu cách thừa | **Frontend tự trim** trước khi kiểm và gửi; backend vẫn không trim |

## 9. Đối chiếu số liệu với CSV

| Vấn đề | Quyết định |
|---|---|
| Ngôn ngữ script | **Python 3, chỉ thư viện chuẩn** (`csv`, `decimal`…), chạy bằng `python3 -I`, không `pip install`. Cố ý khác ngôn ngữ và bộ đọc CSV của ứng dụng để phép đối chiếu thật sự độc lập. Chỉ là công cụ kiểm, không thuộc stack ứng dụng |
| Vị trí | `database/verify/cross_check.py`, nằm trong repo |
| Phạm vi | Báo cáo 9 môn × 4 mức, top 10 và top 20, 164 SBD mẫu và một SBD không tồn tại |
| Tự kiểm script | Fixture 10 dòng chứa các ca ranh giới (`--self-test`) |
| Kết quả | **Khớp hoàn toàn**: 9/9 môn, top 10/10, top 20/20, 164/164 SBD |

## 10. README nộp bài

| Vấn đề | Quyết định |
|---|---|
| Vị trí | Phần hướng dẫn đặt ở **đầu** README; đề bài giữ nguyên bên dưới |
| Ngôn ngữ | Tiếng Việt |
| Ảnh | Có ảnh chụp màn hình, gồm một ảnh trên điện thoại |
| Cài đặt | `npm install` (không dùng `npm ci`) |
| Kiểm trên máy sạch | Clone từ GitHub, chạy trong project Docker tạm (cổng 5434), xong thì xoá project tạm |

## 11. Responsive và Docker

| Vấn đề | Quyết định |
|---|---|
| Biểu đồ màn hẹp | Đổi sang **cột ngang** khi khung < 560px; trục số rút gọn (`1 Tr` / `1M`), tooltip và bảng vẫn có số đầy đủ |
| Bảng ở 360px | Thu padding, giữ cuộn ngang trong khung |
| Menu trên điện thoại | Giữ hàng link xuống dòng, không dùng hamburger |
| Bật ứng dụng bằng Docker | Profile `app` trong file compose sẵn có + hai script `docker-up.sh`, `docker-down.sh` ở gốc repo |
| Base image | `node:26.6.0-bookworm-slim` cho cả ba image (`api`, `web`, `tools`); không dùng Alpine để tránh lỗi Prisma và giữ đồng nhất |
| README | Mục Docker đặt **trước** mục chạy local |
| Image gọn | Mỗi bên **một Dockerfile riêng, build multi-stage** (image cũ khoảng 2 GB) |
| Next.js | Bật `output: "standalone"` với `outputFileTracingRoot` là gốc repo |
| `tsx` | Chuyển sang `dependencies` của backend để image `api` cài `--omit=dev` vẫn chạy |
| Stage build web | `npm ci` đủ cả hai workspace và copy `backend/`, không thêm cấu hình TypeScript riêng |
| Kích thước sau khi tối ưu | `api` ≈ 395 MB, `web` ≈ 326 MB, `tools` ≈ 860 MB (`tools` chỉ chạy một lần để migrate và seed nên chấp nhận lớn hơn) |

## 12. Thư viện và phiên bản ghim

Mọi phiên bản đều **ghim chính xác**; tránh bản `latest` tiền phát hành và bản mới ra được vài ngày.

| Nhóm | Dùng | Không dùng |
|---|---|---|
| Backend | `express` 5.3.0, `@types/express` 5.0.6, `zod`, `tsx` 4.23.15 | `supertest`, `cors`, `dotenv`, thư viện đọc CSV |
| CSDL | `prisma` / `@prisma/client` / `@prisma/adapter-pg` 7.10.1, `pg` / `@types/pg` 8.23.1 | `pg-copy-streams` |
| Frontend | `next` 16.4.5, `react` / `react-dom` 19.3.1, `next-intl` 4.14.9, `next-themes` 0.4.6, `just-validate` 4.3.0, `recharts` 3.10.1, `react-is` 19.3.1 | Zod ở frontend, Playwright, Testing Library |
| Công cụ | TypeScript 5.9.3, Vitest 5.1.0, ESLint 10.14.0 + `eslint-config-next` 16.4.5, `@types/node` 26.6.6 | `esbuild` |
| Kiểm số liệu | Python 3 thư viện chuẩn | Python cho mã ứng dụng |

## 13. Quy trình và git

- Mỗi phần việc đi theo: đặc tả → thiết kế → viết mã → kiểm tra.
- Nhánh `feat/…`, `fix/…`, `docs/…`; commit `type(scope): description` bằng tiếng Anh; mỗi phần việc một PR (một vài phần liên quan chặt được gộp chung).
- Mã, comment, commit viết tiếng Anh; tài liệu viết tiếng Việt.
- Secret chỉ nằm ở `.env` (đã gitignore), không xuất hiện trong mã, log hay commit.
- Mỗi tiêu chí chấp nhận có test hoặc bước kiểm tay có bằng chứng.
