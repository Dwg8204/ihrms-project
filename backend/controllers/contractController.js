const Contract = require('../models/contractModel');
const Candidate = require('../models/candidateModel'); // For candidate status transition
const { isValidContractStatus, CONTRACT_STATUSES } = require('../utils/contractStatus');
const { CANDIDATE_STATUSES } = require('../utils/candidateStatus'); // For candidate status constant

exports.createContract = async (req, res, next) => {
  try {
    const {
      candidate_id, job_order_id, contract_number, contract_type,
      signed_date, effective_date, expiry_date, status
    } = req.body;
    let { contract_details_json } = req.body;

    // Việc tải lên tập tin được xử lý bởi phần mềm trung gian.
    const document_url = req.file ? req.file.path : null;

    if (!candidate_id || !contract_type) {
      return res.status(400).json({ success: false, message: 'Candidate ID and Contract Type are required.' });
    }
    if (status && !isValidContractStatus(status)) {
        return res.status(400).json({ success: false, message: 'Invalid contract status.' });
    }
    if (contract_details_json) {
        if (typeof contract_details_json === 'string') {
            try {
                contract_details_json = JSON.parse(contract_details_json);
            } catch (parseError) {
                return res.status(400).json({ success: false, message: 'contract_details_json is not a valid JSON string.' });
            }
        }
        if (typeof contract_details_json !== 'object' || contract_details_json === null) {
            return res.status(400).json({ success: false, message: 'contract_details_json must be a valid JSON object.' });
        }
    }

    const newContract = await Contract.create({
      candidate_id: parseInt(candidate_id),
      job_order_id: job_order_id ? parseInt(job_order_id) : null,
      contract_number, contract_type,
      signed_date, effective_date, expiry_date, status,
      document_url, contract_details_json
    });
    res.status(201).json({ success: true, data: newContract, message: 'Contract created successfully.' });
  } catch (error) {
    if (error.message.includes('Candidate not found') || error.message.includes('Candidate must be in')) {
        return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message.includes('Contract number already exists')) {
        return res.status(409).json({ success: false, message: error.message });
    }
    next(error);
  }
};

exports.getContracts = async (req, res, next) => {
  try {
    const { page, limit, search, candidate_id, job_order_id, status } = req.query;
    const contracts = await Contract.findAll({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      candidate_id: candidate_id ? parseInt(candidate_id) : null,
      job_order_id: job_order_id ? parseInt(job_order_id) : null,
      status
    });
    res.status(200).json({ success: true, ...contracts });
  } catch (error) {
    next(error);
  }
};

exports.getContractById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ success: false, message: 'Contract not found.' });
    }
    res.status(200).json({ success: true, data: contract });
  } catch (error) {
    next(error);
  }
};

exports.updateContract = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      candidate_id, job_order_id, contract_number, contract_type,
      signed_date, effective_date, expiry_date, status
    } = req.body;
    let { contract_details_json } = req.body;

    // Lấy hợp đồng hiện tại để kiểm tra tình trạng chuyển đổi
    const currentContract = await Contract.findById(id);
    if (!currentContract) {
        return res.status(404).json({ success: false, message: 'Contract not found.' });
    }

    const document_url = req.file ? req.file.path : (req.body.document_url === '' ? '' : currentContract.document_url); // Xử lý chuỗi rỗng rõ ràng để xóa hoặc null để không thay đổi.

    if (status && !isValidContractStatus(status)) {
        return res.status(400).json({ success: false, message: 'Invalid contract status.' });
    }
    if (contract_details_json !== undefined) {
        if (typeof contract_details_json === 'string') {
            try {
                contract_details_json = JSON.parse(contract_details_json);
            } catch (parseError) {
                return res.status(400).json({ success: false, message: 'contract_details_json is not a valid JSON string.' });
            }
        }
        // Sau khi phân tích cú pháp, kết quả trả về phải là một đối tượng hoặc null (nếu đó là chuỗi "null")
        // Nếu nó vẫn không phải là một đối tượng (và không phải là null), thì nó không hợp lệ
        if (typeof contract_details_json !== 'object' || (contract_details_json === null && req.body.contract_details_json !== null)) { // Đảm bảo cho phép sử dụng chuỗi "null" một cách rõ ràng
            return res.status(400).json({ success: false, message: 'contract_details_json must be a valid JSON object or null.' });
        }
    }

    const updatedContract = await Contract.update(id, {
      candidate_id: candidate_id ? parseInt(candidate_id) : undefined,
      job_order_id: job_order_id ? parseInt(job_order_id) : undefined,
      contract_number, contract_type,
      signed_date, effective_date, expiry_date, status,
      document_url, contract_details_json
    });

    if (!updatedContract) {
      return res.status(404).json({ success: false, message: 'Contract not found.' });
    }

    // --- TỰ ĐỘNG CẬP NHẬT TRẠNG THÁI ỨNG VIÊN (Tích hợp Mô-đun 1) ---
    // Trạng thái ứng viên chuyển đổi nếu trạng thái hợp đồng thay đổi thành ĐÃ KÝ.
    if (status === CONTRACT_STATUSES.SIGNED && currentContract.status !== CONTRACT_STATUSES.SIGNED) {
        await Candidate.transitionStatus(currentContract.candidate_id, CANDIDATE_STATUSES.CONTRACT_SIGNED);
    }
    // Cân nhắc việc khôi phục trạng thái ứng viên nếu hợp đồng thay đổi từ SIGNED sang PENDING/CANCELLED

    res.status(200).json({ success: true, data: updatedContract, message: 'Contract updated successfully.' });
  } catch (error) {
    if (error.message.includes('Contract number already exists')) {
        return res.status(409).json({ success: false, message: error.message });
    }
    if (error.message.includes('Invalid contract status transition')) {
        return res.status(409).json({ success: false, message: error.message });
    }
    if (error.message.includes('contract_details_json is not a valid JSON string.')) {
         return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

exports.deleteContract = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, force_hard_delete } = req.body; // `reason` dùng cho xóa mềm, `force_hard_delete` dùng cho logic xóa cứng.

    const currentContract = await Contract.findById(id);
    if (!currentContract) {
        return res.status(404).json({ success: false, message: 'Contract not found.' });
    }

    let deleted = false;
    if (force_hard_delete && currentContract.status === CONTRACT_STATUSES.DRAFT) {
        // Chỉ thực hiện xóa vĩnh viễn nếu được yêu cầu và hợp đồng ở dạng DRAFT
        deleted = await Contract.hardDelete(id);
        if (deleted) {
            return res.status(200).json({ success: true, message: 'Contract hard deleted successfully.' });
        } else {
             // Nếu thao tác xóa vĩnh viễn thất bại, nguyên nhân có thể là do các phụ thuộc.
             // Vì vậy, phương thức hardDelete sẽ ném ra một lỗi mà next(error) sẽ bắt được.
             // Nếu nó không ảnh hưởng đến các hàng, điều đó có nghĩa là nó không phải là bản NHÁP hoặc không được tìm thấy, những trường hợp này đã được xử lý ở trên.
             return res.status(500).json({ success: false, message: 'Failed to hard delete contract.' });
        }
    } else {
        // Mặc định là xóa mềm
        if (!reason) {
            return res.status(400).json({ success: false, message: 'Cancellation reason is required for soft deleting contract.' });
        }
        deleted = await Contract.softDelete(id, reason);
        if (deleted) {
            return res.status(200).json({ success: true, message: 'Contract cancelled successfully (soft deleted).' });
        } else {
            return res.status(500).json({ success: false, message: 'Failed to soft delete contract.' });
        }
    }

  } catch (error) {
    if (error.message.includes('Cannot cancel contract with linked') || error.message.includes('Cannot hard delete contract with linked')) {
        return res.status(409).json({ success: false, message: error.message });
    }
    if (error.message.includes('Only DRAFT contracts can be hard deleted')) {
        return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};


// --- Mẫu hợp đồng CRUD --- 
exports.createContractTemplate = async (req, res, next) => {
    try {
        const { name, template_type, description } = req.body;
        const template_file_url = req.file ? req.file.path : null; // Giả sử các tệp mẫu được lưu vào một thư mục 'templates' riêng biệt.

        if (!name || !template_type || !template_file_url) {
            return res.status(400).json({ success: false, message: 'Name, Type, and Template File are required for template.' });
        }

        const newTemplate = await Contract.createTemplate({ name, template_type, template_file_url, description });
        res.status(201).json({ success: true, data: newTemplate, message: 'Contract template created successfully.' });
    } catch (error) {
        if (error.message.includes('Template name already exists')) {
            return res.status(409).json({ success: false, message: error.message });
        }
        next(error);
    }
};

exports.getContractTemplates = async (req, res, next) => {
    try {
        const { page, limit, search } = req.query;
        const templates = await Contract.getTemplates({
            page: parseInt(page),
            limit: parseInt(limit),
            search
        });
        res.status(200).json({ success: true, ...templates });
    } catch (error) {
        next(error);
    }
};

exports.getContractTemplateById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const template = await Contract.getTemplateById(id);
        if (!template) {
            return res.status(404).json({ success: false, message: 'Contract template not found.' });
        }
        res.status(200).json({ success: true, data: template });
    } catch (error) {
        next(error);
    }
};

exports.updateContractTemplate = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, template_type, description } = req.body;
        const template_file_url = req.file ? req.file.path : (req.body.template_file_url === '' ? '' : currentTemplate.template_file_url);

        const updated = await Contract.updateTemplate(id, { name, template_type, template_file_url, description });
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Contract template not found.' });
        }
        res.status(200).json({ success: true, message: 'Contract template updated successfully.' });
    } catch (error) {
        if (error.message.includes('Template name already exists')) {
            return res.status(409).json({ success: false, message: error.message });
        }
        next(error);
    }
};

exports.deleteContractTemplate = async (req, res, next) => {
    try {
        const { id } = req.params;
        // Thêm các bước kiểm tra tại đây nếu mẫu được liên kết với các hợp đồng hiện có trước khi xóa.
        const deleted = await Contract.deleteTemplate(id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Contract template not found.' });
        }
        res.status(200).json({ success: true, message: 'Contract template deleted successfully.' });
    } catch (error) {
        next(error);
    }
};