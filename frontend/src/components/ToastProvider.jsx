import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

function getTitleByType(type) {
  if (type === 'success') return 'Thành công';
  if (type === 'error') return 'Lỗi';
  if (type === 'warning') return 'Cảnh báo';
  return 'Thông báo';
}

function ToastItem({ toast, onClose }) {
  return (
    <div className={`app-toast app-toast--${toast.type}`} role="status" aria-live="polite">
      <div className="app-toast__content">
        <p className="app-toast__title">{getTitleByType(toast.type)}</p>
        <p className="app-toast__message">{toast.message}</p>
      </div>
      <button className="app-toast__close" type="button" onClick={() => onClose(toast.id)}>
        Đóng
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timeoutId = timersRef.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timersRef.current.delete(id);
    }

    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (message, type = 'info', options = {}) => {
      if (!message) return null;

      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const duration = Number.isFinite(options.duration) ? options.duration : 3600;

      setToasts((prev) => [...prev, { id, message: String(message), type }]);

      if (duration > 0) {
        const timeoutId = setTimeout(() => {
          dismiss(id);
        }, duration);
        timersRef.current.set(id, timeoutId);
      }

      return id;
    },
    [dismiss]
  );

  const clear = useCallback(() => {
    timersRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const api = useMemo(
    () => ({
      push,
      dismiss,
      clear,
      success: (message, options) => push(message, 'success', options),
      error: (message, options) => push(message, 'error', options),
      warning: (message, options) => push(message, 'warning', options),
      info: (message, options) => push(message, 'info', options)
    }),
    [clear, dismiss, push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="app-toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
