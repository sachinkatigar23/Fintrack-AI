// Page title block: small mono "eyebrow", serif heading and description
export default function PageHeader({ eyebrow, title, description, children }) {
  return (
    <div className="page-hd">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="hd-sp" />
      {children && <div className="flex flex-wrap items-center gap-3 no-print">{children}</div>}
    </div>
  );
}
