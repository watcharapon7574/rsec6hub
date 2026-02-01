# ✅ แก้ปัญหา CORS - Railway API

## ปัญหาที่เจอ

```
Access to fetch at 'https://backboard.railway.com/graphql/v2' from origin 'http://localhost:8080'
has been blocked by CORS policy
```

## สาเหตุ

Railway API **ไม่อนุญาต** ให้เรียก API จาก browser โดยตรง (เฉพาะจาก https://railway.com เท่านั้น)

## วิธีแก้ ✅

ใช้ **Supabase Edge Function เป็น Proxy** แทนการเรียก Railway API โดยตรง

### สถาปัตยกรรม:

```
Browser (Frontend)
    ↓
Supabase Edge Function (railway-api)
    ↓
Railway API
```

### ไฟล์ที่เปลี่ยนแปลง:

1. **สร้าง Edge Function**: `supabase/functions/railway-api/index.ts`
   - รับ request จาก Frontend
   - เรียก Railway API แทน
   - ส่ง response กลับไป

2. **แก้ไข railwayService.ts**:
   - เปลี่ยนจาก `fetch(RAILWAY_API_URL)`
   - เป็น `supabase.functions.invoke('railway-api')`

## วิธีใช้งาน

### 1. Deploy Edge Function (ทำแล้ว ✅)

```bash
supabase functions deploy railway-api
```

### 2. ทดสอบใน Browser

ไปที่ `/railway` และทดสอบ:
1. ตั้งค่า Railway API Token
2. ดูรายการ Projects (ต้องไม่มี CORS error)
3. เปิด/ปิด Services

### 3. ตรวจสอบ Logs (ถ้ามีปัญหา)

ใน Supabase Dashboard:
```
Functions → railway-api → Logs
```

## ข้อดีของวิธีนี้

✅ **ไม่มี CORS error** - Edge Function ไม่มีข้อจำกัด CORS
✅ **ปลอดภัย** - API Token เก็บใน Supabase Database (ไม่อยู่ใน Frontend)
✅ **ใช้งานบน Vercel ได้** - ไม่ต้องมี backend server เอง
✅ **รองรับ Authentication** - ตรวจสอบ user ก่อนเรียก API

## ทดสอบการทำงาน

### Test 1: ดูรายการ Projects

```javascript
// ใน Browser Console
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

console.log('Projects:', data);
```

### Test 2: เปิด Service

```javascript
const { data, error } = await supabase.functions.invoke('railway-api', {
  body: {
    action: 'start',
    serviceId: 'your-service-id',
    environmentId: 'your-environment-id'
  }
});

console.log('Result:', data);
```

## Troubleshooting

### Error: "Railway API token not configured"

```bash
# ตั้งค่า token ผ่าน Web UI
# ไปที่ /railway → ตั้งค่า API Token
```

### Error: "Unauthorized"

```bash
# ตรวจสอบว่า login อยู่หรือไม่
# Supabase Auth ต้อง authenticated
```

### Edge Function ไม่ทำงาน

```bash
# Re-deploy Edge Function
supabase functions deploy railway-api

# ดู logs
supabase functions logs railway-api
```

## สรุป

✅ **ปัญหา CORS ถูกแก้แล้ว!**
- ใช้ Edge Function เป็น Proxy
- Deploy แล้ว และพร้อมใช้งาน
- ทดสอบได้ที่ `/railway`

---

**Deploy บน Vercel ได้เลย - ไม่มีปัญหา CORS!** 🚀
