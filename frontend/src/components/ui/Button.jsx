const VARIANT_CLASSES = {
  // tangerine-700, not -500: white text on -500 measures 2.8:1, well under
  // the 4.5:1 AA text minimum — verified live via computed-style contrast
  // measurement, not assumed from the swatch alone. -700 measures ~5.4:1.
  primary:
    'bg-tangerine-700 text-white shadow-sm hover:bg-tangerine-800 focus-visible:ring-tangerine-300 disabled:hover:bg-tangerine-700',
  secondary:
    'bg-blue-800 text-white shadow-sm hover:bg-blue-700 focus-visible:ring-blue-300 disabled:hover:bg-blue-800',
  outline:
    'border border-stone-300 bg-white text-stone-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 focus-visible:ring-blue-200',
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
