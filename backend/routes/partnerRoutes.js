const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/partnerController');

// Partner routes
router.post('/', partnerController.createPartner);
router.get('/', partnerController.getPartners);
router.get('/:id', partnerController.getPartnerById);
router.patch('/:id', partnerController.updatePartner);
router.delete('/:id', partnerController.deletePartner); // Thao tác này chỉ xóa vĩnh viễn nếu không còn đơn đặt hàng công việc nào đang hoạt động.

// Partner Contact routes
router.post('/:partnerId/contacts', partnerController.createPartnerContact);
router.get('/:partnerId/contacts', partnerController.getPartnerContacts);
router.get('/:partnerId/contacts/:id', partnerController.getPartnerContactById); // Lộ trình cụ thể mới cho một liên hệ duy nhất
router.patch('/:partnerId/contacts/:id', partnerController.updatePartnerContact);
router.delete('/:partnerId/contacts/:id', partnerController.deletePartnerContact);

module.exports = router;