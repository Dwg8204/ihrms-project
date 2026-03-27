const Candidate = require('../models/candidateModel');
const RecruitmentSource = require('../models/recruitmentSourceModel');
const {
  CANDIDATE_STATUSES,
  STATUS_ORDER,
  isValidStatus,
  canTransition
} = require('../utils/candidateStatus');

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

function toNullableInt(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? NaN : parsed;
}

function toNullableFloat(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? NaN : parsed;
}

function pickField(body, snakeKey, camelKey) {
  if (Object.prototype.hasOwnProperty.call(body, snakeKey)) {
    return body[snakeKey];
  }
  if (Object.prototype.hasOwnProperty.call(body, camelKey)) {
    return body[camelKey];
  }
  return undefined;
}

function normalizeCandidatePayload(body) {
  const sourceIdRaw = pickField(body, 'source_id', 'sourceId');
  const heightRaw = pickField(body, 'height', 'height');
  const weightRaw = pickField(body, 'weight', 'weight');

  return {
    full_name: pickField(body, 'full_name', 'fullName'),
    dob: pickField(body, 'dob', 'dob'),
    gender: pickField(body, 'gender', 'gender'),
    phone: pickField(body, 'phone', 'phone'),
    email: pickField(body, 'email', 'email'),
    address: pickField(body, 'address', 'address'),
    height: toNullableFloat(heightRaw),
    weight: toNullableFloat(weightRaw),
    blood_type: pickField(body, 'blood_type', 'bloodType'),
    education_level: pickField(body, 'education_level', 'educationLevel'),
    source_id: toNullableInt(sourceIdRaw),
    status: pickField(body, 'status', 'status'),
    cv_file_url: pickField(body, 'cv_file_url', 'cvFileUrl')
  };
}

function hasAnyEditableField(payload) {
  return Object.values(payload).some((value) => value !== undefined);
}

const candidateController = {
  getAllCandidates: async (req, res, next) => {
    try {
      const page = toPositiveInt(req.query.page, 1);
      const limit = Math.min(toPositiveInt(req.query.limit, 20), 100);
      const search = String(req.query.search || '').trim();
      const status = String(req.query.status || '').trim();
      const source_id = req.query.source_id ? Number.parseInt(req.query.source_id, 10) : null;

      if (status && !isValidStatus(status)) {
        return next(createHttpError('Invalid status filter', 400));
      }

      if (req.query.source_id && (Number.isNaN(source_id) || source_id <= 0)) {
        return next(createHttpError('Invalid source_id filter', 400));
      }

      const result = await Candidate.getAll({ page, limit, search, status, source_id });

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  },

  getCandidateById: async (req, res, next) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id <= 0) {
        return next(createHttpError('Invalid candidate id', 400));
      }

      const candidate = await Candidate.getById(id);
      if (!candidate) {
        return next(createHttpError('Candidate not found', 404));
      }

      res.status(200).json({ success: true, data: candidate });
    } catch (error) {
      next(error);
    }
  },

  createCandidate: async (req, res, next) => {
    try {
      const payload = normalizeCandidatePayload(req.body);

      if (!payload.full_name || !String(payload.full_name).trim()) {
        return next(createHttpError('full_name is required', 400));
      }

      payload.full_name = String(payload.full_name).trim();

      if (payload.status === undefined || payload.status === null || payload.status === '') {
        payload.status = CANDIDATE_STATUSES.RECEIVED;
      }

      if (!isValidStatus(payload.status)) {
        return next(createHttpError('Invalid candidate status', 400));
      }

      if (Number.isNaN(payload.source_id) || (payload.source_id !== null && payload.source_id <= 0)) {
        return next(createHttpError('Invalid source_id', 400));
      }

      if (payload.source_id) {
        const source = await RecruitmentSource.getById(payload.source_id);
        if (!source) {
          return next(createHttpError('source_id does not exist', 400));
        }
      }

      if (Number.isNaN(payload.height)) {
        return next(createHttpError('Invalid height', 400));
      }

      if (Number.isNaN(payload.weight)) {
        return next(createHttpError('Invalid weight', 400));
      }

      if (req.file) {
        payload.cv_file_url = req.file.path || req.file.secure_url || null;
      }

      const newId = await Candidate.create(payload);
      const created = await Candidate.getById(newId);

      res.status(201).json({
        success: true,
        message: 'Candidate created successfully',
        data: created
      });
    } catch (error) {
      next(error);
    }
  },

  updateCandidate: async (req, res, next) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id <= 0) {
        return next(createHttpError('Invalid candidate id', 400));
      }

      const existing = await Candidate.getById(id);
      if (!existing) {
        return next(createHttpError('Candidate not found', 404));
      }

      const payload = normalizeCandidatePayload(req.body);

      if (Object.prototype.hasOwnProperty.call(req.body, 'status')) {
        return next(createHttpError('Use /:id/status endpoint to update status', 400));
      }

      if (payload.full_name !== undefined && !String(payload.full_name).trim()) {
        return next(createHttpError('full_name cannot be empty', 400));
      }

      if (payload.full_name !== undefined) {
        payload.full_name = String(payload.full_name).trim();
      }

      if (Number.isNaN(payload.source_id) || (payload.source_id !== null && payload.source_id <= 0)) {
        return next(createHttpError('Invalid source_id', 400));
      }

      if (payload.source_id) {
        const source = await RecruitmentSource.getById(payload.source_id);
        if (!source) {
          return next(createHttpError('source_id does not exist', 400));
        }
      }

      if (Number.isNaN(payload.height)) {
        return next(createHttpError('Invalid height', 400));
      }

      if (Number.isNaN(payload.weight)) {
        return next(createHttpError('Invalid weight', 400));
      }

      if (req.file) {
        payload.cv_file_url = req.file.path || req.file.secure_url || null;
      }

      if (!hasAnyEditableField(payload)) {
        return next(createHttpError('No valid field to update', 400));
      }

      await Candidate.update(id, payload);
      const updated = await Candidate.getById(id);

      res.status(200).json({
        success: true,
        message: 'Candidate updated successfully',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  },

  updateCandidateStatus: async (req, res, next) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id <= 0) {
        return next(createHttpError('Invalid candidate id', 400));
      }

      const nextStatus = String(req.body.status || '').trim();
      if (!isValidStatus(nextStatus)) {
        return next(createHttpError('Invalid status', 400));
      }

      const candidate = await Candidate.getById(id);
      if (!candidate) {
        return next(createHttpError('Candidate not found', 404));
      }

      if (!canTransition(candidate.status, nextStatus)) {
        return next(createHttpError('Status transition is not allowed', 409));
      }

      await Candidate.updateStatus(id, nextStatus);
      const updated = await Candidate.getById(id);

      res.status(200).json({
        success: true,
        message: 'Candidate status updated successfully',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  },

  deleteCandidate: async (req, res, next) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id <= 0) {
        return next(createHttpError('Invalid candidate id', 400));
      }

      const existing = await Candidate.getById(id);
      if (!existing) {
        return next(createHttpError('Candidate not found', 404));
      }

      await Candidate.deleteById(id);

      res.status(200).json({
        success: true,
        message: 'Candidate deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  getKanbanBoard: async (req, res, next) => {
    try {
      const limitPerStatus = Math.min(toPositiveInt(req.query.limit_per_status, 30), 200);
      const source_id = req.query.source_id ? Number.parseInt(req.query.source_id, 10) : null;

      if (req.query.source_id && (Number.isNaN(source_id) || source_id <= 0)) {
        return next(createHttpError('Invalid source_id filter', 400));
      }

      const rows = await Candidate.getKanbanBoard({ source_id, limitPerStatus });

      const data = STATUS_ORDER.map((status) => ({
        status,
        items: rows.filter((row) => row.status === status)
      }));

      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  },

  getFunnelSummary: async (req, res, next) => {
    try {
      const from_date = String(req.query.from_date || '1970-01-01').trim();
      const to_date = String(req.query.to_date || '2099-12-31').trim();

      const summary = await Candidate.getFunnelSummary({ from_date, to_date });

      res.status(200).json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = candidateController;