# Supabase Database Analysis - Profiles Table

**Generated:** 2026-02-01
**Database:** https://ikfioqvjrhquiyeylmsv.supabase.co

---

## Summary

- **Total Profiles:** 111
- **Profiles with employee_id:** 111
- **Highest employee_id:** RSEC712
- **Recommended Next ID:** **RSEC713**

---

## 1. Employee ID Pattern Analysis

### Pattern Format
- **Prefix:** `RSEC`
- **Number Range:** 600-712
- **Digit Length:** 3 digits (zero-padded)
- **Format:** `RSEC` + 3-digit number
- **Examples:** RSEC600, RSEC601, RSEC712

### ID Sequencing
- **Sequential:** Mostly sequential from RSEC600 to RSEC712
- **Missing IDs:** RSEC602, RSEC647 (gaps in sequence)
- **Total IDs:** 111 profiles

### All Employee IDs (Sorted)
```
RSEC600, RSEC601, RSEC603, RSEC604, RSEC605, RSEC606, RSEC607, RSEC608,
RSEC609, RSEC610, RSEC611, RSEC612, RSEC613, RSEC614, RSEC615, RSEC616,
RSEC617, RSEC618, RSEC619, RSEC620, RSEC621, RSEC622, RSEC623, RSEC624,
RSEC625, RSEC626, RSEC627, RSEC628, RSEC629, RSEC630, RSEC631, RSEC632,
RSEC633, RSEC634, RSEC635, RSEC636, RSEC637, RSEC638, RSEC639, RSEC640,
RSEC641, RSEC642, RSEC643, RSEC644, RSEC645, RSEC646, RSEC648, RSEC649,
RSEC650, RSEC651, RSEC652, RSEC653, RSEC654, RSEC655, RSEC656, RSEC657,
RSEC658, RSEC659, RSEC660, RSEC661, RSEC662, RSEC663, RSEC664, RSEC665,
RSEC666, RSEC667, RSEC668, RSEC669, RSEC670, RSEC671, RSEC672, RSEC673,
RSEC674, RSEC675, RSEC676, RSEC677, RSEC678, RSEC679, RSEC680, RSEC681,
RSEC682, RSEC683, RSEC684, RSEC685, RSEC686, RSEC687, RSEC688, RSEC689,
RSEC690, RSEC691, RSEC692, RSEC693, RSEC694, RSEC695, RSEC696, RSEC697,
RSEC698, RSEC699, RSEC700, RSEC701, RSEC702, RSEC703, RSEC704, RSEC705,
RSEC706, RSEC707, RSEC708, RSEC709, RSEC710, RSEC711, RSEC712
```

---

## 2. Table Schema - profiles

### Column List (43 columns total)

| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to auth.users |
| `employee_id` | TEXT | Employee identifier (RSEC###) |
| `prefix` | TEXT | Title/prefix (นาย, นาง, นางสาว) |
| `first_name` | TEXT | First name (Thai) |
| `last_name` | TEXT | Last name (Thai) |
| `nickname` | TEXT | Nickname |
| `gender` | TEXT | Gender (male/female) |
| `birth_date` | DATE | Date of birth |
| `age` | INTEGER | Age |
| `nationality` | TEXT | Nationality |
| `ethnicity` | TEXT | Ethnicity |
| `religion` | TEXT | Religion |
| `education` | TEXT | Education level/degree |
| `address` | TEXT | Full address |
| `postal_code` | TEXT | Postal code |
| `phone` | TEXT | Phone number |
| `email` | TEXT | Email address |
| `marital_status` | TEXT | Marital status |
| `spouse` | TEXT | Spouse information |
| `number_of_children` | INTEGER | Number of children |
| `father_name` | TEXT | Father's name |
| `father_occupation` | TEXT | Father's occupation |
| `mother_name` | TEXT | Mother's name |
| `mother_occupation` | TEXT | Mother's occupation |
| `emergency_contact` | JSONB | Emergency contact info |
| `position` | TEXT | Position type (director, government_teacher, etc.) |
| `job_position` | TEXT | Job title (Thai) |
| `academic_rank` | TEXT | Academic rank (Thai) |
| `org_structure_role` | TEXT | Organization role |
| `workplace` | TEXT | Workplace name |
| `start_work_date` | DATE | Start date |
| `current_position` | TEXT | Current position |
| `work_experience_years` | INTEGER | Years of experience |
| `education_history` | JSONB | Education history |
| `work_history` | JSONB | Work history |
| `signature_url` | TEXT | Signature image URL |
| `profile_picture_url` | TEXT | Profile picture URL |
| `documents` | JSONB | Document storage |
| `is_admin` | BOOLEAN | Admin flag |
| `telegram_chat_id` | TEXT | Telegram chat ID |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

### Key Findings
- **prefix column EXISTS** (not title)
- Contains Thai title prefixes: "นาย" (Mr.), "นาง" (Mrs.), "นางสาว" (Ms.)
- All editable profile fields are present
- JSONB fields for complex data (emergency_contact, education_history, work_history, documents)

---

## 3. Sample Profile Data

### Example 1: RSEC646 (วัชรพล อ่อนพันธ์)
```json
{
  "employee_id": "RSEC646",
  "prefix": "นาย",
  "first_name": "วัชรพล",
  "last_name": "อ่อนพันธ์",
  "nickname": "ฟอร์ด",
  "phone": "0925717574",
  "email": "watcharapon.ford@gmail.com",
  "position": "government_employee",
  "job_position": "ครูผู้ช่วย",
  "academic_rank": "ครูผู้ช่วย",
  "org_structure_role": "ครู",
  "gender": "male",
  "nationality": "ไทย",
  "ethnicity": "ไทย",
  "religion": "พุทธ",
  "education": "ปริญญาตรี วิทยาการคอมพิวเตอร์ (วท.บ.)",
  "workplace": "ศูนย์การศึกษาพิเศษ เขตการศึกษา 6 จังหวัดลพบุรี",
  "is_admin": false,
  "telegram_chat_id": "6479064915"
}
```

### Example 2: RSEC601 (อานนท์ จ่าแก้ว - Director)
```json
{
  "employee_id": "RSEC601",
  "prefix": "นาย",
  "first_name": "อานนท์",
  "last_name": "จ่าแก้ว",
  "phone": "0835595128",
  "position": "director",
  "job_position": "ผู้อำนวยการสถานศึกษา",
  "academic_rank": "ผู้อำนวยการชำนาญการพิเศษ",
  "org_structure_role": "ผู้อำนวยการศูนย์การศึกษาพิเศษเขตการศึกษา ๖ จังหวัดลพบุรี",
  "gender": "male"
}
```

### Example 3: RSEC603 (เจษฎา มั่งมูล - Deputy Director)
```json
{
  "employee_id": "RSEC603",
  "prefix": "นาย",
  "first_name": "เจษฎา",
  "last_name": "มั่งมูล",
  "phone": "0969068966",
  "position": "deputy_director",
  "job_position": "รองผู้อำนวยการสถานศึกษา",
  "academic_rank": "รองผู้อำนวยการชำนาญการพิเศษ",
  "org_structure_role": "รองผู้อำนวยการ",
  "gender": "male"
}
```

---

## 4. Position Types in Database

### Positions Found
- `director` - ผู้อำนวยการสถานศึกษา
- `deputy_director` - รองผู้อำนวยการสถานศึกษา
- `assistant_director` - ผู้ช่วยผู้อำนวยการ
- `government_teacher` - ครูผู้สอน
- `government_employee` - ข้าราชการ
- `contract_teacher` - ครูอัตราจ้าง
- `temporary_employee` - พนักงานชั่วคราว

### Academic Ranks Found
- `ผู้อำนวยการชำนาญการพิเศษ` (Director - Expert Level)
- `รองผู้อำนวยการชำนาญการพิเศษ` (Deputy Director - Expert Level)
- `ครูชำนาญการพิเศษ` (Expert Teacher)
- `ครูชำนาญการ` (Skilled Teacher)
- `ครู` (Teacher)
- `ครูผู้ช่วย` (Assistant Teacher)

---

## 5. Prefix (Title) Values

| Thai | English | Gender |
|------|---------|--------|
| นาย | Mr. | Male |
| นาง | Mrs. | Female |
| นางสาว | Ms. | Female |

---

## 6. Next Employee ID Recommendation

**Current Highest:** RSEC712
**Next ID:** **RSEC713**

### Auto-generation Logic
```javascript
// Get highest employee_id number
const maxNumber = 712; // from RSEC712

// Generate next ID
const nextNumber = maxNumber + 1;
const nextEmployeeId = `RSEC${String(nextNumber).padStart(3, '0')}`;
// Result: "RSEC713"
```

---

## 7. Data Quality Observations

### Complete Profiles
- Only a few profiles have complete data (phone, email, signature, etc.)
- Most profiles are basic entries with just name and position

### NULL Fields (common)
- `phone` - Most profiles missing
- `email` - Most profiles missing
- `signature_url` - Most profiles missing
- `profile_picture_url` - Most profiles missing
- `birth_date` - All profiles missing
- `telegram_chat_id` - Most profiles missing

### Populated Fields (consistent)
- `employee_id` - 100% populated
- `prefix` - 100% populated
- `first_name` - 100% populated
- `last_name` - 100% populated
- `position` - 100% populated
- `job_position` - 100% populated
- `academic_rank` - 100% populated
- `org_structure_role` - 100% populated
- `gender` - 100% populated
- `nationality` - 100% populated (default: "ไทย")
- `ethnicity` - 100% populated (default: "ไทย")
- `religion` - 100% populated (default: "พุทธ")

---

## 8. Editable Profile Fields

### Personal Information
- `prefix` (นาย/นาง/นางสาว)
- `first_name`
- `last_name`
- `nickname`
- `gender` (male/female)
- `birth_date`
- `nationality`
- `ethnicity`
- `religion`

### Contact Information
- `phone`
- `email`
- `address`
- `postal_code`
- `emergency_contact` (JSONB)

### Family Information
- `marital_status`
- `spouse`
- `number_of_children`
- `father_name`
- `father_occupation`
- `mother_name`
- `mother_occupation`

### Professional Information
- `position` (dropdown: director, deputy_director, government_teacher, etc.)
- `job_position` (Thai job title)
- `academic_rank` (Thai academic rank)
- `org_structure_role` (Organization role)
- `workplace`
- `education`
- `start_work_date`
- `work_experience_years`

### Complex Data (JSONB)
- `education_history`
- `work_history`
- `documents`

### Media
- `signature_url` (URL to signature image)
- `profile_picture_url` (URL to profile picture)

### System Fields (not typically edited by users)
- `employee_id` (auto-generated)
- `is_admin` (system flag)
- `telegram_chat_id` (system integration)
- `user_id` (auth reference)
- `created_at` (timestamp)
- `updated_at` (timestamp)

---

## 9. Key Takeaways

1. **Schema Confirmed:** `prefix` column exists (not `title`)
2. **ID Pattern:** RSEC + 3-digit number (currently 600-712)
3. **Next ID:** RSEC713 should be used for new employees
4. **Data Quality:** Basic info complete, extended info mostly missing
5. **Total Staff:** 111 employees in the system
6. **Missing IDs:** RSEC602 and RSEC647 (gaps in sequence)
7. **Most Common Position:** government_teacher (ครูผู้สอน)
8. **Organization:** ศูนย์การศึกษาพิเศษ เขตการศึกษา 6 จังหวัดลพบุรี

---

## 10. Database Connection Details

```javascript
// Supabase Configuration
const supabaseUrl = 'https://ikfioqvjrhquiyeylmsv.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

// Query Example
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .order('employee_id', { ascending: true });
```

---

**End of Analysis**
