const { ClassModel, CLASS_STATUSES } = require('../models/classModel');
const { ClassStudentModel, CLASS_STUDENT_STATUSES } = require('../models/classStudentModel');
const Candidate = require('../models/candidateModel');

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function normalizeEnum(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim().toUpperCase();
}

function validateStudentStatus(value) {
  if (!Object.values(CLASS_STUDENT_STATUSES).includes(value)) {
    throw createHttpError('Invalid class student status', 400);
  }
}

const classStudentController = {
  addStudent: async (req, res, next) => {
    try {
      const class_id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(class_id) || class_id <= 0) {
        return next(createHttpError('Invalid class id', 400));
      }

      const candidate_id = Number.parseInt(req.body.candidate_id, 10);
      if (Number.isNaN(candidate_id) || candidate_id <= 0) {
        return next(createHttpError('candidate_id is required and must be a positive integer', 400));
      }

      const classDetail = await ClassModel.findById(class_id);
      if (!classDetail) {
        return next(createHttpError('Class not found', 404));
      }

      if (classDetail.status === CLASS_STATUSES.COMPLETED) {
        return next(createHttpError('Cannot enroll students into a completed class', 409));
      }

      const candidate = await Candidate.getById(candidate_id);
      if (!candidate) {
        return next(createHttpError('Candidate not found', 404));
      }

      const status = req.body.status ? normalizeEnum(req.body.status) : CLASS_STUDENT_STATUSES.STUDYING;
      validateStudentStatus(status);

      const payload = {
        class_id,
        candidate_id,
        enroll_date: req.body.enroll_date || null,
        status,
        attitude_note: req.body.attitude_note || null
      };

      const created = await ClassStudentModel.addStudent(payload);
      res.status(201).json({ success: true, data: created });
    } catch (error) {
      if (error.message.includes('Duplicate entry')) {
        return next(createHttpError('Candidate already enrolled in this class', 409));
      }
      next(error);
    }
  },

  getClassStudents: async (req, res, next) => {
    try {
      const class_id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(class_id) || class_id <= 0) {
        return next(createHttpError('Invalid class id', 400));
      }

      const page = toPositiveInt(req.query.page, 1);
      const limit = Math.min(toPositiveInt(req.query.limit, 50), 200);
      const search = String(req.query.search || '').trim();

      const classDetail = await ClassModel.findById(class_id);
      if (!classDetail) {
        return next(createHttpError('Class not found', 404));
      }

      const result = await ClassStudentModel.findByClassId({
        class_id,
        page,
        limit,
        search
      });

      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },

  updateClassStudent: async (req, res, next) => {
    try {
      const class_id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(class_id) || class_id <= 0) {
        return next(createHttpError('Invalid class id', 400));
      }

      const classStudentId = Number.parseInt(req.params.classStudentId, 10);
      if (Number.isNaN(classStudentId) || classStudentId <= 0) {
        return next(createHttpError('Invalid class student id', 400));
      }

      const existing = await ClassStudentModel.findById(classStudentId);
      if (!existing || Number(existing.class_id) !== Number(class_id)) {
        return next(createHttpError('Class student not found for this class', 404));
      }

      const payload = {};

      if (Object.prototype.hasOwnProperty.call(req.body, 'enroll_date')) {
        payload.enroll_date = req.body.enroll_date || null;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'status')) {
        const status = normalizeEnum(req.body.status);
        validateStudentStatus(status);
        payload.status = status;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'attitude_note')) {
        payload.attitude_note = req.body.attitude_note || null;
      }

      const updated = await ClassStudentModel.update(classStudentId, payload);
      if (!updated) {
        return next(createHttpError('Class student not found or no changes applied', 404));
      }

      const refreshed = await ClassStudentModel.findById(classStudentId);
      res.status(200).json({ success: true, data: refreshed });
    } catch (error) {
      next(error);
    }
  },

  deleteClassStudent: async (req, res, next) => {
    try {
      const class_id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(class_id) || class_id <= 0) {
        return next(createHttpError('Invalid class id', 400));
      }

      const classStudentId = Number.parseInt(req.params.classStudentId, 10);
      if (Number.isNaN(classStudentId) || classStudentId <= 0) {
        return next(createHttpError('Invalid class student id', 400));
      }

      const existing = await ClassStudentModel.findById(classStudentId);
      if (!existing || Number(existing.class_id) !== Number(class_id)) {
        return next(createHttpError('Class student not found for this class', 404));
      }

      const deleted = await ClassStudentModel.delete(classStudentId);
      if (!deleted) {
        return next(createHttpError('Class student not found', 404));
      }

      res.status(200).json({ success: true, message: 'Class student removed successfully.' });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = classStudentController;
