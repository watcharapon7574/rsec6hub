# 🔧 Railway Management - Troubleshooting Guide

## Error: 500 Internal Server Error จาก Edge Function

### ขั้นตอนการแก้ไข:

#### 1. ตรวจสอบ Logs ใน Supabase Dashboard

ไปที่:
```
https://supabase.com/dashboard/project/ikfioqvjrhquiyeylmsv/functions/railway-api
```

คลิกแท็บ **Logs** และดูว่ามี error อะไร

#### 2. ตรวจสอบว่า Railway API Token ถูกบันทึกหรือยัง

```sql
-- ใน Supabase SQL Editor
SELECT * FROM app_settings WHERE key = 'railway_api_token';
```

ถ้าไม่มีข้อมูล:
1. ไปที่ `/railway`
2. คลิก "ตั้งค่า API Token"
3. วาง Railway API Token
4. คลิก "บันทึก"

#### 3. ตรวจสอบว่า login อยู่หรือไม่

```javascript
// ใน Browser Console
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);
```

ถ้าไม่มี session → ออกจากระบบแล้ว login ใหม่

#### 4. ทดสอบ Edge Function โดยตรง

```javascript
// ใน Browser Console (ต้อง login ก่อน)
const { data, error } = await supabase.functions.invoke('railway-api', {
  body: {
    query: `
      query {
        projects {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    `
  }
});

console.log('Result:', data);
console.log('Error:', error);
```

---

## Error Messages ที่พบบ่อย

### 1. "Missing authorization header"

**สาเหตุ:** ไม่ได้ login หรือ session หมดอายุ

**วิธีแก้:**
```javascript
// Logout และ login ใหม่
await supabase.auth.signOut();
// จากนั้น login ใหม่
```

### 2. "Railway API token not configured"

**สาเหตุ:** ยังไม่ได้ตั้งค่า Railway API Token

**วิธีแก้:**
1. ไปที่ https://railway.com/account/tokens
2. สร้าง token ใหม่
3. ไปที่ `/railway` → "ตั้งค่า API Token"
4. วาง token และบันทึก

### 3. "Unauthorized"

**สาเหตุ:** User authentication failed

**วิธีแก้:**
1. ตรวจสอบว่า login ด้วย email/password ที่ถูกต้อง
2. ตรวจสอบ Supabase Auth settings

### 4. "Railway API Error"

**สาเหตุ:** Railway API ตอบกลับด้วย error

**วิธีแก้:**
1. ตรวจสอบ Railway API Token ว่ายังใช้ได้อยู่หรือไม่
2. ตรวจสอบว่า Service ID และ Environment ID ถูกต้อง
3. ดู error details ใน console

---

## การตรวจสอบแบบละเอียด

### ตรวจสอบ Environment Variables ของ Edge Function

Edge Function ต้องการ env variables เหล่านี้:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**ตรวจสอบ:**
```bash
# ผ่าน Supabase Dashboard
Settings → Edge Functions → Environment Variables
```

### ตรวจสอบ RLS Policies

```sql
-- ตรวจสอบว่า RLS policies ถูกสร้างแล้ว
SELECT * FROM pg_policies
WHERE tablename IN ('app_settings', 'railway_schedules', 'railway_logs');
```

ถ้าไม่มี policies → รัน migration ใหม่:
```bash
supabase db push
```

---

## การทดสอบแบบ Step-by-Step

### Test 1: ทดสอบ Authentication

```javascript
// 1. Check session
const { data: { session } } = await supabase.auth.getSession();
console.log('✅ Session:', !!session);

// 2. Check user
const { data: { user } } = await supabase.auth.getUser();
console.log('✅ User:', user?.email);
```

### Test 2: ทดสอบ Database Access

```javascript
// 1. Read app_settings
const { data, error } = await supabase
  .from('app_settings')
  .select('*')
  .eq('key', 'railway_api_token');

console.log('✅ Token exists:', !!data?.[0]?.value);
console.log('Error:', error);
```

### Test 3: ทดสอบ Edge Function

```javascript
// 1. Simple query
const { data, error } = await supabase.functions.invoke('railway-api', {
  body: {
    query: '{ __typename }'
  }
});

console.log('✅ Edge Function works:', !error);
console.log('Data:', data);
console.log('Error:', error);
```

### Test 4: ทดสอบ Railway API

```javascript
// 1. List projects
const { data, error } = await supabase.functions.invoke('railway-api', {
  body: {
    query: `
      query {
        projects {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    `
  }
});

console.log('✅ Projects:', data?.projects?.edges?.length);
console.log('Error:', error);
```

---

## คำแนะนำเพิ่มเติม

### ถ้า Edge Function ยัง error อยู่

1. **Re-deploy Edge Function:**
   ```bash
   supabase functions deploy railway-api
   ```

2. **ตรวจสอบ Logs:**
   - ไปที่ Supabase Dashboard → Functions → railway-api → Logs
   - ดู console.log และ console.error

3. **ลอง invoke ด้วย Postman/Insomnia:**
   ```
   POST https://ikfioqvjrhquiyeylmsv.supabase.co/functions/v1/railway-api
   Headers:
     Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN
     Content-Type: application/json
   Body:
     {
       "query": "{ __typename }"
     }
   ```

### ถ้า Railway API ไม่ตอบกลับ

1. **ตรวจสอบ Railway API Token:**
   - ไปที่ https://railway.com/account/tokens
   - ตรวจสอบว่า token ยังใช้ได้อยู่
   - ลองสร้าง token ใหม่

2. **ทดสอบ Railway API โดยตรง (ผ่าน curl):**
   ```bash
   curl -X POST https://backboard.railway.com/graphql/v2 \
     -H "Authorization: Bearer YOUR_RAILWAY_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"query": "{ me { id name email } }"}'
   ```

---

## สรุป Checklist

เมื่อเจอ error 500:

- [ ] Login อยู่หรือไม่ (`supabase.auth.getSession()`)
- [ ] Railway API Token ถูกบันทึกหรือยัง (ตาราง `app_settings`)
- [ ] Edge Function ถูก deploy แล้วหรือยัง (`supabase functions deploy`)
- [ ] ดู Edge Function logs แล้วหรือยัง (Supabase Dashboard)
- [ ] ทดสอบ Edge Function โดยตรงแล้วหรือยัง (Browser Console)
- [ ] Railway API Token ยังใช้ได้อยู่หรือไม่ (Railway Dashboard)

---

**ถ้ายังแก้ไม่ได้ ให้ส่ง screenshot ของ Edge Function Logs มาดูครับ!**
