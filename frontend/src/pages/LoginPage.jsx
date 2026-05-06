import { useState } from 'react';
import { authService } from '../services/authService';

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      setLoading(true);
      const res = await authService.login({ username, password });
      if (!res?.success || !res?.data?.user) {
        throw new Error(res?.message || 'Đăng nhập thất bại');
      }
      onLogin(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'linear-gradient(135deg, #eef2ff 0%, #dbeafe 100%)' }}>
      <div className="surface" style={{ width: '100%', maxWidth: 420 }}>
        <h2 style={{ marginBottom: 8 }}>Đăng nhập Admin</h2>
        <p className="muted" style={{ marginBottom: 14 }}>Vui lòng đăng nhập để sử dụng hệ thống.</p>

        <form className="grid-form" onSubmit={handleSubmit}>
          <label className="field-span-2">
            Tên đăng nhập
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label className="field-span-2">
            Mật khẩu
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error ? <div className="field-span-2 error-text">{error}</div> : null}
          <div className="field-span-2 row-actions" style={{ marginTop: 8 }}>
            <button className="btn" type="submit" disabled={loading}>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
          </div>
        </form>

        <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>Tài khoản mặc định: admin / admin123</p>
      </div>
    </div>
  );
}

export default LoginPage;
