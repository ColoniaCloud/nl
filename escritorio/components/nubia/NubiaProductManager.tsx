"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Pencil, Trash2, Star, Loader2, Sparkles, X, Check, Upload, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  description_enhanced: string | null;
  price: number;
  compare_price: number | null;
  images: string[];
  featured: number;
  active: number;
  category_id: number | null;
}

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface Props {
  projectId: number;
  industry: string | null;
}

export default function NubiaProductManager({ projectId, industry }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [saving, setSaving] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const [pRes, cRes] = await Promise.all([
      fetch(`/api/nubia/products?project_id=${projectId}`),
      fetch(`/api/nubia/categories?project_id=${projectId}`),
    ]);
    const pData = await pRes.json();
    const cData = await cRes.json();
    setProducts(pData.products ?? []);
    setCategories(cData.categories ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [projectId]);

  async function saveProduct() {
    if (!editing?.name?.trim() || editing.price === undefined) return;
    setSaving(true);
    const isNew = !editing.id;
    const method = isNew ? "POST" : "PATCH";
    const body = isNew
      ? { project_id: projectId, ...editing }
      : { project_id: projectId, id: editing.id, ...editing };

    await fetch("/api/nubia/products", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    setEditing(null);
    load();
  }

  async function deleteProduct(id: number) {
    if (!confirm("Eliminar este producto?")) return;
    await fetch("/api/nubia/products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, project_id: projectId }),
    });
    load();
  }

  async function enhanceDescription() {
    if (!editing?.name) return;
    setEnhancing(true);
    const res = await fetch("/api/nubia/enhance-description", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        product_id: editing.id,
        product_name: editing.name,
        description: editing.description || "",
        industry,
      }),
    });
    const data = await res.json();
    if (data.description_enhanced) {
      setEditing((p) => ({ ...p, description_enhanced: data.description_enhanced }));
    }
    setEnhancing(false);
  }

  async function addCategory() {
    if (!newCatName.trim()) return;
    await fetch("/api/nubia/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, name: newCatName }),
    });
    setNewCatName("");
    load();
  }

  async function uploadImage(file: File) {
    if (uploading) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("project_id", String(projectId));
      formData.append("file", file);
      const res = await fetch("/api/nubia/product-image", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        setEditing((p) => ({ ...p, images: [...(p?.images || []), data.url] }));
      }
    } catch {}
    setUploading(false);
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) uploadImage(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadImage(file);
    e.target.value = "";
  }

  function removeImage(idx: number) {
    setEditing((p) => ({ ...p, images: (p?.images || []).filter((_, i) => i !== idx) }));
  }

  const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Productos</h2>
        <button
          onClick={() => setEditing({ images: [], active: 1, featured: 0 })}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo producto
        </button>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500 font-medium">Categorias:</span>
        {categories.map((c) => (
          <span key={c.id} className="text-xs px-2 py-1 rounded-full bg-zinc-700 text-zinc-300">{c.name}</span>
        ))}
        <div className="flex items-center gap-1">
          <input
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
            placeholder="+ Nueva categoria"
            className="text-xs bg-transparent border border-zinc-700 rounded-full px-3 py-1 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 w-36"
          />
          {newCatName && (
            <button onClick={addCategory} className="p-1 text-green-400 hover:text-green-300">
              <Check className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Product list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <p className="mb-3">Aun no hay productos.</p>
          <button onClick={() => setEditing({ images: [], active: 1, featured: 0 })} className="text-violet-400 hover:text-violet-300 text-sm underline">
            Agrega el primero
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className={cn("flex items-center gap-3 p-3 rounded-xl border border-zinc-700/50 bg-zinc-800/50", !p.active && "opacity-50")}>
              {p.images?.[0] ? (
                <img src={p.images[0]} alt={p.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-zinc-700" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-zinc-700 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-100 truncate">{p.name}</span>
                  {p.featured === 1 && <Star className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                </div>
                <span className="text-sm text-zinc-400">${Number(p.price).toLocaleString("es-AR")}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setEditing(p)} className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => deleteProduct(p.id)} className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-zinc-100">{editing.id ? "Editar producto" : "Nuevo producto"}</h3>
              <button onClick={() => setEditing(null)} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400"><X className="w-4 h-4" /></button>
            </div>

            {[
              { key: "name", label: "Nombre *", type: "text" },
              { key: "price", label: "Precio *", type: "number" },
              { key: "compare_price", label: "Precio original (tachado)", type: "number" },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="block text-xs text-zinc-400 mb-1">{label}</label>
                <input
                  type={type}
                  value={(editing as any)[key] ?? ""}
                  onChange={(e) => {
                    const val = type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value;
                    setEditing((p) => ({ ...p, [key]: val }));
                    if (key === "name" && !editing.id) {
                      setEditing((p) => ({ ...p, slug: slugify(e.target.value) }));
                    }
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-violet-500"
                />
              </div>
            ))}

            {/* Category */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Categoria</label>
              <select
                value={editing.category_id ?? ""}
                onChange={(e) => setEditing((p) => ({ ...p, category_id: e.target.value ? Number(e.target.value) : null }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-violet-500"
              >
                <option value="">Sin categoria</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-zinc-400">Descripcion</label>
                <button onClick={enhanceDescription} disabled={enhancing || !editing.name} className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 disabled:opacity-40">
                  {enhancing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Mejorar con IA
                </button>
              </div>
              <textarea
                value={editing.description ?? ""}
                onChange={(e) => setEditing((p) => ({ ...p, description: e.target.value }))}
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 resize-none"
                placeholder="Descripcion del producto..."
              />
              {editing.description_enhanced && (
                <div className="mt-2 bg-violet-950/50 border border-violet-700/50 rounded-xl p-3 text-xs text-zinc-300">
                  <span className="text-violet-400 font-medium block mb-1">Version mejorada por IA:</span>
                  {editing.description_enhanced}
                </div>
              )}
            </div>

            {/* Images upload */}
            <div>
              <label className="block text-xs text-zinc-400 mb-2">Imagenes del producto</label>
              {/* Thumbnails */}
              {(editing.images || []).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {(editing.images || []).map((img, idx) => (
                    <div key={idx} className="relative group w-16 h-16">
                      <img src={img} alt="" className="w-full h-full object-cover rounded-lg border border-zinc-700" />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* Drop zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-700 hover:border-violet-500 rounded-xl p-4 text-center cursor-pointer transition-colors"
              >
                {uploading ? (
                  <div className="flex items-center justify-center gap-2 text-zinc-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-xs">Subiendo...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-zinc-500">
                    <ImagePlus className="w-6 h-6" />
                    <span className="text-xs">Arrastra una imagen o haz clic para seleccionar</span>
                    <span className="text-[10px] text-zinc-600">PNG, JPG, WebP hasta 5MB</span>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Flags */}
            <div className="flex gap-6">
              {[
                { key: "active", label: "Activo" },
                { key: "featured", label: "Destacado" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean((editing as any)[key])}
                    onChange={(e) => setEditing((p) => ({ ...p, [key]: e.target.checked ? 1 : 0 }))}
                    className="rounded border-zinc-600 bg-zinc-800"
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditing(null)} className="flex-1 py-2 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800 transition-colors">
                Cancelar
              </button>
              <button onClick={saveProduct} disabled={saving || !editing.name} className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
