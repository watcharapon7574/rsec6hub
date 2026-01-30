# System Overview Diagram - Documents Management System

## 1. High-Level Architecture

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[React UI Components]
        Hooks[Custom Hooks]
        Services[Services Layer]
    end

    subgraph "Backend Layer - Supabase"
        Auth[Authentication]
        DB[(PostgreSQL Database)]
        Storage[File Storage]
        Realtime[Realtime Subscriptions]
    end

    subgraph "User Roles"
        Clerk[ธุรการ<br/>clerk_teacher]
        Mgmt[ผู้บริหาร<br/>ผอ, รองผอ, ผช.ผอ]
        Staff[ครู/พนักงาน<br/>teacher, employee]
    end

    Clerk --> UI
    Mgmt --> UI
    Staff --> UI

    UI --> Hooks
    Hooks --> Services
    Services --> Auth
    Services --> DB
    Services --> Storage
    Services --> Realtime

    Realtime -.->|Push Updates| Hooks

    style Clerk fill:#e1f5ff
    style Mgmt fill:#fff4e1
    style Staff fill:#f0f0f0
    style Auth fill:#4CAF50
    style DB fill:#2196F3
    style Storage fill:#FF9800
    style Realtime fill:#9C27B0
```

## 2. Database Schema Overview

```mermaid
erDiagram
    profiles ||--o{ memos : creates
    profiles ||--o{ doc_receive : creates
    profiles ||--o{ official_documents : creates
    profiles ||--o{ memo_signatures : signs

    memos {
        uuid id PK
        varchar doc_number
        text subject
        date date
        text content
        varchar status
        uuid created_by FK
        jsonb form_data
        jsonb signature_positions
        jsonb signatures
        int current_signer_order
        text pdf_draft_path
        text pdf_final_path
        text[] attached_files
    }

    doc_receive {
        uuid id PK
        varchar doc_number
        text subject
        date date
        text content
        varchar status
        uuid created_by FK
        jsonb form_data
        jsonb signature_positions
        jsonb signatures
        int current_signer_order
        text pdf_draft_path
        text pdf_final_path
        text[] attached_files
    }

    official_documents {
        uuid id PK
        varchar document_number
        date document_date
        text subject
        text content
        text recipient
        varchar status
        int current_approver_level
        uuid user_id FK
        text pdf_path
        text rejection_reason
        timestamp clerk_approved_at
        timestamp assistant_approved_at
        timestamp deputy_approved_at
        timestamp director_approved_at
    }

    profiles {
        uuid id PK
        varchar first_name
        varchar last_name
        varchar position
        varchar phone_number
        text signature_url
        varchar academic_rank
        varchar prefix
    }

    memo_signatures {
        uuid id PK
        uuid memo_id FK
        uuid user_id FK
        int order
        timestamp signed_at
        text comment
    }
```

## 3. User Roles & Permissions Matrix

```mermaid
graph TB
    subgraph "Roles & Permissions"
        direction LR

        subgraph "ธุรการ (Clerk)"
            C1[เห็นเอกสารทั้งหมด]
            C2[สร้างบันทึกข้อความ]
            C3[อัปโหลดหนังสือรับ PDF]
            C4[ลงเลขหนังสือ]
            C5[เลือกผู้ลงนาม]
            C6[กำหนดตำแหน่งลายเซ็น]
            C7[ตีกลับเอกสาร]
            C8[ลบเอกสาร]
        end

        subgraph "ผู้อำนวยการ (Director)"
            D1[เห็นเอกสารที่รอลงนาม<br/>current_signer_order = 4]
            D2[อนุมัติและลงนาม]
            D3[ตีกลับเอกสาร]
            D4[ดูสถิติ]
        end

        subgraph "รองผู้อำนวยการ (Deputy)"
            DPT1[เห็นเอกสารที่รอลงนาม<br/>current_signer_order = 3]
            DPT2[อนุมัติและลงนาม]
            DPT3[ตีกลับเอกสาร]
            DPT4[ดูสถิติ]
        end

        subgraph "ผู้ช่วยผู้อำนวยการ (Assistant)"
            A1[เห็นเอกสารที่รอลงนาม<br/>current_signer_order = 2]
            A2[อนุมัติและลงนาม]
            A3[ตีกลับเอกสาร]
            A4[ดูสถิติ]
        end

        subgraph "ครู/พนักงาน (Staff)"
            S1[เห็นเอกสารตัวเองเท่านั้น]
            S2[สร้างบันทึกข้อความ]
            S3[ดูสถานะเอกสาร]
        end
    end

    style C1 fill:#e3f2fd
    style C2 fill:#e3f2fd
    style C3 fill:#e3f2fd
    style C4 fill:#e3f2fd
    style C5 fill:#e3f2fd
    style C6 fill:#e3f2fd
    style C7 fill:#e3f2fd
    style C8 fill:#e3f2fd
```

## 4. Document Types & Storage Structure

```mermaid
graph LR
    subgraph "Document Types"
        M[Memos<br/>บันทึกข้อความภายใน]
        DR[Doc Receive<br/>หนังสือรับ PDF Upload]
        OD[Official Documents<br/>เอกสารราชการ]
    end

    subgraph "Supabase Storage"
        subgraph "documents/"
            subgraph "memos/"
                M_USER[userId/]
                M_FILES[timestamp-filename.pdf<br/>attachment_xxx.pdf]
            end

            subgraph "doc_receive/"
                DR_USER[userId/]
                DR_FILES[timestamp-filename.pdf]
            end

            subgraph "signatures/"
                SIG_USER[userId/]
                SIG_FILES[signature.png]
            end
        end
    end

    M --> M_USER
    M_USER --> M_FILES
    DR --> DR_USER
    DR_USER --> DR_FILES

    style M fill:#4CAF50
    style DR fill:#2196F3
    style OD fill:#FF9800
```

## 5. Component Architecture - Documents Feature

```mermaid
graph TB
    subgraph "Pages"
        ODP[OfficialDocumentsPage<br/>/documents]
        CDP[CreateDocumentPage<br/>/create-document]
        CMP[CreateMemoPage<br/>/create-memo]
        DMP[DocumentManagePage<br/>/document-manage/:id]
        ADP[ApproveDocumentPage<br/>/approve-document/:id]
        PSP[PDFSignaturePage<br/>/pdf-signature]
    end

    subgraph "Main Components"
        DC[DocumentCards]
        DL[DocumentList]
        DRL[DocReceiveList]
        PDL[PersonalDocumentList]
        PDC[PendingDocumentCard]
    end

    subgraph "Form Components"
        CMF[CreateMemoForm]
        SPF[SinglePDFSignatureForm]
    end

    subgraph "Document Management Components"
        S1[Step1DocumentNumber]
        S2[Step2SelectSigners]
        S3[Step3SignaturePositions]
        S4[Step4Review]
    end

    subgraph "Approval Components"
        AP[ApprovalProcess]
        AA[ApprovalAction]
        AS[ApprovalSteps]
    end

    subgraph "Utilities"
        PDFV[PDFViewer]
        SPS[SignaturePositionSelector]
    end

    ODP --> DC
    DC --> DL
    DC --> DRL
    DC --> PDL
    DC --> PDC

    CDP --> CMF
    CDP --> SPF

    CMP --> CMF

    DMP --> S1
    DMP --> S2
    DMP --> S3
    DMP --> S4

    S3 --> PDFV
    S3 --> SPS

    ADP --> AP
    AP --> AA
    AP --> AS
    ADP --> PDFV

    PSP --> SPF

    style ODP fill:#4CAF50
    style DMP fill:#2196F3
    style ADP fill:#FF9800
```

## 6. Data Flow Architecture

```mermaid
sequenceDiagram
    participant U as User
    participant C as React Component
    participant H as Custom Hook
    participant S as Service Layer
    participant SB as Supabase Client
    participant DB as Database
    participant ST as Storage
    participant RT as Realtime

    U->>C: User Action
    C->>H: Call Hook (e.g., useAllMemos)
    H->>S: Call Service (e.g., fetchMemos)
    S->>SB: API Request

    alt Database Query
        SB->>DB: SELECT/INSERT/UPDATE
        DB-->>SB: Query Result
    end

    alt File Upload
        SB->>ST: Upload File
        ST-->>SB: File URL
    end

    SB-->>S: Response Data
    S-->>H: Processed Data
    H-->>C: Updated State
    C-->>U: UI Update

    Note over RT,H: Realtime Updates
    RT->>H: Push Notification
    H->>C: Update State
    C->>U: UI Refresh
```

## 7. Authentication & Authorization Flow

```mermaid
graph TB
    Start([User Access App]) --> Login{Authenticated?}

    Login -->|No| AuthPage[Navigate to /auth]
    AuthPage --> SupaAuth[Supabase Authentication]
    SupaAuth --> GetProfile[Fetch User Profile]
    GetProfile --> GetPerms[Get Position & Permissions]
    GetPerms --> SetContext[Set Auth Context]

    Login -->|Yes| CheckPerms{Check Permissions}
    SetContext --> CheckPerms

    CheckPerms -->|Clerk| ClerkView[Full Access<br/>See All Documents]
    CheckPerms -->|Management| MgmtView[See Pending Documents<br/>Approval Level Match]
    CheckPerms -->|Staff| StaffView[See Own Documents Only]

    ClerkView --> RenderUI[Render UI Components]
    MgmtView --> RenderUI
    StaffView --> RenderUI

    RenderUI --> Protected{Protected Route?}
    Protected -->|Yes| ValidateJWT[Validate JWT Token]
    Protected -->|No| ShowContent[Show Content]

    ValidateJWT -->|Valid| ShowContent
    ValidateJWT -->|Invalid| AuthPage

    style AuthPage fill:#f44336
    style ClerkView fill:#4CAF50
    style MgmtView fill:#2196F3
    style StaffView fill:#FF9800
```

## 8. Status State Machine

```mermaid
stateDiagram-v2
    [*] --> draft: สร้างเอกสาร

    draft --> pending_sign: ธุรการลงเลขหนังสือ<br/>และเลือกผู้ลงนาม

    pending_sign --> pending_sign: ผู้ลงนามคนที่ 1, 2, 3<br/>อนุมัติและลงนาม<br/>(current_signer_order++)

    pending_sign --> approved: ผู้ลงนามคนสุดท้าย<br/>อนุมัติและลงนาม

    draft --> rejected: ธุรการตีกลับ
    pending_sign --> rejected: ผู้ลงนามคนใดคนหนึ่ง<br/>ตีกลับเอกสาร

    approved --> [*]: เสร็จสิ้นกระบวนการ
    rejected --> [*]: สิ้นสุดกระบวนการ

    note right of draft
        status = 'draft'
        current_signer_order = 0
    end note

    note right of pending_sign
        status = 'pending_sign'
        current_signer_order = 1-4
        - 1: ธุรการ (optional)
        - 2: ผช.ผอ
        - 3: รองผอ
        - 4: ผอ
    end note

    note right of approved
        status = 'approved'
        pdf_final_path ถูกตั้งค่า
        ทุกคนลงนามครบแล้ว
    end note

    note right of rejected
        status = 'rejected'
        rejection_reason บันทึกไว้
    end note
```

## 9. File Processing Pipeline

```mermaid
graph LR
    subgraph "Create Document"
        A1[User Uploads<br/>Attachments] --> A2[Upload to Storage<br/>documents/memos/userId/]
        A2 --> A3[Get File URLs]
        A3 --> A4[Generate PDF<br/>from Form Data]
        A4 --> A5[Save to<br/>pdf_draft_path]
    end

    subgraph "Signature Process"
        B1[Clerk Sets<br/>Signature Positions] --> B2[Store positions<br/>in signature_positions[]]
        B2 --> B3[Signer 1<br/>Signs Document]
        B3 --> B4[Fetch Signature<br/>Image from Profile]
        B4 --> B5[Draw Signature<br/>on PDF using pdf-lib]
        B5 --> B6[Upload New PDF]
        B6 --> B7[Update<br/>pdf_draft_path]
        B7 --> B8{More Signers?}
        B8 -->|Yes| B3
        B8 -->|No| B9[Set pdf_final_path]
    end

    subgraph "Merge with Attachments"
        C1[Get Main PDF] --> C2[Get All Attachments]
        C2 --> C3[Merge PDFs<br/>using pdf-lib]
        C3 --> C4[Upload Final PDF]
        C4 --> C5[Update Record]
    end

    A5 --> B1
    B9 --> C1

    style A4 fill:#4CAF50
    style B5 fill:#2196F3
    style C3 fill:#FF9800
```

## 10. Realtime Update Flow

```mermaid
sequenceDiagram
    participant DB as Supabase Database
    participant RT as Realtime Channel
    participant H as useSmartRealtime Hook
    participant C as Component
    participant UI as User Interface

    Note over DB: Document Updated<br/>(Status Change, Signature Added)

    DB->>RT: Broadcast Change Event
    RT->>H: Receive Event

    H->>H: Filter Event<br/>(Check if relevant to user)

    alt Relevant to Current User
        H->>C: Update Local State
        C->>UI: Re-render with New Data
        UI->>UI: Show Toast Notification
    else Not Relevant
        H->>H: Ignore Event
    end

    Note over H: Auto-reconnect on disconnect<br/>Debounce rapid updates
```

## 11. API Service Layer Architecture

```mermaid
graph TB
    subgraph "Services"
        ODS[officialDocumentService.ts]
        MS[memoService.ts]
        PS[profileService.ts]
        NS[notificationService.ts]
    end

    subgraph "officialDocumentService"
        ODS1[fetchOfficialDocuments<br/>Filter by role]
        ODS2[fetchMemos<br/>Get all memos 30 days]
        ODS3[fetchMemoPDFFiles<br/>From storage]
        ODS4[rejectDocument<br/>Update status]
        ODS5[assignDocumentNumber<br/>Set doc_number]
        ODS6[setDocumentForSigning<br/>Set signers]
        ODS7[uploadNewPDF<br/>Upload to storage]
        ODS8[downloadPDF<br/>Download from storage]
    end

    subgraph "MemoService Class"
        MS1[uploadAttachedFiles<br/>Upload to storage]
        MS2[createMemoDraft<br/>Create record]
        MS3[updateMemo<br/>Update record]
        MS4[submitMemoForApproval<br/>Change status]
        MS5[submitPDFSignature<br/>Add signature to PDF]
        MS6[getMemoById<br/>Get single memo]
    end

    subgraph "Supabase Client"
        SC[supabase.from<br/>supabase.storage<br/>supabase.auth]
    end

    ODS --> ODS1
    ODS --> ODS2
    ODS --> ODS3
    ODS --> ODS4
    ODS --> ODS5
    ODS --> ODS6
    ODS --> ODS7
    ODS --> ODS8

    MS --> MS1
    MS --> MS2
    MS --> MS3
    MS --> MS4
    MS --> MS5
    MS --> MS6

    ODS1 --> SC
    ODS2 --> SC
    ODS3 --> SC
    ODS4 --> SC
    ODS5 --> SC
    ODS6 --> SC
    ODS7 --> SC
    ODS8 --> SC

    MS1 --> SC
    MS2 --> SC
    MS3 --> SC
    MS4 --> SC
    MS5 --> SC
    MS6 --> SC

    style ODS fill:#4CAF50
    style MS fill:#2196F3
    style SC fill:#FF9800
```

## 12. Technology Stack

```mermaid
graph TB
    subgraph "Frontend"
        React[React 18.3.1]
        TS[TypeScript 5.x]
        Vite[Vite 6.x]
        TW[Tailwind CSS]
        Radix[Radix UI]
        RQ[React Query v5]
        RHF[React Hook Form]
        Zod[Zod Validation]
    end

    subgraph "PDF Libraries"
        PDFLIB[pdf-lib<br/>PDF manipulation]
        PDFJS[pdfjs-dist<br/>PDF rendering]
        RPV[@react-pdf-viewer<br/>PDF viewer UI]
    end

    subgraph "Backend - Supabase"
        SBAUTH[Supabase Auth<br/>JWT-based]
        SBDB[PostgreSQL<br/>Database]
        SBSTOR[Supabase Storage<br/>File storage]
        SBRT[Realtime<br/>WebSocket]
    end

    subgraph "Development Tools"
        ESL[ESLint]
        Prettier[Prettier]
        Git[Git]
    end

    React --> TS
    React --> TW
    React --> Radix
    React --> RQ
    React --> RHF
    RHF --> Zod

    React --> PDFLIB
    React --> PDFJS
    React --> RPV

    React --> SBAUTH
    React --> SBDB
    React --> SBSTOR
    React --> SBRT

    style React fill:#61dafb
    style SBDB fill:#3ecf8e
    style PDFLIB fill:#ff6b6b
```

## 13. Deployment & Environment

```mermaid
graph LR
    subgraph "Development"
        Dev[Local Dev Server<br/>Vite Dev Mode<br/>Port 5173]
        DevDB[Supabase Local<br/>Docker Containers]
    end

    subgraph "Production"
        Build[Production Build<br/>npm run build]
        Dist[Static Files<br/>dist/]
        Host[Hosting Platform<br/>Vercel/Netlify]
        ProdDB[Supabase Cloud<br/>Production Instance]
    end

    Dev --> DevDB
    Build --> Dist
    Dist --> Host
    Host --> ProdDB

    style Dev fill:#4CAF50
    style Build fill:#2196F3
    style Host fill:#FF9800
    style ProdDB fill:#9C27B0
```

---

## สรุป System Overview

### Core Features:
1. **Multi-role Document Management** - ธุรการ, ผู้บริหาร 3 ระดับ, ครู/พนักงาน
2. **Digital Signature Workflow** - ลงนามแบบต่อเนื่อง (Chain signing)
3. **PDF Processing** - สร้าง, รวม, แก้ไข PDF
4. **Realtime Updates** - อัปเดทสถานะแบบ real-time
5. **Role-based Access Control** - จำกัดสิทธิ์ตาม position
6. **File Storage** - จัดเก็บเอกสารและไฟล์แนบ

### Key Technologies:
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Storage + Auth + Realtime)
- **PDF**: pdf-lib + pdfjs-dist + @react-pdf-viewer
- **State Management**: React Query (TanStack Query)

### Document Flow Summary:
```
Create → Draft → Assign Number → Select Signers → Position Signatures
→ Pending Sign → Sign (ผช.ผอ) → Sign (รองผอ) → Sign (ผอ) → Approved
```
