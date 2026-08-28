const SIZE_CLASSES = {
  md: 'max-w-3xl',
  lg: 'max-w-4xl',
  xl: 'max-w-5xl',
};

function PageContainer({ size = 'xl', title, subtitle, actions, className = '', children }) {
  return (
    <div className={`mx-auto ${SIZE_CLASSES[size] || SIZE_CLASSES.xl} space-y-6 px-4 py-6 sm:px-6 sm:py-8 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {title && <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>}
            {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export default PageContainer;
