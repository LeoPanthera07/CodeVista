import { motion } from 'framer-motion';

const variants = {
  default: 'glass-card',
  hover: 'glass-card glass-card-hover',
  bordered: 'glass-card glass-card-bordered',
  glow: 'glass-card glass-card-glow',
};

export default function GlassCard({
  children,
  variant = 'default',
  className = '',
  animate = true,
  delay = 0,
  onClick,
  ...props
}) {
  const baseClass = variants[variant] || variants.default;

  if (!animate) {
    return (
      <div className={`${baseClass} ${className}`} onClick={onClick} {...props}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={`${baseClass} ${className}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      {...props}
    >
      {children}
    </motion.div>
  );
}
