import React, { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import "../styles/Sidebar.css";
import { useI18n } from "../i18n/I18nProvider";

const ChevronIcon = ({ direction = "right" }) => (
  <svg
    viewBox="0 0 20 20"
    aria-hidden="true"
    className={`sidebar__chevron sidebar__chevron--${direction}`}
  >
    <path
      d="M7 4.5 12.5 10 7 15.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SquareGridIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar__nav-icon-svg">
    <rect x="4" y="4" width="6" height="6" rx="1.4" />
    <rect x="14" y="4" width="6" height="6" rx="1.4" />
    <rect x="4" y="14" width="6" height="6" rx="1.4" />
    <rect x="14" y="14" width="6" height="6" rx="1.4" />
  </svg>
);

const BarChartIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar__nav-icon-svg">
    <path d="M5 19V10" />
    <path d="M12 19V5" />
    <path d="M19 19v-8" />
    <path d="M4 19.2h16" />
  </svg>
);

const StoreIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar__nav-icon-svg">
    <path d="M4.5 9.5 6 5h12l1.5 4.5" />
    <path d="M5 9.5h14v9.5H5z" />
    <path d="M9 19V13h6v6" />
  </svg>
);

const HandshakeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar__nav-icon-svg">
    <path d="M8.5 12.5 11 15a2 2 0 0 0 2.8 0l2.4-2.4a2 2 0 0 1 2.8 0l1 1" />
    <path d="m3.5 11 3.6-3.6a2 2 0 0 1 2.8 0l2.1 2.1" />
    <path d="m20.5 11-2.6-2.6a2 2 0 0 0-2.8 0L12.8 11a2 2 0 0 1-2.8 0L8.6 9.6" />
    <path d="m2.8 12.2 3.1 3.1" />
    <path d="m18.1 15.3 2.8-2.8" />
  </svg>
);

const RocketIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar__nav-icon-svg">
    <path d="M14.5 4.5c2.7.1 5 2.3 5 5-2.8 1.5-5.8 4.5-7.4 7.3-2.7 0-4.9-2.2-4.9-4.9 2.8-1.6 5.8-4.6 7.3-7.4Z" />
    <path d="m9.2 14.8-2.7 2.7" />
    <path d="m7.3 16.7 2 2" />
    <circle cx="15.7" cy="8.3" r="1.2" />
  </svg>
);

const TrendIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar__nav-icon-svg">
    <path d="M4 18h16" />
    <path d="m6 15 4-4 3 2.5L18 8" />
    <path d="M18 8h-3" />
    <path d="M18 8v3" />
  </svg>
);

const BookIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar__nav-icon-svg">
    <path d="M6 5.5h8.5a3 3 0 0 1 3 3V19a2 2 0 0 0-2-2H6" />
    <path d="M6 5.5v11.5a2 2 0 0 1 2-2h9" />
    <path d="M6 5.5a2 2 0 0 0-2 2V19a2 2 0 0 1 2-2" />
  </svg>
);

const MailIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar__nav-icon-svg">
    <path d="M4.5 6.5h15v11h-15z" />
    <path d="m5.4 7.4 6.6 5.3 6.6-5.3" />
  </svg>
);

const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar__logout-icon">
    <path d="M10 6H6.5a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 6.5 18H10" />
    <path d="m13 8 4 4-4 4" />
    <path d="M9 12h8" />
  </svg>
);

function Sidebar({ user, onLogout }) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);

  const menuSections = useMemo(
    () => [
      {
        label: "Nghiệp vụ chính",
        items: [
          {
            label: "Dashboard",
            icon: SquareGridIcon,
            to: "/",
          },
          {
            label: "Tuyển dụng",
            icon: HandshakeIcon,
            to: "/module-1",
          },
          {
            label: "Đối tác & Đơn hàng",
            icon: StoreIcon,
            to: "/module-2",
          },
          {
            label: "Lịch thi",
            icon: RocketIcon,
            to: "/module-3",
          },
          {
            label: "Quản lý đào tạo",
            icon: BookIcon,
            to: "/module-9",
          },
          {
            label: "Hợp đồng dịch vụ",
            icon: SquareGridIcon,
            to: "/module-4",
          },
          {
            label: "Tài chính dịch vụ",
            icon: BarChartIcon,
            to: "/module-5",
          },
          {
            label: "Hồ sơ xuất cảnh",
            icon: TrendIcon,
            to: "/module-6",
          },
        ],
      },
      {
        label: "Mail",
        items: [
          { label: "Mail", icon: MailIcon, to: "/mail" },
        ],
      },
    ],
    []
  );

  const compactItems = useMemo(
    () => menuSections.flatMap((section) => section.items),
    [menuSections]
  );

  const displayName = user?.full_name || "Admin";
  const roleText = user?.role || t("sidebar.userRole");
  const avatar = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "AD";

  return (
    <aside className={`app-sidebar ${collapsed ? "sidebar--collapsed" : ""}`}>
      <button
        type="button"
        className="sidebar__toggle"
        onClick={() => setCollapsed((value) => !value)}
        aria-label={collapsed ? t("sidebar.expandSidebar") : t("sidebar.collapseSidebar")}
        aria-expanded={!collapsed}
      >
        <ChevronIcon direction={collapsed ? "right" : "left"} />
      </button>

      <div className="sidebar__rail"></div>

      <div className="sidebar__scroll">
        {collapsed ? (
          <nav className="sidebar__compact-nav" aria-label="Sidebar navigation">
            {compactItems.map(({ label, icon: Icon, to, badge }) => (
              <NavLink
                key={label}
                className={({ isActive }) =>
                  `sidebar__compact-item ${isActive ? "sidebar__compact-item--active" : ""}`
                }
                to={to}
                end={to === "/"}
                aria-label={label}
                title={label}
              >
                <Icon />
                {badge ? <span className="sidebar__compact-badge"></span> : null}
              </NavLink>
            ))}
          </nav>
        ) : (
          <>
            {menuSections.map((section) => (
              <section key={section.label} className="sidebar__menu-section">
                <div className="sidebar__section-header">
                  <div className="sidebar__section-label">{section.label}</div>
                  <span className="sidebar__section-action">
                    <ChevronIcon direction="down" />
                  </span>
                </div>
                <nav className="sidebar__nav" aria-label={section.label}>
                  {section.items.map(({ label, icon: Icon, to, badge }) => (
                    <NavLink
                      key={label}
                      className={({ isActive }) =>
                        `sidebar__nav-item ${isActive ? "sidebar__nav-item--active" : ""}`
                      }
                      to={to}
                      end={to === "/"}
                    >
                      <span className="sidebar__nav-active-marker" aria-hidden="true"></span>
                      <Icon />
                      <span className="sidebar__nav-text">{label}</span>
                      {badge ? <span className="sidebar__nav-badge"></span> : null}
                    </NavLink>
                  ))}
                </nav>
              </section>
            ))}
          </>
        )}
      </div>

      <div className="sidebar__user">
        <div className="sidebar__user-avatar">{avatar}</div>
        {!collapsed ? (
          <>
            <div className="sidebar__user-info">
              <div className="sidebar__user-name">{displayName}</div>
              <div className="sidebar__user-role">{roleText}</div>
            </div>
            <button
              type="button"
              className="sidebar__logout-button"
              aria-label={t("sidebar.logout")}
              onClick={onLogout}
            >
              <LogoutIcon />
            </button>
          </>
        ) : null}
      </div>
    </aside>
  );
}

export default Sidebar;
