const nodemailer = require('nodemailer');
const EmailTemplate = require('../models/emailTemplateModel');
const EmailRecipient = require('../models/emailRecipientModel');
const { EmailLog, EMAIL_STATUSES } = require('../models/emailLogModel');
const { renderTemplate } = require('../utils/templateRenderer');

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

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function buildFromAddress() {
  const fromRaw = String(process.env.MAIL_FROM || '').trim();
  if (fromRaw) {
    return fromRaw.replace(/^"+|"+$/g, '');
  }

  const fromName = String(process.env.MAIL_FROM_NAME || '').trim();
  const fromEmail = String(process.env.MAIL_USER || process.env.SMTP_USER || '').trim();
  if (fromName && fromEmail) {
    return `${fromName} <${fromEmail}>`;
  }

  return fromEmail || 'no-reply@ihrms.local';
}

function ensureSubject(subject, fallback = 'Thong bao tu he thong IHRMS') {
  const normalized = String(subject || '').trim();
  return normalized || fallback;
}

function htmlToText(html = '') {
  return String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function formatDateTimeValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

let transporterCache = null;
let transporterMeta = null;

function getMailer() {
  if (transporterCache) {
    return { transporter: transporterCache, meta: transporterMeta };
  }

  const host = process.env.MAIL_HOST || process.env.SMTP_HOST;
  const port = Number.parseInt(process.env.MAIL_PORT || process.env.SMTP_PORT || '587', 10);
  const user = process.env.MAIL_USER || process.env.SMTP_USER;
  const pass = process.env.MAIL_PASS || process.env.SMTP_PASS;
  const encryption = String(process.env.MAIL_ENCRYPTION || '').toLowerCase();
  const secure =
    encryption === 'ssl' ||
    (String(process.env.SMTP_SECURE || '').toLowerCase() === 'true') ||
    port === 465;

  if (host && user && pass) {
    transporterCache = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });
    transporterMeta = { mode: 'smtp' };
  } else {
    transporterCache = nodemailer.createTransport({ jsonTransport: true });
    transporterMeta = { mode: 'mock' };
  }

  return { transporter: transporterCache, meta: transporterMeta };
}

function buildTemplateVariables(candidate, extraVariables = {}) {
  return {
    candidate_id: candidate.id,
    full_name: candidate.full_name || '',
    email: candidate.email || '',
    phone: candidate.phone || '',
    citizen_id: candidate.citizen_id || '',
    candidate_status: candidate.status || '',
    exam_date: formatDateTimeValue(candidate.exam_date),
    job_name: candidate.job_name || '',
    ...extraVariables
  };
}

const emailController = {
  getTemplates: async (req, res, next) => {
    try {
      const page = toPositiveInt(req.query.page, 1);
      const limit = Math.min(toPositiveInt(req.query.limit, 50), 200);
      const search = String(req.query.search || '').trim();

      const result = await EmailTemplate.getAll({ page, limit, search });

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  },

  getTemplateById: async (req, res, next) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id <= 0) {
        return next(createHttpError('Invalid template id', 400));
      }

      const template = await EmailTemplate.getById(id);
      if (!template) {
        return next(createHttpError('Email template not found', 404));
      }

      res.status(200).json({ success: true, data: template });
    } catch (error) {
      next(error);
    }
  },

  createTemplate: async (req, res, next) => {
    try {
      const template_code = String(req.body.template_code || '').trim();
      const subject = String(req.body.subject || '').trim();
      const body_html = String(req.body.body_html || '').trim();

      if (!template_code) {
        return next(createHttpError('template_code is required', 400));
      }
      if (!subject) {
        return next(createHttpError('subject is required', 400));
      }
      if (!body_html) {
        return next(createHttpError('body_html is required', 400));
      }

      const normalizedCode = template_code.toUpperCase();
      const existing = await EmailTemplate.getByCode(normalizedCode);
      if (existing) {
        return next(createHttpError('template_code already exists', 409));
      }

      const id = await EmailTemplate.create({
        template_code: normalizedCode,
        subject,
        body_html
      });

      const created = await EmailTemplate.getById(id);
      res.status(201).json({
        success: true,
        message: 'Email template created successfully',
        data: created
      });
    } catch (error) {
      next(error);
    }
  },

  updateTemplate: async (req, res, next) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id <= 0) {
        return next(createHttpError('Invalid template id', 400));
      }

      const existingById = await EmailTemplate.getById(id);
      if (!existingById) {
        return next(createHttpError('Email template not found', 404));
      }

      const template_code = String(req.body.template_code || '').trim();
      const subject = String(req.body.subject || '').trim();
      const body_html = String(req.body.body_html || '').trim();

      if (!template_code) {
        return next(createHttpError('template_code is required', 400));
      }
      if (!subject) {
        return next(createHttpError('subject is required', 400));
      }
      if (!body_html) {
        return next(createHttpError('body_html is required', 400));
      }

      const normalizedCode = template_code.toUpperCase();
      const existingCode = await EmailTemplate.getByCode(normalizedCode, id);
      if (existingCode) {
        return next(createHttpError('template_code already exists', 409));
      }

      await EmailTemplate.update(id, {
        template_code: normalizedCode,
        subject,
        body_html
      });

      const updated = await EmailTemplate.getById(id);
      res.status(200).json({
        success: true,
        message: 'Email template updated successfully',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  },

  deleteTemplate: async (req, res, next) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id <= 0) {
        return next(createHttpError('Invalid template id', 400));
      }

      const existingById = await EmailTemplate.getById(id);
      if (!existingById) {
        return next(createHttpError('Email template not found', 404));
      }

      const deleted = await EmailTemplate.deleteById(id);
      if (!deleted) {
        return next(createHttpError('Cannot delete template', 500));
      }

      res.status(200).json({
        success: true,
        message: 'Email template deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  getLogs: async (req, res, next) => {
    try {
      const page = toPositiveInt(req.query.page, 1);
      const limit = Math.min(toPositiveInt(req.query.limit, 50), 200);
      const status = String(req.query.status || '').trim().toUpperCase();
      const candidateId = req.query.candidate_id
        ? Number.parseInt(req.query.candidate_id, 10)
        : null;

      if (status && !Object.values(EMAIL_STATUSES).includes(status)) {
        return next(createHttpError('Invalid email log status', 400));
      }

      if (req.query.candidate_id && (Number.isNaN(candidateId) || candidateId <= 0)) {
        return next(createHttpError('Invalid candidate_id filter', 400));
      }

      const result = await EmailLog.getAll({ page, limit, status, candidateId });
      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  },

  sendManual: async (req, res, next) => {
    try {
      const templateId = Number.parseInt(req.body.template_id, 10);
      const candidateIdsRaw = Array.isArray(req.body.candidate_ids) ? req.body.candidate_ids : [];
      const candidateIds = [...new Set(candidateIdsRaw.map((id) => Number.parseInt(id, 10)).filter((id) => !Number.isNaN(id) && id > 0))];
      const extraVariables = req.body.extra_variables && typeof req.body.extra_variables === 'object'
        ? req.body.extra_variables
        : {};

      if (Number.isNaN(templateId) || templateId <= 0) {
        return next(createHttpError('template_id is required', 400));
      }

      if (!candidateIds.length) {
        return next(createHttpError('candidate_ids must be a non-empty array', 400));
      }

      const template = await EmailTemplate.getById(templateId);
      if (!template) {
        return next(createHttpError('Email template not found', 404));
      }

      const recipients = await EmailRecipient.getCandidatesForManualSend(candidateIds);
      if (!recipients.length) {
        return next(createHttpError('No candidates found for manual send', 404));
      }

      const { transporter, meta } = getMailer();
      const from = buildFromAddress();

      let sent = 0;
      let failed = 0;
      const results = [];

      for (const candidate of recipients) {
        const logId = await EmailLog.createPending({
          candidateId: candidate.id,
          templateId
        });

        const to = String(candidate.email || '').trim();
        if (!isValidEmail(to)) {
          const errorMessage = 'Invalid email address';
          await EmailLog.markResult({
            logId,
            status: EMAIL_STATUSES.FAILED,
            errorMessage
          });

          failed += 1;
          results.push({
            log_id: logId,
            candidate_id: candidate.id,
            email: to,
            status: EMAIL_STATUSES.FAILED,
            error_message: errorMessage
          });
          continue;
        }

        const variables = buildTemplateVariables(candidate, extraVariables);
        const subject = ensureSubject(
          renderTemplate(template.subject, variables),
          `Thong bao ket qua thi - ${variables.full_name || 'Ung vien'}`
        );
        const html = renderTemplate(template.body_html, variables);

        try {
          await transporter.sendMail({
            from,
            to,
            subject,
            html,
            text: htmlToText(html)
          });

          await EmailLog.markResult({
            logId,
            status: EMAIL_STATUSES.SENT,
            errorMessage: null
          });

          sent += 1;
          results.push({
            log_id: logId,
            candidate_id: candidate.id,
            email: to,
            status: EMAIL_STATUSES.SENT
          });
        } catch (error) {
          const errorMessage = error?.message || 'Unknown send error';
          await EmailLog.markResult({
            logId,
            status: EMAIL_STATUSES.FAILED,
            errorMessage
          });

          failed += 1;
          results.push({
            log_id: logId,
            candidate_id: candidate.id,
            email: to,
            status: EMAIL_STATUSES.FAILED,
            error_message: errorMessage
          });
        }
      }

      res.status(200).json({
        success: true,
        message: `Processed ${recipients.length} email(s)`,
        data: {
          total: recipients.length,
          sent,
          failed,
          transport_mode: meta.mode,
          results
        }
      });
    } catch (error) {
      next(error);
    }
  }
};

/**
 * Tự động gửi email thông báo kết quả thi cho 1 ứng viên.
 * Dùng template EXAM_PASS_NOTIFY hoặc EXAM_FAIL_NOTIFY tùy kết quả.
 * Hàm này không throw — lỗi gửi mail chỉ được log, không ảnh hưởng luồng chính.
 */
async function autoSendExamResultEmail(candidateId, resultStatus) {
  try {
    const templateCode = resultStatus === 'Pass' ? 'EXAM_PASS_NOTIFY' : 'EXAM_FAIL_NOTIFY';
    const template = await EmailTemplate.getByCode(templateCode);
    if (!template) return; // Template chưa tạo thì bỏ qua

    const recipients = await EmailRecipient.getCandidatesForManualSend([candidateId]);
    if (!recipients.length) return;

    const candidate = recipients[0];
    const to = String(candidate.email || '').trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return;

    const { transporter } = getMailer();
    const from = buildFromAddress();

    const variables = buildTemplateVariables(candidate);
    const subject = ensureSubject(
      renderTemplate(template.subject, variables),
      `Thong bao ket qua thi - ${variables.full_name || 'Ung vien'}`
    );
    const html = renderTemplate(template.body_html, variables);

    const logId = await EmailLog.createPending({ candidateId: candidate.id, templateId: template.id });

    try {
      await transporter.sendMail({
        from,
        to,
        subject,
        html,
        text: htmlToText(html)
      });
      await EmailLog.markResult({ logId, status: EMAIL_STATUSES.SENT });
    } catch (sendError) {
      await EmailLog.markResult({ logId, status: EMAIL_STATUSES.FAILED, errorMessage: sendError.message });
    }
  } catch (_) {
    // Không để lỗi auto-send phá luồng chính
  }
}

emailController.autoSendExamResultEmail = autoSendExamResultEmail;

module.exports = emailController;
