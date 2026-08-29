import { StatusBadge } from './ui/Badge.jsx';

// Technical document-identifier strip — deliberately reads like a metadata
// header on a real memo, not a dashboard stat card. FROM/TO map onto the
// existing author/department fields exactly as Stage 2's Document Composer
// already does (the memo model has no literal "to" field); no new data.
function MetadataCell({ label, value, className = '' }) {
  return (
    <div className={`px-4 py-3 sm:px-5 ${className}`}>
      <p className="truncate text-sm font-semibold text-stone-800">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">{label}</p>
    </div>
  );
}

function MemoMetadataBar({ memo, fromLabel, toLabel }) {
  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-panel sm:grid-cols-4 sm:divide-y-0">
      <MetadataCell label="ID" value={<span className="font-mono text-tangerine-600">{memo.referenceNumber}</span>} />
      <MetadataCell label="From" value={fromLabel || '—'} />
      <MetadataCell label="To" value={toLabel || '—'} />
      <div className="px-4 py-3 sm:px-5">
        <StatusBadge status={memo.status} className="text-sm font-semibold" />
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">Status</p>
      </div>
    </div>
  );
}

export default MemoMetadataBar;
