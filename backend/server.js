const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./config/db');

const candidateRoutes = require('./routes/candidateRoutes');
const recruitmentSourceRoutes = require('./routes/recruitmentSourceRoutes');
const documentRoutes = require('./routes/documentRoutes');
const partnerRoutes = require('./routes/partnerRoutes');
const jobOrderRoutes = require('./routes/jobOrderRoutes');
const examApplicationRoutes = require('./routes/examApplicationRoutes');
const contractRoutes = require('./routes/contractRoutes');
const educationLevelRoutes = require('./routes/educationLevelRoutes');
const emailRoutes = require('./routes/emailRoutes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const cron = require('node-cron');
const JobOrder = require('./models/jobOrderModel');
const { ensureEmailSchema } = require('./database/emailSchema');

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
app.use('/api/partners', partnerRoutes);
app.use('/api/job-orders', jobOrderRoutes);
app.use('/api/exam-applications', examApplicationRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/education-levels', educationLevelRoutes);
app.use('/api/emails', emailRoutes);

ensureEmailSchema().catch((error) => {
  console.error('Cannot initialize email schema:', error.message);
});

cron.schedule('0 0 * * *', async () => {
    console.log('Running daily cron job for job orders...');
    try {
        await JobOrder.updateExpiredJobOrders();
        await JobOrder.hardDeleteCancelledJobOrders(7); // Xóa vĩnh viễn các đơn hàng đã hủy quá 7 ngày.
    } catch (error) {
        console.error('Error during daily cron job:', error);
    }
});

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});