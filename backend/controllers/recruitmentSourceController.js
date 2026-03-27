const RecruitmentSource = require('../models/recruitmentSourceModel');

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

const recruitmentSourceController = {
  getAllSources: async (req, res, next) => {
    try {
      const page = toPositiveInt(req.query.page, 1);
      const limit = Math.min(toPositiveInt(req.query.limit, 20), 100);
      const search = String(req.query.search || '').trim();

      const result = await RecruitmentSource.getAll({ page, limit, search });

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  },

  getSourceById: async (req, res, next) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id <= 0) {
        return next(createHttpError('Invalid source id', 400));
      }

      const source = await RecruitmentSource.getById(id);
      if (!source) {
        return next(createHttpError('Source not found', 404));
      }

      res.status(200).json({ success: true, data: source });
    } catch (error) {
      next(error);
    }
  },

  createSource: async (req, res, next) => {
    try {
      const source_name = String(req.body.source_name || req.body.sourceName || '').trim();

      if (!source_name) {
        return next(createHttpError('source_name is required', 400));
      }

      const duplicated = await RecruitmentSource.existsByName(source_name);
      if (duplicated) {
        return next(createHttpError('Source name already exists', 409));
      }

      const newId = await RecruitmentSource.create({ source_name });
      const created = await RecruitmentSource.getById(newId);

      res.status(201).json({
        success: true,
        message: 'Source created successfully',
        data: created
      });
    } catch (error) {
      next(error);
    }
  },

  updateSource: async (req, res, next) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id <= 0) {
        return next(createHttpError('Invalid source id', 400));
      }

      const source_name = String(req.body.source_name || req.body.sourceName || '').trim();
      if (!source_name) {
        return next(createHttpError('source_name is required', 400));
      }

      const existing = await RecruitmentSource.getById(id);
      if (!existing) {
        return next(createHttpError('Source not found', 404));
      }

      const duplicated = await RecruitmentSource.existsByName(source_name, id);
      if (duplicated) {
        return next(createHttpError('Source name already exists', 409));
      }

      await RecruitmentSource.update(id, { source_name });
      const updated = await RecruitmentSource.getById(id);

      res.status(200).json({
        success: true,
        message: 'Source updated successfully',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  },

  deleteSource: async (req, res, next) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id <= 0) {
        return next(createHttpError('Invalid source id', 400));
      }

      const existing = await RecruitmentSource.getById(id);
      if (!existing) {
        return next(createHttpError('Source not found', 404));
      }

      const inUse = await RecruitmentSource.isInUse(id);
      if (inUse) {
        return next(createHttpError('Source is in use by candidates and cannot be deleted', 409));
      }

      await RecruitmentSource.deleteById(id);

      res.status(200).json({
        success: true,
        message: 'Source deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = recruitmentSourceController;