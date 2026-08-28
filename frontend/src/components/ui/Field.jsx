function Field({ label, htmlFor, error, required, hint, children }) {
  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-tangerine-500">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-stone-400">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

export default Field;
