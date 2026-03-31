import { useI18n } from "../i18n/I18nProvider";

function SegmentTabs({ tabs, activeKey, onChange }) {
  const { t } = useI18n();

  return (
    <div className="tab-row" role="tablist" aria-label={t("common.tabs")}>
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={`tab-btn ${active ? "active" : ""}`}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentTabs;
