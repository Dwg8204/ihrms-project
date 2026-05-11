import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Header.css";
import { useI18n } from "../i18n/I18nProvider";
import { recruitmentService } from "../services/recruitmentService";
import { partnerService } from "../services/partnerService";
import { jobOrderService } from "../services/jobOrderService";

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="header__icon-svg">
    <path
      d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PaletteIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="header__icon-svg">
    <path
      d="M12 3.5c-4.97 0-9 3.58-9 8 0 2.42 1.94 4.38 4.33 4.38H9a1.5 1.5 0 0 1 1.5 1.5c0 1.73 1.39 3.12 3.1 3.12 4.63 0 8.4-3.7 8.4-8.25 0-4.83-4.48-8.75-10-8.75Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="7.9" cy="11.2" r="1.05" fill="currentColor" />
    <circle cx="11.1" cy="8.4" r="1.05" fill="currentColor" />
    <circle cx="15.1" cy="8.7" r="1.05" fill="currentColor" />
    <circle cx="16.8" cy="12.3" r="1.05" fill="currentColor" />
  </svg>
);

const BellIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="header__icon-svg">
    <path
      d="M15.5 17H4.5l1.6-1.9v-4.2a5.4 5.4 0 1 1 10.8 0v4.2l1.6 1.9h-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10 19.2a2.1 2.1 0 0 0 4 0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="header__icon-svg">
    <path
      d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="m20 20-3.5-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CustomizeIcon = ({ children }) => (
  <span className="header__customize-icon">{children}</span>
);

const languageOptions = [
  { key: "vietnamese", label: "Tiếng Việt", icon: "VI" },
  { key: "english", label: "English", icon: "EN" },
  { key: "japanese", label: "日本語", icon: "JP" },
];

const colorOptions = [
  { key: "emerald", label: "Emerald", icon: "C" },
  { key: "blue", label: "Blue", icon: "C" },
  { key: "violet", label: "Violet", icon: "C" },
  { key: "rose", label: "Rose", icon: "C" },
  { key: "orange", label: "Orange", icon: "C" },
  { key: "slate", label: "Slate", icon: "C" },
];

function Header({ customizer, setCustomizer }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const searchInputRef = useRef(null);
  const searchBoxRef = useRef(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [searchResults, setSearchResults] = useState({
    candidates: [],
    partners: [],
    jobOrders: []
  });

  useEffect(() => {
    const onGlobalSearchShortcut = (event) => {
      const isSearchShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";

      if (!isSearchShortcut) return;

      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };

    window.addEventListener("keydown", onGlobalSearchShortcut);
    return () => window.removeEventListener("keydown", onGlobalSearchShortcut);
  }, []);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (!searchBoxRef.current?.contains(event.target)) {
        setShowSearchPanel(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    const keyword = searchKeyword.trim();

    if (keyword.length < 2) {
      setSearchLoading(false);
      setSearchResults({ candidates: [], partners: [], jobOrders: [] });
      return;
    }

    let cancelled = false;
    setSearchLoading(true);

    const timer = setTimeout(async () => {
      try {
        const [candidateRes, partnerRes, jobRes] = await Promise.all([
          recruitmentService.getCandidates({ page: 1, limit: 10, search: keyword }),
          partnerService.getPartners({ page: 1, limit: 10, search: keyword }),
          jobOrderService.getJobOrders({ page: 1, limit: 10, search: keyword })
        ]);

        if (cancelled) return;

        setSearchResults({
          candidates: Array.isArray(candidateRes?.data) ? candidateRes.data : [],
          partners: Array.isArray(partnerRes?.data) ? partnerRes.data : [],
          jobOrders: Array.isArray(jobRes?.data) ? jobRes.data : []
        });
      } catch (_error) {
        if (!cancelled) {
          setSearchResults({ candidates: [], partners: [], jobOrders: [] });
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchKeyword]);

  const hasSearchData =
    searchResults.candidates.length > 0 ||
    searchResults.partners.length > 0 ||
    searchResults.jobOrders.length > 0;

  const handlePickSearchItem = (path) => {
    navigate(path);
    setShowSearchPanel(false);
  };

  const panelClassName = useMemo(
    () => `header__customize-panel app-customizer--${customizer.color}`,
    [customizer.color]
  );

  const updateSetting = (key, value) => {
    setCustomizer((prev) => ({ ...prev, [key]: value }));
  };

  const customizeSections = [
    {
      title: t("header.theme"),
      key: "theme",
      options: [
        { key: "light", label: t("header.optionLight"), icon: "L" },
        { key: "dark", label: t("header.optionDark"), icon: "D" },
        { key: "system", label: t("header.optionSystem"), icon: "S" },
      ],
    },
    {
      title: t("header.color"),
      key: "color",
      options: colorOptions,
      gridClass: "header__customize-grid--color",
    },
    {
      title: t("header.density"),
      key: "density",
      options: [
        { key: "compact", label: t("header.optionCompact"), icon: "C" },
        { key: "comfortable", label: t("header.optionComfortable"), icon: "M" },
        { key: "spacious", label: t("header.optionSpacious"), icon: "S" },
      ],
    },
    {
      title: t("header.layout"),
      key: "layout",
      options: [
        { key: "sidebar", label: t("header.optionSidebar"), icon: "SB" },
        { key: "topnav", label: t("header.optionTopnav"), icon: "TN" },
      ],
    },
    {
      title: t("header.container"),
      key: "container",
      options: [
        { key: "fluid", label: t("header.optionFluid"), icon: "F" },
        { key: "boxed", label: t("header.optionBoxed"), icon: "B" },
      ],
    },
    {
      title: t("header.direction"),
      key: "direction",
      options: [
        { key: "ltr", label: t("header.optionLtr"), icon: "L" },
        { key: "rtl", label: t("header.optionRtl"), icon: "R" },
      ],
    },
    {
      title: t("header.language"),
      key: "language",
      options: languageOptions,
    },
  ];

  return (
    <>
      <header className="header">
        <div className="header__left">
          <div className="header__logo">
            <span className="header__logo-icon">F</span>
          </div>
          <div className="header__brand">
            <span className="header__brand-sub">DASHBOARD</span>
          </div>
        </div>

        <div className="header__center">
          <div className="header__search-wrap" ref={searchBoxRef}>
            <div className="header__search">
            <span className="header__search-icon">
              <SearchIcon />
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchKeyword}
              onFocus={() => setShowSearchPanel(true)}
              onChange={(event) => {
                setSearchKeyword(event.target.value);
                setShowSearchPanel(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setShowSearchPanel(false);
                  searchInputRef.current?.blur();
                  return;
                }

                if (event.key === "Enter" && searchResults.candidates[0]?.id) {
                  handlePickSearchItem(`/module-1?candidateId=${searchResults.candidates[0].id}`);
                }
              }}
              placeholder={t("header.searchPlaceholder")}
              aria-label={t("header.searchPlaceholder")}
            />
            </div>

            {showSearchPanel ? (
              <div className="header__search-panel">
                {searchKeyword.trim().length < 2 ? (
                  <p className="header__search-empty">Nhập ít nhất 2 ký tự để tìm nhanh ứng viên, đối tác, đơn hàng.</p>
                ) : searchLoading ? (
                  <p className="header__search-empty">Đang tìm kiếm...</p>
                ) : !hasSearchData ? (
                  <p className="header__search-empty">Không có kết quả phù hợp.</p>
                ) : (
                  <>
                    {searchResults.candidates.length ? (
                      <div className="header__search-group">
                        <h4>Ứng viên ({searchResults.candidates.length})</h4>
                        {searchResults.candidates.map((item) => (
                          <button
                            key={`candidate-${item.id}`}
                            type="button"
                            className="header__search-item"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handlePickSearchItem(`/module-1?candidateId=${item.id}`)}
                          >
                            <span className="header__search-item-title">{item.full_name || "Ứng viên"}</span>
                            <div className="header__search-item-meta">
                              <small>{item.phone || item.citizen_id || "Không có mã"}</small>
                              <small>{item.source_name || ""}</small>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {searchResults.partners.length ? (
                      <div className="header__search-group">
                        <h4>Đối tác ({searchResults.partners.length})</h4>
                        {searchResults.partners.map((item) => (
                          <button
                            key={`partner-${item.id}`}
                            type="button"
                            className="header__search-item"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handlePickSearchItem(`/module-2?partnerId=${item.id}`)}
                          >
                            <span className="header__search-item-title">{item.name || "Đối tác"}</span>
                            <div className="header__search-item-meta">
                              <small>{item.country || ""}</small>
                              <small>{item.phone || item.email || ""}</small>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {searchResults.jobOrders.length ? (
                      <div className="header__search-group">
                        <h4>Đơn hàng ({searchResults.jobOrders.length})</h4>
                        {searchResults.jobOrders.map((item) => (
                          <button
                            key={`job-${item.id}`}
                            type="button"
                            className="header__search-item"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handlePickSearchItem(`/module-2?jobOrderId=${item.id}`)}
                          >
                            <span className="header__search-item-title">{item.job_title || "Đơn hàng"}</span>
                            <div className="header__search-item-meta">
                              <small>{item.partner_name || ""}</small>
                              <small>{item.salary_info ? `${item.salary_info}` : item.matched_candidates_count ? `${item.matched_candidates_count} ứng viên phù hợp` : ""}</small>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="header__right">
          <button className="header__new-order">{t("common.newOrder")}</button>
          <button
            className="header__icon-button"
            aria-label="theme toggle"
            type="button"
            onClick={() =>
              updateSetting("theme", customizer.theme === "dark" ? "light" : "dark")
            }
          >
            <MoonIcon />
          </button>
          <button
            className={`header__icon-button ${isCustomizeOpen ? "header__icon-button--active" : ""}`}
            aria-label="palette"
            type="button"
            onClick={() => setIsCustomizeOpen((value) => !value)}
          >
            <PaletteIcon />
          </button>
          <div className="header__bell-wrapper">
            <button className="header__icon-button" aria-label="notifications" type="button">
              <BellIcon />
            </button>
            <span className="header__bell-dot"></span>
          </div>
          <div className="header__avatar">AS</div>
        </div>
      </header>

      {isCustomizeOpen ? (
        <>
          <div
            className="header__customize-backdrop"
            onClick={() => setIsCustomizeOpen(false)}
          ></div>
          <aside className={panelClassName}>
            <div className="header__customize-head">
              <div>
                <h3>{t("header.customizeTitle")}</h3>
                <p>{t("header.customizeDescription")}</p>
              </div>
              <button
                type="button"
                className="header__customize-close"
                onClick={() => setIsCustomizeOpen(false)}
              >
                X
              </button>
            </div>

            {customizeSections.map((section) => (
              <section key={section.key} className="header__customize-section">
                <h4>{section.title}</h4>
                <div
                  className={`header__customize-grid ${section.gridClass || ""}`.trim()}
                >
                  {section.options.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={`header__customize-option ${
                        customizer[section.key] === option.key
                          ? "header__customize-option--active"
                          : ""
                      } ${
                        section.key === "color"
                          ? `header__customize-option--${option.key}`
                          : ""
                      }`}
                      onClick={() => updateSetting(section.key, option.key)}
                    >
                      <CustomizeIcon>{option.icon}</CustomizeIcon>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}

            <button
              type="button"
              className="header__customize-reset"
              onClick={() =>
                setCustomizer({
                  theme: "light",
                  color: "violet",
                  density: "compact",
                  layout: "sidebar",
                  container: "fluid",
                  direction: "ltr",
                  language: "vietnamese",
                })
              }
            >
              {t("common.resetDefaults")}
            </button>
          </aside>
        </>
      ) : null}
    </>
  );
}

export default Header;
