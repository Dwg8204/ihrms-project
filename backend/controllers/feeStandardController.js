const FeeStandard = require('../models/feeStandardModel');

exports.createFeeStandard = async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.job_order_id === "" || data.job_order_id === "null") {
      data.job_order_id = null;
    }
    const newStandard = await FeeStandard.create(data);
    res.status(201).json({ success: true, data: newStandard, message: 'Fee standard created successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFeeStandards = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const { search, job_order_id, fee_category } = req.query;
    const standards = await FeeStandard.findAll({ page, limit, search, job_order_id, fee_category });
    res.status(200).json({ success: true, data: standards });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFeeStandardById = async (req, res) => {
  try {
    const standard = await FeeStandard.findById(req.params.id);
    if (!standard) {
      return res.status(404).json({ success: false, message: 'Fee standard not found.' });
    }
    res.status(200).json({ success: true, data: standard });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateFeeStandard = async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.job_order_id === "" || data.job_order_id === "null") {
      data.job_order_id = null;
    }
    const updated = await FeeStandard.update(req.params.id, data);
    res.status(200).json({ success: true, data: updated, message: 'Fee standard updated successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteFeeStandard = async (req, res) => {
  try {
    await FeeStandard.delete(req.params.id);
    res.status(200).json({ success: true, message: 'Fee standard deleted successfully.' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
