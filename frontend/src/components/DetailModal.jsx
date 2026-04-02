function DetailModal({ open, title, onClose, children, footer }) {
  if (!open) return null;

  return (
    <div className="detail-modal-overlay" role="dialog" aria-modal="true">
      <div className="detail-modal-card">
        <div className="detail-modal-head">
          <h3>{title}</h3>
          <button className="btn text" type="button" onClick={onClose}>
            Đóng
          </button>
        </div>
        <div className="detail-modal-body">{children}</div>
        {footer ? <div className="detail-modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export default DetailModal;
