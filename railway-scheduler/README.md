# Railway Scheduler - ตั้งเวลาเปิดปิด Railway Services

เครื่องมือสำหรับตั้งเวลาเปิดปิด Railway services อัตโนมัติเพื่อลดค่าใช้จ่าย

## 📋 คุณสมบัติ

1. **Railway MCP Server** - ควบคุม Railway ผ่าน Claude Code
2. **Scheduler Script** - ตั้งเวลาเปิดปิดอัตโนมัติด้วย cron
3. **Cost Optimization** - ลดค่าใช้จ่ายโดยปิด services ที่ไม่ได้ใช้งาน

## 🚀 การติดตั้ง

### 1. ติดตั้ง dependencies

```bash
cd railway-scheduler
npm install
```

### 2. ตั้งค่า Environment Variables

สร้างไฟล์ `.env`:

```bash
# Railway API Token (หาได้จาก https://railway.com/account/tokens)
RAILWAY_API_TOKEN=your_railway_api_token_here

# Environment ID (หาได้จาก Railway Dashboard URL หรือ API)
RAILWAY_ENVIRONMENT_ID=your_environment_id_here

# Service IDs ที่ต้องการควบคุม (คั่นด้วย comma)
RAILWAY_SERVICE_IDS=service-id-1,service-id-2
```

### 3. หา Service ID และ Environment ID

#### วิธีที่ 1: ใช้ Railway CLI

```bash
# ติดตั้ง Railway CLI
npm i -g @railway/cli

# Login
railway login

# List projects
railway list

# Link project
railway link

# Show service info
railway status
```

#### วิธีที่ 2: ใช้ MCP Server (ผ่าน Claude Code)

```bash
# เพิ่ม MCP server ใน Claude Code settings
claude mcp add railway node /path/to/railway-scheduler/railway-mcp-server.js

# จากนั้นถาม Claude:
# "ช่วยแสดงรายการ Railway projects และ services ของผม"
```

#### วิธีที่ 3: ตรวจสอบจาก URL

Railway Dashboard URL มักจะมีรูปแบบ:
```
https://railway.app/project/<PROJECT_ID>/service/<SERVICE_ID>?environment=<ENVIRONMENT_ID>
```

## 🎯 การใช้งาน

### ใช้งานด้วย Command Line

```bash
# เปิด services
node scheduler.js start

# ปิด services
node scheduler.js stop

# ตรวจสอบสถานะ
node scheduler.js status
```

### ตั้งเวลาอัตโนมัติด้วย Cron

#### บน macOS/Linux:

```bash
# แก้ไข crontab
crontab -e

# เพิ่มบรรทัดเหล่านี้:
# เปิด services ทุกวันเวลา 08:00 น.
0 8 * * * cd /Users/watcharaponaonpan/rsec6hub/railway-scheduler && /usr/local/bin/node scheduler.js start >> /tmp/railway-start.log 2>&1

# ปิด services ทุกวันเวลา 18:00 น.
0 18 * * * cd /Users/watcharaponaonpan/rsec6hub/railway-scheduler && /usr/local/bin/node scheduler.js stop >> /tmp/railway-stop.log 2>&1
```

**สำคัญ:** ต้องตั้งค่า environment variables ใน crontab ด้วย:

```bash
crontab -e

# เพิ่มที่บรรทัดบนสุด:
RAILWAY_API_TOKEN=your_token_here
RAILWAY_ENVIRONMENT_ID=your_env_id_here
RAILWAY_SERVICE_IDS=service-id-1,service-id-2

# แล้วค่อยเพิ่ม cron jobs
0 8 * * * cd /path/to/railway-scheduler && node scheduler.js start >> /tmp/railway-start.log 2>&1
0 18 * * * cd /path/to/railway-scheduler && node scheduler.js stop >> /tmp/railway-stop.log 2>&1
```

#### บน Windows:

ใช้ Task Scheduler:

1. เปิด Task Scheduler
2. สร้าง Basic Task
3. ตั้งชื่อ: "Railway Start Services"
4. Trigger: Daily, 8:00 AM
5. Action: Start a program
   - Program: `node`
   - Arguments: `scheduler.js start`
   - Start in: `/path/to/railway-scheduler`
6. ทำซ้ำสำหรับ Stop (6:00 PM)

## 🔧 ใช้งานผ่าน Claude Code (MCP)

### 1. เพิ่ม MCP Server

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

### 2. Restart Claude Code

```bash
# ออกจาก Claude Code และเปิดใหม่
```

### 3. ใช้งาน

ตอนนี้คุณสามารถถาม Claude ได้เลย:

```
- "แสดงรายการ Railway projects ของผม"
- "ปิด service xyz ให้หน่อย"
- "ตรวจสอบสถานะ service abc"
- "เปิด service ทั้งหมด"
```

## 💰 ประหยัดค่าใช้จ่าย

### ตัวอย่าง: ปิดนอกเวลาทำงาน (จันทร์-ศุกร์)

```bash
# เปิดเวลา 08:00 (จ.-ศ.)
0 8 * * 1-5 cd /path/to/railway-scheduler && node scheduler.js start

# ปิดเวลา 18:00 (จ.-ศ.)
0 18 * * 1-5 cd /path/to/railway-scheduler && node scheduler.js stop

# ปิดทั้งวันเสาร์-อาทิตย์
0 0 * * 6 cd /path/to/railway-scheduler && node scheduler.js stop
```

**การประหยัด:**
- ทำงาน: 10 ชั่วโมง/วัน × 5 วัน = 50 ชั่วโมง/สัปดาห์
- ปิด: 118 ชั่วโมง/สัปดาห์
- **ประหยัด ~70% ของค่าใช้จ่าย!**

## 🧪 Testing

```bash
# ทดสอบ API connection
npm test

# ทดสอบ start service
node scheduler.js start

# ดู logs
tail -f /tmp/railway-start.log
tail -f /tmp/railway-stop.log
```

## 📝 Logging

Logs จะถูกบันทึกที่:
- `/tmp/railway-start.log` - Start logs
- `/tmp/railway-stop.log` - Stop logs
- `/tmp/railway-status.log` - Status logs

## ⚠️ ข้อควรระวัง

1. **API Token Security**: เก็บ API token ให้ปลอดภัย อย่า commit ลง git
2. **Service Dependencies**: ถ้า service มี dependencies ต้องเปิดตามลำดับที่ถูกต้อง
3. **Database Services**: ระวังการปิด database services ที่มีการใช้งานจริง
4. **Timezone**: Cron ใช้ server timezone ตรวจสอบให้แน่ใจว่าตั้งเวลาถูกต้อง

## 🔍 Troubleshooting

### ไม่สามารถหา Service ID

```bash
# ใช้ MCP server หรือ Railway CLI
railway status

# หรือตรวจสอบ network tab ใน Railway Dashboard
```

### Cron ไม่ทำงาน

```bash
# ตรวจสอบ cron logs
tail -f /var/log/cron

# ตรวจสอบ PATH
which node  # ใช้ full path ใน crontab

# ตรวจสอบ permissions
chmod +x scheduler.js
```

### API Token ไม่ทำงาน

```bash
# Verify token
curl -H "Authorization: Bearer $RAILWAY_API_TOKEN" \
  https://backboard.railway.com/graphql/v2 \
  -d '{"query": "{ me { id name } }"}'
```

## 📚 เอกสารอ้างอิง

- [Railway API Documentation](https://docs.railway.com/reference/public-api)
- [Cron Syntax](https://crontab.guru/)
- [MCP Documentation](https://modelcontextprotocol.io/)

## 🤝 Support

หากมีปัญหาหรือข้อสงสัย:
1. ตรวจสอบ logs
2. ทดสอบด้วย `npm test`
3. ตรวจสอบ environment variables
4. ลอง run manual ก่อน: `node scheduler.js status`
