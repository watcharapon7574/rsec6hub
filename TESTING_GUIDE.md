# คู่มือการทดสอบระบบ Request Queue

## 📋 วิธีตรวจสอบว่าการทดสอบเชื่อถือได้

### วิธีที่ 1: ดูจาก Network Tab (แนะนำ ⭐)

1. **เปิด Developer Tools (F12)**
2. **ไปที่แท็บ Network**
3. **กรอง: `memos` หรือ `supabase`**
4. **คลิกทดสอบ เช่น "20 requests"**

**สิ่งที่ควรเห็น:**

#### ✅ ก่อนใช้ Request Queue (ถ้าไม่มีระบบ):
```
[0.1s] ❌ 20 requests พร้อมกัน
[0.2s] ❌ Error: "too many connections"
[0.2s] ❌ Error: "connection pool exhausted"
[0.3s] ⚠️  Success Rate: 30-40%
```

#### ✅ หลังใช้ Request Queue (ที่เราทำแล้ว):
```
[0.0s] ✅ Request 1-8 เริ่มพร้อมกัน (8 concurrent)
[0.5s] ✅ Request 9-16 เริ่มหลังจาก 1-8 เสร็จ
[1.0s] ✅ Request 17-20 เริ่มหลังจาก 9-16 เสร็จ
[1.5s] ✅ Success Rate: 100%
```

**ความแตกต่าง:**
- **ไม่มี Queue:** Requests ไปพร้อมกัน 20 ตัว → Database ไม่ไหว → Error
- **มี Queue:** Requests ไปทีละ 8 ตัว → Database รับไหว → สำเร็จหมด

---

### วิธีที่ 2: ดูจาก Console Logs

เปิด Console (F12) แล้วคลิก "20 requests" จะเห็น:

```
🧪 Starting Request Queue Test with 20 concurrent requests...
⏰ Start time: 14:23:45

📤 Request 1 started
📤 Request 2 started
📤 Request 3 started
📤 Request 4 started
📤 Request 5 started
📤 Request 6 started
📤 Request 7 started
📤 Request 8 started
⬅️ หยุดที่ 8! (เพราะ maxConcurrent = 8)

✅ Request 1 completed (5 records)
📤 Request 9 started  ⬅️ Request 9 เริ่มหลังจาก 1 เสร็จ
✅ Request 2 completed (5 records)
📤 Request 10 started ⬅️ Request 10 เริ่มหลังจาก 2 เสร็จ
...
✅ Request 20 completed (5 records)

📊 Test Results:
==================================================
✅ Successful: 20/20 (100.0%)
❌ Failed: 0/20
⏱️  Duration: 3.45 seconds
📈 Throughput: 5.80 requests/second
==================================================
```

**จุดสำคัญ:**
- ถ้า Queue ไม่ทำงาน → จะเห็น "Request 1-20 started" พร้อมกัน
- ถ้า Queue ทำงาน → จะเห็นทีละ 8 requests

---

### วิธีที่ 3: ดูจาก LoadingQueue Indicator

**ก่อนทดสอบ:**
- LoadingQueue: ไม่แสดง (Queue ว่าง)

**กำลังทดสอบ:**
- LoadingQueue ปรากฏที่มุมล่างขวา
- แสดง: "รอ 12 รายการ • กำลังทำ 8 รายการ"
- ตัวเลข "รอคิว" ลดลงเรื่อยๆ

**หลังทดสอบ:**
- LoadingQueue หายไป (Queue ว่าง)

**ถ้า LoadingQueue ไม่แสดง:**
- แสดงว่า requests ไม่ได้เข้าคิว
- Queue system ไม่ทำงาน

---

### วิธีที่ 4: เปรียบเทียบ Duration

#### ทดสอบ 20 requests:

**ไม่มี Queue (ไปพร้อมกัน):**
- Duration: ~0.5-1.0 วินาที (เร็วแต่มี error)
- Success Rate: 30-40%

**มี Queue (ไปทีละ 8):**
- Duration: ~2-4 วินาที (ช้ากว่าแต่ไม่มี error)
- Success Rate: 100%

**ถ้าเห็น Duration นานกว่า + Success Rate 100%:**
- แสดงว่า Queue ทำงาน (เพราะรอคิว)

---

### วิธีที่ 5: ทดสอบโดยปิด Queue (Proof)

ถ้าคุณยังไม่เชื่อ ลองปิด Queue ชั่วคราว:

```typescript
// ใน src/utils/requestQueue.ts
constructor(maxConcurrent = 8) {
  this.maxConcurrent = 999; // ⬅️ เปลี่ยนเป็น 999 (ไม่จำกัด)
}
```

**ทดสอบใหม่:**
- Success Rate จะลดลงเป็น 30-40%
- จะเห็น error "too many connections"

**เปลี่ยนกลับเป็น 8:**
- Success Rate กลับมา 100%

---

## 📊 ตารางเปรียบเทียบ

| การทดสอบ | ไม่มี Queue | มี Queue |
|---------|------------|---------|
| 5 requests | ✅ 100% | ✅ 100% |
| 10 requests | ⚠️ 80-90% | ✅ 100% |
| 20 requests | ❌ 30-40% | ✅ 100% |
| 50 requests | ❌ 10-20% | ✅ 100% |
| Duration (20) | ~0.5s | ~3s |
| LoadingQueue | ไม่แสดง | แสดง |

---

## 🔬 การทดสอบแบบมืออาชีพ (Advanced)

### 1. ทดสอบกับ Supabase Dashboard

1. เข้า [Supabase Dashboard](https://supabase.com/dashboard)
2. ไปที่ **Database** → **Connections**
3. คลิกทดสอบ "50 requests"
4. ดู **Active Connections** graph

**ควรเห็น:**
- Active Connections ไม่เกิน 8-10
- ถ้าเกิน 20 → Queue ไม่ทำงาน

---

### 2. ทดสอบด้วย Error Injection

```typescript
// เพิ่มใน testRequestQueue.ts
async testWithErrorInjection() {
  // Simulate database connection limit
  const maxConnections = 10;
  let activeConnections = 0;

  const promises = [];
  for (let i = 0; i < 50; i++) {
    const promise = requestQueue.enqueue(async () => {
      activeConnections++;

      if (activeConnections > maxConnections) {
        throw new Error('Too many connections!');
      }

      await new Promise(r => setTimeout(r, 100));
      activeConnections--;
      return { success: true };
    });

    promises.push(promise);
  }

  const results = await Promise.allSettled(promises);
  const successful = results.filter(r => r.status === 'fulfilled').length;

  console.log(`Success Rate: ${(successful/50*100).toFixed(1)}%`);
  // ควรได้ 100% ถ้า Queue ทำงาน
}
```

---

## ✅ Checklist สำหรับวันสาธิต

- [ ] 1. เปิด Network Tab แล้วกรอง `memos`
- [ ] 2. เปิด Console Tab เพื่อดู logs
- [ ] 3. คลิก "Health Check" → ควรได้ 100%
- [ ] 4. คลิก "20 requests" → ดู LoadingQueue แสดง
- [ ] 5. ดู Network Tab → ควรเห็น requests ทีละ 8
- [ ] 6. ดู Console → ควรเห็น "Request X started" ทีละ 8
- [ ] 7. ดูผลลัพธ์ → Success Rate ควรเป็น 100%
- [ ] 8. อธิบาย Duration ที่นานขึ้น = เพราะรอคิว (แต่ไม่มี error)

---

## 🎓 คำอธิบายให้ผู้ใช้

**คำถาม:** "ทำไมต้องใช้ Request Queue?"

**คำตอบ:**
> Supabase ฟรีรองรับได้แค่ 10-20 connections พร้อมกัน
> ถ้า 100 คนสร้าง memo พร้อมกัน → Database ไม่ไหว → Error
> Request Queue จะจัดให้ไปทีละ 8 requests
> ผลลัพธ์: Success Rate 100% แต่ใช้เวลานานขึ้นนิดหน่อย (30-60วินาที)
> ซึ่งดีกว่า error 70% เยอะมาก!

---

## 🚨 สัญญาณเตือนว่า Queue ไม่ทำงาน

1. ❌ Success Rate < 80% เมื่อทดสอบ 20+ requests
2. ❌ ไม่เห็น LoadingQueue indicator
3. ❌ Network Tab แสดง requests ไปพร้อมกัน 20+
4. ❌ Console ไม่มี logs "Request X started" แบบทีละ 8
5. ❌ Duration สั้นเกินไป (~0.5s สำหรับ 20 requests)

---

## 📞 หากพบปัญหา

1. ตรวจสอบว่า `requestQueue` ถูก import ใน `memoService.ts`
2. ตรวจสอบ `maxConcurrent = 8` ใน `requestQueue.ts`
3. ตรวจสอบว่า LoadingQueue แสดงใน App.tsx
4. ตรวจสอบ Console ว่ามี error อะไรไหม

---

## 📡 การทดสอบ Edge Functions (ใหม่!)

### Edge Functions ที่ทดสอบได้

1. **Telegram Notifications** - ส่งการแจ้งเตือนผ่าน Telegram
2. **OTP Requests** - ขอรหัส OTP ผ่าน Telegram (มี rate limit 3 OTP/5min)
3. **OTP Verification** - ยืนยันรหัส OTP

### วิธีทดสอบ Edge Functions

#### 1. ทดสอบ Telegram Notifications

**คลิก:** "10 แจ้งเตือน", "20 แจ้งเตือน", "50 แจ้งเตือน", "100 แจ้งเตือน"

**สิ่งที่ควรเห็น:**
```
📢 Starting Telegram Notify Test with 20 concurrent notifications...
📤 Notification 1 started
📤 Notification 2 started
...
📤 Notification 8 started (หยุดที่ 8 เพราะ maxConcurrent = 8)

✅ Notification 1 sent successfully
📤 Notification 9 started
✅ Notification 2 sent successfully
📤 Notification 10 started
...

📊 Telegram Notify Test Results:
==================================================
✅ Successful: 20/20 (100.0%)
❌ Failed: 0/20
⏱️  Duration: 2.34 seconds
📈 Throughput: 8.55 notifications/second
==================================================
```

**เช็คการทำงาน:**
- ตรวจสอบ Telegram ว่าได้รับการแจ้งเตือน 20 ข้อความ
- Success Rate ควรเป็น 100% (ถ้า chat_id ถูกต้อง)
- Throughput ปกติประมาณ 5-10 notifications/second

**สัญญาณเตือน:**
- ❌ Failed > 10% → ตรวจสอบ Telegram bot token
- ❌ Error "chat_id required" → ต้องระบุ chat_id ใน code

---

#### 2. ทดสอบ OTP Requests

**คลิก:** "5 OTP", "10 OTP", "20 OTP", "50 OTP"

**⚠️ สำคัญ:** มี Rate Limit 3 OTP ต่อ 5 นาที ต่อเบอร์โทร

**สิ่งที่ควรเห็น:**
```
🔐 Starting OTP Request Test with 10 concurrent requests...
⚠️ Rate Limit: 3 OTP per 5 minutes per phone number
📤 OTP Request 1 started (phone: 0925717574)
📤 OTP Request 2 started (phone: 0812345678)
📤 OTP Request 3 started (phone: 0823456789)
...

📊 OTP Request Test Results:
==================================================
✅ Successful: 8/10 (80.0%)
❌ Failed: 2/10
⏱️  Duration: 3.12 seconds

❌ Error breakdown:
  - Edge Function Error: กรุณารอ 5 นาทีก่อนขอรหัส OTP ใหม่: 2 occurrences
==================================================
✅ OTP Edge Function working well!
💡 Some failures expected due to rate limiting (3 OTP/5min)
```

**เช็คการทำงาน:**
- Success Rate 60-100% ถือว่าปกติ (เพราะมี rate limit)
- ถ้า Success Rate < 50% → อาจมีปัญหา Edge Function
- ตรวจสอบ Telegram ว่าได้รับรหัส OTP

**Rate Limit ทำงานอย่างไร:**
```typescript
// เบอร์ 0925717574 (Your phone)
Request 1: ✅ Success (1st OTP)
Request 6: ✅ Success (2nd OTP - reuse same phone)
Request 11: ✅ Success (3rd OTP)
Request 16: ❌ Failed (Rate limited - รอ 5 นาที)

// เบอร์ 0812345678 (Test phone 1)
Request 2: ✅ Success (1st OTP)
Request 7: ✅ Success (2nd OTP)
Request 12: ✅ Success (3rd OTP)
Request 17: ❌ Failed (Rate limited)
```

---

#### 3. ทดสอบ OTP Verification

**วิธีทดสอบ (ผ่าน Console):**
```javascript
// 1. ขอ OTP ก่อน
testRequestQueue.testEdgeFunctionOTP(1)

// 2. เช็ค Telegram เพื่อดูรหัส OTP (เช่น 123456)

// 3. ทดสอบ Verify OTP 10 ครั้งพร้อมกัน (ครั้งแรกจะสำเร็จ, ที่เหลือจะล้มเหลว)
testRequestQueue.testEdgeFunctionVerifyOTP(10, '0925717574', '123456')
```

**สิ่งที่ควรเห็น:**
```
🔓 Starting OTP Verification Test with 10 concurrent requests...
📤 OTP Verify 1 started
✅ OTP Verify 1 completed (ครั้งแรกสำเร็จ)
📤 OTP Verify 2 started
❌ OTP Verify 2 failed: รหัส OTP นี้ถูกใช้ไปแล้ว
...

📊 OTP Verification Test Results:
==================================================
✅ Successful: 1/10 (10.0%)
❌ Failed: 9/10
⏱️  Duration: 1.23 seconds
==================================================
⚠️ Success rate: 10.0% - expected failures after first verification
💡 Note: OTP can only be verified once, subsequent requests will fail
```

**นี่คือพฤติกรรมที่ถูกต้อง:**
- Request แรกสำเร็จ (10%)
- Request ที่เหลือล้มเหลว (90%) เพราะ OTP ถูกใช้ไปแล้ว
- ระบบป้องกันการใช้ OTP ซ้ำได้ดี

---

### ตารางเปรียบเทียบ Edge Functions

| Edge Function | Max Concurrent | Expected Success Rate | Avg Duration (10 req) |
|---------------|----------------|----------------------|------------------------|
| Telegram Notify | 8 | 100% | ~2-3s |
| OTP Request | 8 | 60-100% (มี rate limit) | ~3-4s |
| OTP Verify | 8 | 10% (1st only) | ~1-2s |

---

### สัญญาณเตือนว่า Edge Functions มีปัญหา

1. **Telegram Notify:**
   - ❌ Success Rate < 80% (ไม่มี rate limit ควรได้ 100%)
   - ❌ Error "TELEGRAM_BOT_TOKEN not configured"
   - ❌ Error "chat_id required"

2. **OTP Request:**
   - ❌ Success Rate < 50% (แม้มี rate limit ก็ไม่ควรต่ำกว่า 50%)
   - ❌ Error "ไม่พบเบอร์โทรศัพท์นี้ในระบบ" (เบอร์ไม่มีใน profiles)
   - ❌ Error "ไม่สามารถส่งรหัส OTP ได้" (Telegram API ล้มเหลว)

3. **OTP Verify:**
   - ❌ Success Rate > 20% (ควรเป็น 10% เพราะ verify ได้ครั้งเดียว)
   - ❌ Error "เกิดข้อผิดพลาดในการตรวจสอบรหัส OTP"

---

### เปรียบเทียบ Edge Functions vs Railway PDF

| ประเภท | Max Concurrent | Success Rate | เหตุผลข้อจำกัด |
|--------|----------------|--------------|----------------|
| Supabase Database | 8 | 100% | Connection pool limit |
| Telegram Notify | 8 | 100% | Telegram API limit |
| OTP Request | 8 | 60-100% | Rate limit 3 OTP/5min |
| Railway PDF | 2 | 85%+ | LibreOffice process limit |

**สรุป:**
- Edge Functions รองรับ concurrent ได้ดีกว่า Railway (8 vs 2)
- Rate limiting เป็นเรื่องปกติสำหรับ OTP
- Telegram API รองรับ concurrent ได้ดี (ไม่มี error rate สูง)

---

**เวอร์ชัน:** v1.1
**อัปเดตล่าสุด:** 2026-01-30
**เพิ่มเติม:** Edge Function Testing
