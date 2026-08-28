const VARIANT_CLASSES = {
  primary:
    'bg-terracotta-500 text-white shadow-sm hover:bg-terracotta-600 focus-visible:ring-terracotta-300 disabled:hover:bg-terracotta-500',
  secondary:
    'bg-plum-800 text-white shadow-sm hover:bg-plum-700 focus-visible:ring-plum-300 disabled:hover:bg-plum-800',
  outline:
    'border border-stone-300 bg-white text-stone-700 hover:border-plum-300 hover:bg-plum-50 hover:text-plum-800 focus-visible:ring-plum-200',
  ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-stone-200',
  danger:
    'bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-300 disabled:hover:bg-red-600',
};

const SIZE_CLASSES = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary} ${SIZE_CLASSES[size] || SIZE_CLASSES.md} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
