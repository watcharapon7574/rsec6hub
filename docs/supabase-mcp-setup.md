# ตั้งค่า Supabase MCP สำหรับ Claude Code

คู่มือตั้งค่า Supabase MCP (Model Context Protocol) ให้ใช้งานได้จริงกับ Claude Code CLI / VSCode Extension

## MCP คืออะไร?

MCP ทำให้ Claude สามารถเข้าถึง Supabase ได้โดยตรง เช่น:
- สร้าง/จัดการ tables, migrations
- รัน SQL queries
- ดู logs, advisors
- Generate TypeScript types
- จัดการ Edge Functions, Branches

---

## วิธีตั้งค่า (แบบที่ใช้งานได้จริง)

### ขั้นตอนที่ 1: หา Project Ref และ Service Role Key

1. เข้า [Supabase Dashboard](https://supabase.com/dashboard)
2. เลือกโปรเจค
3. ไปที่ **Settings → API**
4. คัดลอก:
   - **Project Reference ID** (เช่น `abcdefghijklmnopqrst`)
   - **service_role key** (JWT ยาวๆ ขึ้นต้นด้วย `eyJ...`)

> **สำคัญ**: ใช้ `service_role` key ไม่ใช่ `anon` key

### ขั้นตอนที่ 2: เพิ่ม MCP Server ใน Claude Code

#### วิธี A: ใช้คำสั่ง CLI (แนะนำ)

```bash
claude mcp add --transport http supabase \
  "https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF" \
  --header "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

ตัวอย่างจริง:
```bash
claude mcp add --transport http supabase \
  "https://mcp.supabase.com/mcp?project_ref=abcdefghijklmnopqrst" \
  --header "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

#### วิธี B: แก้ไขไฟล์ settings.json โดยตรง

เปิดไฟล์ `~/.claude/settings.json` แล้วเพิ่ม `mcpServers`:

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF",
      "headers": {
        "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"
      }
    }
  }
}
```

**ตัวอย่างไฟล์เต็ม:**
```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=abcdefghijklmnopqrst",
      "headers": {
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx..."
      }
    }
  }
}
```

### ขั้นตอนที่ 3: รีสตาร์ท Claude Code

- **CLI**: ปิดแล้วเปิดใหม่
- **VSCode Extension**: กด `Cmd+Shift+P` → "Claude: Restart"

### ขั้นตอนที่ 4: ทดสอบ

ลองพิมพ์ใน Claude Code:

```
ดูรายการ tables ในโปรเจค
```

ถ้าตั้งค่าถูกต้อง Claude จะเรียก `list_tables` แล้วแสดงผลออกมา

---

## ตำแหน่งไฟล์ Config

| Scope | ไฟล์ | ใช้เมื่อ |
|-------|------|---------|
| **User** (ทุกโปรเจค) | `~/.claude/settings.json` | ใช้ Supabase เดียวกันทุกโปรเจค |
| **Project** (เฉพาะโปรเจค) | `.mcp.json` ที่ root โปรเจค | แชร์กับทีม (ระวัง key รั่ว) |

**แนะนำ**: ใส่ใน `~/.claude/settings.json` (User scope) เพราะมี key ที่เป็นความลับ

---

## จุดที่ต้องระวัง

### 1. ต้องใช้ `type: "http"` ไม่ใช่ `type: "stdio"`
```json
// ถูก
{ "type": "http", "url": "https://mcp.supabase.com/mcp?..." }

// ผิด
{ "type": "stdio", "command": "npx", "args": ["supabase-mcp"] }
```
Supabase MCP เป็น hosted server ใช้ HTTP ไม่ใช่ stdio

### 2. URL ต้องมี `?project_ref=`
ถ้าไม่ใส่ `project_ref` Claude จะถาม project ทุกครั้ง ใส่ไว้เลยสะดวกกว่า

### 3. อย่าใส่ `anon` key
`anon` key มีสิทธิ์จำกัด (ผ่าน RLS) ทำให้หลาย operations ไม่ทำงาน เช่น `apply_migration`, `execute_sql`
ต้องใช้ **`service_role`** key เท่านั้น

### 4. อย่า commit key ลง git
ถ้าใช้ `.mcp.json` ในโปรเจค ต้องเพิ่มใน `.gitignore`:
```
.mcp.json
```

### 5. ถ้ามีหลายโปรเจค
ใช้ `.mcp.json` แยกในแต่ละโปรเจค:

**โปรเจค A** (`projectA/.mcp.json`):
```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=PROJECT_A_REF",
      "headers": {
        "Authorization": "Bearer PROJECT_A_SERVICE_ROLE_KEY"
      }
    }
  }
}
```

**โปรเจค B** (`projectB/.mcp.json`):
```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=PROJECT_B_REF",
      "headers": {
        "Authorization": "Bearer PROJECT_B_SERVICE_ROLE_KEY"
      }
    }
  }
}
```

---

## Tools ที่ใช้ได้หลังตั้งค่า

| Tool | ทำอะไร |
|------|--------|
| `list_tables` | ดูรายการ tables ทั้งหมด |
| `execute_sql` | รัน SQL query (SELECT, INSERT, etc.) |
| `apply_migration` | สร้าง migration (CREATE TABLE, ALTER, etc.) |
| `list_migrations` | ดู migrations ที่มี |
| `get_logs` | ดู logs (api, postgres, auth, etc.) |
| `get_advisors` | ตรวจ security/performance issues |
| `generate_typescript_types` | สร้าง TypeScript types จาก schema |
| `list_extensions` | ดู PostgreSQL extensions |
| `search_docs` | ค้นหา Supabase documentation |
| `deploy_edge_function` | Deploy Edge Function |
| `create_branch` | สร้าง development branch |

---

## ตัวอย่างการใช้งาน

### สร้าง table ใหม่
```
สร้าง table ชื่อ products มี id, name, price, created_at
```
Claude จะเรียก `apply_migration` ให้อัตโนมัติ

### ดูข้อมูล
```
ดูข้อมูลใน table profiles 10 rows แรก
```
Claude จะเรียก `execute_sql` → `SELECT * FROM profiles LIMIT 10`

### ตรวจ security
```
ตรวจ security advisors ให้หน่อย
```
Claude จะเรียก `get_advisors` แล้วแจ้ง issues ที่พบ

---

## Checklist ก่อนใช้กับโปรเจคใหม่

- [ ] มี Supabase project แล้ว
- [ ] คัดลอก **Project Ref** จาก Dashboard → Settings → General
- [ ] คัดลอก **service_role key** จาก Dashboard → Settings → API
- [ ] เพิ่ม config ใน `~/.claude/settings.json` หรือ `.mcp.json`
- [ ] รีสตาร์ท Claude Code
- [ ] ทดสอบด้วย "ดูรายการ tables"
- [ ] (ถ้าใช้ `.mcp.json`) เพิ่ม `.mcp.json` ใน `.gitignore`
