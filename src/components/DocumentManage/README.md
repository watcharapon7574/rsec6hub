# DocumentManage Components

This directory contains the refactored DocumentManagePage components, broken down into 4 separate step components for better organization and maintainability.

## Structure

```
src/components/DocumentManage/
├── index.ts                      # Export file for easy imports
├── Step1DocumentNumber.tsx      # Document number assignment step
├── Step2SelectSigners.tsx       # Signer selection step
├── Step3SignaturePositions.tsx  # Signature position placement step
└── Step4Review.tsx              # Final review and submission step
```

## Components Overview

### Step1DocumentNumber.tsx
**Purpose**: Document number assignment and PDF preview
- Document number input with auto-suggestion
- Document numbering functionality with database integration
- PDF preview display
- Attached files accordion
- Rejection functionality

**Props**:
- `documentNumber`: Current document number
- `suggestedDocNumber`: Auto-suggested next document number
- `docNumberSuffix`: User input for document suffix
- `isNumberAssigned`: Whether number has been assigned
- `isAssigningNumber`: Loading state for assignment
- `memo`: Memo data object
- `onDocNumberSuffixChange`: Handle suffix input changes
- `onAssignNumber`: Handle document number assignment
- `onNext`: Navigate to next step
- `onReject`: Handle document rejection
- `isRejecting`: Loading state for rejection
- `isStepComplete`: Whether step requirements are met

### Step2SelectSigners.tsx
**Purpose**: Select signers for the document workflow
- Assistant director selection (optional)
- Deputy director selection (optional)
- Display signer order and roles
- Navigation between steps

**Props**:
- `selectedAssistant`: Selected assistant director ID
- `selectedDeputy`: Selected deputy director ID
- `assistantDirectors`: Available assistant directors
- `deputyDirectors`: Available deputy directors
- `signers`: Final list of signers with order
- `onSelectedAssistantChange`: Handle assistant selection
- `onSelectedDeputyChange`: Handle deputy selection
- `onPrevious`: Navigate to previous step
- `onNext`: Navigate to next step
- `isStepComplete`: Whether step requirements are met

### Step3SignaturePositions.tsx
**Purpose**: Place signature positions on PDF pages
- Visual signer selection interface
- PDF viewer with signature positioning
- Document summary input
- Multiple signature positions per signer support
- Attached files display

**Props**:
- `signers`: List of signers
- `signaturePositions`: Current signature positions
- `comment`: Document summary comment
- `selectedSignerIndex`: Currently selected signer
- `memo`: Memo data object
- `onCommentChange`: Handle comment changes
- `onSelectedSignerIndexChange`: Handle signer selection
- `onPositionClick`: Handle PDF position clicks
- `onPositionRemove`: Handle position removal
- `onPrevious`: Navigate to previous step
- `onNext`: Navigate to next step
- `isStepComplete`: Whether step requirements are met

### Step4Review.tsx
**Purpose**: Final review and document submission
- Document information summary
- Signer list review
- Signature positions summary
- Final submission functionality

**Props**:
- `memo`: Memo data object
- `documentNumber`: Final document number
- `signers`: List of signers
- `signaturePositions`: All signature positions
- `onPositionRemove`: Handle position removal (final chance)
- `onPrevious`: Navigate to previous step
- `onSubmit`: Submit the document

## Key Features

### Document Numbering System
- Automatic document number suggestions based on latest entries
- Split UI design: `ศธ ๐๔๐๐๗.๖๐๐/` + input field
- PDF regeneration with document numbers
- Thai date formatting (Buddhist calendar)
- Database status tracking with JSONB

### Signature Workflow
- Flexible signer selection (can skip assistant/deputy directors)
- Multiple signature positions per person
- Visual PDF positioning interface
- Document summary for signer context

### Data Flow
1. **Step 1**: Assign document number → regenerate PDF
2. **Step 2**: Select workflow participants
3. **Step 3**: Place signature positions → save document summary
4. **Step 4**: Review and submit → start signature workflow

## Usage in DocumentManagePage

The main DocumentManagePage component imports and renders the appropriate step component based on `currentStep` state:

```tsx
import {
  Step1DocumentNumber,
  Step2SelectSigners,
  Step3SignaturePositions,
  Step4Review
} from '@/components/DocumentManage';

// In render:
{currentStep === 1 && (
  <Step1DocumentNumber
    documentNumber={documentNumber}
    // ... other props
  />
)}
```

## Benefits of This Structure

1. **Modularity**: Each step is self-contained
2. **Maintainability**: Easier to modify individual steps
3. **Reusability**: Components can be reused in other workflows
4. **Testing**: Easier to unit test individual steps
5. **Code Organization**: Cleaner separation of concerns
6. **Development**: Multiple developers can work on different steps

## Dependencies

Each component uses shared UI components:
- `@/components/ui/*` - Shadcn/ui components
- `@/components/OfficialDocuments/PDFViewer` - PDF viewing
- `@/components/OfficialDocuments/RejectionCard` - Rejection functionality
- `@/components/OfficialDocuments/Accordion` - File attachments

## API Integration

- **Step 1**: Supabase database for document numbering, PDF regeneration API
- **Step 3**: Document summary storage
- **Step 4**: Signature workflow initiation, PDF signing API

This refactoring maintains all original functionality while providing better code organization and developer experience.
