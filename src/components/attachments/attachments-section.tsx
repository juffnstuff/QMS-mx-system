"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon, Paperclip, Trash2, Upload, X, Pencil, Check } from "lucide-react";

type Attachment = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  caption: string | null;
  createdAt: string;
  uploadedBy: { id: string; name: string };
};

interface Props {
  recordType: string;
  recordId: string;
  currentUserId: string;
  isAdmin: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function AttachmentsSection({ recordType, recordId, currentUserId, isAdmin }: Props) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [lightbox, setLightbox] = useState<Attachment | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attachments?recordType=${recordType}&recordId=${recordId}`);
      if (res.ok) {
        setItems(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [recordType, recordId]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      setUploading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("recordType", recordType);
        form.append("recordId", recordId);
        for (const f of list) form.append("files", f);

        const res = await fetch("/api/attachments", { method: "POST", body: form });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Upload failed");
        } else {
          await load();
        }
      } catch {
        setError("Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [recordType, recordId, load]
  );

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      upload(e.target.files);
      e.target.value = "";
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) upload(e.dataTransfer.files);
  };

  const remove = async (a: Attachment) => {
    if (!window.confirm(`Delete "${a.filename}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/attachments/${a.id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((x) => x.id !== a.id));
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to delete");
    }
  };

  const saveCaption = async (a: Attachment) => {
    const res = await fetch(`/api/attachments/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption: editingCaption }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems((prev) => prev.map((x) => (x.id === a.id ? updated : x)));
      setEditingId(null);
    } else {
      alert("Failed to save caption");
    }
  };

  const canEditCaption = (a: Attachment) => isAdmin || a.uploadedBy.id === currentUserId;
  const canDelete = (_a: Attachment) => isAdmin;

  const images = items.filter((a) => isImage(a.mimeType));
  const docs = items.filter((a) => !isImage(a.mimeType));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Paperclip size={16} />
          Attachments
          {items.length > 0 && <span className="text-sm font-normal text-gray-500">({items.length})</span>}
        </h2>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          <Upload size={14} />
          {uploading ? "Uploading..." : "Upload"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv"
          onChange={onPick}
          className="hidden"
        />
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-md p-4 mb-4 text-center text-sm transition-colors ${
          dragOver ? "border-blue-400 bg-blue-50" : "border-gray-200 text-gray-500"
        }`}
      >
        Drag &amp; drop photos or documents here, or click <span className="font-medium">Upload</span>. Max 25 MB per file.
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading attachments…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No attachments yet.</p>
      ) : (
        <div className="space-y-5">
          {images.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Photos</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {images.map((a) => (
                  <div key={a.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => setLightbox(a)}
                      className="block w-full aspect-square bg-gray-100 rounded-md overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/attachments/${a.id}/download`}
                        alt={a.caption || a.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </button>
                    <div className="mt-1">
                      {editingId === a.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            value={editingCaption}
                            onChange={(e) => setEditingCaption(e.target.value)}
                            className="flex-1 text-xs border border-gray-300 rounded px-1.5 py-0.5"
                            placeholder="Caption"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => saveCaption(a)}
                            className="text-green-600 hover:text-green-700"
                            title="Save"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-gray-400 hover:text-gray-600"
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-700 truncate" title={a.caption || a.filename}>
                          {a.caption || a.filename}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 truncate">
                        {a.uploadedBy.name} • {formatBytes(a.sizeBytes)}
                      </p>
                    </div>
                    {(canEditCaption(a) || canDelete(a)) && editingId !== a.id && (
                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canEditCaption(a) && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(a.id);
                              setEditingCaption(a.caption || "");
                            }}
                            className="bg-white/90 hover:bg-white text-gray-700 rounded-full p-1 shadow-sm"
                            title="Edit caption"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                        {canDelete(a) && (
                          <button
                            type="button"
                            onClick={() => remove(a)}
                            className="bg-white/90 hover:bg-white text-red-600 rounded-full p-1 shadow-sm"
                            title="Delete (admin only)"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {docs.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Documents</h3>
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md">
                {docs.map((a) => (
                  <li key={a.id} className="p-3 flex items-center gap-3">
                    <FileText size={18} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <a
                        href={`/api/attachments/${a.id}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 block truncate"
                      >
                        {a.filename}
                      </a>
                      {editingId === a.id ? (
                        <div className="flex items-center gap-1 mt-1">
                          <input
                            value={editingCaption}
                            onChange={(e) => setEditingCaption(e.target.value)}
                            className="flex-1 text-xs border border-gray-300 rounded px-1.5 py-0.5"
                            placeholder="Caption"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => saveCaption(a)}
                            className="text-green-600 hover:text-green-700"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        a.caption && <p className="text-xs text-gray-600 mt-0.5">{a.caption}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {a.uploadedBy.name} • {formatBytes(a.sizeBytes)} • {new Date(a.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {(canEditCaption(a) || canDelete(a)) && editingId !== a.id && (
                      <div className="flex items-center gap-1">
                        {canEditCaption(a) && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(a.id);
                              setEditingCaption(a.caption || "");
                            }}
                            className="text-gray-400 hover:text-gray-700 p-1"
                            title="Edit caption"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {canDelete(a) && (
                          <button
                            type="button"
                            onClick={() => remove(a)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Delete (admin only)"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
            aria-label="Close"
          >
            <X size={24} />
          </button>
          <div onClick={(e) => e.stopPropagation()} className="max-w-6xl max-h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/attachments/${lightbox.id}/download`}
              alt={lightbox.caption || lightbox.filename}
              className="max-w-full max-h-[85vh] object-contain rounded"
            />
            <div className="mt-3 text-center text-sm text-white">
              <p className="font-medium">{lightbox.caption || lightbox.filename}</p>
              <p className="text-white/70 text-xs mt-1">
                {lightbox.uploadedBy.name} • {formatBytes(lightbox.sizeBytes)}
              </p>
              <a
                href={`/api/attachments/${lightbox.id}/download?download=1`}
                className="inline-block mt-2 text-blue-300 hover:text-blue-200 text-xs underline"
              >
                Download original
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
