function BarChart({ rows, valueKey, labelKey, suffix = '', color = 'teal' }) {
  const max = Math.max(...rows.map((row) => Number(row[valueKey] || 0)), 1);

  return (
    <div className="bar-chart">
      {rows.map((row) => {
        const value = Number(row[valueKey] || 0);
        const width = (value / max) * 100;

        return (
          <div className="bar-row" key={`${row[labelKey]}-${value}`}>
            <div className="bar-label" title={row[labelKey]}>
              {row[labelKey]}
            </div>
            <div className="bar-track">
              <div
                className={`bar-fill ${color}`}
                style={{ width: `${Math.max(width, 4)}%` }}
              >
                <span>
                  {value}
                  {suffix}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      {!rows.length ? <p className="muted">Chưa có dữ liệu.</p> : null}
    </div>
  );
}

export default BarChart;
