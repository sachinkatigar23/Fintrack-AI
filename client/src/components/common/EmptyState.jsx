import { Plus } from "./icons.js";

// "Nothing here yet" panel with an optional call-to-action button
export default function EmptyState({ icon, title, text, actionLabel, onAction }) {
  return (
    <div className="empty">
      <div className="eic">{icon}</div>
      <b>{title}</b>
      {text && <p>{text}</p>}
      {actionLabel && (
        <button type="button" className="btn primary" onClick={onAction}>
          <Plus /> {actionLabel}
        </button>
      )}
    </div>
  );
}
