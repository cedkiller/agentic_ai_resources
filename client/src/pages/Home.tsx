import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import {
  TEMPLATE_STORAGE_KEY,
  addTemplate,
  deleteTemplate,
  resetTemplates,
  updateTemplate,
} from '../store/templatesSlice';
import { TEMPLATE_CATEGORIES, seedTemplates } from '../data/templates';
import type { TemplateItem } from '../data/templates';
import './Home.css';

const PAGE_SIZE = 24;
const PREVIEW_LENGTH = 180;

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy method */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

interface ModalState {
  open: boolean;
  mode: 'add' | 'edit';
  id: string;
  title: string;
  category: string;
  content: string;
  error: string;
}

interface ConfirmState {
  kind: 'delete' | 'reset';
  id: string;
  label: string;
}

const emptyModal: ModalState = {
  open: false,
  mode: 'add',
  id: '',
  title: '',
  category: TEMPLATE_CATEGORIES[0],
  content: '',
  error: '',
};

function Home() {
  const dispatch = useDispatch();
  const items = useSelector((state: RootState) => state.templates.items);

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [modal, setModal] = useState<ModalState>(emptyModal);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const copyTimer = useRef<number | undefined>(undefined);
  const toastTimer = useRef<number | undefined>(undefined);
  const toastSeq = useRef(0);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  // Persist every change to local storage. Initial state was already hydrated
  // from storage (or seeds on first run), so this only ever writes back what
  // the user actually has — it never erases anything on load.
  useEffect(() => {
    try {
      window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full or unavailable: keep in-memory state */
    }
  }, [items]);

  // Auto-dismiss toast + copied state.
  useEffect(() => {
    return () => {
      window.clearTimeout(copyTimer.current);
      window.clearTimeout(toastTimer.current);
    };
  }, []);

  // Focus title field + Esc handling while a dialog is open.
  useEffect(() => {
    if (!modal.open && !confirm) return;
    if (modal.open) titleInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModal(emptyModal);
        setConfirm(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modal.open, confirm]);

  function showToast(message: string) {
    window.clearTimeout(toastTimer.current);
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, message });
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }

  async function handleCopy(item: TemplateItem) {
    const ok = await writeToClipboard(item.content);
    window.clearTimeout(copyTimer.current);
    if (ok) {
      setCopiedId(item.id);
      showToast(`Copied "${item.title}"`);
      copyTimer.current = window.setTimeout(() => setCopiedId(null), 2000);
    } else {
      showToast('Copy failed — select the text manually');
    }
  }

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of items) map.set(t.category, (map.get(t.category) ?? 0) + 1);
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((t) => {
      if (activeCategory !== 'All' && t.category !== activeCategory) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.content.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [items, query, activeCategory]);

  const visible = filtered.slice(0, visibleCount);

  function saveModal() {
    const title = modal.title.trim();
    const content = modal.content.trim();
    const category = modal.category.trim() || 'General';
    if (!title || !content) {
      setModal({ ...modal, error: 'Please fill in both a title and content.' });
      return;
    }
    if (modal.mode === 'add') {
      dispatch(addTemplate({ title, category, content }));
      showToast(`Added "${title}"`);
    } else {
      dispatch(updateTemplate({ id: modal.id, title, category, content }));
      showToast(`Updated "${title}"`);
    }
    setModal(emptyModal);
  }

  function runConfirm() {
    if (!confirm) return;
    if (confirm.kind === 'delete') {
      dispatch(deleteTemplate(confirm.id));
      showToast(`Deleted "${confirm.label}"`);
    } else {
      dispatch(resetTemplates(seedTemplates));
      setQuery('');
      setActiveCategory('All');
      setVisibleCount(PAGE_SIZE);
      showToast('Restored the 200 default templates');
    }
    setConfirm(null);
  }

  function previewOf(content: string, id: string): string {
    if (expanded[id] || content.length <= PREVIEW_LENGTH) return content;
    return `${content.slice(0, PREVIEW_LENGTH).trimEnd()}…`;
  }

  return (
    <div className="tpb-page">
      <div className="tpb-wrap">
        <header className="tpb-hero">
          <div>
            <span className="tpb-eyebrow">Prompt Library</span>
            <h1>Template Copy-Paste Board</h1>
            <p className="tpb-sub">
              Browse reusable prompt templates, copy any of them in one click, and manage
              your own collection. Everything is saved automatically in this browser.
            </p>
          </div>
        </header>

        <div className="tpb-stats" aria-label="Library statistics">
          <span className="tpb-stat"><strong>{items.length}</strong> templates</span>
          <span className="tpb-stat"><strong>{counts.size}</strong> categories</span>
          <span className="tpb-stat">Saved locally</span>
        </div>

        <section className="tpb-toolbar" aria-label="Search and filter templates">
          <div className="tpb-searchrow">
            <div className="tpb-searchwrap">
              <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M7 2a5 5 0 1 0 3.54 8.54l2.46 2.46a1 1 0 0 0 1.42-1.42l-2.46-2.46A5 5 0 0 0 7 2Zm-3 5a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z" />
              </svg>
              <label className="sr-only" htmlFor="tpb-search">Search templates</label>
              <input
                id="tpb-search"
                className="tpb-input"
                type="search"
                placeholder="Search by title, keyword, or category…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
              />
              {query && (
                <button
                  type="button"
                  className="tpb-iconbtn tpb-clear"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path d="M8 6.59 11.7 2.9a1 1 0 0 1 1.4 1.4L9.41 8l3.69 3.7a1 1 0 0 1-1.4 1.4L8 9.41l-3.7 3.69a1 1 0 0 1-1.4-1.4L6.59 8 2.9 4.3a1 1 0 0 1 1.4-1.4L8 6.59Z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="tpb-chips" role="group" aria-label="Filter by category">
            <button
              type="button"
              className="tpb-chip"
              aria-pressed={activeCategory === 'All'}
              onClick={() => {
                setActiveCategory('All');
                setVisibleCount(PAGE_SIZE);
              }}
            >
              All<span className="tpb-chip-count">{items.length}</span>
            </button>
            {TEMPLATE_CATEGORIES.map((cat) => {
              const n = counts.get(cat) ?? 0;
              if (n === 0) return null;
              return (
                <button
                  key={cat}
                  type="button"
                  className="tpb-chip"
                  aria-pressed={activeCategory === cat}
                  onClick={() => {
                    setActiveCategory(cat);
                    setVisibleCount(PAGE_SIZE);
                  }}
                >
                  {cat}<span className="tpb-chip-count">{n}</span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="tpb-resultline">
          <span role="status" aria-live="polite">
            Showing {visible.length} of {filtered.length} template{filtered.length === 1 ? '' : 's'}
            {activeCategory !== 'All' ? ` in ${activeCategory}` : ''}
            {query.trim() ? ` matching "${query.trim()}"` : ''}
          </span>
        </div>

        {visible.length === 0 ? (
          <div className="tpb-empty">
            <h2>No templates found</h2>
            <p>Try a different keyword or category — or create a new template.</p>
            <button
              type="button"
              className="tpb-btn tpb-btn-ghost"
              onClick={() => {
                setQuery('');
                setActiveCategory('All');
              }}
            >
              Clear search &amp; filters
            </button>
          </div>
        ) : (
          <ul className="tpb-grid">
            {visible.map((item, index) => {
              const isCopied = copiedId === item.id;
              const isOpen = !!expanded[item.id];
              const long = item.content.length > PREVIEW_LENGTH;
              return (
                <li
                  key={item.id}
                  className="tpb-card"
                  style={{ animationDelay: `${Math.min(index, 11) * 35}ms` }}
                >
                  <div className="tpb-card-top">
                    <span className="tpb-badge" title={item.category}>{item.category}</span>
                    <span className="tpb-num">#{String(index + 1).padStart(3, '0')}</span>
                  </div>
                  <h3 className="tpb-title">{item.title}</h3>
                  <p className="tpb-preview">{previewOf(item.content, item.id)}</p>
                  {long && (
                    <button
                      type="button"
                      className="tpb-linkbtn"
                      aria-expanded={isOpen}
                      aria-label={isOpen ? `Collapse ${item.title}` : `Expand ${item.title}`}
                      onClick={() => setExpanded((p) => ({ ...p, [item.id]: !p[item.id] }))}
                    >
                      {isOpen ? 'Show less' : 'Show full text'}
                    </button>
                  )}
                  <div className="tpb-card-actions">
                    <button
                      type="button"
                      className={`tpb-btn ${isCopied ? 'tpb-btn-copied' : 'tpb-btn-primary'}`}
                      onClick={() => handleCopy(item)}
                      aria-label={isCopied ? `${item.title} copied` : `Copy ${item.title} to clipboard`}
                    >
                      {isCopied ? (
                        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
                          <path d="M13.3 4.3a1 1 0 0 0-1.4 0L6 10.2 4.1 8.3a1 1 0 0 0-1.4 1.4l2.6 2.6a1 1 0 0 0 1.4 0l6.6-6.6a1 1 0 0 0 0-1.4Z" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
                          <path d="M5 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H5Zm-1 2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4Z" opacity="0" />
                          <path d="M6 1.5A1.5 1.5 0 0 1 7.5 0h2A1.5 1.5 0 0 1 11 1.5V2h2.5a.5.5 0 0 1 .5.5v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5v-11A1.5 1.5 0 0 1 3.5 1H6v.5ZM7.5 1a.5.5 0 0 0-.5.5V2h3v-.5a.5.5 0 0 0-.5-.5h-2ZM3 3v10.5a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V3H3Z" />
                        </svg>
                      )}
                      {isCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {filtered.length > visibleCount && (
          <div className="tpb-more">
            <button
              type="button"
              className="tpb-btn tpb-btn-ghost"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            >
              Show more ({filtered.length - visibleCount} remaining)
            </button>
          </div>
        )}

        <footer className="tpb-footer">
          <span>&copy; 2026 Created and Developed by Cedrick Jasper R. Sarabia. All Rights Reserved.</span>
          <button
            type="button"
            className="tpb-linkbtn"
            onClick={() => setConfirm({ kind: 'reset', id: '', label: 'all templates' })}
          >
            Restore 200 defaults
          </button>
        </footer>
      </div>

      {modal.open && (
        <div className="tpb-overlay" onClick={() => setModal(emptyModal)}>
          <div
            className="tpb-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tpb-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="tpb-modal-title">{modal.mode === 'add' ? 'Add template' : 'Edit template'}</h2>
            <p className="tpb-modal-sub">
              {modal.mode === 'add'
                ? 'Create a reusable prompt for your board.'
                : 'Update the title, category, or content.'}
            </p>
            {modal.error && (
              <p className="tpb-error" role="alert">{modal.error}</p>
            )}
            <div className="tpb-field">
              <label htmlFor="tpb-field-title">Title</label>
              <input
                id="tpb-field-title"
                ref={titleInputRef}
                className="tpb-input"
                type="text"
                placeholder="e.g. Code Review"
                value={modal.title}
                maxLength={120}
                onChange={(e) => setModal({ ...modal, title: e.target.value })}
              />
            </div>
            <div className="tpb-field">
              <label htmlFor="tpb-field-category">Category</label>
              <select
                id="tpb-field-category"
                className="tpb-select"
                value={TEMPLATE_CATEGORIES.includes(modal.category) ? modal.category : 'Custom'}
                onChange={(e) => setModal({ ...modal, category: e.target.value })}
              >
                {TEMPLATE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                {!TEMPLATE_CATEGORIES.includes(modal.category) && (
                  <option value="Custom">{modal.category || 'Custom'}</option>
                )}
              </select>
            </div>
            <div className="tpb-field">
              <label htmlFor="tpb-field-content">Content</label>
              <textarea
                id="tpb-field-content"
                className="tpb-textarea"
                placeholder="Write or paste the full prompt text…"
                value={modal.content}
                onChange={(e) => setModal({ ...modal, content: e.target.value })}
              />
            </div>
            <div className="tpb-modal-actions">
              <button type="button" className="tpb-btn tpb-btn-ghost" onClick={() => setModal(emptyModal)}>
                Cancel
              </button>
              <button type="button" className="tpb-btn tpb-btn-primary" onClick={saveModal}>
                {modal.mode === 'add' ? 'Add template' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="tpb-overlay" onClick={() => setConfirm(null)}>
          <div
            className="tpb-modal tpb-modal-sm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="tpb-confirm-title"
            aria-describedby="tpb-confirm-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="tpb-confirm-title">
              {confirm.kind === 'delete' ? 'Delete template?' : 'Restore defaults?'}
            </h2>
            <p className="tpb-modal-sub" id="tpb-confirm-desc">
              {confirm.kind === 'delete'
                ? `"${confirm.label}" will be removed from this browser. This cannot be undone.`
                : 'Your current list will be replaced with the 200 default templates.'}
            </p>
            <div className="tpb-modal-actions">
              <button type="button" className="tpb-btn tpb-btn-ghost" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button type="button" className="tpb-btn tpb-btn-danger" onClick={runConfirm}>
                {confirm.kind === 'delete' ? 'Delete' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div key={toast.id} className="tpb-toast" role="status" aria-live="polite">
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm3.53 5.47a.75.75 0 0 0-1.06 0L7 8.94 5.53 7.47a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4-4a.75.75 0 0 0 0-1.06Z" />
          </svg>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default Home;
