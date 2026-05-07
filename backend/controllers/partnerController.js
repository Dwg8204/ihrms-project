const Partner = require('../models/partnerModel');
const PartnerContact = require('../models/partnerContactModel');
const { isValidPartnerStatus, PARTNER_STATUSES } = require('../utils/partnerStatus');
const {
  normalizePhoneNumber,
  isValidVietnamesePhoneNumber,
  normalizeEmail,
  isValidEmail
} = require('../utils/inputValidation');

function validateOptionalPhoneAndEmail(phone, email) {
  const normalizedPhone = normalizePhoneNumber(phone);
  const normalizedEmail = normalizeEmail(email);

  if (normalizedPhone && !isValidVietnamesePhoneNumber(normalizedPhone)) {
    throw new Error('Phone must be a valid Vietnamese phone number with exactly 10 digits.');
  }

  if (normalizedEmail && !isValidEmail(normalizedEmail)) {
    throw new Error('Email is invalid.');
  }

  return {
    phone: normalizedPhone,
    email: normalizedEmail
  };
}

// --- Partner CRUD ---
exports.createPartner = async (req, res, next) => {
  try {
    const { name, country, contact_person, phone, email, status } = req.body;
    const normalized = validateOptionalPhoneAndEmail(phone, email);

    // Xác thực cơ bản
    if (!name) {
      return res.status(400).json({ success: false, message: 'Partner name is required.' });
    }
    if (status && !isValidPartnerStatus(status)) {
      return res.status(400).json({ success: false, message: 'Invalid partner status.' });
    }

    const newPartner = await Partner.create({ name, country, status });
    
    // Nếu có thông tin người liên hệ, tạo bản ghi liên hệ đầu tiên làm Primary
    if (contact_person || normalized.phone || normalized.email) {
        await PartnerContact.create(newPartner.id, {
            contact_name: contact_person || 'Liên hệ chính',
            contact_phone: normalized.phone,
            contact_email: normalized.email,
            contact_role: 'Liên hệ chính',
            is_primary: true
        });
    }

    res.status(201).json({ success: true, data: newPartner });
  } catch (error) {
    if (error.message.includes('Phone must') || error.message.includes('Email is invalid')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message.includes('Partner name already exists')) {
      return res.status(409).json({ success: false, message: error.message });
    }
    next(error);
  }
};

exports.getPartners = async (req, res, next) => {
  try {
    const { page, limit, search, status } = req.query;
    const partners = await Partner.findAll(parseInt(page), parseInt(limit), search, status);
    res.status(200).json({ success: true, ...partners });
  } catch (error) {
    next(error);
  }
};

exports.getPartnerById = async (req, res, next) => {
  try {
    const partner = await Partner.findById(req.params.id);
    if (!partner) {
      return res.status(404).json({ success: false, message: 'Partner not found.' });
    }
    res.status(200).json({ success: true, data: partner });
  } catch (error) {
    next(error);
  }
};

exports.updatePartner = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, country, contact_person, phone, email, status } = req.body;
    const normalized = validateOptionalPhoneAndEmail(phone, email);

    // Xác thực cơ bản
    if (status && !isValidPartnerStatus(status)) {
      return res.status(400).json({ success: false, message: 'Invalid partner status.' });
    }

    const updatedPartner = await Partner.update(id, { name, country, status });
    
    if (!updatedPartner) {
      return res.status(404).json({ success: false, message: 'Partner not found.' });
    }

    // Cập nhật hoặc tạo liên hệ Primary nếu có thông tin
    if (contact_person || normalized.phone || normalized.email) {
        const contacts = await PartnerContact.findByPartnerId(id);
        const primaryContact = contacts.find(c => c.is_primary);
        
        if (primaryContact) {
            await PartnerContact.update(primaryContact.id, id, {
                contact_name: contact_person,
                contact_phone: normalized.phone,
                contact_email: normalized.email,
                is_primary: true
            });
        } else {
            await PartnerContact.create(id, {
                contact_name: contact_person || 'Liên hệ chính',
                contact_phone: normalized.phone,
                contact_email: normalized.email,
                contact_role: 'Liên hệ chính',
                is_primary: true
            });
        }
    }

    // Nếu trạng thái đối tác là INACTIVE hoặc BLACKLISTED, cập nhật các đơn đặt hàng liên quan.
    if (status && (status === PARTNER_STATUSES.INACTIVE || status === PARTNER_STATUSES.BLACKLISTED)) {
      await Partner.updateJobOrdersOnPartnerStatusChange(id, status);
    }

    res.status(200).json({ success: true, data: updatedPartner });
  } catch (error) {
    if (error.message.includes('Phone must') || error.message.includes('Email is invalid')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message.includes('Partner name already exists')) {
      return res.status(409).json({ success: false, message: error.message });
    }
    next(error);
  }
};

exports.deletePartner = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await Partner.delete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Partner not found.' });
    }
    res.status(200).json({ success: true, message: 'Partner deleted successfully.' });
  } catch (error) {
    if (error.message.includes('Cannot delete partner with active job orders')) {
      return res.status(409).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// --- Partner Contacts CRUD ---
exports.createPartnerContact = async (req, res, next) => {
  try {
    const { partnerId } = req.params;
    const { contact_name, contact_phone, contact_email, contact_role, is_primary } = req.body;
    const normalized = validateOptionalPhoneAndEmail(contact_phone, contact_email);

    if (!contact_name) {
      return res.status(400).json({ success: false, message: 'Contact name is required.' });
    }

    const newContact = await PartnerContact.create(partnerId, { contact_name, contact_phone: normalized.phone, contact_email: normalized.email, contact_role, is_primary });
    res.status(201).json({ success: true, data: newContact });
  } catch (error) {
    if (error.message.includes('Partner not found')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes('Phone must') || error.message.includes('Email is invalid')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message.includes('Maximum')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message.includes('Duplicate entry')) { // MySQL specific for UNIQUE constraint
      return res.status(409).json({ success: false, message: 'Contact name already exists for this partner.' });
    }
    next(error);
  }
};

exports.getPartnerContacts = async (req, res, next) => {
  try {
    const { partnerId } = req.params;
    const contacts = await PartnerContact.findByPartnerId(partnerId);
    if (!contacts.length && !(await Partner.findById(partnerId))) { // Kiểm tra xem đối tác có tồn tại hay không
        return res.status(404).json({ success: false, message: 'Partner not found or no contacts.' });
    }
    res.status(200).json({ success: true, data: contacts });
  } catch (error) {
    next(error);
  }
};

exports.getPartnerContactById = async (req, res, next) => {
    try {
        const { id, partnerId } = req.params;
        const contact = await PartnerContact.findById(id);
        if (!contact || contact.partner_id != partnerId) {
            return res.status(404).json({ success: false, message: 'Contact not found for this partner.' });
        }
        res.status(200).json({ success: true, data: contact });
    } catch (error) {
        next(error);
    }
};

exports.updatePartnerContact = async (req, res, next) => {
  try {
    const { id, partnerId } = req.params;
    const { contact_name, contact_phone, contact_email, contact_role, is_primary } = req.body;
    const normalized = validateOptionalPhoneAndEmail(contact_phone, contact_email);

    const updatedContact = await PartnerContact.update(id, partnerId, { contact_name, contact_phone: normalized.phone, contact_email: normalized.email, contact_role, is_primary });
    if (!updatedContact) {
      return res.status(404).json({ success: false, message: 'Contact not found or does not belong to this partner.' });
    }
    res.status(200).json({ success: true, data: updatedContact });
  } catch (error) {
    if (error.message.includes('Phone must') || error.message.includes('Email is invalid')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message.includes('Duplicate entry')) {
        return res.status(409).json({ success: false, message: 'Contact name already exists for this partner.' });
    }
    next(error);
  }
};

exports.deletePartnerContact = async (req, res, next) => {
  try {
    const { id, partnerId } = req.params;
    const deleted = await PartnerContact.delete(id, partnerId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Contact not found or does not belong to this partner.' });
    }
    res.status(200).json({ success: true, message: 'Contact deleted successfully.' });
  } catch (error) {
    next(error);
  }
};