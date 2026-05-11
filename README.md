# He thong Quan ly Cung ung Nhan luc Quoc te (IHRMS)

He thong quan ly toan bo quy trinh tuyen dung, thi tuyen, ky hop dong, thu phi, xu ly ho so xuat canh, theo doi lao dong tai nuoc ngoai va bao cao van hanh theo thoi gian thuc.

## Tong quan chuc nang

### M1. Quan ly Tuyen dung va Nguon ung vien
- Tiep nhan va tao ho so ung vien, nhap thong tin co ban va upload CV.
- Gan nguon (source tracking) bat buoc de danh gia hieu qua kenh va tinh hoa hong.
- Quan ly phieu trang thai theo phieu: Moi tiep nhan -> Da nop phi dot 0 & giay to -> Cho ghep form -> Da ghep form cho thi -> Trung tuyen / Rot (tra ve kho).

### M2. Quan ly Doi tac va Don hang viec lam
- Danh muc doi tac (nghiep doan/cong ty tiep nhan), luu thong tin lien he va danh gia uy tin.
- Kho don hang (job orders): nganh nghe, so luong, luong, dieu kien, han chot.
- Matching co dieu kien: chi cho phep ghep ung vien da hoan thanh dot 0 va du 7 loai giay to bat buoc o M6.

### M3. Quan ly Thong tin Dao tao va Thi tuyen
- Danh sach thi tuyen theo ca thi (session) va don hang.
- Cap nhat ket qua thi: trung tuyen -> chuyen sang hop dong (M4); truot -> tra ve kho + thong bao xu ly hoan tien.
- Quan ly dao tao dinh huong: lich hoc, diem so dinh ky cho ung vien da trung tuyen.

### M4. Quan ly Hop dong va Cam ket dich vu
- Tao hop dong tu dong theo mau, tu dien thong tin ung vien va don hang.
- Luu tru ban scan hop dong da ky/dong dau.
- Quan ly trang thai hop dong: Cho ky, Da ky, Da thanh ly, Dang co tranh chap.

### M5. Quan ly Tai chinh va Phi dich vu
- Thu phi dot 0 (phi kham suc khoe, coc thi tuyen) la dieu kien tham gia thi.
- Thu cac dot phi sau khi trung tuyen va ky hop dong.
- Xu ly hoan tien/rut ho so, quan ly phieu chi hoan tien.
- Kiem soat cong no, chan thu tuc xuat canh neu chua dong du.

### M6. Quan ly Ho so va Thu tuc xuat canh
- Giai doan 1 (Tien thi tuyen - 7 giay to bat buoc):
  1) So yeu ly lich (ho so xin viec)
  2) Giay kham suc khoe dat chuan
  3) Giay xac nhan dan su cong an xa
  4) Giay xac nhan tinh trang hon nhan
  5) Bang tot nghiep cap cao nhat
  6) Khai sinh + xac nhan cu tru + CCCD photo cong chung
  7) Anh ho so dinh nhat
- Giai doan 2 (Hau thi tuyen): Visa, Ho chieu, COE.
- Luu tru va canh bao: canh bao giay kham suc khoe sap het han, tien do visa cham.

### M7. Quan ly Thong tin Lao dong tai nuoc ngoai
- Cap nhat ngay bay, noi lam viec, thong tin the ngoai kieu.
- Theo doi su co: tai nan, doi cho lam, bo tron va trang thai xu ly.
- Quan ly han hop dong, nhac viec gia han/thanh ly/dua ve nuoc.

### M8. Bao cao va MIS Dashboard
- Dashboard tuyen dung: hieu qua nguon, ty le rot o cac buoc, ty le dau don hang.
- Dashboard tai chinh: doanh thu, coc dang giu, cong no.
- Dashboard van hanh: canh bao tac nghen ho so, ty le su co theo doi tac.

### M9. Quan ly Dao tao (Giao vien, Lop hoc, Hoc vien)
- Quan ly danh muc giao vien (co huu/thinh giang), phan loai giao vien day Tieng hoac Nghe.
- Quan ly lop hoc theo loai (Tieng/Nghe), gan giao vien chu nhiem va theo doi trang thai lop.
- Quan ly si so: xep ung vien vao lop, cap nhat trang thai hoc, diem trung binh, ghi chu thai do.

## Diem da hoan thanh trong he thong hien tai
- Quan ly ung vien va phieu trang thai (M1) da hoan chinh.
- Nguon ung vien va thong ke theo nguon (M1).
- Quan ly doi tac va don hang (M2).
- Matching co dieu kien du 7 giay to (M2 + M6).
- M3 theo ca thi: danh sach, chi tiet, sua ca, cap nhat ket qua theo ca.
- Tao ca thi cho nhieu ung vien cung don hang trong mot thao tac.
- Ket qua thi tu dong cap nhat trang thai ung vien.
- Dashboard duoc toi uu theo chi so van hanh thuc te.
- Backend M9: CRUD giao vien, lop hoc, va xep lop ung vien; co rang buoc trung lap lop.

## Kien truc
- Frontend: React + Vite.
- Backend: Node.js (Express) + MySQL.
- Database: MySQL, co rang buoc unique cho CCCD va cac thuc the chinh.

## Cai dat va chay thu

### Yeu cau
- Node.js >= 18
- MySQL 8

### Backend
1) Cai dat phu thuoc
```
cd backend
npm install
```
2) Tao database va chay migration SQL (theo thu tu v1.0 -> v1.10)
3) Tao file .env
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=ihrms_db
PORT=5000
```
4) Chay server
```
npm run dev
```

5) Reset database + nap bo du lieu mau lien ket day du (khuyen dung khi moi pull code)
```
npm run reset:db
```

Lenh tren se xoa toan bo du lieu nghiep vu cu va nap lai dataset thuc te theo migration `v1.17_seed_realistic_dataset.sql`.

### Frontend
1) Cai dat phu thuoc
```
cd frontend
npm install
```
2) Chay ung dung
```
npm run dev
```

## Luong hoat dong tong quan
1) Tiep nhan ung vien, gan nguon, upload CV.
2) Hoan thanh 7 giay to bat buoc de du dieu kien ghep don.
3) Matching ung vien - don hang va lap ca thi.
4) Cap nhat ket qua thi va tu dong chuyen trang thai.
5) Neu trung tuyen: tao hop dong va thu phi cac dot.
6) Theo doi ho so xuat canh va thong tin lao dong tai nuoc ngoai.
7) Ban giam doc theo doi toan canh qua dashboard.

## Dong bo du lieu nhieu nguoi dung
- Tat ca may tinh dong bo qua backend va MySQL tap trung.
- Cac rang buoc unique tranh trung lap (CCCD, don thi, giay to ung vien).
- Trang thai va luong nghiep vu duoc kiem soat o backend.

## Tai lieu API
- Xem chi tiet API M9 (Giao vien, Lop hoc, Xep lop): [docs/M9_API.md](docs/M9_API.md)

## Ghi chu migration Mail module
- Bảng cho Mail module (email_templates, email_logs) da duoc bo sung o [backend/database/v1.10.sql](backend/database/v1.10.sql).
- Neu database da ton tai tu cac ban cu, chi can chay them file [backend/database/v1.10.sql](backend/database/v1.10.sql) de dong bo schema va template mac dinh.

## Huong phat trien tiep
- Audit log cho thay doi nhay cam.
- Khoa xung dot (optimistic locking) khi nhieu nguoi cap nhat cung luc.
- Idempotency key cho cac thao tac co nguy co double click.

## Ban quyen
Du an phuc vu muc dich hoc tap va do an mon hoc.