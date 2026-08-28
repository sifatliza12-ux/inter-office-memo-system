function Card({ as: Tag = 'div', hoverable = false, padded = true, className = '', children, ...props }) {
  return (
    <Tag
      className={`rounded-xl border border-stone-200/80 bg-white shadow-card transition-all duration-200 ease-out ${
        hoverable ? 'hover:-translate-y-0.5 hover:shadow-card-hover' : ''
      } ${padded ? 'p-5 sm:p-6' : ''} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}

export default Card;
