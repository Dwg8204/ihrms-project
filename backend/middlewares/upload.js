const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// const storage = new CloudinaryStorage({
//   cloudinary,
//   params: {
//     folder: 'ihrms_cvs',
//     allowed_formats: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
//     resource_type: 'auto'
//   }
// });

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png'
]);

const fileFilter = (req, file, cb) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    return cb(new Error('Invalid file type. Allowed: pdf, doc, docx, jpg, jpeg, png'));
  }
  cb(null, true);
};

// Tạo một hàm factory để cấu hình multer với thư mục động.
const createCloudinaryUploader = (folderName) => {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: folderName, // Thư mục động
      resource_type: 'auto'
    }
  });

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
  });
};

// const upload = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 5 * 1024 * 1024 }
// });

// Xuất trình tải lên cụ thể
const uploadCvs = createCloudinaryUploader('ihrms_cvs');
const uploadContracts = createCloudinaryUploader('ihrms_contracts');
const uploadTemplates = createCloudinaryUploader('ihrms_contract_templates'); // Thư mục mới dành cho các mẫu

// module.exports = upload;
module.exports = {
  uploadCvs,
  uploadContracts,
  uploadTemplates
};