# Unit Test Plan - RSEC6Hub

## สถานะปัจจุบัน
- ยังไม่มี test framework หรือ test ใดๆ ในโปรเจกต์
- ใช้ Vite 5.4 + React 18 + TypeScript

## เป้าหมาย
เมื่อฟีเจอร์ใหม่ใช้โค้ดร่วม (utils, types, services) → test จะบอกทันทีว่าแก้แล้วพังตรงไหน

---

## Phase 1: Setup Test Framework

### เลือก Vitest (เหตุผล)
- ใช้ Vite config เดียวกับโปรเจกต์ (resolve alias `@/` ใช้ได้เลย)
- เร็วกว่า Jest มาก (native ESM, no transform)
- API เหมือน Jest เกือบ 100% (describe, it, expect)
- รองรับ TypeScript out of the box

### ติดตั้ง
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

| Package | ใช้ทำอะไร |
|---------|----------|
| `vitest` | Test runner + assertion |
| `@testing-library/react` | Render + interact กับ React components |
| `@testing-library/jest-dom` | DOM matchers (`toBeInTheDocument`, etc.) |
| `jsdom` | จำลอง browser DOM สำหรับ component tests |

### Config
**`vitest.config.ts`** (แยกจาก vite.config.ts)
```ts
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(viteConfig, defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/utils/**', 'src/types/**', 'src/services/**'],
    },
  },
}));
```

**`src/test/setup.ts`**
```ts
import '@testing-library/jest-dom/vitest';
```

**`package.json`** เพิ่ม scripts:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## Phase 2: Pure Function Tests (ลำดับแรก - คุ้มค่าที่สุด)

โค้ดที่ถูกใช้ร่วมกันหลายที่ + เป็น pure function ไม่ต้อง mock → เขียน test ง่าย คุ้มค่าสูงสุด

### 2.1 `src/types/database.ts` → `src/types/database.test.ts`
**ฟังก์ชันที่ test:**
- `isAdmin(profile)` → ต้อง true เมื่อ `is_admin=true` หรือ `position='director'`
- `isExecutive(position)` → director, deputy, assistant = true
- `isClerk(position)` → clerk_teacher = true
- `isTeacher(position)` → government_teacher, contract_teacher = true
- `getPositionDisplayName(position)` → return ชื่อไทยถูกต้อง

**ทำไมสำคัญ:** ทุกหน้าใช้ role checking นี้ ถ้าแก้แล้วผิด → permission ทั้งระบบพัง

### 2.2 `src/utils/permissionUtils.ts` → `src/utils/permissionUtils.test.ts`
**ฟังก์ชันที่ test:**
- `getPermissions(null)` → ทุก field เป็น false
- `getPermissions(adminProfile)` → ทุก field เป็น true
- `getPermissions(teacherProfile)` → isTeacher=true, isAdmin=false
- `getPermissions(clerkProfile)` → isClerk=true, isManagement=false

**ทำไมสำคัญ:** กำหนดว่าใครเห็นอะไร ใครทำอะไรได้ ผิดตรงนี้ = ข้อมูลรั่ว

### 2.3 `src/utils/dateUtils.ts` → `src/utils/dateUtils.test.ts`
**ฟังก์ชันที่ test:**
- `convertToThaiNumerals(123)` → `'๑๒๓'`
- `formatThaiDateFull('2025-02-02')` → `'๒ กุมภาพันธ์ ๒๕๖๘'`
- `formatThaiDateShort('2025-02-02')` → `'2/2/68'`
- `formatThaiDateISO('2025-02-02')` → `'๒๕๖๘-๐๒-๐๒'`
- `formatRelativeTime(...)` → เมื่อสักครู่ / X นาทีที่แล้ว / เมื่อวาน
- Edge cases: null, undefined, invalid date string → return ''

**ทำไมสำคัญ:** ใช้ทั่วทั้งแอป (เอกสาร, newsfeed, notifications) ผิด = วันที่แสดงผิดในเอกสารราชการ

### 2.4 `src/utils/memoUtils.ts` → `src/utils/memoUtils.test.ts`
**ฟังก์ชันที่ test:**
- `getMemoSourceType({ form_data: { type: 'pdf_upload' } })` → `'pdf_upload'`
- `getMemoSourceType({ form_data: {} })` → `'create_memo'`
- `getMemoSourceType(null)` → `'create_memo'`
- `getDocumentManageRoute(memo, 'abc')` → route ถูกต้องตาม source type
- `getDocumentEditRoute(rejectedDocReceive, 'abc')` → `/create-doc-receive?edit=abc`

**ทำไมสำคัญ:** routing ผิด → user กดเข้าเอกสารแล้วเจอหน้าผิด/ว่างเปล่า

### 2.5 `src/utils/validatePdfA4.ts` → `src/utils/validatePdfA4.test.ts`
**ฟังก์ชันที่ test (pure functions เท่านั้น ไม่ต้อง mock pdfjs):**
- `detectPaperType(612, 792)` → `'Letter (US)'` (ต้อง export ก่อน)
- `ptToMm(72)` → `25.4`
- `formatA4ValidationError(validResult)` → `''`
- `formatA4ValidationError(invalidResult)` → ข้อความ error ถูกต้อง

### 2.6 `src/utils/approvalUtils.tsx` → `src/utils/approvalUtils.test.tsx`
**ฟังก์ชันที่ test:**
- `getStatusText('approved')` → `'อนุมัติแล้ว'`
- `getStatusText('rejected')` → `'ปฏิเสธแล้ว'`
- `getStatusText('pending')` → `'รอดำเนินการ'`
- `getStatusText('unknown')` → `'รอดำเนินการ'` (default)

### 2.7 `src/utils/requestQueue.ts` → `src/utils/requestQueue.test.ts`
**ฟังก์ชันที่ test:**
- enqueue 1 request → resolves ถูกต้อง
- enqueue เกิน maxConcurrent → request ถัดไปต้องรอ
- request fail → reject ถูกต้อง ไม่กระทบ queue อื่น
- getSnapshot() → return status ถูกต้อง

**ทำไมสำคัญ:** throttle ผิด → Supabase connection เต็ม → ทั้งแอปค้าง

---

## Phase 3: Service Tests (Mock Supabase)

ใช้ `vi.mock()` mock supabase client เพื่อ test logic ใน service โดยไม่ต้องต่อ DB จริง

### 3.1 `src/services/chatService.ts` (ฟีเจอร์ใหม่)
- sendMessage → เรียก supabase.insert ถูก table + data ถูกต้อง
- getMessages → filter by room_id + order by created_at
- uploadImage → เรียก storage.upload + return public URL

### 3.2 `src/services/memoService.ts`
- createMemo → insert ถูก table + field ครบ
- updateMemoStatus → update ถูก record

### 3.3 `src/services/authService.ts`
- signIn → เรียก verify-otp + set localStorage
- signOut → clear localStorage + เรียก supabase.auth.signOut
- isAuthenticated → check expiration ถูกต้อง

### Mock Pattern
```ts
// src/test/mocks/supabase.ts
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }),
    auth: {
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn(),
        getPublicUrl: vi.fn(),
      }),
    },
  },
}));
```

---

## Phase 4: Component Tests (เฉพาะ shared components ที่สำคัญ)

ไม่ต้อง test ทุก component — เฉพาะตัวที่ใช้ร่วมกันหลายที่

| Component | ทำไมต้อง test |
|-----------|--------------|
| `ChatBubble` | ใช้ทั้ง user + admin view |
| `ChatInput` | validate รูป (จำนวน, ขนาด) |
| `DarkModeToggle` | เปลี่ยนจาก toggle → hamburger menu ต้องไม่พัง |

---

## Phase 5: CI Integration (Pre-commit Hook)

### เพิ่มใน pre-commit hook ที่มีอยู่
```bash
# scripts/bump-version.js ทำงานก่อน แล้วตามด้วย:
npx vitest run --reporter=dot 2>&1
if [ $? -ne 0 ]; then
  echo "❌ Test failed - ห้าม commit"
  exit 1
fi
```

### ประโยชน์
- **แก้โค้ดร่วม → test fail ก่อน commit** → รู้ทันทีว่าพัง
- ไม่ต้องรอ deploy แล้วค่อยรู้

---

## ลำดับการทำงาน

| ลำดับ | งาน | ประมาณไฟล์ |
|-------|-----|-----------|
| **1** | Setup vitest + config + setup file | 3 ไฟล์ |
| **2** | Test `database.ts` (role checking) | 1 ไฟล์ |
| **3** | Test `permissionUtils.ts` | 1 ไฟล์ |
| **4** | Test `dateUtils.ts` | 1 ไฟล์ |
| **5** | Test `memoUtils.ts` | 1 ไฟล์ |
| **6** | Test `validatePdfA4.ts` (pure parts) | 1 ไฟล์ |
| **7** | Test `approvalUtils.tsx` | 1 ไฟล์ |
| **8** | Test `requestQueue.ts` | 1 ไฟล์ |
| **9** | เพิ่ม test ใน pre-commit hook | แก้ 1 ไฟล์ |
| **10** | Service tests (mock supabase) | ทำเมื่อเริ่ม implement ฟีเจอร์ใหม่ |

---

## กฎสำหรับอนาคต
1. **ทุกไฟล์ใน `utils/` และ `types/` ต้องมี test** — เป็นโค้ดร่วมที่ส่งผลกระทบกว้าง
2. **เพิ่มฟีเจอร์ใหม่ → เขียน test พร้อมกัน** — โดยเฉพาะ service layer
3. **แก้ bug → เขียน test ก่อนแก้** — ป้องกัน regression
4. **test ต้อง pass ก่อน commit ได้** — enforce ผ่าน pre-commit hook
