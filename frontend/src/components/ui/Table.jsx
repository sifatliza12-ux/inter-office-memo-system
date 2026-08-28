export function Table({ className = '', children }) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-stone-200/80 bg-white shadow-card ${className}`}>
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }) {
  return (
    <thead>
      <tr className="border-b border-stone-200 text-xs font-semibold uppercase tracking-wide text-stone-500">
        {children}
      </tr>
    </thead>
  );
}

export function Th({ className = '', children }) {
  return <th className={`whitespace-nowrap px-4 py-3 font-semibold ${className}`}>{children}</th>;
}

export function Tr({ className = '', children, ...props }) {
  return (
    <tr className={`border-b border-stone-100 transition-colors last:border-0 hover:bg-stone-50 ${className}`} {...props}>
      {children}
    </tr>
  );
}

export function Td({ className = '', children, ...props }) {
  return (
    <td className={`px-4 py-3 align-middle text-stone-700 ${className}`} {...props}>
      {children}
    </td>
  );
}

export default Table;
