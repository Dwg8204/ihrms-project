import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'dashboard' },
  { to: '/module-1', label: 'Tuyển dụng ứng viên' },
  { to: '/module-2', label: 'Đối tác và đơn hàng' },
  { to: '/module-3', label: 'Thi tuyển và đào tạo' },
  { to: '/module-6', label: 'Hồ sơ xuất cảnh' },
  { to: '/roadmap', label: 'Kế hoạch mở rộng' }
];

function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-box">
          <p className="brand-kicker">Quốc tế</p>
          <h1>IHRMS</h1>
          <p className="brand-sub">Trung tâm quản lý cung ứng lao động</p>
        </div>

        <nav className="side-nav" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
            >
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="content-shell">
        <header className="topbar">
          <div>
            <p className="topbar-kicker">Trạng thái hệ thống</p>
            <h2>Giao diện quản lý cung ứng lao động</h2>
          </div>
          <div className="chip-row">
            <span className="chip chip-ok">M1 Hoạt động</span>
            <span className="chip chip-ok">M2 Hoạt động</span>
            <span className="chip chip-plan">M3 Giao diện</span>
            <span className="chip chip-ok">M6 Hoạt động</span>
            <span className="chip chip-plan">M8 Biểu đồ</span>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
