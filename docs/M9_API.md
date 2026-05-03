# M9 API Docs - Giao vien, Lop hoc, Xep lop

Tai lieu nay mo ta cac API backend cho module M9, kem ghi chu ve nhung phan da lam va nhung dieu chinh so voi mo ta goc.

## Phan da lam duoc
- CRUD giao vien (teachers).
- CRUD lop hoc (classes).
- Xep ung vien vao lop (class_students): them, danh sach, cap nhat, xoa.
- Phan trang + tim kiem co ban.
- Rang buoc trung lap ung vien trong lop (unique class_id + candidate_id).

## Dieu chinh so voi yeu cau goc
- Su dung VARCHAR cho cac truong trang thai/type thay vi ENUM de giam rui ro thay doi gia tri sau nay (van validate o backend).
- Kiem tra teacher_type phai trung class_type khi gan giao vien cho lop.
- Khong cho them hoc vien vao lop da COMPLETED.
- Khong cho xoa giao vien neu con lop dang gan, khong cho xoa lop neu con hoc vien.

## Base URL
- Backend mac dinh: http://localhost:5000
- Base API: /api

## Danh muc gia tri (validate o backend)
- teacher_type: LANGUAGE | SKILL
- employment_type: FULL_TIME | VISITING
- teacher status: ACTIVE | INACTIVE
- class_type: LANGUAGE | SKILL
- class status: PENDING | IN_PROGRESS | COMPLETED
- class_students status: STUDYING | DROPPED | GRADUATED

## 1) Giao vien (teachers)

### Tao giao vien
POST /api/teachers

Body (JSON):
{
  "full_name": "Nguyen Van A",
  "phone": "0900000000",
  "email": "a@example.com",
  "teacher_type": "LANGUAGE",
  "employment_type": "FULL_TIME",
  "status": "ACTIVE"
}

### Danh sach giao vien
GET /api/teachers?page=1&limit=20&search=&status=ACTIVE&teacher_type=LANGUAGE

### Chi tiet giao vien
GET /api/teachers/:id

### Cap nhat giao vien
PATCH /api/teachers/:id

Body (JSON) - cac truong optional:
{
  "full_name": "Nguyen Van A",
  "phone": "0900000001",
  "status": "INACTIVE"
}

### Xoa giao vien
DELETE /api/teachers/:id

Luu y: khong the xoa neu giao vien con dang gan vao lop hoc.

## 2) Lop hoc (classes)

### Tao lop hoc
POST /api/classes

Body (JSON):
{
  "class_name": "Lop Tieng Nhat K15 - Co ban",
  "class_type": "LANGUAGE",
  "teacher_id": 1,
  "room": "Phong 302",
  "start_date": "2026-05-10",
  "end_date": "2026-08-10",
  "status": "PENDING"
}

### Danh sach lop hoc
GET /api/classes?page=1&limit=20&search=&status=IN_PROGRESS&class_type=LANGUAGE&teacher_id=1

### Chi tiet lop hoc
GET /api/classes/:id

### Cap nhat lop hoc
PATCH /api/classes/:id

Body (JSON) - cac truong optional:
{
  "class_name": "Lop Tieng Nhat K15 - Nang cao",
  "status": "IN_PROGRESS",
  "room": "Phong 401"
}

### Xoa lop hoc
DELETE /api/classes/:id

Luu y: khong the xoa neu lop con hoc vien.

## 3) Xep lop (class_students)

### Them ung vien vao lop
POST /api/classes/:id/students

Body (JSON):
{
  "candidate_id": 10,
  "enroll_date": "2026-05-12",
  "status": "STUDYING",
  "average_score": 7.8,
  "attitude_note": "Hoc cham chi"
}

Luu y: khong the them hoc vien vao lop da COMPLETED, va khong the them trung ung vien trong cung 1 lop.

### Danh sach hoc vien theo lop
GET /api/classes/:id/students?page=1&limit=50&search=

### Cap nhat thong tin hoc vien trong lop
PATCH /api/classes/:id/students/:classStudentId

Body (JSON) - cac truong optional:
{
  "status": "GRADUATED",
  "average_score": 8.5,
  "attitude_note": "Tien bo ro"
}

### Xoa hoc vien khoi lop
DELETE /api/classes/:id/students/:classStudentId

## Ghi chu ve database (migration)
- Them file migration: backend/database/v1.8.sql
- Tao 3 bang: teachers, classes, class_students
- Rang buoc unique: class_students(class_id, candidate_id)
