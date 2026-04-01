const EducationLevel = require('../models/educationLevelModel');

exports.createEducationLevel = async (req, res, next) => {
    try {
        const { name, description, display_order } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: 'Education level name is required.' });
        }
        const newLevel = await EducationLevel.create({ name, description, display_order });
        res.status(201).json({ success: true, data: newLevel, message: 'Education level created successfully.' });
    } catch (error) {
        if (error.message.includes('Education level name already exists')) {
            return res.status(409).json({ success: false, message: error.message });
        }
        next(error);
    }
};

exports.getEducationLevels = async (req, res, next) => {
    try {
        const { page, limit, search } = req.query;
        const levels = await EducationLevel.findAll({ page: parseInt(page), limit: parseInt(limit), search });
        res.status(200).json({ success: true, ...levels });
    } catch (error) {
        next(error);
    }
};

exports.getEducationLevelById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const level = await EducationLevel.findById(id);
        if (!level) {
            return res.status(404).json({ success: false, message: 'Education level not found.' });
        }
        res.status(200).json({ success: true, data: level });
    } catch (error) {
        next(error);
    }
};

exports.updateEducationLevel = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, display_order } = req.body;
        const updated = await EducationLevel.update(id, { name, description, display_order });
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Education level not found.' });
        }
        res.status(200).json({ success: true, message: 'Education level updated successfully.' });
    } catch (error) {
        if (error.message.includes('Education level name already exists')) {
            return res.status(409).json({ success: false, message: error.message });
        }
        next(error);
    }
};

exports.deleteEducationLevel = async (req, res, next) => {
    try {
        const { id } = req.params;
        const deleted = await EducationLevel.delete(id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Education level not found.' });
        }
        res.status(200).json({ success: true, message: 'Education level deleted successfully.' });
    } catch (error) {
        if (error.message.includes('linked to existing candidates')) {
            return res.status(409).json({ success: false, message: error.message });
        }
        next(error);
    }
};