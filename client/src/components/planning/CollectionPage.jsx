import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "../common/icons.js";
import toast from "react-hot-toast";
import PageHeader from "../common/PageHeader.jsx";
import EmptyState from "../common/EmptyState.jsx";
import Skeleton from "../common/Skeleton.jsx";
import Modal from "../common/Modal.jsx";
import { collectionApi } from "../../services/financeApi.js";
import { errorMessage } from "../../api/axios.js";
import { toInputDate } from "../../utils/format.js";

const DEFAULT_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);

/**
 * Generic list + add/edit page used by Budgets, Savings goals, Bills and Recurring.
 *  - endpoint:   API path, e.g. "/budgets"
 *  - fields:     form fields [{ name, label, type, options, default, required, full, hint }]
 *  - renderCard: (record, helpers) => card body
 *  - params / summary / toolbar: optional extras (month filter, totals)
 */
export default function CollectionPage({
  title,
  singular,
  description,
  eyebrow = "PLANNING SPACE",
  endpoint,
  icon = DEFAULT_ICON,
  fields,
  renderCard,
  params,
  toolbar,
  renderSummary,
  toForm,
  fromForm,
}) {
  const api = collectionApi(endpoint);
  const [records, setRecords] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, record: null });
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const blank = useCallback(
    () => Object.fromEntries(fields.map((f) => [f.name, typeof f.default === "function" ? f.default() : f.default ?? ""])),
    [fields]
  );

  const load = useCallback(() => {
    api
      .list(params)
      .then((d) => {
        setRecords(d.records || []);
        setMeta(d);
      })
      .catch((err) => toast.error(errorMessage(err, `Could not load ${title.toLowerCase()}`)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, JSON.stringify(params || {})]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setForm(blank());
    setModal({ open: true, record: null });
  };

  const openEdit = (record) => {
    const values = toForm
      ? toForm(record)
      : Object.fromEntries(
          fields.map((f) => {
            const v = record[f.name];
            return [f.name, f.type === "date" && v ? toInputDate(v) : v ?? ""];
          })
        );
    setForm(values);
    setModal({ open: true, record });
  };

  const changed = () => {
    window.dispatchEvent(new Event("fintrack:data-changed"));
    load();
  };

  const save = async (e) => {
    e.preventDefault();
    for (const f of fields) {
      if (f.required !== false && (form[f.name] === "" || form[f.name] === undefined)) {
        return toast.error(`${f.label} is required`);
      }
    }
    const payload = fromForm ? fromForm(form) : { ...form };
    fields.forEach((f) => {
      if (f.type === "number" && payload[f.name] !== "") payload[f.name] = Number(payload[f.name]);
    });

    setSaving(true);
    try {
      if (modal.record) await api.update(modal.record._id, payload);
      else await api.create(payload);
      toast.success(modal.record ? "Saved" : `${singular} added`);
      setModal({ open: false, record: null });
      changed();
    } catch (err) {
      toast.error(errorMessage(err, "Could not save"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (record) => {
    if (!window.confirm(`Delete "${record.name || record.title}"?`)) return;
    try {
      await api.remove(record._id);
      toast.success("Deleted");
      changed();
    } catch (err) {
      toast.error(errorMessage(err, "Could not delete"));
    }
  };

  // Extra actions used by cards (pay a bill, add a contribution, pause ...)
  const helpers = {
    reload: changed,
    edit: openEdit,
    action: async (record, action, body, message) => {
      try {
        await api.action(record._id, action, body);
        if (message) toast.success(message);
        changed();
      } catch (err) {
        toast.error(errorMessage(err, "Action failed"));
      }
    },
    update: async (record, body, message) => {
      try {
        await api.update(record._id, body);
        if (message) toast.success(message);
        changed();
      } catch (err) {
        toast.error(errorMessage(err, "Could not update"));
      }
    },
  };

  const plural = title.toLowerCase();

  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description}>
        {toolbar}
        <button type="button" className="btn primary" onClick={openNew}>
          <Plus /> Add new
        </button>
      </PageHeader>

      {renderSummary && !loading && records.length > 0 && renderSummary(meta, records)}

      {loading ? (
        <div className="grid g3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ height: 150 }} />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={icon}
            title={`No ${plural} found`}
            text={`You haven't set up any ${plural} yet. Add one to get started.`}
            actionLabel={`Create your first ${singular.toLowerCase()}`}
            onAction={openNew}
          />
        </div>
      ) : (
        <div className="grid g3">
          {records.map((record) => (
            <div key={record._id} className="card bcard group" onClick={() => openEdit(record)}>
              <div className="acts" style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }} onClick={(e) => e.stopPropagation()}>
                <button type="button" aria-label="Edit" onClick={() => openEdit(record)}>
                  <Pencil />
                </button>
                <button type="button" className="del" aria-label="Delete" onClick={() => remove(record)}>
                  <Trash2 />
                </button>
              </div>
              {renderCard(record, helpers)}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, record: null })}
        title={modal.record ? `Edit ${singular.toLowerCase()}` : `Add ${singular.toLowerCase()}`}
      >
        <form onSubmit={save} noValidate>
          <div className="form-grid">
            {fields.map((f) => {
              const options = typeof f.options === "function" ? f.options(form) : f.options;
              return (
                <label key={f.name} className={`field${f.full ? " full" : ""}`}>
                  <span className="flabel">
                    {f.label}
                    {f.required === false && <em>(optional)</em>}
                  </span>
                  {options ? (
                    <select
                      className="select"
                      value={form[f.name] ?? ""}
                      onChange={(e) => setForm((v) => ({ ...v, [f.name]: e.target.value, ...(f.onChange ? f.onChange(e.target.value, v) : {}) }))}
                    >
                      {options.map((o) => {
                        const [value, label] = Array.isArray(o) ? o : [o, o];
                        return (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      className="input"
                      type={f.type || "text"}
                      step={f.type === "number" ? "0.01" : undefined}
                      min={f.type === "number" ? "0" : undefined}
                      placeholder={f.hint || ""}
                      value={form[f.name] ?? ""}
                      onChange={(e) => setForm((v) => ({ ...v, [f.name]: e.target.value }))}
                    />
                  )}
                </label>
              );
            })}
          </div>
          <div className="modal-ft">
            <button type="button" className="btn ghost" onClick={() => setModal({ open: false, record: null })}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving && <span className="spin" />}
              {modal.record ? "Save changes" : `Add ${singular.toLowerCase()}`}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
