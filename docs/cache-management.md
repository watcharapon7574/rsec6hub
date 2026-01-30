# คู่มือการจัดการ Browser Cache และ Service Worker

## ปัญหาที่เคยพบ

ผู้ใช้งานต้องกด **Cmd+Shift+R** (Hard Refresh) ทุกครั้งเพื่อดูการเปลี่ยนแปลงใหม่ เนื่องจาก:
1. Browser แคชไฟล์ JavaScript และ CSS ไว้
2. Service Worker แคชไฟล์เพื่อใช้งาน Offline
3. ไม่มีระบบบังคับให้โหลดไฟล์ใหม่เมื่อ deploy

## วิธีแก้ปัญหาที่ใช้

### 1. เพิ่ม Cache Control Headers ใน HTML
```html
<!-- ป้องกัน Browser Cache -->
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
```

### 2. กำหนด Hash ให้ไฟล์ที่ Build (vite.config.ts)
```typescript
build: {
  rollupOptions: {
    output: {
      entryFileNames: `assets/[name].[hash].js`,
      chunkFileNames: `assets/[name].[hash].js`,
      assetFileNames: `assets/[name].[hash].[ext]`
    }
  }
}
```
**ผลลัพธ์:** ไฟล์ที่ build จะมีชื่อเป็น `main.a1b2c3d4.js` ทุกครั้งที่ build ใหม่ hash จะเปลี่ยน บราว์เซอร์จะโหลดไฟล์ใหม่อัตโนมัติ

### 3. ใช้ Network First Strategy สำหรับ JS/CSS
ในไฟล์ `public/sw.js`:
```javascript
const NETWORK_FIRST_URLS = [
  '/assets/', // JS และ CSS files
  '/api/',    // API calls
  '/src/'     // Source files
];
```

**ทำงานอย่างไร:**
- ลองโหลดจาก network ก่อน (internet)
- ถ้าโหลดไม่ได้ (offline) ค่อยใช้ cache
- **ไม่ใช้** cache ก่อนแล้วค่อยโหลดจาก network

### 4. เพิ่มเวอร์ชันใน Service Worker
```javascript
const CACHE_NAME = 'rsec6-officehub-v1.4.4';
```

**สำคัญ:** ทุกครั้งที่ deploy ต้องเปลี่ยนเลขเวอร์ชันนี้! เช่น:
- v1.4.4 → v1.4.5
- v1.4.5 → v1.5.0

### 5. ระบบแจ้งเตือนอัปเดทอัตโนมัติ
เพิ่มใน `index.html`:
```javascript
// ตรวจสอบอัปเดททุก 60 วินาที
setInterval(() => {
  registration.update();
}, 60000);

// แจ้งเตือนเมื่อมีเวอร์ชันใหม่
if (confirm('มีเวอร์ชันใหม่ของระบบ คุณต้องการรีเฟรชหน้าเพื่ออัปเดทหรือไม่?')) {
  window.location.reload();
}
```

## ขั้นตอนการ Deploy ใหม่

### ก่อน Deploy
1. ✅ เปลี่ยนเลขเวอร์ชันใน `public/sw.js`:
   ```javascript
   const CACHE_NAME = 'rsec6-officehub-v1.4.5'; // เปลี่ยนจาก v1.4.4
   ```

2. ✅ (ถ้ามี) เปลี่ยนเลขเวอร์ชันใน `package.json`:
   ```json
   {
     "version": "1.4.5"
   }
   ```

### หลัง Deploy
1. ผู้ใช้งานที่เปิดระบบค้างไว้ จะเห็นข้อความแจ้งเตือน:
   > มีเวอร์ชันใหม่ของระบบ คุณต้องการรีเฟรชหน้าเพื่ออัปเดทหรือไม่?

2. กด "OK" → หน้าจะรีโหลดอัตโนมัติ
3. กด "Cancel" → จะใช้เวอร์ชันเก่าต่อ (แต่ครั้งถัดไปที่เปิดใหม่จะเป็นเวอร์ชันใหม่)

## การทดสอบ

### ทดสอบว่า Cache ทำงานถูกต้อง

1. เปิด Chrome DevTools (F12)
2. ไปที่แท็บ **Application**
3. ดูที่ **Service Workers**
   - ต้องเห็น `rsec6-officehub-v1.4.4` หรือเวอร์ชันที่ใหม่กว่า
4. ดูที่ **Cache Storage**
   - คลิกดู cache ว่ามีไฟล์อะไรบ้าง
5. ดูที่ **Network**
   - คอลัมน์ "Size" ถ้าเป็น `(disk cache)` = โหลดจาก cache
   - ถ้าเป็นตัวเลข เช่น `150 KB` = โหลดจาก network

### ทดสอบการอัปเดทอัตโนมัติ

1. แก้ไขโค้ดอะไรก็ได้ (เช่น เปลี่ยนข้อความ)
2. เปลี่ยนเวอร์ชันใน `sw.js`
3. Build และ Deploy ใหม่
4. เปิดหน้าเว็บที่เปิดค้างไว้
5. รอ 1-2 นาที (จะเช็คอัปเดททุก 60 วินาที)
6. ต้องเห็นข้อความแจ้งเตือน

## วิธีล้าง Cache (สำหรับการพัฒนา)

### วิธีที่ 1: ผ่าน Chrome DevTools
1. เปิด DevTools (F12)
2. **Application** → **Storage**
3. คลิก **Clear site data**
4. รีเฟรชหน้า (F5)

### วิธีที่ 2: ใช้ Hard Refresh
- **Windows/Linux:** Ctrl + Shift + R
- **Mac:** Cmd + Shift + R

### วิธีที่ 3: ปิด Service Worker (ขณะพัฒนา)
1. เปิด DevTools (F12)
2. **Application** → **Service Workers**
3. เช็ค ✅ **Bypass for network**
4. (หรือ) คลิก **Unregister** เพื่อลบ SW

## คำแนะนำเพิ่มเติม

### ไฟล์ที่ควรแคช (Cache First)
- ✅ รูปภาพ logo
- ✅ ไฟล์ manifest.json
- ✅ ไฟล์ font (ถ้ามี)
- ✅ ไฟล์ static ที่ไม่เปลี่ยน

### ไฟล์ที่ไม่ควรแคช (Network First)
- ❌ JavaScript files (main.js, chunk.js)
- ❌ CSS files (main.css)
- ❌ API calls
- ❌ ไฟล์ที่เปลี่ยนบ่อย

### เมื่อไหร่ควรเปลี่ยนเวอร์ชัน

**ต้องเปลี่ยนเวอร์ชันเมื่อ:**
- ✅ แก้ bug ที่สำคัญ
- ✅ เพิ่มฟีเจอร์ใหม่
- ✅ เปลี่ยน UI/UX
- ✅ แก้ไข logic สำคัญ

**ไม่ต้องเปลี่ยนเมื่อ:**
- แก้ไข comment ในโค้ด
- แก้ไข README หรือเอกสาร
- แก้ไขเล็กน้อยที่ไม่กระทบผู้ใช้

## ตัวอย่าง Version Naming

```
v1.4.4 → เวอร์ชันปัจจุบัน
  │ │ │
  │ │ └─ Patch (แก้ bug เล็กน้อย)
  │ └─── Minor (เพิ่มฟีเจอร์เล็ก)
  └───── Major (เปลี่ยนแปลงใหญ่)

ตัวอย่าง:
- แก้ typo → v1.4.4 → v1.4.5 (เปลี่ยน Patch)
- เพิ่มฟีเจอร์เล็ก → v1.4.5 → v1.5.0 (เปลี่ยน Minor)
- Redesign ทั้งระบบ → v1.5.0 → v2.0.0 (เปลี่ยน Major)
```

## สรุป

✅ **ทำแล้ว:**
1. เพิ่ม Cache-Control headers
2. กำหนด hash ให้ไฟล์ build
3. ใช้ Network First สำหรับ JS/CSS
4. ระบบแจ้งเตือนอัปเดทอัตโนมัติ
5. เวอร์ชันใน Service Worker

✅ **ผลลัพธ์:**
- ผู้ใช้ไม่ต้องกด Hard Refresh แล้ว
- รีเฟรชปกติ (F5) จะโหลดไฟล์ใหม่ทันที
- มีการแจ้งเตือนเมื่อมีเวอร์ชันใหม่
- ยังคงใช้งาน Offline ได้ (สำหรับรูปภาพและไฟล์ static)

✅ **หน้าที่ของนักพัฒนา:**
- เปลี่ยนเลขเวอร์ชันใน `sw.js` ทุกครั้งที่ deploy

---

**อัปเดทล่าสุด:** 14 มกราคม 2026
**ใช้กับเวอร์ชัน:** 1.4.4+
