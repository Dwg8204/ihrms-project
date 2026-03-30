function SegmentTabs({ tabs, activeKey, onChange }) {
  return (
    <div className="tab-row" role="tablist" aria-label="Nhóm thẻ">
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={`tab-btn ${active ? 'active' : ''}`}
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
