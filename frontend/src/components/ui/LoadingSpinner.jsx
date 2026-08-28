const SIZE_CLASSES = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-9 w-9 border-[3px]',
};

function LoadingSpinner({ size = 'md', label, className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-2.5 ${className}`}>
      <span
        className={`inline-block animate-spin rounded-full border-plum-200 border-t-plum-600 ${SIZE_CLASSES[size] || SIZE_CLASSES.md}`}
        aria-hidden="true"
      />
      {label && <span className="text-sm text-stone-500">{label}</span>}
    </div>
  );
}

export default LoadingSpinner;
