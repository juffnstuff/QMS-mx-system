"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Trash2, Pencil, Check, X, Plus } from "lucide-react";

interface Note {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
}

interface Props {
  recordType: string;
  recordId: string;
  currentUserId: string;
  isAdmin: boolean;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function NotesSection({ recordType, recordId, currentUserId, isAdmin }: Props) {
  const [items, setItems] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newBody, setNewBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/notes?recordType=${recordType}&recordId=${recordId}`,
      );
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }, [recordType, recordId]);

  useEffect(() => {
    load();
  }, [load]);

  const canModify = (n: Note) => isAdmin || n.createdBy.id === currentUserId;

  async function addNote() {
    if (!newBody.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordType, recordId, body: newBody }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to add note");
        return;
      }
      setNewBody("");
      setAdding(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(n: Note) {
    if (!editingBody.trim()) return;
    const res = await fetch(`/api/notes/${n.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: editingBody }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems((prev) => prev.map((x) => (x.id === n.id ? updated : x)));
      setEditingId(null);
    } else {
      alert("Failed to save note");
    }
  }

  async function remove(n: Note) {
    if (!window.confirm("Delete this note? This cannot be undone.")) return;
    const res = await fetch(`/api/notes/${n.id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((x) => x.id !== n.id));
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to delete");
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <MessageSquare size={16} />
          Notes
          {items.length > 0 && (
            <span className="text-sm font-normal text-gray-500">({items.length})</span>
          )}
        </h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus size={14} />
            Add note
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {adding && (
        <div className="mb-4 border border-gray-200 rounded-md p-3 bg-gray-50">
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            rows={3}
            autoFocus
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Write a note…"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={addNote}
              disabled={saving || !newBody.trim()}
              className="bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {saving ? "Saving…" : "Save note"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setNewBody("");
                setError(null);
              }}
              className="text-gray-600 hover:text-gray-800 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading notes…</p>
      ) : items.length === 0 && !adding ? (
        <p className="text-sm text-gray-500">No notes yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md">
          {items.map((n) => (
            <li key={n.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-gray-500 mb-1">
                    <span className="font-medium text-gray-700">{n.createdBy.name}</span>
                    {" • "}
                    {formatWhen(n.createdAt)}
                    {n.updatedAt !== n.createdAt && (
                      <span className="text-gray-400"> (edited)</span>
                    )}
                  </div>
                  {editingId === n.id ? (
                    <div>
                      <textarea
                        value={editingBody}
                        onChange={(e) => setEditingBody(e.target.value)}
                        rows={3}
                        autoFocus
                        className="w-full border border-gray-300 rounded-md px-2 py-1 text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(n)}
                          className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 text-sm"
                        >
                          <Check size={14} /> Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm"
                        >
                          <X size={14} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{n.body}</p>
                  )}
                </div>
                {canModify(n) && editingId !== n.id && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(n.id);
                        setEditingBody(n.body);
                      }}
                      className="text-gray-400 hover:text-gray-700 p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md hover:bg-gray-100"
                      title="Edit note"
                      aria-label="Edit note"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(n)}
                      className="text-red-500 hover:text-red-700 p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md hover:bg-red-50"
                      title="Delete note"
                      aria-label="Delete note"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
