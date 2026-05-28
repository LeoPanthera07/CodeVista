import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';

const icons = {
  success: <CheckCircle size={18} />,
  error: <AlertCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
};

function ToastItem({ toast }) {
  const { removeToast } = useApp();
  const { id, title, message, type = 'info', duration = 5000 } = toast;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
      className={`toast toast-${type}`}
      role="alert"
    >
      <div className="toast-icon">
        {icons[type] || icons.info}
      </div>
      <div className="toast-body">
        {title && <div className="toast-title">{title}</div>}
        {message && <div className="toast-message">{message}</div>}
      </div>
      <button
        className="toast-close"
        onClick={() => removeToast(id)}
        aria-label="Close notification"
      >
        <X size={14} />
      </button>
      <div
        className="toast-progress"
        style={{
          animationDuration: `${duration}ms`,
        }}
      />
    </motion.div>
  );
}

export default function ToastContainer() {
  const { state } = useApp();
  const { toasts } = state;

  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
