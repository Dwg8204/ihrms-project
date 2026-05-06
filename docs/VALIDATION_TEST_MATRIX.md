# Validation Test Matrix

## Scope
This file summarizes validation cases reviewed and tightened on May 7, 2026.

Covered areas:
- Candidate create/update
- Exam scheduling and exam session updates
- Teacher create/update
- Class create/update
- Job order create/update
- Partner and partner contact create/update

Note:
- No automated test suite was available for these flows.
- Validation was implemented in both frontend and backend where practical.
- The checklist below is intended for manual QA.

## Implemented Rules

### 1. Candidate validation
Files:
- frontend/src/pages/RecruitmentPage.jsx
- frontend/src/utils/validation.js
- backend/controllers/candidateController.js
- backend/utils/inputValidation.js

Rules:
- CCCD must be exactly 12 digits.
- Vietnamese phone number must be exactly 10 digits and start with `0`.
- Email must be valid if provided.
- Date of birth must be before today.
- Gender must be `Nam` or `Nữ` if provided.
- Height must be `> 0` and `<= 250` if provided.
- Weight must be `> 0` and `<= 300` if provided.
- Frontend sanitizes CCCD to 12 digits max.
- Frontend sanitizes phone to 10 digits max.

Manual test cases:
- Pass: CCCD `012345678901`
- Fail: CCCD `123`
- Fail: CCCD `1234567890123`
- Pass: Phone `0901234567`
- Fail: Phone `901234567`
- Fail: Phone `09012345678`
- Fail: Phone `abc090123`
- Pass: Email `user@example.com`
- Fail: Email `user@`
- Pass: DOB yesterday
- Fail: DOB today
- Fail: DOB future date
- Pass: Height `165`, Weight `55`
- Fail: Height `0`
- Fail: Height `251`
- Fail: Weight `0`
- Fail: Weight `301`

### 2. Exam scheduling validation
Files:
- frontend/src/pages/RecruitmentPage.jsx
- frontend/src/pages/Module3Page.jsx
- backend/controllers/examApplicationController.js
- backend/models/examApplicationModel.js
- backend/utils/inputValidation.js

Rules:
- `exam_date` must be a valid future datetime.
- Applies to:
  - create single exam application
  - update one exam schedule
  - update whole exam session
  - bulk create/update exam session
  - candidate workflow transition when matching to exam
- Frontend sets minimum datetime on exam inputs.

Manual test cases:
- Pass: Exam date 1 hour in the future
- Fail: Exam date equal to current minute
- Fail: Exam date 1 minute in the past
- Fail: Invalid datetime string
- Fail: Empty exam date

### 3. Teacher validation
Files:
- frontend/src/pages/Module9TrainingPage.jsx
- backend/controllers/teacherController.js
- backend/utils/inputValidation.js

Rules:
- Teacher name is required.
- Phone must be a valid Vietnamese 10-digit number if provided.
- Email must be valid if provided.
- Frontend sanitizes phone to 10 digits max.

Manual test cases:
- Pass: `Nguyen Van A`, phone `0901234567`
- Fail: empty name
- Fail: phone `123456789`
- Fail: phone `09012345678`
- Fail: email `teacher@`

### 4. Class validation
Files:
- frontend/src/pages/Module9TrainingPage.jsx
- backend/controllers/classController.js

Rules:
- Class name is required.
- Teacher is required.
- Start date is required when creating/updating through the form.
- Start date must be after today.
- End date must be on or after start date.

Manual test cases:
- Pass: start date tomorrow, end date tomorrow
- Pass: start date tomorrow, end date next week
- Fail: start date today
- Fail: start date yesterday
- Fail: end date before start date
- Fail: no teacher selected

### 5. Job order validation
Files:
- frontend/src/pages/PartnersJobsPage.jsx
- backend/models/jobOrderModel.js

Rules:
- Partner is required.
- Job title is required.
- Quantity must be a positive integer.
- Deadline is required and cannot be in the past.
- Age min/max must be non-negative.
- Age min cannot exceed age max.
- Experience min, height min, weight min must be non-negative.
- Gender matching now normalizes both `male/female` and `Nam/Nữ`.

Manual test cases:
- Pass: quantity `5`, deadline tomorrow
- Fail: quantity `0`
- Fail: deadline yesterday
- Fail: age min `30`, age max `20`
- Fail: experience `-1`
- Fail: height `-10`
- Fail: weight `-2`
- Pass: job gender `male` matches candidate gender `Nam`
- Pass: job gender `female` matches candidate gender `Nữ`

### 6. Partner and contact validation
Files:
- frontend/src/pages/PartnersJobsPage.jsx
- backend/controllers/partnerController.js
- backend/utils/inputValidation.js

Rules:
- Partner name is required.
- Contact name is required.
- Partner/contact phone must be valid Vietnamese 10-digit number if provided.
- Partner/contact email must be valid if provided.
- Frontend sanitizes phone fields to 10 digits max.

Manual test cases:
- Pass: partner phone `0901234567`
- Fail: partner phone `09012345678`
- Fail: partner email `partner@`
- Pass: contact phone `0987654321`
- Fail: contact email `abc`

## Suggested QA Order
1. Candidate create form in Recruitment module
2. Candidate edit form in Recruitment module
3. Match candidate to exam with past/future datetime
4. Bulk create exam session in Module 3
5. Edit exam session datetime in Module 3
6. Create teacher with invalid phone/email
7. Create class with invalid start/end dates
8. Create job order with invalid deadline and age range
9. Create partner/contact with invalid phone/email

## Remaining Risks / Not Fully Covered
- Database-level constraints are still mostly application-side rather than SQL CHECK constraints.
- Existing legacy data in DB may still contain old phone/email/gender values.
- No unit/integration test runner was added in this pass.
- Other modules may still have edge-case validation gaps not covered in this document.
