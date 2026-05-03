const { Teacher, TEACHER_TYPES, EMPLOYMENT_TYPES, TEACHER_STATUSES } = require('../models/teacherModel');

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

function validateTeacherType(value) {
  if (!Object.values(TEACHER_TYPES).includes(value)) {
    throw createHttpError('Invalid teacher_type', 400);
  }
}

function validateEmploymentType(value) {
  if (!Object.values(EMPLOYMENT_TYPES).includes(value)) {
    throw createHttpError('Invalid employment_type', 400);
  }
}

function validateTeacherStatus(value) {
  if (!Object.values(TEACHER_STATUSES).includes(value)) {
    throw createHttpError('Invalid status', 400);
  }
}

const teacherController = {
  createTeacher: async (req, res, next) => {
    try {
      const full_name = String(req.body.full_name || '').trim();
      if (!full_name) {
        return next(createHttpError('full_name is required', 400));
      }

      const teacher_type = normalizeEnum(req.body.teacher_type);
      const employment_type = normalizeEnum(req.body.employment_type);
      const status = req.body.status ? normalizeEnum(req.body.status) : TEACHER_STATUSES.ACTIVE;

      validateTeacherType(teacher_type);
      validateEmploymentType(employment_type);
      validateTeacherStatus(status);

      const newTeacher = await Teacher.create({
        full_name,
        phone: req.body.phone || null,
        email: req.body.email || null,
        teacher_type,
        employment_type,
        status
      });

      res.status(201).json({ success: true, data: newTeacher });
    } catch (error) {
      next(error);
    }
  },

  getTeachers: async (req, res, next) => {
    try {
      const page = toPositiveInt(req.query.page, 1);
      const limit = Math.min(toPositiveInt(req.query.limit, 20), 100);
      const search = String(req.query.search || '').trim();
      const status = normalizeEnum(req.query.status || '');
      const teacher_type = normalizeEnum(req.query.teacher_type || '');

      if (status) validateTeacherStatus(status);
      if (teacher_type) validateTeacherType(teacher_type);

      const result = await Teacher.findAll({ page, limit, search, status, teacher_type });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },

  getTeacherById: async (req, res, next) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id <= 0) {
        return next(createHttpError('Invalid teacher id', 400));
      }

      const teacher = await Teacher.findById(id);
      if (!teacher) {
        return next(createHttpError('Teacher not found', 404));
      }

      res.status(200).json({ success: true, data: teacher });
    } catch (error) {
      next(error);
    }
  },

  updateTeacher: async (req, res, next) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id <= 0) {
        return next(createHttpError('Invalid teacher id', 400));
      }

      const payload = {};

      if (Object.prototype.hasOwnProperty.call(req.body, 'full_name')) {
        const full_name = String(req.body.full_name || '').trim();
        if (!full_name) {
          return next(createHttpError('full_name cannot be empty', 400));
        }
        payload.full_name = full_name;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'phone')) {
        payload.phone = req.body.phone || null;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'email')) {
        payload.email = req.body.email || null;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'teacher_type')) {
        const teacher_type = normalizeEnum(req.body.teacher_type);
        validateTeacherType(teacher_type);
        payload.teacher_type = teacher_type;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'employment_type')) {
        const employment_type = normalizeEnum(req.body.employment_type);
        validateEmploymentType(employment_type);
        payload.employment_type = employment_type;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'status')) {
        const status = normalizeEnum(req.body.status);
        validateTeacherStatus(status);
        payload.status = status;
      }

      const updated = await Teacher.update(id, payload);
      if (!updated) {
        return next(createHttpError('Teacher not found or no changes applied', 404));
      }

      const refreshed = await Teacher.findById(id);
      res.status(200).json({ success: true, data: refreshed });
    } catch (error) {
      if (error.message.includes('assigned classes')) {
        return next(createHttpError(error.message, 409));
      }
      next(error);
    }
  },

  deleteTeacher: async (req, res, next) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id <= 0) {
        return next(createHttpError('Invalid teacher id', 400));
      }

      const deleted = await Teacher.delete(id);
      if (!deleted) {
        return next(createHttpError('Teacher not found', 404));
      }

      res.status(200).json({ success: true, message: 'Teacher deleted successfully.' });
    } catch (error) {
      if (error.message.includes('assigned classes')) {
        return next(createHttpError(error.message, 409));
      }
      next(error);
    }
  }
};

module.exports = teacherController;
