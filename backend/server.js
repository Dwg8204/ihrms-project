const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./config/db'); // Test kết nối DB

const app = express();

// Middlewares
app.use(cors());
app.use(express.json()); // Phân giải JSON từ request body
app.use(express.urlencoded({ extended: true }));

// Test Route cơ bản
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'Backend IHRMS đang chạy ổn định!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});