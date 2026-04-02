const Candidate = require('../models/candidateModel');
const RecruitmentSource = require('../models/recruitmentSourceModel');
const DocumentModel = require('../models/documentModel');
const EducationLevel = require('../models/educationLevelModel');

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

function toNullableBoolean(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value === 'boolean') return value ? 1 : 0;

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return 1;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return 0;
  return NaN;
}

function normalizeCitizenId(value) {
  if (value === undefined) return undefined;
  if (value === null) return '';
  return String(value).trim();
}

function isValidCitizenId(value) {
  return /^\d{12}$/.test(String(value || ''));
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
  return {
    citizen_id: normalizeCitizenId(
      pickField(body, 'citizen_id', 'citizenId') ?? pickField(body, 'cccd', 'cccd')
    ),
    full_name: pickField(body, 'full_name', 'fullName'),
    dob: pickField(body, 'dob', 'dob'),
    gender: pickField(body, 'gender', 'gender'),
    phone: pickField(body, 'phone', 'phone'),
    email: pickField(body, 'email', 'email'),
    address: pickField(body, 'address', 'address'),
    height: toNullableFloat(pickField(body, 'height', 'height')),
    weight: toNullableFloat(pickField(body, 'weight', 'weight')),
    blood_type: pickField(body, 'blood_type', 'bloodType'),
    education_level: toNullableInt(pickField(body, 'education_level', 'educationLevel')),
    experience_summary: pickField(body, 'experience_summary', 'experienceSummary'),
    source_id: toNullableInt(pickField(body, 'source_id', 'sourceId')),
    source_note: pickField(body, 'source_note', 'sourceNote'),
    status: pickField(body, 'status', 'status'),
    is_fee0_paid: toNullableBoolean(pickField(body, 'is_fee0_paid', 'isFee0Paid')),
    fee0_paid_amount: toNullableFloat(pickField(body, 'fee0_paid_amount', 'fee0PaidAmount')),
    fee0_paid_at: pickField(body, 'fee0_paid_at', 'fee0PaidAt'),
    cv_file_url: pickField(body, 'cv_file_url', 'cvFileUrl')
  };
}

function hasAnyEditableField(payload) {
  return Object.values(payload).some((value) => value !== undefined);
}

async function validateSourceMandatory(sourceId) {
  if (sourceId === undefined || sourceId === null || Number.isNaN(sourceId) || sourceId <= 0) {
    throw createHttpError('source_id is required and must be a positive integer', 400);
  }

  const source = await RecruitmentSource.getById(sourceId);
  if (!source) {
    throw createHttpError('source_id does not exist', 400);
  }
}

async function validateEducationLevelOptional(levelId) {
  if (levelId === undefined || levelId === null) return;
  if (Number.isNaN(levelId) || levelId <= 0) {
    throw createHttpError('education_level must be a positive integer or null', 400);
  }

  const level = await EducationLevel.findById(levelId);
  if (!level) {
    throw createHttpError('education_level does not exist', 400);
  }
}

function validateCitizenIdRequired(citizenId) {
  if (!citizenId || !isValidCitizenId(citizenId)) {
    throw createHttpError('citizen_id is required and must be exactly 12 digits', 400);
  }
}

async function validateCitizenIdUnique(citizenId, excludeCandidateId = null) {
  const existing = await Candidate.getByCitizenId(citizenId);
  if (!existing) return;

  if (excludeCandidateId && Number(existing.id) === Number(excludeCandidateId)) {
    return;
  }

  throw createHttpError('citizen_id already exists', 409);
}

async function validatePreExamGate(candidate, nextStatus) {
  const readiness = await DocumentModel.getPreExamReadiness(candidate.id);
  if (nextStatus === CANDIDATE_STATUSES.PAID0_DOCS_SUBMITTED) {
    if (!readiness.can_submit_profile) {
      const error = createHttpError('Cannot move status: required pre-exam documents are not submitted', 409);
      error.details = readiness;
      throw error;
    }
    return;
  }

  if (!readiness.can_proceed_verified) {
    const error = createHttpError('Cannot move status: required pre-exam documents are not verified', 409);
    error.details = readiness;
    throw error;
  }
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

      validateCitizenIdRequired(payload.citizen_id);
      await validateCitizenIdUnique(payload.citizen_id);

      await validateSourceMandatory(payload.source_id);
      await validateEducationLevelOptional(payload.education_level);

      if (Number.isNaN(payload.height)) {
        return next(createHttpError('Invalid height', 400));
      }
      if (Number.isNaN(payload.weight)) {
        return next(createHttpError('Invalid weight', 400));
      }

      if (Number.isNaN(payload.is_fee0_paid)) {
        return next(createHttpError('Invalid is_fee0_paid', 400));
      }

      if (payload.is_fee0_paid === undefined || payload.is_fee0_paid === null) {
        payload.is_fee0_paid = 0;
      }

      if (payload.is_fee0_paid === 0) {
        payload.fee0_paid_amount = null;
        payload.fee0_paid_at = null;
      } else if (!payload.fee0_paid_at) {
        payload.fee0_paid_at = new Date();
      }

      if (req.file) {
        payload.cv_file_url = req.file.path || req.file.secure_url || null;
      }

      payload.status = CANDIDATE_STATUSES.NEW_RECEIVED;

      const newId = await Candidate.create(payload);

      await DocumentModel.initCandidateDocuments({
        candidateId: newId,
        phase: 'PRE_EXAM'
      });

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

      if (payload.citizen_id !== undefined) {
        validateCitizenIdRequired(payload.citizen_id);
        await validateCitizenIdUnique(payload.citizen_id, id);
      }

      if (payload.source_id !== undefined) {
        await validateSourceMandatory(payload.source_id);
      }

      if (payload.education_level !== undefined) {
        await validateEducationLevelOptional(payload.education_level);
      }

      if (Number.isNaN(payload.height)) {
        return next(createHttpError('Invalid height', 400));
      }
      if (Number.isNaN(payload.weight)) {
        return next(createHttpError('Invalid weight', 400));
      }

      if (Number.isNaN(payload.is_fee0_paid)) {
        return next(createHttpError('Invalid is_fee0_paid', 400));
      }

      if (payload.is_fee0_paid === 0) {
        payload.fee0_paid_amount = null;
        payload.fee0_paid_at = null;
      } else if (payload.is_fee0_paid === 1 && !payload.fee0_paid_at) {
        payload.fee0_paid_at = new Date();
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

      const gateRequiredStatuses = new Set([
        CANDIDATE_STATUSES.PAID0_DOCS_SUBMITTED,
        CANDIDATE_STATUSES.WAITING_FORM_MATCH,
        CANDIDATE_STATUSES.FORM_MATCHED_WAITING_EXAM
      ]);

      if (gateRequiredStatuses.has(nextStatus)) {
        await validatePreExamGate(candidate, nextStatus);
      }

      // await Candidate.updateStatus(id, nextStatus);
      await Candidate.transitionStatus(id, nextStatus, { jobOrderId: req.body.jobOrderId || null });
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