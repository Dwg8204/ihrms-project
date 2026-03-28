const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./config/db');

const candidateRoutes = require('./routes/candidateRoutes');
const recruitmentSourceRoutes = require('./routes/recruitmentSourceRoutes');
const documentRoutes = require('./routes/documentRoutes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Backend IHRMS is running'
  });
});

app.use('/api/candidates', candidateRoutes);
app.use('/api/recruitment-sources', recruitmentSourceRoutes);
app.use('/api', documentRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});