const JobOrder = require('../models/jobOrderModel');
const { isValidJobOrderStatus, JOB_ORDER_STATUSES } = require('../utils/jobOrderStatus');
const EducationLevel = require('../models/educationLevelModel');

exports.createJobOrder = async (req, res, next) => {
  try {
    const { partner_id, job_title, quantity_needed, salary_info, deadline, status } = req.body;
    let { requirements } = req.body

    if (!partner_id || !job_title || !quantity_needed || !deadline) {
      return res.status(400).json({ success: false, message: 'Partner ID, Job Title, Quantity Needed, and Deadline are required.' });
    }
    if (status && !isValidJobOrderStatus(status)) {
        return res.status(400).json({ success: false, message: 'Invalid job order status.' });
    }
    // --- LOGIC MỚI cho việc xác thực requirements.education_level ---
    if (requirements && requirements.education_level && Array.isArray(requirements.education_level)) {
        // Ensure education_level IDs are valid
        for (const levelId of requirements.education_level) {
            const level = await EducationLevel.findById(levelId);
            if (!level) {
                return res.status(400).json({ success: false, message: `Invalid education_level ID: ${levelId} in requirements.` });
            }
        }
    }
    // Kiểm tra cơ bản cấu trúc JSON của các yêu cầu
    if (requirements && typeof requirements !== 'object') {
        return res.status(400).json({ success: false, message: 'Requirements must be a valid JSON object.' });
    }

    const newJobOrder = await JobOrder.create({ partner_id, job_title, quantity_needed, salary_info, requirements, deadline, status });
    res.status(201).json({ success: true, data: newJobOrder });
  } catch (error) {
    if (error.message.includes('Partner not found') || error.message.includes('Cannot create job order')) {
        return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message.includes('Quantity needed must be a positive number') || error.message.includes('Deadline cannot be in the past')) {
        return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

exports.getJobOrders = async (req, res, next) => {
  try {
    const { page, limit, search, partner_id, status } = req.query;
    const jobOrders = await JobOrder.findAll(parseInt(page), parseInt(limit), search, partner_id, status);
    res.status(200).json({ success: true, ...jobOrders });
  } catch (error) {
    next(error);
  }
};

exports.getJobOrderById = async (req, res, next) => {
  try {
    const jobOrder = await JobOrder.findById(req.params.id);
    if (!jobOrder) {
      return res.status(404).json({ success: false, message: 'Job Order not found.' });
    }
    res.status(200).json({ success: true, data: jobOrder });
  } catch (error) {
    next(error);
  }
};

exports.updateJobOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { partner_id, job_title, quantity_needed, salary_info, deadline, status } = req.body;
    let { requirements } = req.body;

    // --- LOGIC MỚI cho việc xác thực requirements.education_level ---
    if (requirements && requirements.education_level && Array.isArray(requirements.education_level)) {
        for (const levelId of requirements.education_level) {
            const level = await EducationLevel.findById(levelId);
            if (!level) {
                return res.status(400).json({ success: false, message: `Invalid education_level ID: ${levelId} in requirements.` });
            }
        }
    }

    const currentJobOrder = await JobOrder.findById(id);
    if (!currentJobOrder) {
      return res.status(404).json({ success: false, message: 'Job Order not found.' });
    }

    // Kiểm tra cơ bản cấu trúc JSON của các yêu cầu
    if (requirements && typeof requirements !== 'object') {
        return res.status(400).json({ success: false, message: 'Requirements must be a valid JSON object.' });
    }
    if (status && !isValidJobOrderStatus(status)) {
        return res.status(400).json({ success: false, message: 'Invalid job order status.' });
    }

    const updatedJobOrder = await JobOrder.update(id, { partner_id, job_title, quantity_needed, salary_info, requirements, deadline, status });
    if (!updatedJobOrder) {
      return res.status(404).json({ success: false, message: 'Job Order not found.' });
    }
    res.status(200).json({ success: true, data: updatedJobOrder });
  } catch (error) {
    if (error.message.includes('Partner not found') || error.message.includes('Quantity needed must be a positive number') || error.message.includes('Deadline cannot be in the past') || error.message.includes('Cannot set quantity less than') || error.message.includes('Invalid education_level ID')) {
        return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message.includes('Invalid status transition')) {
        return res.status(409).json({ success: false, message: error.message });
    }
    next(error);
  }
};

exports.softDeleteJobOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const softDeleted = await JobOrder.softDelete(id);
    if (!softDeleted) {
      return res.status(404).json({ success: false, message: 'Job Order not found or already cancelled.' });
    }
    res.status(200).json({ success: true, message: 'Job Order cancelled successfully (soft deleted).' });
  } catch (error) {
    if (error.message.includes('Cannot cancel job order with linked')) {
      return res.status(409).json({ success: false, message: error.message });
    }
    next(error);
  }
};

exports.getMatchingCandidates = async (req, res, next) => {
  try {
    const { jobOrderId } = req.params;
    const { search, page, limit } = req.query;

    const result = await JobOrder.findMatchingCandidates(
      jobOrderId,
      search,
      parseInt(page) || 1,
      parseInt(limit) || 20
    );
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    if (error.message.includes('Job Order not found') || error.message.includes('Job Order is not open for matching')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// --- Bộ điều khiển mới để ghép nối thủ công ---
exports.manualMatchCandidateToJobOrder = async (req, res, next) => {
    try {
        const { jobOrderId } = req.params;
        const { candidate_id } = req.body;

        if (!candidate_id) {
            return res.status(400).json({ success: false, message: 'Candidate ID is required for manual matching.' });
        }

        const newExamApp = await JobOrder.manualMatchCandidate(parseInt(jobOrderId), parseInt(candidate_id));
        res.status(201).json({ success: true, data: newExamApp, message: 'Candidate manually matched and status updated.' });
    } catch (error) {
        if (error.message.includes('Candidate not found') || error.message.includes('Job Order not found') || error.message.includes('must be in WAITING_FORM_MATCH status') || error.message.includes('Job Order is not open for matching') || error.message.includes('Candidate has not paid Fee 0') || error.message.includes('Candidate is missing required PRE_EXAM documents')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        if (error.message.includes('already registered for an exam')) {
            return res.status(409).json({ success: false, message: error.message });
        }
        next(error);
    }
};