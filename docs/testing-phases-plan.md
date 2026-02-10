# RSEC6 OfficeHub — Testing Phases Plan

> แผนทดสอบระบบก่อน Production แบ่งเป็น 4 Phases

---

## Phase 1: Unit Testing (สัปดาห์ที่ 1)

> เป้าหมาย: ทดสอบ pure functions / business logic ที่ไม่พึ่ง external services
> เครื่องมือ: **Vitest**

### Tasks

- [ ] **1.1** ติดตั้ง Vitest + config (`vitest.config.ts`)
- [ ] **1.2** ทดสอบ Phone Validation & Normalization
  - `+66925717574` ↔ `0925717574` แปลงถูกต้อง
  - เบอร์ผิดรูปแบบ (สั้น/ยาวเกิน, มีตัวอักษร) → reject
  - Edge cases: `036776259` (เบอร์พื้นฐาน), เบอร์ที่ขึ้นต้น `+66` แล้วไม่มี `0`
- [ ] **1.3** ทดสอบ Session Logic
  - `getSessionTimeRemaining()` คำนวณเวลาถูกต้อง
  - Session หมดอายุ → return null
  - `isExpiring` flag เมื่อเหลือ < 30 นาที
- [ ] **1.4** ทดสอบ Permission Utils
  - Admin ได้สิทธิ์ครบ
  - User ทั่วไปเห็นเฉพาะที่ควรเห็น
  - Profile เป็น null → return default permissions
- [ ] **1.5** ทดสอบ Telegram Message Formatting
  - `formatMessage()` สร้างข้อความถูกต้องสำหรับทุก notification type
  - `document_pending`, `document_approved`, `document_rejected`, `task_assigned`, `task_completed`
  - HTML tags ถูกต้อง (`<b>`, `\n`)
- [ ] **1.6** ทดสอบ OTP Generation Logic
  - OTP เป็น 6 หลักเสมอ
  - หมดอายุ 5 นาที (expires_at คำนวณถูก)

### Definition of Done
- [ ] ทุก test ผ่าน (`vitest run`)
- [ ] Coverage > 80% สำหรับไฟล์ที่ทดสอบ

---

## Phase 2: API / Integration Testing (สัปดาห์ที่ 2)

> เป้าหมาย: ทดสอบ service layer + Supabase Edge Functions ด้วย mock/test DB
> เครื่องมือ: **Vitest + Supabase Test Client** (หรือ mock)

### Tasks

- [ ] **2.1** สร้าง test utilities (mock Supabase client, test fixtures)
- [ ] **2.2** ทดสอบ Auth Flow (send-otp → verify-otp)
  - ส่ง OTP สำเร็จ → บันทึกลง `otp_codes` table
  - Verify OTP ถูกต้อง → return session + profile
  - Verify OTP ผิด → return error
  - OTP หมดอายุ → return "หมดอายุ" error
  - OTP ใช้แล้ว → return "ใช้แล้ว" error
  - Rate limit: > 3 ครั้งใน 5 นาที → return 429
- [ ] **2.3** ทดสอบ Profile Service
  - `createProfileWithAuth()` → สร้าง auth user + profile สำเร็จ
  - Profile creation fail → rollback auth user
  - `clearPhoneFromAuthUsers()` ทำงานถูกต้อง
  - `getNextEmployeeId()` ไม่ซ้ำกัน
- [ ] **2.4** ทดสอบ Document Workflow Service
  - สร้าง memo → status = draft
  - ส่งเอกสาร → status = pending, current_signer ถูกต้อง
  - อนุมัติ → current_signer เลื่อนไปคนถัดไป
  - อนุมัติครบ → status = completed
  - ปฏิเสธ → status = rejected, reject_reason ถูกบันทึก
- [ ] **2.5** ทดสอบ Task Assignment Service
  - มอบหมายงาน → สร้าง task record + แจ้งเตือน
  - รายงานผลงาน → อัปเดต task status
- [ ] **2.6** ทดสอบ Notification Edge Function
  - แต่ละ notification type ส่ง payload ถูกต้อง
  - Chat ID ไม่มี → handle gracefully (ไม่ crash)
  - Telegram API error → return error ไม่ crash function
- [ ] **2.7** ทดสอบ Admin OTP (เบอร์ 036776259)
  - ส่ง unique OTP ให้ทุก active recipient
  - Admin login log ถูกบันทึก
- [ ] **2.8** ทดสอบ Single-Device Session
  - Login ที่เครื่อง A → Login ที่เครื่อง B → เครื่อง A ถูก force logout

### Definition of Done
- [ ] ทุก service function มี test ครอบคลุม happy path + error path
- [ ] Edge Functions ทดสอบผ่าน mock request/response

---

## Phase 3: E2E Testing (สัปดาห์ที่ 3)

> เป้าหมาย: ทดสอบ user flow จริงผ่าน browser
> เครื่องมือ: **Playwright**

### Tasks

- [ ] **3.1** ติดตั้ง Playwright + config
- [ ] **3.2** สร้าง test environment (test DB / seed data / mock OTP)
- [ ] **3.3** ทดสอบ Authentication Flow
  - เข้าหน้า `/auth` → กรอกเบอร์ → ส่ง OTP → กรอก OTP → redirect ไป `/dashboard`
  - เข้า protected route โดยไม่ login → redirect ไป `/auth`
  - Logout → redirect ไป `/auth` + ไม่สามารถกด back กลับได้
- [ ] **3.4** ทดสอบ Document Creation Flow
  - สร้างบันทึกข้อความ → กรอกข้อมูล → เลือกผู้อนุมัติ → submit → เห็นในรายการ
  - สร้างหนังสือรับ → กรอกข้อมูล → submit
- [ ] **3.5** ทดสอบ Document Approval Flow
  - Login เป็นผู้อนุมัติ → เห็นเอกสารรอพิจารณา → อนุมัติ → status เปลี่ยน
  - ปฏิเสธเอกสาร → กรอกเหตุผล → ผู้สร้างเห็น status rejected
- [ ] **3.6** ทดสอบ PDF Operations
  - ดู PDF preview → แสดงผลถูกต้อง
  - Download PDF → ไฟล์สมบูรณ์
  - PDF ลายเซ็น → แสดงลายเซ็นถูกตำแหน่ง
- [ ] **3.7** ทดสอบ Task Assignment
  - มอบหมายงาน → ผู้รับเห็นในหน้า assigned tasks
  - รายงานผลงาน → ผู้มอบหมายเห็นรายงาน
- [ ] **3.8** ทดสอบ Admin Pages
  - จัดการ profile (เพิ่ม/แก้ไข)
  - จัดการ OTP recipients
- [ ] **3.9** ทดสอบ Responsive Design
  - ทุก critical page บน viewport: mobile (375px), tablet (768px), desktop (1280px)
  - FloatingNavbar + TopBar แสดงผลถูกต้อง
- [ ] **3.10** ทดสอบ Error Handling
  - Network error → แสดง error message ภาษาไทย
  - 404 page → แสดงหน้า Not Found
  - Session หมดอายุขณะใช้งาน → redirect ไป login

### Definition of Done
- [ ] Critical user paths ทั้งหมดมี E2E test
- [ ] ทดสอบผ่านทั้ง Chromium, Firefox, WebKit
- [ ] Screenshot comparison สำหรับ responsive tests

---

## Phase 4: Performance, Security & CI/CD (สัปดาห์ที่ 4)

> เป้าหมาย: ทดสอบ non-functional requirements + ตั้งค่า automation pipeline
> เครื่องมือ: **Lighthouse CI, GitHub Actions**

### Tasks

#### Performance
- [ ] **4.1** Lighthouse CI
  - LCP < 3 วินาที
  - Performance score > 70
  - Accessibility score > 80
  - Bundle size analysis (ไม่เกิน 500KB gzipped)
- [ ] **4.2** Load Testing (Optional)
  - Concurrent OTP requests (50 users พร้อมกัน)
  - Concurrent document approval (ป้องกัน race condition)

#### Security
- [ ] **4.3** ทดสอบ RLS (Row Level Security)
  - User A ไม่เห็นเอกสารของ User B (ถ้า policy กำหนดไว้)
  - Admin เห็นทุกอย่าง
- [ ] **4.4** ทดสอบ Input Validation
  - SQL injection → ถูกป้องกัน (Supabase parameterized queries)
  - XSS → ถูกป้องกัน (React auto-escape)
  - Telegram message injection (HTML tags ใน input) → sanitized
- [ ] **4.5** ทดสอบ API Security
  - Edge Functions ต้องมี Authorization header
  - Invalid API key → reject
  - CORS: เฉพาะ origin ที่อนุญาต (ตอนนี้เป็น `*` ควรจำกัด)

#### CI/CD Pipeline
- [ ] **4.6** ตั้งค่า GitHub Actions
  - `vite build` ต้องสำเร็จ (ไม่มี TypeScript / ESLint errors)
  - Run Unit Tests (Phase 1)
  - Run Integration Tests (Phase 2)
  - Run E2E Tests (Phase 3) — optional: เฉพาะ PR ไป main
  - Lighthouse CI check
- [ ] **4.7** ตั้งค่า Pre-deploy Checklist
  - Environment variables ครบ (SUPABASE_URL, ANON_KEY, TELEGRAM_BOT_TOKEN ฯลฯ)
  - Database migrations up to date
  - Edge functions deployed

### Definition of Done
- [ ] CI/CD pipeline ทำงานครบทุก step
- [ ] Security tests ผ่านทั้งหมด
- [ ] Performance baseline ถูกบันทึก

---

## สรุป Timeline

```
สัปดาห์ที่ 1  ──▶  Phase 1: Unit Tests (Vitest)
สัปดาห์ที่ 2  ──▶  Phase 2: API/Integration Tests
สัปดาห์ที่ 3  ──▶  Phase 3: E2E Tests (Playwright)
สัปดาห์ที่ 4  ──▶  Phase 4: Performance + Security + CI/CD
```

## สิ่งที่ Automate ได้ vs ต้อง Manual

| Automate ได้ | ต้อง Manual Test |
|---|---|
| Phone validation/normalization | PWA install experience (แต่ละ device) |
| OTP flow (send/verify/expire/rate-limit) | Telegram Bot UX (ข้อความอ่านง่าย?) |
| Document workflow (create → approve → reject) | PDF visual quality (ตัวอักษรไทยชัด?) |
| Session management | Realtime reconnection (สัญญาณหลุด) |
| Permission checks | Cross-browser quirks บน Safari iOS |
| API security (auth header, CORS) | User onboarding flow (first-time user) |
| Build + lint + type check | Performance บน low-end Android devices |
| Responsive layout (viewport sizes) | |
| Notification payloads | |
