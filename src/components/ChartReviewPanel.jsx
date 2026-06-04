import { useState, useEffect, useRef } from "react"
import { supabase } from "../lib/supabase"

const STATUS_STYLE = {
  pending:  { bg: "rgba(245,158,11,0.15)",  color: "#fbbf24", label: "Pendiente" },
  reviewed: { bg: "rgba(16,185,129,0.15)",  color: "#10b981", label: "Revisado"  },
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.pending
  return (
    <span style={{ fontSize: "10px", background: s.bg, color: s.color, padding: "2px 8px", borderRadius: "999px", fontWeight: "700" }}>
      {s.label}
    </span>
  )
}

function ImageModal({ submission, isAdmin, onClose, onSave }) {
  const [notes, setNotes] = useState(submission.admin_notes || "")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(submission.id, notes)
    setSaving(false)
    onClose()
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
    >
      <div style={{
        width: "100%", maxWidth: "820px",
        background: "var(--card-bg)",
        borderRadius: "20px",
        border: "1px solid rgba(148,163,184,0.1)",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        maxHeight: "90vh",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border-nav)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-1)" }}>
              {submission.profiles?.email || "Estudiante"}
            </div>
            <StatusBadge status={submission.status} />
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "18px", padding: "4px" }}>✕</button>
        </div>

        {/* Image */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <img
            src={submission.image_url}
            alt="Chart"
            style={{ width: "100%", borderRadius: "12px", border: "1px solid var(--border-nav)", display: "block" }}
          />

          {/* Student notes */}
          {submission.student_notes && (
            <div style={{ background: "var(--inner-bg)", borderRadius: "12px", padding: "14px 16px", border: "1px solid var(--border-input)" }}>
              <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6px" }}>
                Descripción del estudiante
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-1)", lineHeight: 1.55 }}>{submission.student_notes}</div>
            </div>
          )}

          {/* Admin notes */}
          {isAdmin ? (
            <div>
              <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "8px" }}>
                Tus anotaciones
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Escribe tu feedback aquí..."
                rows={4}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: "12px",
                  border: "1px solid var(--border-input)", background: "var(--app-bg)",
                  color: "var(--text-1)", fontSize: "13px", resize: "vertical",
                  fontFamily: "Inter, Arial, sans-serif", outline: "none", boxSizing: "border-box",
                  lineHeight: 1.55,
                }}
              />
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  marginTop: "10px", padding: "10px 22px", borderRadius: "11px", border: "none",
                  background: saving ? "rgba(16,185,129,0.5)" : "linear-gradient(135deg,#10b981,#059669)",
                  color: "#fff", fontWeight: "700", fontSize: "13px",
                  cursor: saving ? "not-allowed" : "pointer", fontFamily: "Inter, Arial, sans-serif",
                }}
              >
                {saving ? "Guardando..." : "Guardar y marcar revisado"}
              </button>
            </div>
          ) : submission.admin_notes ? (
            <div style={{ background: "rgba(16,185,129,0.07)", borderRadius: "12px", padding: "14px 16px", border: "1px solid rgba(16,185,129,0.2)" }}>
              <div style={{ fontSize: "10px", fontWeight: "700", color: "#10b981", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6px" }}>
                Feedback del instructor
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-1)", lineHeight: 1.55 }}>{submission.admin_notes}</div>
            </div>
          ) : (
            <div style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "8px 0" }}>
              Aún sin feedback del instructor
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ChartReviewPanel({ isAdmin, userId }) {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [studentNotes, setStudentNotes] = useState("")
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [selected, setSelected] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const fileInputRef = useRef(null)

  const loadSubmissions = async () => {
    setLoading(true)
    let query = supabase
      .from("chart_reviews")
      .select("*, profiles(email)")
      .order("created_at", { ascending: false })
    if (!isAdmin) query = query.eq("user_id", userId)
    const { data } = await query
    if (data) setSubmissions(data)
    setLoading(false)
  }

  useEffect(() => { loadSubmissions() }, [])

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
    setUploadError("")
  }

  useEffect(() => {
    const onPaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          handleFile(item.getAsFile())
          break
        }
      }
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [])

  const handleUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    setUploadError("")

    const ext = selectedFile.name.split(".").pop()
    const path = `${userId}/${Date.now()}.${ext}`

    const { error: storageErr } = await supabase.storage
      .from("chart-reviews")
      .upload(path, selectedFile, { cacheControl: "3600" })

    if (storageErr) {
      setUploadError("Error al subir la imagen. Intenta de nuevo.")
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from("chart-reviews").getPublicUrl(path)

    await supabase.from("chart_reviews").insert({
      user_id: userId,
      image_url: publicUrl,
      student_notes: studentNotes.trim() || null,
      status: "pending",
    })

    setSelectedFile(null)
    setPreview(null)
    setStudentNotes("")
    loadSubmissions()
    setUploading(false)
  }

  const handleSaveAdmin = async (id, notes) => {
    await supabase.from("chart_reviews")
      .update({ admin_notes: notes, status: "reviewed" })
      .eq("id", id)
    loadSubmissions()
  }

  const handleDelete = async (submission) => {
    const path = submission.image_url.split("/chart-reviews/")[1]
    if (path) await supabase.storage.from("chart-reviews").remove([path])
    await supabase.from("chart_reviews").delete().eq("id", submission.id)
    loadSubmissions()
  }

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

  const pendingCount = submissions.filter((s) => s.status === "pending").length

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div>
        <p style={{ margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "10px" }}>
          Academia
        </p>
        <h1 style={{ margin: "8px 0 6px", fontSize: "34px", fontWeight: "800", color: "var(--text-1)", letterSpacing: "-0.02em" }}>
          Revisión de Charts
        </h1>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>
          {isAdmin
            ? "Revisa las capturas de tus estudiantes y deja tu feedback"
            : "Sube tu captura de TradingView y recibe feedback del instructor"}
        </p>
      </div>

      {/* Upload area */}
      <div style={{ background: "var(--card-bg)", borderRadius: "20px", padding: "24px", border: "1px solid rgba(148,163,184,0.08)" }}>
        <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-1)", marginBottom: "16px" }}>
          Subir captura
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
          onClick={() => !preview && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? "#10b981" : preview ? "rgba(16,185,129,0.4)" : "rgba(16,185,129,0.3)"}`,
            borderRadius: "14px",
            padding: preview ? "12px" : "32px 20px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "8px",
            cursor: preview ? "default" : "pointer",
            background: dragOver ? "rgba(16,185,129,0.06)" : "transparent",
            transition: "all 0.15s",
          }}
        >
          {preview ? (
            <div style={{ position: "relative", width: "100%" }}>
              <img src={preview} alt="Preview" style={{ maxHeight: "280px", maxWidth: "100%", borderRadius: "10px", display: "block", margin: "0 auto" }} />
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setPreview(null) }}
                style={{
                  position: "absolute", top: "8px", right: "8px",
                  background: "rgba(0,0,0,0.6)", border: "none", color: "#fff",
                  borderRadius: "50%", width: "26px", height: "26px",
                  cursor: "pointer", fontSize: "13px", display: "grid", placeItems: "center",
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <>
              <div style={{
                width: "52px", height: "52px", borderRadius: "14px",
                background: "rgba(16,185,129,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#10b981",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div style={{ color: "var(--text-1)", fontWeight: "600", fontSize: "14px" }}>
                Arrastra tu captura aquí
              </div>
              <div style={{ color: "#10b981", fontSize: "13px", fontWeight: "500" }}>
                o haz clic para seleccionar
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>
                PNG, JPG, WebP · también puedes pegar con Ctrl+V
              </div>
            </>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />

        {/* Description */}
        <textarea
          value={studentNotes}
          onChange={(e) => setStudentNotes(e.target.value)}
          placeholder="Describe la situación: par, temporalidad, setup que ves, duda... (opcional)"
          rows={2}
          style={{
            marginTop: "12px", width: "100%", padding: "10px 13px",
            borderRadius: "11px", border: "1px solid var(--border-input)",
            background: "var(--app-bg)", color: "var(--text-1)",
            fontSize: "13px", resize: "none", fontFamily: "Inter, Arial, sans-serif",
            outline: "none", boxSizing: "border-box", lineHeight: 1.5,
          }}
        />

        {uploadError && (
          <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#f87171", background: "rgba(248,113,113,0.08)", padding: "9px 13px", borderRadius: "9px" }}>
            {uploadError}
          </p>
        )}

        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          style={{
            marginTop: "12px", padding: "10px 22px", borderRadius: "11px", border: "none",
            background: (!selectedFile || uploading) ? "rgba(16,185,129,0.3)" : "linear-gradient(135deg,#10b981,#059669)",
            color: "#fff", fontWeight: "700", fontSize: "13px",
            cursor: (!selectedFile || uploading) ? "not-allowed" : "pointer",
            fontFamily: "Inter, Arial, sans-serif",
          }}
        >
          {uploading ? "Subiendo..." : "Enviar captura"}
        </button>
      </div>

      {/* Gallery */}
      <div style={{ background: "var(--card-bg)", borderRadius: "20px", padding: "24px", border: "1px solid rgba(148,163,184,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--text-1)" }}>
            {isAdmin ? "Capturas recibidas" : "Mis capturas"}
          </h2>
          {isAdmin && pendingCount > 0 && (
            <span style={{ fontSize: "11px", background: "rgba(245,158,11,0.15)", color: "#fbbf24", padding: "2px 8px", borderRadius: "999px", fontWeight: "700" }}>
              {pendingCount} pendiente{pendingCount > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>Cargando...</div>
        ) : submissions.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: "14px", padding: "12px 0" }}>
            {isAdmin ? "No hay capturas enviadas aún" : "Aún no has enviado capturas"}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "14px" }}>
            {submissions.map((s) => (
              <div
                key={s.id}
                style={{
                  background: "var(--inner-bg)", borderRadius: "14px",
                  border: "1px solid var(--border-input)", overflow: "hidden",
                  cursor: "pointer", transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = "#10b981"}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border-input)"}
              >
                {/* Thumbnail */}
                <div
                  onClick={() => setSelected(s)}
                  style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden", background: "#0d1117" }}
                >
                  <img
                    src={s.image_url}
                    alt="Chart"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                  {s.status === "reviewed" && (
                    <div style={{
                      position: "absolute", top: "8px", right: "8px",
                      background: "rgba(16,185,129,0.9)", borderRadius: "50%",
                      width: "22px", height: "22px", display: "grid", placeItems: "center",
                    }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ padding: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                    {isAdmin && (
                      <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "140px" }}>
                        {s.profiles?.email?.split("@")[0] || "Estudiante"}
                      </div>
                    )}
                    <StatusBadge status={s.status} />
                  </div>
                  {s.student_notes && (
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {s.student_notes}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{formatDate(s.created_at)}</div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => setSelected(s)}
                        style={{ fontSize: "11px", fontWeight: "600", padding: "4px 10px", borderRadius: "8px", border: "none", background: "rgba(16,185,129,0.12)", color: "#10b981", cursor: "pointer" }}
                      >
                        {isAdmin ? "Revisar" : "Ver"}
                      </button>
                      {(isAdmin || s.user_id === userId) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(s) }}
                          style={{ fontSize: "11px", fontWeight: "600", padding: "4px 10px", borderRadius: "8px", border: "none", background: "rgba(248,113,113,0.1)", color: "#f87171", cursor: "pointer" }}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <ImageModal
          submission={selected}
          isAdmin={isAdmin}
          onClose={() => setSelected(null)}
          onSave={handleSaveAdmin}
        />
      )}
    </div>
  )
}
