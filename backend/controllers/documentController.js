const Candidate = require('../models/candidateModel');
const DocumentModel = require('../models/documentModel');
const { CANDIDATE_STATUSES } = require('../utils/candidateStatus');

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
}

const VALID_PHASES = new Set(['PRE_EXAM', 'POST_EXAM']);
const VALID_DOC_STATUSES = new Set(['NOT_SUBMITTED', 'SUBMITTED', 'VERIFIED', 'REJECTED']);

async function tryAutoTransitionAfterDocumentUpdate(candidateId) {
  const candidate = await Candidate.getById(candidateId);
  if (!candidate) {
    return { applied: false, reason: 'candidate-not-found' };
  }

  if (candidate.status !== CANDIDATE_STATUSES.NEW_RECEIVED) {
    return { applied: false, reason: 'status-not-eligible' };
  }

  if (!candidate.is_fee0_paid) {
    return { applied: false, reason: 'fee0-not-paid' };
  }

  const readiness = await DocumentModel.getPreExamReadiness(candidateId);
  if (!readiness.can_submit_profile) {
    return { applied: false, reason: 'documents-not-submitted', readiness };
  }

  await Candidate.transitionStatus(candidateId, CANDIDATE_STATUSES.PAID0_DOCS_SUBMITTED);
  const updatedCandidate = await Candidate.getById(candidateId);
  return { applied: true, reason: 'ok', candidate: updatedCandidate, readiness };
}

const documentController = {
  getDocumentTypes: async (req, res, next) => {
    try {
      const phase = req.query.phase ? String(req.query.phase).trim() : null;

      if (phase && !VALID_PHASES.has(phase)) {
        return next(createHttpError('Invalid phase. Use PRE_EXAM or POST_EXAM', 400));
      }

      const data = await DocumentModel.getDocumentTypes({ phase });

      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  },

  initCandidateDocuments: async (req, res, next) => {
    try {
      const candidateId = Number.parseInt(req.params.candidateId, 10);
      if (Number.isNaN(candidateId) || candidateId <= 0) {
        return next(createHttpError('Invalid candidateId', 400));
      }

      const candidate = await Candidate.getById(candidateId);
      if (!candidate) {
        return next(createHttpError('Candidate not found', 404));
      }

      const phase = String(req.body.phase || 'PRE_EXAM').trim();
      if (!VALID_PHASES.has(phase)) {
        return next(createHttpError('Invalid phase. Use PRE_EXAM or POST_EXAM', 400));
      }

      const inserted = await DocumentModel.initCandidateDocuments({ candidateId, phase });
      const documents = await DocumentModel.getCandidateDocuments({ candidateId, phase });

      res.status(200).json({
        success: true,
        message: 'Candidate documents initialized',
        inserted_count: inserted,
        data: documents
      });
    } catch (error) {
      next(error);
    }
  },

  getCandidateDocuments: async (req, res, next) => {
    try {
      const candidateId = Number.parseInt(req.params.candidateId, 10);
      if (Number.isNaN(candidateId) || candidateId <= 0) {
        return next(createHttpError('Invalid candidateId', 400));
      }

      const candidate = await Candidate.getById(candidateId);
      if (!candidate) {
        return next(createHttpError('Candidate not found', 404));
      }

      const phase = req.query.phase ? String(req.query.phase).trim() : null;
      if (phase && !VALID_PHASES.has(phase)) {
        return next(createHttpError('Invalid phase. Use PRE_EXAM or POST_EXAM', 400));
      }

      const data = await DocumentModel.getCandidateDocuments({ candidateId, phase });

      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  },

  updateCandidateDocument: async (req, res, next) => {
    try {
      const candidateId = Number.parseInt(req.params.candidateId, 10);
      if (Number.isNaN(candidateId) || candidateId <= 0) {
        return next(createHttpError('Invalid candidateId', 400));
      }

      const candidate = await Candidate.getById(candidateId);
      if (!candidate) {
        return next(createHttpError('Candidate not found', 404));
      }

      const documentTypeCode = String(req.params.documentTypeCode || '').trim();
      if (!documentTypeCode) {
        return next(createHttpError('documentTypeCode is required', 400));
      }

      const payload = {
        status: req.body.status,
        issue_date: req.body.issue_date,
        expiration_date: req.body.expiration_date,
        expected_complete_date: req.body.expected_complete_date,
        file_url: req.body.file_url,
        rejected_reason: req.body.rejected_reason,
        note: req.body.note
      };

      if (payload.status !== undefined) {
        payload.status = String(payload.status).trim().toUpperCase();
        if (!VALID_DOC_STATUSES.has(payload.status)) {
          return next(createHttpError('Invalid document status', 400));
        }
      }

      if (req.file) {
        payload.file_url = req.file.path || req.file.secure_url || null;
      }

      const updated = await DocumentModel.updateCandidateDocumentByCode({
        candidateId,
        code: documentTypeCode,
        data: payload
      });

      if (!updated) {
        return next(createHttpError('Document type not found', 404));
      }

      const autoTransition =
        updated.phase === 'PRE_EXAM'
          ? await tryAutoTransitionAfterDocumentUpdate(candidateId)
          : { applied: false, reason: 'phase-not-eligible' };

      res.status(200).json({
        success: true,
        message: 'Candidate document updated',
        data: updated,
        auto_transition: autoTransition
      });
    } catch (error) {
      next(error);
    }
  },

  getPreExamReadiness: async (req, res, next) => {
    try {
      const candidateId = Number.parseInt(req.params.candidateId, 10);
      if (Number.isNaN(candidateId) || candidateId <= 0) {
        return next(createHttpError('Invalid candidateId', 400));
      }

      const candidate = await Candidate.getById(candidateId);
      if (!candidate) {
        return next(createHttpError('Candidate not found', 404));
      }

      const readiness = await DocumentModel.getPreExamReadiness(candidateId);

      res.status(200).json({
        success: true,
        data: readiness
      });
    } catch (error) {
      next(error);
    }
  },

  getHealthExpiryAlerts: async (req, res, next) => {
    try {
      const days = Math.min(toPositiveInt(req.query.days, 30), 365);
      const data = await DocumentModel.getHealthExpiryAlerts(days);

      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  },

  getVisaDelayAlerts: async (req, res, next) => {
    try {
      const data = await DocumentModel.getVisaDelayAlerts();

      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = documentController;