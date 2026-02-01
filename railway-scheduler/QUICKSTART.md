# 🚀 Quick Start - Railway Scheduler

## วิธีใช้งานแบบเร็ว (5 นาที)

### ขั้นตอนที่ 1: ติดตั้ง

```bash
cd railway-scheduler
npm install
```

### ขั้นตอนที่ 2: สร้าง Railway API Token

1. ไปที่: https://railway.com/account/tokens
2. คลิก "Create New Token"
3. ตั้งชื่อ: "Scheduler Token"
4. คัดลอก token

### ขั้นตอนที่ 3: หา Service IDs และ Environment ID

```bash
# ตั้งค่า API token
export RAILWAY_API_TOKEN="your_token_here"

# ทดสอบและดูรายการ projects/services
npm test
```

คุณจะเห็นผลลัพธ์แบบนี้:

```
✅ Found 2 project(s):

   📦 My Project
      ID: abc123
      Services: 3
         - web-api (service-xxx)
         - worker (service-yyy)
         - redis (service-zzz)
      Environments: 2
         - production (env-111)
         - staging (env-222)
```

### ขั้นตอนที่ 4: ตั้งค่า Environment Variables

```bash
# เลือก Service IDs ที่ต้องการควบคุม
export RAILWAY_SERVICE_IDS="service-xxx,service-yyy"

# เลือก Environment
export RAILWAY_ENVIRONMENT_ID="env-111"
```

### ขั้นตอนที่ 5: ทดสอบการเปิดปิด

```bash
# ตรวจสอบสถานะ
node scheduler.js status

# ทดสอบปิด service
node scheduler.js stop

# ทดสอบเปิด service
node scheduler.js start
```

### ขั้นตอนที่ 6: ตั้งเวลาอัตโนมัติ

#### บน macOS/Linux:

```bash
# เปิด crontab editor
crontab -e

# เพิ่มบรรทัดเหล่านี้ (แก้ไข path ให้ถูกต้อง):
RAILWAY_API_TOKEN=your_token_here
RAILWAY_ENVIRONMENT_ID=env-111
RAILWAY_SERVICE_IDS=service-xxx,service-yyy

# เปิด 08:00, ปิด 18:00 (จันทร์-ศุกร์)
0 8 * * 1-5 cd /Users/watcharaponaonpan/rsec6hub/railway-scheduler && /usr/local/bin/node scheduler.js start >> /tmp/railway-start.log 2>&1
0 18 * * 1-5 cd /Users/watcharaponaonpan/rsec6hub/railway-scheduler && /usr/local/bin/node scheduler.js stop >> /tmp/railway-stop.log 2>&1
```

**หมายเหตุ:** ใช้ `which node` เพื่อหา full path ของ node

#### บน Windows:

1. เปิด Task Scheduler
2. Create Basic Task: "Railway Start"
   - Trigger: Daily, 8:00 AM, Mon-Fri
   - Action: Start program
     - Program: `C:\Program Files\nodejs\node.exe`
     - Arguments: `scheduler.js start`
     - Start in: `C:\path\to\railway-scheduler`
   - ตั้ง environment variables ใน Task properties
3. Create Basic Task: "Railway Stop" (เหมือนข้างบนแต่เป็น 6:00 PM)

## 🎯 ใช้งานผ่าน Claude Code (MCP)

### ติดตั้ง MCP Server

แก้ไขไฟล์ `~/.claude/config/mcp.json`:

```json
{
  "mcpServers": {
    "railway": {
      "command": "node",
      "args": ["/Users/watcharaponaonpan/rsec6hub/railway-scheduler/railway-mcp-server.js"],
      "env": {
        "RAILWAY_API_TOKEN": "your_railway_api_token_here"
      }
    }
  }
}
```

Restart Claude Code แล้วลองถาม:

```
ช่วยแสดง Railway projects ของผม
ตรวจสอบสถานะ service xyz
ปิด service abc ให้หน่อย
```

## 💰 ตัวอย่างการประหยัดค่าใช้จ่าย

### สถานการณ์: Development Environment

- **ก่อน:** เปิดตลอด 24/7 = 730 ชั่วโมง/เดือน
- **หลัง:** เปิดเฉพาะ จ.-ศ. 08:00-18:00 = ~220 ชั่วโมง/เดือน
- **ประหยัด:** ~70% หรือ $50-200/เดือน (ขึ้นอยู่กับ plan)

### ตัวอย่าง Cron Schedules

```bash
# เปิด-ปิดแบบ office hours (8-18 น., จ.-ศ.)
0 8 * * 1-5 node scheduler.js start
0 18 * * 1-5 node scheduler.js stop

# เปิด-ปิดแบบกะกลางคืน (ปิด 22:00-07:00)
0 7 * * * node scheduler.js start
0 22 * * * node scheduler.js stop

# ปิดช่วงสุดสัปดาห์
0 18 * * 5 node scheduler.js stop  # ศุกร์ 18:00
0 8 * * 1 node scheduler.js start   # จันทร์ 08:00
```

## 🔍 Troubleshooting

### API Token ไม่ทำงาน

```bash
# ทดสอบ token
curl -H "Authorization: Bearer $RAILWAY_API_TOKEN" \
  https://backboard.railway.com/graphql/v2 \
  -d '{"query": "{ me { id name } }"}'
```

### Cron ไม่ทำงาน

```bash
# ตรวจสอบ cron logs
tail -f /var/log/cron  # Linux
log show --predicate 'process == "cron"' --last 1h  # macOS

# ดู scheduler logs
tail -f /tmp/railway-start.log
tail -f /tmp/railway-stop.log
```

### Service ไม่ปิด/เปิด

```bash
# ตรวจสอบสถานะ
node scheduler.js status

# ลอง manual
node scheduler.js stop
node scheduler.js start
```

## 📚 อ่านเพิ่มเติม

- [README.md](README.md) - คู่มือฉบับเต็ม
- [crontab-example.txt](crontab-example.txt) - ตัวอย่าง cron schedules เพิ่มเติม
- [Railway API Docs](https://docs.railway.com/reference/public-api)

## 🆘 ต้องการความช่วยเหลือ?

ถาม Claude Code ได้เลย:

```
ช่วยตั้งค่า Railway scheduler ให้หน่อย
ทำไม cron ไม่ทำงาน?
แสดงวิธีดู logs ให้หน่อย
```
