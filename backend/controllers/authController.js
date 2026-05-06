const crypto = require('crypto');
const AdminUser = require('../models/adminUserModel');

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên đăng nhập và mật khẩu.'
      });
    }

    const user = await AdminUser.findByCredentials(username, password);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Sai tài khoản hoặc mật khẩu.'
      });
    }

    const token = crypto.randomBytes(24).toString('hex');
    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công.',
      data: {
        token,
        user
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
