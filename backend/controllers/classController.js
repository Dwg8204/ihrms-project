const { ClassModel, CLASS_TYPES, CLASS_STATUSES } = require('../models/classModel');
const { Teacher } = require('../models/teacherModel');

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

function validateClassType(value) {
  if (!Object.values(CLASS_TYPES).includes(value)) {
    throw createHttpError('Invalid class_type', 400);
  }
}

function validateClassStatus(value) {
  if (!Object.values(CLASS_STATUSES).includes(value)) {
    throw createHttpError('Invalid status', 400);
  }
}

function normalizeDateOnly(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function validateStartDateAfterToday(value) {
  const startDate = normalizeDateOnly(value);
  if (!startDate) {
    throw createHttpError('start_date is required and must be a valid date', 400);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (startDate <= today) {
    throw createHttpError('start_date must be after today', 400);
  }
}

function validateEndDateNotBeforeStart(startValue, endValue) {
  if (!endValue) return;

  const endDate = normalizeDateOnly(endValue);
  if (!endDate) {
    throw createHttpError('end_date must be a valid date', 400);
  }

  const startDate = normalizeDateOnly(startValue);
  if (startDate && endDate < startDate) {
    throw createHttpError('end_date must be on or after start_date', 400);
  }
}

async function validateTeacher(teacherId, classType) {
  const teacher = await Teacher.findById(teacherId);
  if (!teacher) {
    throw createHttpError('Teacher not found', 404);
  }

  if (classType && teacher.teacher_type !== classType) {
    throw createHttpError('Teacher type does not match class_type', 409);
  }

  return teacher;
}

const classController = {
  createClass: async (req, res, next) => {
    try {
      const class_name = String(req.body.class_name || '').trim();
      if (!class_name) {
        return next(createHttpError('class_name is required', 400));
      }

      const class_type = normalizeEnum(req.body.class_type);
      const teacher_id = Number.parseInt(req.body.teacher_id, 10);
      const status = req.body.status ? normalizeEnum(req.body.status) : CLASS_STATUSES.PENDING;

      validateClassType(class_type);
      validateClassStatus(status);

      validateStartDateAfterToday(req.body.start_date);
      validateEndDateNotBeforeStart(req.body.start_date, req.body.end_date);

      if (Number.isNaN(teacher_id) || teacher_id <= 0) {
        return next(createHttpError('teacher_id is required and must be a positive integer', 400));
      }

      await validateTeacher(teacher_id, class_type);

      const newClass = await ClassModel.create({
        class_name,
        class_type,
        teacher_id,
        room: req.body.room || null,
        start_date: req.body.start_date || null,
        end_date: req.body.end_date || null,
        status
      });

      const refreshed = await ClassModel.findById(newClass.id);
      res.status(201).json({ success: true, data: refreshed });
    } catch (error) {
      next(error);
    }
  },

  getClasses: async (req, res, next) => {
    try {
      const page = toPositiveInt(req.query.page, 1);
      const limit = Math.min(toPositiveInt(req.query.limit, 20), 100);
      const search = String(req.query.search || '').trim();
      const status = normalizeEnum(req.query.status || '');
      const class_type = normalizeEnum(req.query.class_type || '');
      const teacher_id = req.query.teacher_id ? Number.parseInt(req.query.teacher_id, 10) : null;

      if (status) validateClassStatus(status);
      if (class_type) validateClassType(class_type);

      if (req.query.teacher_id && (Number.isNaN(teacher_id) || teacher_id <= 0)) {
        return next(createHttpError('Invalid teacher_id filter', 400));
      }

      const result = await ClassModel.findAll({
        page,
        limit,
        search,
        status,
        class_type,
        teacher_id
      });

      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },

  getClassById: async (req, res, next) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id <= 0) {
        return next(createHttpError('Invalid class id', 400));
      }

      const classDetail = await ClassModel.findById(id);
      if (!classDetail) {
        return next(createHttpError('Class not found', 404));
      }

      res.status(200).json({ success: true, data: classDetail });
    } catch (error) {
      next(error);
    }
  },

  updateClass: async (req, res, next) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id <= 0) {
        return next(createHttpError('Invalid class id', 400));
      }

      const payload = {};
      const currentClass = await ClassModel.findById(id);
      if (!currentClass) {
        return next(createHttpError('Class not found', 404));
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'class_name')) {
        const class_name = String(req.body.class_name || '').trim();
        if (!class_name) {
          return next(createHttpError('class_name cannot be empty', 400));
        }
        payload.class_name = class_name;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'class_type')) {
        const class_type = normalizeEnum(req.body.class_type);
        validateClassType(class_type);
        payload.class_type = class_type;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'teacher_id')) {
        const teacher_id = Number.parseInt(req.body.teacher_id, 10);
        if (Number.isNaN(teacher_id) || teacher_id <= 0) {
          return next(createHttpError('teacher_id must be a positive integer', 400));
        }
        payload.teacher_id = teacher_id;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'room')) {
        payload.room = req.body.room || null;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'start_date')) {
        // Bỏ qua kiểm tra validateStartDateAfterToday khi cập nhật lớp học 
        // để cho phép giữ ngày cũ hoặc cập nhật cho các lớp đã khai giảng.
        payload.start_date = req.body.start_date || null;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'end_date')) {
        payload.end_date = req.body.end_date || null;
      }

      const nextStartDate = Object.prototype.hasOwnProperty.call(payload, 'start_date')
        ? payload.start_date
        : currentClass.start_date;
      const nextEndDate = Object.prototype.hasOwnProperty.call(payload, 'end_date')
        ? payload.end_date
        : currentClass.end_date;
      validateEndDateNotBeforeStart(nextStartDate, nextEndDate);

      if (Object.prototype.hasOwnProperty.call(req.body, 'status')) {
        const status = normalizeEnum(req.body.status);
        validateClassStatus(status);
        payload.status = status;
      }

      if (payload.teacher_id || payload.class_type) {
        const nextClassType = payload.class_type || currentClass.class_type;
        const nextTeacherId = payload.teacher_id || currentClass.teacher_id;
        await validateTeacher(nextTeacherId, nextClassType);
      }

      const updated = await ClassModel.update(id, payload);
      if (!updated) {
        return next(createHttpError('Class not found or no changes applied', 404));
      }

      const refreshed = await ClassModel.findById(id);
      res.status(200).json({ success: true, data: refreshed });
    } catch (error) {
      next(error);
    }
  },

  deleteClass: async (req, res, next) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id <= 0) {
        return next(createHttpError('Invalid class id', 400));
      }

      const deleted = await ClassModel.delete(id);
      if (!deleted) {
        return next(createHttpError('Class not found', 404));
      }

      res.status(200).json({ success: true, message: 'Class deleted successfully.' });
    } catch (error) {
      if (error.message.includes('enrolled students')) {
        return next(createHttpError(error.message, 409));
      }
      next(error);
    }
  }
};

module.exports = classController;
