import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════
// FIREBASE CONFIG — URL fija, funciona en todos los dispositivos
// ═══════════════════════════════════════════════════════════
const LS_FB_KEY = "mt_firebase_cfg";
function getFbCfg() { return { url: FB_URL }; }
function saveFbCfg(cfg) {}  // no necesario, URL ya está fija

// ─── Firebase REST API wrapper ───────────────────────────────
let FB_URL = "https://mcanico-taller-de-motos-default-rtdb.firebaseio.com";

function fbUrl(path) { return `${FB_URL}/${path}.json`; }

async function fbGet(path) {
  const r = await fetch(fbUrl(path));
  if (!r.ok) throw new Error("Firebase GET error " + r.status);
  return await r.json();
}
async function fbSet(path, data) {
  const r = await fetch(fbUrl(path), { method: "PUT", body: JSON.stringify(data), headers: { "Content-Type": "application/json" } });
  if (!r.ok) throw new Error("Firebase SET error " + r.status);
  return await r.json();
}
async function fbPush(path, data) {
  const r = await fetch(fbUrl(path), { method: "POST", body: JSON.stringify(data), headers: { "Content-Type": "application/json" } });
  if (!r.ok) throw new Error("Firebase PUSH error " + r.status);
  const res = await r.json();
  return res.name; // Firebase key
}
async function fbDelete(path) {
  const r = await fetch(fbUrl(path), { method: "DELETE" });
  if (!r.ok) throw new Error("Firebase DELETE error " + r.status);
}
async function fbPatch(path, data) {
  const r = await fetch(fbUrl(path), { method: "PATCH", body: JSON.stringify(data), headers: { "Content-Type": "application/json" } });
  if (!r.ok) throw new Error("Firebase PATCH error " + r.status);
  return await r.json();
}

// ─── Suscripción en tiempo real vía SSE ──────────────────────
function fbListen(path, callback) {
  const url = `${FB_URL}/${path}.json`;
  const es = new EventSource(url);
  es.addEventListener("put", e => {
    try { const d = JSON.parse(e.data); callback(d.data); } catch {}
  });
  es.addEventListener("patch", e => {
    try { callback(null, "patch"); } catch {}  // trigger refresh
  });
  es.onerror = () => {};
  return () => es.close();
}

// ─── Helpers ────────────────────────────────────────────────
const uid = () => Math.random().toString(36).substr(2, 9);
const hoy = () => new Date().toISOString().split("T")[0];
const money = n => "$" + Number(n || 0).toLocaleString("es-CL");

// ─── RUT CHILENO ────────────────────────────────────────────
function formatRut(raw) {
  let v = raw.replace(/[^0-9kK]/g, "").toUpperCase();
  if (v.length === 0) return "";
  const dv = v.slice(-1);
  let body = v.slice(0, -1);
  body = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return body ? body + "-" + dv : dv;
}
function validarRut(rut) {
  const clean = rut.replace(/[.\-]/g, "").toUpperCase();
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  let sum = 0, mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const expected = 11 - (sum % 11);
  const dvExpected = expected === 11 ? "0" : expected === 10 ? "K" : String(expected);
  return dv === dvExpected;
}

// ─── THEME ──────────────────────────────────────────────────
const T = {
  bg: "#f0f4f8", bgCard: "#ffffff", border: "#dde3ed",
  text: "#1a2233", textLight: "#5a6a82",
  danger: "#e53935", success: "#2e7d32", warning: "#e65100",
};

// ─── BADGE ──────────────────────────────────────────────────
const BADGE_MAP = {
  "Lista para retirar": ["#2e7d32","#e8f5e9"],
  "Entregada":          ["#757575","#f5f5f5"],
  "En reparación":      ["#e65100","#fff3e0"],
  "En revisión":        ["#1565c0","#e3f2fd"],
  "En espera de repuesto": ["#c62828","#ffebee"],
  "Completada":         ["#2e7d32","#e8f5e9"],
  "En proceso":         ["#e65100","#fff3e0"],
  "En espera repuesto": ["#c62828","#ffebee"],
  "Pendiente revisión": ["#1565c0","#e3f2fd"],
};
function Badge({ text }) {
  const [color, bg] = BADGE_MAP[text] || ["#757575","#f5f5f5"];
  return <span style={{ background: bg, color, border: `1px solid ${color}33`, borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", whiteSpace: "nowrap" }}>{text}</span>;
}

// ─── TOAST ──────────────────────────────────────────────────
let _addToast = () => {};
function Toasts() {
  const [list, setList] = useState([]);
  useEffect(() => {
    _addToast = (msg, type = "ok") => {
      const id = uid();
      setList(l => [...l, { id, msg, type }]);
      setTimeout(() => setList(l => l.filter(t => t.id !== id)), 3500);
    };
  }, []);
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
      {list.map(t => (
        <div key={t.id} style={{ background: "#fff", border: "1px solid #dde3ed", borderLeft: `4px solid ${t.type === "error" ? T.danger : t.type === "info" ? "#1565c0" : T.success}`, borderRadius: 8, padding: "12px 20px", fontSize: 14, fontWeight: 600, minWidth: 280, boxShadow: "0 4px 20px rgba(0,0,0,.12)", color: T.text }}>
          {t.type === "error" ? "❌ " : t.type === "info" ? "ℹ️ " : "✅ "}{t.msg}
        </div>
      ))}
    </div>
  );
}
const toast = (msg, type) => _addToast(msg, type);

// ─── SPINNER ────────────────────────────────────────────────
function Spinner({ size = 24, color = "#1565c0" }) {
  return (
    <div style={{ display: "inline-block", width: size, height: size, border: `3px solid ${color}22`, borderTop: `3px solid ${color}`, borderRadius: "50%", animation: "spin 0.7s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── MODAL ──────────────────────────────────────────────────
function Modal({ open, onClose, title, children, size = "md" }) {
  if (!open) return null;
  const widths = { sm: 420, md: 580, lg: 740, xl: 920 };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(21,33,55,.55)", backdropFilter: "blur(3px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 32, width: "100%", maxWidth: widths[size], maxHeight: "92vh", overflowY: "auto", position: "relative", boxShadow: "0 20px 60px rgba(21,101,192,.18)" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "#f0f4f8", border: "none", color: T.textLight, fontSize: 16, cursor: "pointer", width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        {title && <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 22, color: T.text }}>{title}</div>}
        {children}
      </div>
    </div>
  );
}

// ─── INPUTS ─────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: T.textLight, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}
const inputSt = { width: "100%", background: "#f8fafc", border: "1.5px solid #dde3ed", borderRadius: 7, padding: "10px 14px", color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border-color .15s" };
function Input({ style: s, primary = "#1565c0", ...p }) {
  return <input style={{ ...inputSt, ...s }} onFocus={e => e.target.style.borderColor = primary} onBlur={e => e.target.style.borderColor = "#dde3ed"} {...p} />;
}
function Textarea({ style: s, primary = "#1565c0", ...p }) {
  return <textarea style={{ ...inputSt, minHeight: 80, resize: "vertical", ...s }} onFocus={e => e.target.style.borderColor = primary} onBlur={e => e.target.style.borderColor = "#dde3ed"} {...p} />;
}
function Select({ options, style: s, primary = "#1565c0", ...p }) {
  return (
    <select style={{ ...inputSt, cursor: "pointer", ...s }} onFocus={e => e.target.style.borderColor = primary} onBlur={e => e.target.style.borderColor = "#dde3ed"} {...p}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
function RutInput({ value, onChange, cfg }) {
  const primary = cfg?.colorPrimario || "#1565c0";
  const isValid = value.length > 3 && validarRut(value);
  const isInvalid = value.length > 3 && !validarRut(value);
  return (
    <div>
      <div style={{ position: "relative" }}>
        <input value={value} onChange={e => onChange(formatRut(e.target.value))} maxLength={12} placeholder="12.345.678-9"
          style={{ ...inputSt, borderColor: isValid ? "#2e7d32" : isInvalid ? "#c62828" : "#dde3ed", paddingRight: 36, fontWeight: 700, letterSpacing: 1.5 }}
          onFocus={e => e.target.style.borderColor = isInvalid ? "#c62828" : primary}
          onBlur={e => e.target.style.borderColor = isValid ? "#2e7d32" : isInvalid ? "#c62828" : "#dde3ed"} />
        {value.length > 3 && <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 15 }}>{isValid ? "✅" : "❌"}</span>}
      </div>
      {isInvalid && <div style={{ color: "#c62828", fontSize: 11, marginTop: 4, fontWeight: 700 }}>RUT INVÁLIDO — VERIFIQUE EL DÍGITO VERIFICADOR</div>}
      {isValid  && <div style={{ color: "#2e7d32", fontSize: 11, marginTop: 4, fontWeight: 700 }}>✓ RUT VÁLIDO</div>}
    </div>
  );
}

// ─── BUTTON ─────────────────────────────────────────────────
function Btn({ variant = "primary", sm, xs, style: s, cfg, children, ...props }) {
  const primary = cfg?.colorPrimario || "#1565c0";
  const V = {
    primary: { background: primary, color: "#fff", border: "none" },
    outline: { background: "transparent", color: primary, border: `1.5px solid ${primary}` },
    ghost:   { background: primary+"18", color: primary, border: `1px solid ${primary}44` },
    danger:  { background: T.danger, color: "#fff", border: "none" },
    success: { background: T.success, color: "#fff", border: "none" },
    info:    { background: "#0288d1", color: "#fff", border: "none" },
    grey:    { background: "#e8ecf0", color: T.text, border: "none" },
    wa:      { background: "#25d366", color: "#fff", border: "none" },
  };
  const v = V[variant] || V.primary;
  return (
    <button style={{ ...v, borderRadius: 7, padding: xs ? "4px 10px" : sm ? "7px 15px" : "10px 22px", fontSize: xs ? 11 : sm ? 13 : 14, fontWeight: 700, cursor: "pointer", letterSpacing: 0.3, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6, transition: "opacity .15s, transform .1s", ...s }}
      onMouseOver={e => { e.currentTarget.style.opacity = ".88"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseOut={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = ""; }}
      {...props}>{children}</button>
  );
}

function Card({ children, style: s }) { return <div style={{ background: "#fff", border: "1px solid #dde3ed", borderRadius: 10, ...s }}>{children}</div>; }
function Grid2({ children, style: s }) { return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, ...s }}>{children}</div>; }
function Full({ children }) { return <div style={{ gridColumn: "1/-1" }}>{children}</div>; }

function Table({ headers, rows, empty = "Sin registros" }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead><tr style={{ background: "#f8fafc" }}>
          {headers.map((h, i) => <th key={i} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, color: T.textLight, borderBottom: "2px solid #dde3ed", fontWeight: 700 }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={headers.length} style={{ textAlign: "center", padding: 48, color: T.textLight }}>🔍 {empty}</td></tr>
            : rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #eef1f6" }}
                onMouseOver={e => e.currentTarget.style.background = "#f8fafc"}
                onMouseOut={e => e.currentTarget.style.background = ""}>
                {r.map((cell, j) => <td key={j} style={{ padding: "13px 14px", verticalAlign: "middle", color: T.text }}>{cell}</td>)}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// HOOK: useFirebase — carga y escucha datos en tiempo real
// ═══════════════════════════════════════════════════════════
function useFirebase() {
  const [clientes, setClientes] = useState([]);
  const [motos,    setMotos]    = useState([]);
  const [reps,     setReps]     = useState([]);
  const [galeria,  setGaleria]  = useState([]);
  const [cfg,      setCfgState] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [online,   setOnline]   = useState(navigator.onLine);

  // Convierte objeto Firebase {key: {datos}} → array [{id: key, ...datos}]
  const toArr = obj => obj ? Object.entries(obj).map(([id, v]) => ({ id, ...v })) : [];

  const loadAll = async () => {
    try {
      const [cl, mo, re, ga, cf] = await Promise.all([
        fbGet("clientes"), fbGet("motos"), fbGet("reps"),
        fbGet("galeria"),  fbGet("cfg"),
      ]);
      setClientes(toArr(cl));
      setMotos(toArr(mo));
      setReps(toArr(re));
      setGaleria(toArr(ga));
      setCfgState(cf || defaultCfg());
      setLoading(false);
    } catch (e) {
      toast("Error conectando con Firebase: " + e.message, "error");
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // Escuchar cambios en tiempo real
    const unsubs = [
      fbListen("clientes", d => setClientes(toArr(d))),
      fbListen("motos",    d => setMotos(toArr(d))),
      fbListen("reps",     d => setReps(toArr(d))),
      fbListen("galeria",  d => setGaleria(toArr(d))),
      fbListen("cfg",      d => { if(d) setCfgState(d); }),
    ];
    const onOnline  = () => { setOnline(true);  toast("Conectado a la nube ☁️", "info"); loadAll(); };
    const onOffline = () => { setOnline(false); toast("Sin conexión — modo local", "error"); };
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      unsubs.forEach(u => u && u());
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return { clientes, motos, reps, galeria, cfg, loading, online, reload: loadAll };
}

function defaultCfg() {
  return {
    pass: "admin123",
    plantilla: "Hola {nombre}! Tu moto {moto} ({placa}) está en estado: {estado}. Tu RUT es: {rut}. Gracias por confiar en nosotros!",
    taller: "MotoTaller Pro",
    slogan: "Tu taller de confianza",
    logo: "",
    colorPrimario: "#1565c0",
    colorSecundario: "#0d47a1",
  };
}

// ═══════════════════════════════════════════════════════════
// SETUP FIREBASE — pantalla inicial de configuración
// ═══════════════════════════════════════════════════════════
function SetupFirebase({ onDone }) {
  const [url, setUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [err, setErr] = useState("");

  const test = async () => {
    setErr(""); setTesting(true);
    const cleanUrl = url.trim().replace(/\/$/, "");
    if (!cleanUrl.includes("firebaseio.com")) { setErr("La URL debe ser de Firebase (*.firebaseio.com)"); setTesting(false); return; }
    try {
      const r = await fetch(`${cleanUrl}/ping.json`, { method: "PUT", body: JSON.stringify({ ok: true }), headers: { "Content-Type": "application/json" } });
      if (!r.ok) throw new Error("Respuesta " + r.status + " — verifica las reglas de seguridad");
      FB_URL = cleanUrl;
      saveFbCfg({ url: cleanUrl });
      // Inicializar cfg por defecto si no existe
      const existing = await fbGet("cfg");
      if (!existing) await fbSet("cfg", defaultCfg());
      toast("¡Conexión exitosa!");
      onDone();
    } catch (e) {
      setErr("No se pudo conectar: " + e.message);
    }
    setTesting(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #1565c0, #0d47a1)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 40, maxWidth: 560, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,.25)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔥</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#1565c0", marginBottom: 8 }}>Configurar Firebase</h1>
          <p style={{ color: T.textLight, fontSize: 14, lineHeight: 1.6 }}>Necesitas una base de datos Firebase gratuita para guardar los datos en la nube y acceder desde cualquier dispositivo.</p>
        </div>

        {/* Pasos */}
        <div style={{ background: "#e3f2fd", border: "1px solid #90caf9", borderRadius: 10, padding: 20, marginBottom: 24 }}>
          <div style={{ fontWeight: 800, color: "#1565c0", marginBottom: 12, fontSize: 13 }}>📋 PASOS PARA CONFIGURAR (5 minutos, gratis):</div>
          {[
            ["1", "Ve a", "console.firebase.google.com", "https://console.firebase.google.com"],
            ["2", "Crea un proyecto nuevo (cualquier nombre)"],
            ["3", 'Ve a "Realtime Database" → "Crear base de datos"'],
            ["4", 'Selecciona "Comenzar en modo de prueba" (para empezar)'],
            ["5", 'Copia la URL que aparece (termina en .firebaseio.com)'],
            ["6", "Pega esa URL abajo y haz clic en Conectar"],
          ].map(([n, ...parts], i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
              <span style={{ background: "#1565c0", color: "#fff", minWidth: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{n}</span>
              <span style={{ fontSize: 13, color: "#1a2233", lineHeight: 1.5 }}>
                {parts[0]}{" "}
                {parts[1] && <a href={parts[2]} target="_blank" rel="noreferrer" style={{ color: "#1565c0", fontWeight: 700 }}>{parts[1]}</a>}
              </span>
            </div>
          ))}
        </div>

        <Field label="URL de tu Firebase Realtime Database">
          <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://tu-proyecto-default-rtdb.firebaseio.com" primary="#1565c0" onKeyDown={e => e.key === "Enter" && test()} autoFocus />
        </Field>
        {err && <div style={{ color: T.danger, fontSize: 13, marginBottom: 12, padding: "10px 14px", background: "#ffebee", borderRadius: 7, border: "1px solid #ffcdd2" }}>❌ {err}</div>}
        <Btn cfg={{ colorPrimario: "#1565c0" }} style={{ width: "100%", padding: "13px", fontSize: 15 }} onClick={test} disabled={testing}>
          {testing ? <><Spinner size={16} color="#fff" /> Conectando...</> : "🔌 Conectar con Firebase"}
        </Btn>

        <div style={{ marginTop: 20, padding: 14, background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 8, fontSize: 12, color: "#795548" }}>
          <strong>⚠️ Reglas de seguridad:</strong> Para producción, configura las reglas en Firebase para requerir autenticación. Para uso básico del taller, el modo de prueba funciona por 30 días, luego debes actualizar las reglas manualmente.
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MODALS CRUD — ahora async con Firebase
// ═══════════════════════════════════════════════════════════
function ModalCliente({ open, onClose, editing, onSaved, cfg, clientes }) {
  const blank = { nombre: "", telefono: "", email: "", direccion: "", notas: "", rut: "" };
  const [f, setF] = useState(blank);
  const [saving, setSaving] = useState(false);
  const primary = cfg?.colorPrimario || "#1565c0";
  useEffect(() => { if (open) setF(editing ? { ...editing } : { ...blank }); }, [open, editing]);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.nombre.trim()) { toast("El nombre es obligatorio", "error"); return; }
    if (!f.telefono.trim()) { toast("El teléfono es obligatorio", "error"); return; }
    if (!f.rut.trim()) { toast("El RUT es obligatorio", "error"); return; }
    if (!validarRut(f.rut)) { toast("El RUT ingresado no es válido", "error"); return; }
    const dup = clientes.find(c => c.rut === f.rut && c.id !== editing?.id);
    if (dup) { toast("Ya existe un cliente con ese RUT", "error"); return; }
    setSaving(true);
    try {
      const data = { nombre: f.nombre, telefono: f.telefono, email: f.email || "", direccion: f.direccion || "", notas: f.notas || "", rut: f.rut, creadoEn: f.creadoEn || hoy() };
      if (editing) {
        await fbPatch(`clientes/${editing.id}`, data);
        toast("Cliente actualizado");
      } else {
        await fbPush("clientes", data);
        toast("Cliente creado");
      }
      onSaved(); onClose();
    } catch (e) { toast("Error: " + e.message, "error"); }
    setSaving(false);
  };
  return (
    <Modal open={open} onClose={onClose} title={editing ? "✏️ Editar Cliente" : "👤 Nuevo Cliente"} size="lg">
      <Grid2>
        <Field label="Nombre completo *"><Input value={f.nombre} onChange={e => set("nombre", e.target.value)} placeholder="Carlos Rodríguez" primary={primary} autoFocus /></Field>
        <Field label="RUT *"><RutInput value={f.rut} onChange={v => set("rut", v)} cfg={cfg} /></Field>
        <Field label="Teléfono / WhatsApp *"><Input value={f.telefono} onChange={e => set("telefono", e.target.value)} placeholder="+56 9 1234 5678" primary={primary} /></Field>
        <Field label="Email"><Input value={f.email} onChange={e => set("email", e.target.value)} placeholder="correo@email.com" primary={primary} /></Field>
        <Full><Field label="Dirección"><Input value={f.direccion} onChange={e => set("direccion", e.target.value)} placeholder="Calle, comuna, ciudad" primary={primary} /></Field></Full>
        <Full><Field label="Notas internas"><Textarea value={f.notas} onChange={e => set("notas", e.target.value)} placeholder="Observaciones adicionales..." primary={primary} /></Field></Full>
      </Grid2>
      <Btn cfg={cfg} style={{ width: "100%", marginTop: 8 }} onClick={save} disabled={saving}>
        {saving ? <><Spinner size={14} color="#fff" /> Guardando...</> : "💾 Guardar Cliente"}
      </Btn>
    </Modal>
  );
}

const ESTADOS_MOTO = ["En revisión","En reparación","Lista para retirar","Entregada","En espera de repuesto"];
function ModalMoto({ open, onClose, editing, clienteIdPre, onSaved, cfg, clientes }) {
  const blank = { clienteId: "", placa: "", patente: "", marca: "", modelo: "", anio: "", color: "", chasis: "", motor: "", observaciones: "", estado: "En revisión" };
  const [f, setF] = useState(blank);
  const [saving, setSaving] = useState(false);
  const primary = cfg?.colorPrimario || "#1565c0";
  useEffect(() => { if (open) setF(editing ? { ...editing } : { ...blank, clienteId: clienteIdPre || "" }); }, [open, editing, clienteIdPre]);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.clienteId) { toast("Selecciona un cliente", "error"); return; }
    if (!f.placa.trim()) { toast("La placa es obligatoria", "error"); return; }
    if (!f.marca.trim()) { toast("La marca es obligatoria", "error"); return; }
    setSaving(true);
    try {
      const data = { ...f, placa: f.placa.toUpperCase(), chasis: (f.chasis||"").toUpperCase(), motor: (f.motor||"").toUpperCase(), creadoEn: f.creadoEn || hoy() };
      if (editing) { await fbPatch(`motos/${editing.id}`, data); toast("Moto actualizada"); }
      else { await fbPush("motos", data); toast("Moto registrada"); }
      onSaved(); onClose();
    } catch (e) { toast("Error: " + e.message, "error"); }
    setSaving(false);
  };
  return (
    <Modal open={open} onClose={onClose} title={editing ? "✏️ Editar Motocicleta" : "🏍️ Nueva Motocicleta"} size="lg">
      <Full><Field label="Cliente *">
        <Select value={f.clienteId} onChange={e => set("clienteId", e.target.value)} primary={primary}
          options={[{ value: "", label: "-- Seleccionar cliente --" }, ...clientes.map(c => ({ value: c.id, label: `${c.nombre} (${c.rut})` }))]} />
      </Field></Full>
      <Grid2>
        <Field label="Placa *"><Input value={f.placa} onChange={e => set("placa", e.target.value.toUpperCase())} placeholder="ABC-123" primary={primary} /></Field>
        <Field label="Patente"><Input value={f.patente} onChange={e => set("patente", e.target.value)} placeholder="Número de patente" primary={primary} /></Field>
        <Field label="Marca *"><Input value={f.marca} onChange={e => set("marca", e.target.value)} placeholder="Honda, Yamaha..." primary={primary} /></Field>
        <Field label="Modelo"><Input value={f.modelo} onChange={e => set("modelo", e.target.value)} placeholder="CG 150, FZ 25..." primary={primary} /></Field>
        <Field label="Año"><Input type="number" value={f.anio} onChange={e => set("anio", e.target.value)} placeholder="2020" primary={primary} /></Field>
        <Field label="Color"><Input value={f.color} onChange={e => set("color", e.target.value)} placeholder="Rojo, Negro mate..." primary={primary} /></Field>
        <Field label="N° Chasis"><Input value={f.chasis} onChange={e => set("chasis", e.target.value.toUpperCase())} primary={primary} /></Field>
        <Field label="N° Motor"><Input value={f.motor} onChange={e => set("motor", e.target.value.toUpperCase())} primary={primary} /></Field>
        <Full><Field label="Estado">
          <Select value={f.estado} onChange={e => set("estado", e.target.value)} primary={primary} options={ESTADOS_MOTO.map(e => ({ value: e, label: e }))} />
        </Field></Full>
        <Full><Field label="Observaciones de recepción"><Textarea value={f.observaciones} onChange={e => set("observaciones", e.target.value)} placeholder="Estado al ingresar, daños visibles..." primary={primary} /></Field></Full>
      </Grid2>
      <Btn cfg={cfg} style={{ width: "100%", marginTop: 8 }} onClick={save} disabled={saving}>
        {saving ? <><Spinner size={14} color="#fff" /> Guardando...</> : "💾 Guardar Moto"}
      </Btn>
    </Modal>
  );
}

const ESTADOS_REP = ["En proceso","Completada","En espera repuesto","Pendiente revisión"];
const TIPOS_COSTO = ["Mano de obra","Repuesto","Diagnóstico","Otro"];
function ModalRep({ open, onClose, editing, motoIdPre, onSaved, cfg, motos, clientes }) {
  const blank = { motoId: "", descripcion: "", fecha: hoy(), diagnostico: "", estadoRep: "En proceso", procesos: [], costos: [] };
  const [f, setF] = useState(blank);
  const [saving, setSaving] = useState(false);
  const primary = cfg?.colorPrimario || "#1565c0";
  useEffect(() => { if (open) setF(editing ? { ...editing, procesos: [...(editing.procesos||[])], costos: (editing.costos||[]).map(c=>({...c})) } : { ...blank, motoId: motoIdPre || "" }); }, [open, editing, motoIdPre]);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const total = (f.costos||[]).reduce((a, c) => a + (Number(c.valor) || 0), 0);
  const save = async () => {
    if (!f.motoId) { toast("Selecciona una moto", "error"); return; }
    if (!f.descripcion.trim()) { toast("La descripción es obligatoria", "error"); return; }
    setSaving(true);
    try {
      const data = { ...f, creadoEn: f.creadoEn || hoy() };
      if (editing) {
        await fbPatch(`reps/${editing.id}`, data);
        toast("Reparación actualizada");
      } else {
        await fbPush("reps", data);
        // Actualizar estado de la moto
        const nuevoEstado = f.estadoRep === "Completada" ? "Lista para retirar" : "En reparación";
        await fbPatch(`motos/${f.motoId}`, { estado: nuevoEstado });
        toast("Reparación registrada");
      }
      onSaved(); onClose();
    } catch (e) { toast("Error: " + e.message, "error"); }
    setSaving(false);
  };
  return (
    <Modal open={open} onClose={onClose} title={editing ? "✏️ Editar Reparación" : "🔧 Nueva Reparación"} size="xl">
      <Grid2>
        <Full><Field label="Motocicleta *">
          <Select value={f.motoId} onChange={e => set("motoId", e.target.value)} primary={primary}
            options={[{ value: "", label: "-- Seleccionar moto --" }, ...motos.map(m => {
              const c = clientes.find(x => x.id === m.clienteId) || {};
              return { value: m.id, label: `${m.marca} ${m.modelo||""} — ${m.placa} (${c.nombre||"?"})` };
            })]} />
        </Field></Full>
        <Field label="Fecha"><Input type="date" value={f.fecha} onChange={e => set("fecha", e.target.value)} primary={primary} /></Field>
        <Field label="Estado"><Select value={f.estadoRep} onChange={e => set("estadoRep", e.target.value)} primary={primary} options={ESTADOS_REP.map(e => ({ value: e, label: e }))} /></Field>
        <Full><Field label="Descripción *"><Input value={f.descripcion} onChange={e => set("descripcion", e.target.value)} placeholder="Ej: Mantenimiento general..." primary={primary} /></Field></Full>
        <Full><Field label="Diagnóstico técnico"><Textarea value={f.diagnostico} onChange={e => set("diagnostico", e.target.value)} placeholder="Diagnóstico detallado..." primary={primary} /></Field></Full>
      </Grid2>
      {/* Procesos */}
      <div style={{ borderTop: "2px solid #eef1f6", margin: "20px 0 14px" }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: primary, marginTop: 16, marginBottom: 12 }}>📋 PROCESOS REALIZADOS</div>
        {(f.procesos||[]).map((p, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <span style={{ background: primary, color: "#fff", minWidth: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{i+1}</span>
            <Input value={p} onChange={e => set("procesos", f.procesos.map((x,j) => j===i ? e.target.value : x))} placeholder="Describir proceso..." primary={primary} style={{ flex: 1 }} />
            <Btn variant="danger" xs onClick={() => set("procesos", f.procesos.filter((_,j) => j!==i))}>✕</Btn>
          </div>
        ))}
        <Btn variant="ghost" sm cfg={cfg} onClick={() => set("procesos", [...(f.procesos||[]), ""])}>+ Proceso</Btn>
      </div>
      {/* Costos */}
      <div style={{ borderTop: "2px solid #eef1f6", margin: "20px 0 14px" }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: primary, marginTop: 16, marginBottom: 12 }}>💰 COSTOS Y REPUESTOS</div>
        {(f.costos||[]).map((c, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 6, marginBottom: 6, alignItems: "center" }}>
            <Input value={c.descripcion} onChange={e => set("costos", f.costos.map((x,j) => j===i ? {...x, descripcion: e.target.value} : x))} placeholder="Descripción..." primary={primary} />
            <Select value={c.tipo} onChange={e => set("costos", f.costos.map((x,j) => j===i ? {...x, tipo: e.target.value} : x))} primary={primary} options={TIPOS_COSTO.map(t=>({value:t,label:t}))} />
            <Input type="number" value={c.valor} onChange={e => set("costos", f.costos.map((x,j) => j===i ? {...x, valor: e.target.value} : x))} min="0" primary={primary} />
            <Btn variant="danger" xs onClick={() => set("costos", f.costos.filter((_,j) => j!==i))}>✕</Btn>
          </div>
        ))}
        <Btn variant="ghost" sm cfg={cfg} onClick={() => set("costos", [...(f.costos||[]), { descripcion: "", tipo: "Mano de obra", valor: 0 }])}>+ Ítem</Btn>
        <div style={{ textAlign: "right", marginTop: 16, padding: "12px 16px", background: "#f0f7ff", borderRadius: 8, border: `1px solid ${primary}33` }}>
          <span style={{ color: T.textLight, fontSize: 12, marginRight: 12 }}>TOTAL REPARACIÓN:</span>
          <span style={{ fontWeight: 900, fontSize: 24, color: T.success }}>{money(total)}</span>
        </div>
      </div>
      <Btn cfg={cfg} style={{ width: "100%", marginTop: 16 }} onClick={save} disabled={saving}>
        {saving ? <><Spinner size={14} color="#fff" /> Guardando...</> : "💾 Guardar Reparación"}
      </Btn>
    </Modal>
  );
}

// ─── MODAL DETALLE MOTO ─────────────────────────────────────
function ModalDetalleMoto({ motoId, open, onClose, onEditMoto, onNewRep, onEditRep, cfg, motos, clientes, reps }) {
  if (!open || !motoId) return null;
  const m = motos.find(x => x.id === motoId); if (!m) return null;
  const c = clientes.find(x => x.id === m.clienteId) || {};
  const mReps = reps.filter(r => r.motoId === motoId);
  const totalG = mReps.reduce((a,r) => a+(r.costos||[]).reduce((b,co)=>b+(Number(co.valor)||0),0),0);
  const primary = cfg?.colorPrimario || "#1565c0";
  return (
    <Modal open={open} onClose={onClose} size="xl" title="">
      <div style={{ background: `linear-gradient(135deg, ${primary}11, ${primary}06)`, border: `1px solid ${primary}22`, borderRadius: 10, padding: 20, marginBottom: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 22, color: T.text, marginBottom: 8 }}>🏍️ {m.marca} {m.modelo}</div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              {[["Placa",m.placa,primary],["Año",m.anio],["Color",m.color],["Chasis",m.chasis],["Motor",m.motor]].filter(x=>x[1]).map(([l,v,col])=>(
                <div key={l}><div style={{fontSize:10,color:T.textLight,textTransform:"uppercase",letterSpacing:1,fontWeight:700}}>{l}</div><div style={{fontWeight:700,color:col||T.text,fontSize:15}}>{v}</div></div>
              ))}
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
              <Badge text={m.estado} />
              <span style={{ color: T.textLight, fontSize: 13 }}>Cliente: <strong>{c.nombre}</strong></span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: T.textLight, textTransform: "uppercase" }}>Total Invertido</div>
            <div style={{ fontWeight: 900, fontSize: 28, color: T.success }}>{money(totalG)}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
              <Btn cfg={cfg} sm onClick={()=>{onClose();onNewRep(motoId);}}>+ Reparación</Btn>
              <Btn variant="outline" cfg={cfg} sm onClick={()=>{onClose();onEditMoto(m);}}>✏️ Editar</Btn>
            </div>
          </div>
        </div>
      </div>
      <div style={{ fontWeight: 800, fontSize: 14, color: primary, marginBottom: 16 }}>🔧 HISTORIAL ({mReps.length})</div>
      {mReps.length === 0
        ? <div style={{ textAlign: "center", padding: 40, color: T.textLight }}>Sin reparaciones registradas</div>
        : [...mReps].reverse().map(r => {
          const tot = (r.costos||[]).reduce((a,co)=>a+(Number(co.valor)||0),0);
          return (
            <div key={r.id} style={{ border: "1px solid #dde3ed", borderRadius: 8, marginBottom: 12, overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#f8fafc", borderBottom: "1px solid #eef1f6", flexWrap: "wrap", gap: 8 }}>
                <div><div style={{ fontWeight: 700, fontSize: 14 }}>{r.descripcion}</div><div style={{ fontSize: 12, color: T.textLight }}>{r.fecha}</div></div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Badge text={r.estadoRep} />
                  <span style={{ fontWeight: 900, fontSize: 16, color: T.success }}>{money(tot)}</span>
                  <Btn variant="ghost" cfg={cfg} xs onClick={()=>{onClose();onEditRep(r);}}>✏️</Btn>
                </div>
              </div>
              <div style={{ padding: "14px 16px" }}>
                {r.diagnostico && <p style={{ fontSize: 13, color: T.textLight, lineHeight: 1.6, marginBottom: 10 }}>{r.diagnostico}</p>}
                {(r.procesos||[]).length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    {r.procesos.map((p,i) => <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4, fontSize: 13 }}><span style={{ background: primary, color: "#fff", minWidth: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{i+1}</span>{p}</div>)}
                  </div>
                )}
                {(r.costos||[]).length > 0 && (
                  <div style={{ borderTop: "1px solid #eef1f6", paddingTop: 10 }}>
                    {r.costos.map((co,i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f0f4f8", fontSize: 13 }}>
                        <span>{co.descripcion} <span style={{ color: T.textLight, fontSize: 11 }}>({co.tipo})</span></span>
                        <span style={{ fontWeight: 700, color: primary }}>{money(co.valor)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, fontWeight: 900, fontSize: 16, color: T.success }}>
                      <span>TOTAL</span><span>{money(tot)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// SECCIONES ADMIN
// ═══════════════════════════════════════════════════════════
function SecDashboard({ cfg, clientes, motos, reps }) {
  const primary = cfg?.colorPrimario || "#1565c0";
  const totalFact = reps.reduce((a,r)=>a+(r.costos||[]).reduce((b,c)=>b+(Number(c.valor)||0),0),0);
  const stats = [
    { icon: "👥", num: clientes.length, label: "Clientes", color: primary },
    { icon: "🏍️", num: motos.length,    label: "Motos",    color: "#0288d1" },
    { icon: "🔧", num: reps.length,     label: "Reparaciones", color: "#e65100" },
    { icon: "💰", num: money(totalFact), label: "Total facturado", color: T.success, big: true },
  ];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 16, marginBottom: 28 }}>
        {stats.map(s => (
          <Card key={s.label} style={{ padding: "22px 20px", position: "relative", overflow: "hidden", borderLeft: `4px solid ${s.color}` }}>
            <div style={{ position: "absolute", top: 12, right: 14, fontSize: 30, opacity: .1 }}>{s.icon}</div>
            <div style={{ fontWeight: 900, fontSize: s.big ? 20 : 32, color: s.color, lineHeight: 1 }}>{s.num}</div>
            <div style={{ fontSize: 12, color: T.textLight, textTransform: "uppercase", letterSpacing: 1, marginTop: 6, fontWeight: 600 }}>{s.label}</div>
          </Card>
        ))}
      </div>
      <Card>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #eef1f6", fontWeight: 700, fontSize: 15 }}>Últimas Reparaciones</div>
        <Table headers={["Cliente","Moto","Descripción","Estado","Total"]} empty="Sin reparaciones"
          rows={[...reps].reverse().slice(0,8).map(r => {
            const m = motos.find(x=>x.id===r.motoId)||{}, c = clientes.find(x=>x.id===m.clienteId)||{};
            const tot = (r.costos||[]).reduce((a,co)=>a+(Number(co.valor)||0),0);
            return [c.nombre||"-", `${m.marca||""} ${m.placa||""}`, r.descripcion, <Badge text={r.estadoRep}/>, <span style={{color:T.success,fontWeight:700}}>{money(tot)}</span>];
          })} />
      </Card>
    </div>
  );
}

function SecClientes({ cfg, clientes, motos, reps, reload }) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [motoModal, setMotoModal] = useState(false);
  const [motoEdit, setMotoEdit] = useState(null);
  const [motoCliPre, setMotoCliPre] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [repModal, setRepModal] = useState(false);
  const [repEdit, setRepEdit] = useState(null);
  const [repMotoId, setRepMotoId] = useState("");
  const primary = cfg?.colorPrimario || "#1565c0";
  const filtered = clientes.filter(c => !q || [c.nombre,c.rut,c.telefono].some(v=>(v||"").toLowerCase().includes(q.toLowerCase())));

  const del = async id => {
    if (!confirm("¿Eliminar cliente y todos sus datos?")) return;
    const mIds = motos.filter(m=>m.clienteId===id).map(m=>m.id);
    for (const r of reps.filter(r=>mIds.includes(r.motoId))) await fbDelete(`reps/${r.id}`);
    for (const mId of mIds) await fbDelete(`motos/${mId}`);
    await fbDelete(`clientes/${id}`);
    toast("Cliente eliminado"); reload();
  };
  const wa = cli => {
    if (!cli.telefono) { toast("Sin teléfono", "error"); return; }
    const m = motos.find(x=>x.clienteId===cli.id);
    if (!m) { toast("Sin motos", "error"); return; }
    let msg = cfg.plantilla || "";
    msg = msg.replace(/{nombre}/g,cli.nombre).replace(/{moto}/g,`${m.marca} ${m.modelo||""}`).replace(/{placa}/g,m.placa).replace(/{estado}/g,m.estado).replace(/{rut}/g,cli.rut);
    window.open(`https://wa.me/${cli.telefono.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`, "_blank");
  };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <Input style={{ width: 280 }} placeholder="🔍 Buscar cliente..." value={q} onChange={e=>setQ(e.target.value)} primary={primary} />
        <Btn cfg={cfg} onClick={()=>{setEditing(null);setModal(true);}}>+ Nuevo Cliente</Btn>
      </div>
      <Card>
        <Table headers={["RUT","Nombre","Teléfono","Motos","Acciones"]} empty="No hay clientes"
          rows={filtered.map(c => {
            const nm = motos.filter(m=>m.clienteId===c.id).length;
            return [
              <span style={{fontWeight:800,color:primary,letterSpacing:1}}>{c.rut}</span>,
              <strong>{c.nombre}</strong>,
              c.telefono||"-",
              <Badge text={`${nm} moto${nm!==1?"s":""}`} />,
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                <Btn variant="info" xs cfg={cfg} onClick={()=>{setMotoCliPre(c.id);setMotoEdit(null);setMotoModal(true);}}>+ Moto</Btn>
                <Btn variant="outline" xs cfg={cfg} onClick={()=>{setEditing(c);setModal(true);}}>✏️</Btn>
                <button onClick={()=>wa(c)} style={{background:"#25d366",color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>WA</button>
                <Btn variant="danger" xs onClick={()=>del(c.id)}>🗑️</Btn>
              </div>
            ];
          })} />
      </Card>
      <ModalCliente open={modal} onClose={()=>setModal(false)} editing={editing} onSaved={reload} cfg={cfg} clientes={clientes} />
      <ModalMoto open={motoModal} onClose={()=>setMotoModal(false)} editing={motoEdit} clienteIdPre={motoCliPre} onSaved={reload} cfg={cfg} clientes={clientes} />
      <ModalDetalleMoto motoId={detalle} open={!!detalle} onClose={()=>setDetalle(null)}
        onEditMoto={m=>{setMotoEdit(m);setMotoModal(true);}} onNewRep={id=>{setRepMotoId(id);setRepEdit(null);setRepModal(true);}}
        onEditRep={r=>{setRepEdit(r);setRepModal(true);}} cfg={cfg} motos={motos} clientes={clientes} reps={reps} />
      <ModalRep open={repModal} onClose={()=>setRepModal(false)} editing={repEdit} motoIdPre={repMotoId} onSaved={reload} cfg={cfg} motos={motos} clientes={clientes} />
    </div>
  );
}

function SecMotos({ cfg, clientes, motos, reps, reload }) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [repModal, setRepModal] = useState(false);
  const [repEdit, setRepEdit] = useState(null);
  const [repMotoId, setRepMotoId] = useState("");
  const primary = cfg?.colorPrimario || "#1565c0";
  const filtered = motos.filter(m => {
    if (!q) return true;
    const c = clientes.find(x=>x.id===m.clienteId)||{};
    return [m.placa,m.marca,m.modelo,m.chasis,m.motor,c.nombre].some(v=>(v||"").toLowerCase().includes(q.toLowerCase()));
  });
  const del = async id => {
    if (!confirm("¿Eliminar moto y sus reparaciones?")) return;
    for (const r of reps.filter(r=>r.motoId===id)) await fbDelete(`reps/${r.id}`);
    await fbDelete(`motos/${id}`);
    toast("Moto eliminada"); reload();
  };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <Input style={{ width: 300 }} placeholder="🔍 Buscar placa, marca, cliente..." value={q} onChange={e=>setQ(e.target.value)} primary={primary} />
        <Btn cfg={cfg} onClick={()=>{setEditing(null);setModal(true);}}>+ Nueva Moto</Btn>
      </div>
      <Card>
        <Table headers={["Placa","Marca/Modelo","Año","Cliente","Estado","Acciones"]} empty="No hay motos"
          rows={filtered.map(m => {
            const c = clientes.find(x=>x.id===m.clienteId)||{};
            return [
              <strong style={{color:primary}}>{m.placa}</strong>,
              `${m.marca} ${m.modelo||""}`,
              m.anio||"-",
              c.nombre||"-",
              <Badge text={m.estado} />,
              <div style={{display:"flex",gap:5}}>
                <Btn variant="info" xs cfg={cfg} onClick={()=>setDetalle(m.id)}>📋 Ver</Btn>
                <Btn variant="outline" xs cfg={cfg} onClick={()=>{setEditing(m);setModal(true);}}>✏️</Btn>
                <Btn variant="danger" xs onClick={()=>del(m.id)}>🗑️</Btn>
              </div>
            ];
          })} />
      </Card>
      <ModalMoto open={modal} onClose={()=>setModal(false)} editing={editing} onSaved={reload} cfg={cfg} clientes={clientes} />
      <ModalDetalleMoto motoId={detalle} open={!!detalle} onClose={()=>setDetalle(null)}
        onEditMoto={m=>{setEditing(m);setModal(true);}} onNewRep={id=>{setRepMotoId(id);setRepEdit(null);setRepModal(true);}}
        onEditRep={r=>{setRepEdit(r);setRepModal(true);}} cfg={cfg} motos={motos} clientes={clientes} reps={reps} />
      <ModalRep open={repModal} onClose={()=>setRepModal(false)} editing={repEdit} motoIdPre={repMotoId} onSaved={reload} cfg={cfg} motos={motos} clientes={clientes} />
    </div>
  );
}

function SecReparaciones({ cfg, clientes, motos, reps, reload }) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const primary = cfg?.colorPrimario || "#1565c0";
  const del = async id => { if (!confirm("¿Eliminar?")) return; await fbDelete(`reps/${id}`); toast("Eliminada"); reload(); };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <Btn cfg={cfg} onClick={()=>{setEditing(null);setModal(true);}}>+ Nueva Reparación</Btn>
      </div>
      {reps.length===0
        ? <Card style={{padding:60,textAlign:"center",color:T.textLight}}>🔧 Sin reparaciones</Card>
        : [...reps].reverse().map(r => {
          const m=motos.find(x=>x.id===r.motoId)||{}, c=clientes.find(x=>x.id===m.clienteId)||{};
          const tot=(r.costos||[]).reduce((a,co)=>a+(Number(co.valor)||0),0);
          return (
            <Card key={r.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{r.descripcion}</div>
                  <div style={{ fontSize: 12, color: T.textLight }}>{m.marca} {m.placa} — {c.nombre} — {r.fecha}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Badge text={r.estadoRep} />
                  <span style={{ fontWeight: 900, fontSize: 18, color: T.success }}>{money(tot)}</span>
                  <Btn variant="ghost" cfg={cfg} xs onClick={()=>{setEditing(r);setModal(true);}}>✏️</Btn>
                  <Btn variant="danger" xs onClick={()=>del(r.id)}>🗑️</Btn>
                </div>
              </div>
            </Card>
          );
        })}
      <ModalRep open={modal} onClose={()=>setModal(false)} editing={editing} onSaved={reload} cfg={cfg} motos={motos} clientes={clientes} />
    </div>
  );
}

function SecGaleria({ cfg, galeria, reload }) {
  const [modal, setModal] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [fotos, setFotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const primary = cfg?.colorPrimario || "#1565c0";
  const cargar = e => Array.from(e.target.files).forEach(f => { const r=new FileReader(); r.onload=ev=>setFotos(p=>[...p,ev.target.result]); r.readAsDataURL(f); });
  const guardar = async () => {
    if (!titulo.trim()) { toast("Agrega un título", "error"); return; }
    if (!fotos.length) { toast("Agrega una foto", "error"); return; }
    setSaving(true);
    try {
      await fbPush("galeria", { titulo, fotos, creadoEn: hoy() });
      setTitulo(""); setFotos([]); setModal(false); reload(); toast("Foto agregada");
    } catch (e) { toast("Error: " + e.message, "error"); }
    setSaving(false);
  };
  const del = async id => { await fbDelete(`galeria/${id}`); toast("Eliminado"); reload(); };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <Btn cfg={cfg} onClick={()=>{setTitulo("");setFotos([]);setModal(true);}}>+ Agregar Fotos</Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 16 }}>
        {galeria.length === 0
          ? <div style={{color:T.textLight,padding:40}}>📸 Sin fotos</div>
          : galeria.map(g => (
            <Card key={g.id} style={{ overflow: "hidden" }}>
              <div style={{ height: 175, background: "#eef1f6", overflow: "hidden", display:"flex",alignItems:"center",justifyContent:"center" }}>
                {g.fotos?.[0] ? <img src={g.fotos[0]} style={{width:"100%",height:"100%",objectFit:"cover"}} /> : <span style={{fontSize:40}}>📷</span>}
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{g.titulo}</div>
                <div style={{ fontSize: 12, color: T.textLight, marginBottom: 10 }}>{g.creadoEn}</div>
                <Btn variant="danger" xs onClick={()=>del(g.id)}>🗑️</Btn>
              </div>
            </Card>
          ))}
      </div>
      <Modal open={modal} onClose={()=>setModal(false)} title="📸 Agregar a Galería">
        <Field label="Título"><Input value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="Restauración Honda CG 150" primary={primary} autoFocus /></Field>
        <div onClick={()=>document.getElementById("inFoto").click()} style={{ border: `2px dashed ${primary}55`, borderRadius: 8, padding: 28, textAlign: "center", cursor: "pointer", marginBottom: 12, color: primary }}>
          📸 Click para agregar fotos
          <input id="inFoto" type="file" accept="image/*" multiple hidden onChange={cargar} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {fotos.map((f,i)=><div key={i} style={{position:"relative"}}><img src={f} style={{width:72,height:72,objectFit:"cover",borderRadius:6}} /><button onClick={()=>setFotos(p=>p.filter((_,j)=>j!==i))} style={{position:"absolute",top:-6,right:-6,background:T.danger,color:"#fff",border:"none",borderRadius:"50%",width:20,height:20,fontSize:11,cursor:"pointer"}}>✕</button></div>)}
        </div>
        <Btn cfg={cfg} style={{ width: "100%" }} onClick={guardar} disabled={saving}>
          {saving ? <><Spinner size={14} color="#fff" /> Guardando...</> : "💾 Guardar"}
        </Btn>
      </Modal>
    </div>
  );
}

function SecMensajes({ cfg, clientes, motos, reload }) {
  const [plantilla, setPlantilla] = useState(cfg?.plantilla || "");
  const [cliId, setCliId] = useState(""), [motoId, setMotoId] = useState("");
  const [saving, setSaving] = useState(false);
  const primary = cfg?.colorPrimario || "#1565c0";
  const motosCliente = motos.filter(m=>m.clienteId===cliId);
  const genPreview = () => { const c=clientes.find(x=>x.id===cliId),m=motos.find(x=>x.id===motoId); if(!c||!m)return""; return plantilla.replace(/{nombre}/g,c.nombre).replace(/{moto}/g,`${m.marca} ${m.modelo||""}`).replace(/{placa}/g,m.placa).replace(/{estado}/g,m.estado).replace(/{rut}/g,c.rut); };
  const guardarP = async () => { setSaving(true); try { await fbPatch("cfg", { plantilla }); reload(); toast("Plantilla guardada"); } catch(e) { toast("Error: "+e.message,"error"); } setSaving(false); };
  const enviar = () => { const c=clientes.find(x=>x.id===cliId); if(!c?.telefono){toast("Sin teléfono","error");return;} const msg=genPreview(); if(!msg){toast("Selecciona cliente y moto","error");return;} window.open(`https://wa.me/${c.telefono.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`,"_blank"); };
  return (
    <div style={{ maxWidth: 680 }}>
      <Card style={{ padding: 24, marginBottom: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: primary, marginBottom: 12 }}>✏️ PLANTILLA DEL MENSAJE</div>
        <div style={{ background: "#e3f2fd", border: "1px solid #90caf9", borderRadius: 8, padding: 12, fontSize: 12, color: "#1565c0", marginBottom: 14 }}>
          Variables: <strong>{"{nombre}"}</strong> <strong>{"{moto}"}</strong> <strong>{"{placa}"}</strong> <strong>{"{estado}"}</strong> <strong>{"{rut}"}</strong>
        </div>
        <Textarea value={plantilla} onChange={e=>setPlantilla(e.target.value)} style={{minHeight:100}} primary={primary} />
        <Btn cfg={cfg} style={{ marginTop: 12 }} onClick={guardarP} disabled={saving}>
          {saving ? <><Spinner size={14} color="#fff" /> Guardando...</> : "💾 Guardar Plantilla"}
        </Btn>
      </Card>
      <Card style={{ padding: 24 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: primary, marginBottom: 16 }}>📨 ENVIAR A CLIENTE</div>
        <Grid2>
          <Field label="Cliente"><Select value={cliId} onChange={e=>{setCliId(e.target.value);setMotoId("");}} primary={primary} options={[{value:"",label:"-- Seleccionar --"},...clientes.map(c=>({value:c.id,label:c.nombre}))]} /></Field>
          <Field label="Moto"><Select value={motoId} onChange={e=>setMotoId(e.target.value)} primary={primary} options={[{value:"",label:"-- Seleccionar --"},...motosCliente.map(m=>({value:m.id,label:`${m.marca} ${m.modelo||""} - ${m.placa}`}))]} /></Field>
        </Grid2>
        {cliId&&motoId && <div style={{background:"#f0f7ff",border:`1px solid ${primary}33`,borderRadius:8,padding:14,marginBottom:16,fontSize:13,lineHeight:1.7,color:T.text}}>{genPreview()}</div>}
        <button onClick={enviar} style={{background:"#25d366",color:"#fff",border:"none",borderRadius:7,padding:"11px 22px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Enviar por WhatsApp
        </button>
      </Card>
    </div>
  );
}

function SecApariencia({ cfg, reload }) {
  const [f, setF] = useState({ ...cfg });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const primary = f.colorPrimario || "#1565c0";
  const cargarLogo = e => { const file=e.target.files[0]; if(!file)return; const r=new FileReader(); r.onload=ev=>set("logo",ev.target.result); r.readAsDataURL(file); };
  const guardar = async () => {
    setSaving(true);
    try { await fbPatch("cfg", f); reload(); toast("Apariencia guardada"); }
    catch(e) { toast("Error: "+e.message,"error"); }
    setSaving(false);
  };
  const PRESETS = [
    { label: "Azul Clásico", primary: "#1565c0", secondary: "#0d47a1" },
    { label: "Azul Marino", primary: "#0a2463", secondary: "#052050" },
    { label: "Azul Acero", primary: "#1976d2", secondary: "#1565c0" },
    { label: "Verde Taller", primary: "#2e7d32", secondary: "#1b5e20" },
    { label: "Rojo Racing", primary: "#c62828", secondary: "#b71c1c" },
    { label: "Naranja Fuego", primary: "#e65100", secondary: "#bf360c" },
    { label: "Negro Carbono", primary: "#263238", secondary: "#1c242a" },
  ];
  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ background: `linear-gradient(135deg, ${f.colorPrimario||"#1565c0"}, ${f.colorSecundario||"#0d47a1"})`, borderRadius: 12, padding: "20px 24px", marginBottom: 24, display: "flex", alignItems: "center", gap: 18 }}>
        {f.logo ? <img src={f.logo} style={{ height: 52, objectFit: "contain", borderRadius: 8, background: "rgba(255,255,255,.15)", padding: 6 }} /> : <div style={{ background: "rgba(255,255,255,.2)", borderRadius: 8, padding: "10px 18px", fontWeight: 900, fontSize: 22, color: "#fff" }}>LOGO</div>}
        <div>
          <div style={{ fontWeight: 900, fontSize: 20, color: "#fff" }}>{f.taller || "Nombre del Taller"}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.75)", marginTop: 2 }}>{f.slogan || "Tu eslogan aquí"}</div>
        </div>
      </div>
      <Card style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: primary, marginBottom: 16 }}>🖼️ LOGO</div>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div onClick={()=>document.getElementById("inLogo").click()} style={{ flex: 1, border: `2px dashed ${primary}55`, borderRadius: 10, padding: 24, textAlign: "center", cursor: "pointer" }}>
            <div style={{ fontSize: 32 }}>📁</div>
            <div style={{ fontWeight: 700, color: primary, fontSize: 14, marginTop: 8 }}>Subir logo (PNG recomendado)</div>
            <input id="inLogo" type="file" accept="image/*" hidden onChange={cargarLogo} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
            <div style={{ width: 120, height: 80, background: "#f0f4f8", border: "1px solid #dde3ed", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {f.logo ? <img src={f.logo} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <span style={{ color: T.textLight, fontSize: 12 }}>Sin logo</span>}
            </div>
            {f.logo && <Btn variant="danger" xs onClick={()=>set("logo","")}>Quitar</Btn>}
          </div>
        </div>
      </Card>
      <Card style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: primary, marginBottom: 16 }}>🏪 NOMBRE Y SLOGAN</div>
        <Grid2>
          <Field label="Nombre *"><Input value={f.taller} onChange={e=>set("taller",e.target.value)} primary={primary} /></Field>
          <Field label="Eslogan"><Input value={f.slogan||""} onChange={e=>set("slogan",e.target.value)} primary={primary} /></Field>
        </Grid2>
      </Card>
      <Card style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: primary, marginBottom: 16 }}>🎨 COLORES</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {PRESETS.map(p => (
            <button key={p.label} onClick={()=>{set("colorPrimario",p.primary);set("colorSecundario",p.secondary);}}
              style={{ background: `linear-gradient(135deg,${p.primary},${p.secondary})`, color: "#fff", border: f.colorPrimario===p.primary ? "3px solid #000" : "3px solid transparent", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {p.label}
            </button>
          ))}
        </div>
        <Grid2>
          <Field label="Color primario">
            <div style={{ display: "flex", gap: 8 }}>
              <input type="color" value={f.colorPrimario||"#1565c0"} onChange={e=>set("colorPrimario",e.target.value)} style={{ width:48,height:40,border:"1px solid #dde3ed",borderRadius:6,cursor:"pointer",padding:2 }} />
              <Input value={f.colorPrimario||"#1565c0"} onChange={e=>set("colorPrimario",e.target.value)} primary={primary} style={{ flex: 1 }} />
            </div>
          </Field>
          <Field label="Color secundario">
            <div style={{ display: "flex", gap: 8 }}>
              <input type="color" value={f.colorSecundario||"#0d47a1"} onChange={e=>set("colorSecundario",e.target.value)} style={{ width:48,height:40,border:"1px solid #dde3ed",borderRadius:6,cursor:"pointer",padding:2 }} />
              <Input value={f.colorSecundario||"#0d47a1"} onChange={e=>set("colorSecundario",e.target.value)} primary={primary} style={{ flex: 1 }} />
            </div>
          </Field>
        </Grid2>
      </Card>
      <Btn cfg={{ colorPrimario: primary }} style={{ width: "100%", padding: "13px", fontSize: 15 }} onClick={guardar} disabled={saving}>
        {saving ? <><Spinner size={14} color="#fff" /> Guardando...</> : "💾 Guardar Apariencia"}
      </Btn>
    </div>
  );
}

function SecConfig({ cfg, reload }) {
  const [pa, setPa] = useState(""), [pn, setPn] = useState(""), [pc, setPc] = useState("");
  const [saving, setSaving] = useState(false);
  const primary = cfg?.colorPrimario || "#1565c0";
  const cambiarPass = async () => {
    if (pa !== cfg.pass) { toast("Contraseña actual incorrecta", "error"); return; }
    if (pn.length < 4) { toast("Mínimo 4 caracteres", "error"); return; }
    if (pn !== pc) { toast("No coinciden", "error"); return; }
    setSaving(true);
    try { await fbPatch("cfg", { pass: pn }); setPa(""); setPn(""); setPc(""); reload(); toast("Contraseña cambiada"); }
    catch (e) { toast("Error: "+e.message,"error"); }
    setSaving(false);
  };
  const cambiarFirebase = () => { localStorage.removeItem(LS_FB_KEY); window.location.reload(); };
  return (
    <div style={{ maxWidth: 520 }}>
      <Card style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: primary, marginBottom: 14 }}>🔐 CAMBIAR CONTRASEÑA</div>
        <Field label="Contraseña actual"><Input type="password" value={pa} onChange={e=>setPa(e.target.value)} primary={primary} /></Field>
        <Field label="Nueva contraseña"><Input type="password" value={pn} onChange={e=>setPn(e.target.value)} primary={primary} /></Field>
        <Field label="Confirmar nueva"><Input type="password" value={pc} onChange={e=>setPc(e.target.value)} primary={primary} /></Field>
        <Btn cfg={cfg} onClick={cambiarPass} disabled={saving}>
          {saving ? <><Spinner size={14} color="#fff" /> Guardando...</> : "Cambiar Contraseña"}
        </Btn>
      </Card>
      <Card style={{ padding: 24 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: primary, marginBottom: 14 }}>🔥 BASE DE DATOS FIREBASE</div>
        <div style={{ fontSize: 13, color: T.textLight, marginBottom: 4 }}>Estado: <strong style={{ color: T.success }}>✅ Conectado</strong></div>
        <div style={{ fontSize: 12, color: T.textLight }}>URL: {FB_URL}</div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PANEL ADMIN
// ═══════════════════════════════════════════════════════════
const SECS = [
  { id: "dashboard",    icon: "📊", label: "Dashboard" },
  { id: "clientes",     icon: "👥", label: "Clientes" },
  { id: "motos",        icon: "🏍️", label: "Motocicletas" },
  { id: "reparaciones", icon: "🔧", label: "Reparaciones" },
  { id: "galeria",      icon: "📸", label: "Galería" },
  { id: "mensajes",     icon: "💬", label: "WhatsApp" },
  { id: "apariencia",   icon: "🎨", label: "Apariencia" },
  { id: "config",       icon: "⚙️",  label: "Configuración" },
];

function AdminPanel({ onSalir, db }) {
  const [sec, setSec] = useState("dashboard");
  const { clientes, motos, reps, galeria, cfg, loading, online, reload } = db;
  const primary = cfg?.colorPrimario || "#1565c0";
  const secondary = cfg?.colorSecundario || "#0d47a1";
  const p = { cfg, clientes, motos, reps, galeria, reload };

  const Comp = {
    dashboard:    <SecDashboard {...p} />,
    clientes:     <SecClientes {...p} />,
    motos:        <SecMotos {...p} />,
    reparaciones: <SecReparaciones {...p} />,
    galeria:      <SecGaleria {...p} />,
    mensajes:     <SecMensajes {...p} />,
    apariencia:   <SecApariencia {...p} />,
    config:       <SecConfig {...p} />,
  }[sec];

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, flexDirection: "column", gap: 16 }}>
      <Spinner size={40} color={primary} />
      <div style={{ color: T.textLight, fontWeight: 600 }}>Cargando datos desde Firebase...</div>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg }}>
      <aside style={{ width: 228, background: `linear-gradient(180deg,${primary},${secondary})`, display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh", boxShadow: "2px 0 16px rgba(21,101,192,.18)" }}>
        <div style={{ padding: "22px 18px 18px", borderBottom: "1px solid rgba(255,255,255,.15)" }}>
          {cfg?.logo ? <img src={cfg.logo} style={{ height: 72, maxWidth: 180, objectFit: "contain" }} alt="logo" />
            : <div style={{ fontWeight: 900, fontSize: 18, color: "#fff" }}>{cfg?.taller}</div>}
          {cfg?.slogan && <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)", marginTop: 4 }}>{cfg.slogan}</div>}
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: online ? "#4caf50" : "#f44336" }} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,.6)" }}>{online ? "En línea ☁️" : "Sin conexión"}</span>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "10px 0", overflowY: "auto" }}>
          {SECS.map(s => (
            <div key={s.id} onClick={() => setSec(s.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 18px", cursor: "pointer", fontWeight: 600, fontSize: 14, color: sec===s.id ? "#fff" : "rgba(255,255,255,.65)", background: sec===s.id ? "rgba(255,255,255,.18)" : "transparent", borderLeft: `3px solid ${sec===s.id ? "#fff" : "transparent"}`, transition: "all .15s" }}
              onMouseOver={e => { if(sec!==s.id)e.currentTarget.style.background="rgba(255,255,255,.1)"; }}
              onMouseOut={e => { if(sec!==s.id)e.currentTarget.style.background="transparent"; }}>
              <span style={{ fontSize: 16 }}>{s.icon}</span>{s.label}
            </div>
          ))}
        </nav>
        <div style={{ padding: 16, borderTop: "1px solid rgba(255,255,255,.15)" }}>
          <button onClick={onSalir} style={{ width: "100%", background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.25)", borderRadius: 7, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>← Salir al sitio</button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 30, overflowX: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ fontWeight: 900, fontSize: 22, color: T.text }}>{SECS.find(s=>s.id===sec)?.icon} {SECS.find(s=>s.id===sec)?.label}</div>
          <button onClick={reload} style={{ background: "none", border: "1px solid #dde3ed", borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 12, color: T.textLight }}>🔄 Actualizar</button>
        </div>
        {Comp}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PORTAL CLIENTE
// ═══════════════════════════════════════════════════════════
function PortalCliente({ cliente, onSalir, db }) {
  const { motos, reps, cfg } = db;
  const primary = cfg?.colorPrimario || "#1565c0";
  const secondary = cfg?.colorSecundario || "#0d47a1";
  const cliMotos = motos.filter(m=>m.clienteId===cliente.id);
  return (
    <div style={{ minHeight: "100vh", background: T.bg }}>
      <header style={{ background: `linear-gradient(135deg,${primary},${secondary})`, padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 12px rgba(21,101,192,.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {cfg?.logo ? <img src={cfg.logo} style={{ height: 70, objectFit: "contain" }} alt="logo" /> : <div style={{ fontWeight: 900, fontSize: 20, color: "#fff" }}>{cfg?.taller}</div>}
          <div style={{ color: "rgba(255,255,255,.7)", fontSize: 13 }}>Portal del Cliente</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={()=>window.print()} style={{ background: "rgba(255,255,255,.2)", color: "#fff", border: "1px solid rgba(255,255,255,.3)", borderRadius: 7, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>🖨️ Imprimir</button>
          <button onClick={onSalir} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.25)", borderRadius: 7, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>← Salir</button>
        </div>
      </header>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
        <Card style={{ padding: 22, marginBottom: 26, borderLeft: `5px solid ${primary}` }}>
          <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 6 }}>Hola, {cliente.nombre} 👋</div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", color: T.textLight, fontSize: 13 }}>
            {cliente.telefono && <span>📞 {cliente.telefono}</span>}
            {cliente.email && <span>✉️ {cliente.email}</span>}
          </div>
          <div style={{ marginTop: 10, display: "inline-flex", background: `${primary}14`, border: `1px solid ${primary}33`, borderRadius: 8, padding: "6px 14px" }}>
            <span style={{ fontSize: 12, color: T.textLight, marginRight: 8 }}>Tu RUT:</span>
            <span style={{ fontWeight: 900, fontSize: 15, color: primary, letterSpacing: 2 }}>{cliente.rut}</span>
          </div>
        </Card>
        {cliMotos.length === 0
          ? <Card style={{padding:60,textAlign:"center",color:T.textLight}}>🏍️ No tienes motos registradas</Card>
          : cliMotos.map(m => {
            const mReps = reps.filter(r=>r.motoId===m.id);
            const totalG = mReps.reduce((a,r)=>a+(r.costos||[]).reduce((b,co)=>b+(Number(co.valor)||0),0),0);
            return (
              <Card key={m.id} style={{ marginBottom: 24, overflow: "hidden" }}>
                <div style={{ background: `linear-gradient(135deg,${primary}0f,${primary}06)`, borderBottom: "1px solid #eef1f6", padding: "20px 22px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 22 }}>🏍️ {m.marca} {m.modelo}</div>
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                        {[["Placa",m.placa,primary],["Año",m.anio],["Color",m.color],["Chasis",m.chasis],["Motor",m.motor]].filter(x=>x[1]).map(([l,v,col])=>(
                          <div key={l}><div style={{fontSize:10,color:T.textLight,textTransform:"uppercase",letterSpacing:1,fontWeight:700}}>{l}</div><div style={{fontWeight:700,color:col||T.text,fontSize:14}}>{v}</div></div>
                        ))}
                      </div>
                      <div style={{ marginTop: 10 }}><Badge text={m.estado} /></div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: T.textLight, textTransform: "uppercase" }}>Total facturado</div>
                      <div style={{ fontWeight: 900, fontSize: 28, color: T.success }}>{money(totalG)}</div>
                    </div>
                  </div>
                </div>
                <div style={{ padding: 22 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: primary, marginBottom: 14 }}>HISTORIAL ({mReps.length})</div>
                  {mReps.length === 0
                    ? <p style={{ color: T.textLight }}>Sin reparaciones.</p>
                    : [...mReps].reverse().map(r => {
                      const tot=(r.costos||[]).reduce((a,co)=>a+(Number(co.valor)||0),0);
                      return (
                        <div key={r.id} style={{ border: "1px solid #eef1f6", borderRadius: 8, marginBottom: 14, overflow: "hidden", borderLeft: `4px solid ${primary}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", background: "#f8fafc", borderBottom: "1px solid #eef1f6", flexWrap: "wrap", gap: 8 }}>
                            <div><div style={{ fontWeight: 700 }}>{r.descripcion}</div><div style={{ fontSize: 12, color: T.textLight }}>{r.fecha}</div></div>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}><Badge text={r.estadoRep} /><span style={{ fontWeight: 900, fontSize: 16, color: T.success }}>{money(tot)}</span></div>
                          </div>
                          <div style={{ padding: "12px 16px" }}>
                            {r.diagnostico && <p style={{ fontSize: 13, color: T.textLight, marginBottom: 10 }}>{r.diagnostico}</p>}
                            {(r.procesos||[]).map((p,i) => <div key={i} style={{ display:"flex",gap:8,fontSize:13,marginBottom:4 }}><span style={{background:primary,color:"#fff",minWidth:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700}}>{i+1}</span>{p}</div>)}
                            {(r.costos||[]).length>0 && (
                              <div style={{ borderTop: "1px solid #eef1f6", paddingTop: 10, marginTop: 8 }}>
                                {r.costos.map((co,i) => (
                                  <div key={i} style={{ display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #f5f7fa",fontSize:13 }}>
                                    <span>{co.descripcion} <span style={{color:T.textLight,fontSize:11}}>({co.tipo})</span></span>
                                    <span style={{ fontWeight: 700, color: primary }}>{money(co.valor)}</span>
                                  </div>
                                ))}
                                <div style={{ display:"flex",justifyContent:"space-between",paddingTop:10,fontWeight:900,fontSize:16,color:T.success }}>
                                  <span>TOTAL REPARACIÓN</span><span>{money(tot)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </Card>
            );
          })}
      </div>
      <style>{`@media print { header button { display:none!important; } }`}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LANDING
// ═══════════════════════════════════════════════════════════
function Landing({ onAdmin, onCliente, db }) {
  const [loginAdmin, setLoginAdmin] = useState(false);
  const [loginCli, setLoginCli] = useState(false);
  const [pass, setPass] = useState(""), [rut, setRut] = useState("");
  const [errA, setErrA] = useState(""), [errC, setErrC] = useState("");
  const { cfg, clientes, galeria } = db;
  const primary = cfg?.colorPrimario || "#1565c0";
  const secondary = cfg?.colorSecundario || "#0d47a1";

  const doAdmin = () => { if(pass===cfg?.pass){setPass("");setErrA("");setLoginAdmin(false);onAdmin();}else setErrA("Contraseña incorrecta"); };
  const doCli = () => {
    const rutL = rut.trim().toUpperCase();
    if (!rutL) { setErrC("INGRESA TU RUT"); return; }
    if (!validarRut(rutL)) { setErrC("RUT INVÁLIDO — VERIFICA EL DÍGITO VERIFICADOR"); return; }
    const c = clientes.find(x => x.rut === rutL);
    if (c) { setRut(""); setErrC(""); setLoginCli(false); onCliente(c); }
    else setErrC("RUT NO ENCONTRADO — CONSULTA A TU MECÁNICO");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", color: T.text }}>
      <header style={{ background: "#fff", borderBottom: "1px solid #dde3ed", padding: "0 40px", display: "flex", justifyContent: "space-between", alignItems: "center", height: 68, boxShadow: "0 1px 8px rgba(21,101,192,.08)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {cfg?.logo ? <img src={cfg.logo} style={{ height: 72, objectFit: "contain" }} alt="logo" />
            : <div style={{ fontWeight: 900, fontSize: 22, color: primary }}>{cfg?.taller || "MotoTaller Pro"}</div>}
          {cfg?.slogan && <div style={{ fontSize: 13, color: T.textLight, borderLeft: "1px solid #dde3ed", paddingLeft: 12 }}>{cfg.slogan}</div>}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="outline" cfg={cfg} onClick={()=>{setLoginCli(true);setErrC("");}}>🔑 Acceso Cliente</Btn>
          <Btn cfg={cfg} onClick={()=>{setLoginAdmin(true);setErrA("");}}>⚙️ Administrar</Btn>
        </div>
      </header>

      <section style={{ background: `linear-gradient(135deg,${primary},${secondary})`, padding: "80px 40px 70px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        {cfg?.logo && <div style={{ marginBottom: 24 }}><img src={cfg.logo} style={{ height: 560, objectFit: "contain" }} /></div>}
        <div style={{ display: "inline-block", background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.3)", borderRadius: 40, padding: "5px 22px", fontSize: 12, letterSpacing: 2, color: "#fff", textTransform: "uppercase", marginBottom: 24 }}>⚡ Sistema de Gestión Profesional</div>
        <h1 style={{ fontWeight: 900, fontSize: "clamp(2.2rem,6vw,4.5rem)", color: "#fff", lineHeight: 1.1, margin: "0 0 16px" }}>{cfg?.taller || "MotoTaller Pro"}</h1>
        {cfg?.slogan && <p style={{ fontSize: 18, color: "rgba(255,255,255,.8)", margin: "0 auto 12px", fontStyle: "italic" }}>{cfg.slogan}</p>}
        <p style={{ fontSize: 16, color: "rgba(255,255,255,.72)", maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.7 }}>Gestiona clientes, motos y reparaciones. Datos en la nube, acceso desde cualquier dispositivo.</p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={()=>{setLoginAdmin(true);setErrA("");}} style={{ background: "#fff", color: primary, border: "none", borderRadius: 8, padding: "13px 34px", fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,.15)" }}>🔧 Panel Administrativo</button>
          <button onClick={()=>{setLoginCli(true);setErrC("");}} style={{ background: "transparent", color: "#fff", border: "2px solid rgba(255,255,255,.6)", borderRadius: 8, padding: "13px 34px", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>👤 Portal Cliente</button>
        </div>
      </section>

      <section style={{ padding: "56px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, maxWidth: 860, margin: "0 auto" }}>
          {[["🏍️","Registro de Motos","Placa, chasis, motor y más"],["🔧","Historial completo","Diagnósticos y procesos detallados"],["💰","Control de costos","Repuestos y mano de obra"],["☁️","Multi-dispositivo","Datos en la nube en tiempo real"]].map(([icon,title,desc])=>(
            <Card key={title} style={{ padding: 22, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: primary, marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 13, color: T.textLight, lineHeight: 1.5 }}>{desc}</div>
            </Card>
          ))}
        </div>
      </section>

      {galeria && galeria.length > 0 && (
        <section style={{ padding: "0 40px 80px" }}>
          <div style={{ fontWeight: 900, fontSize: 24, marginBottom: 6 }}>Galería de <span style={{ color: primary }}>Trabajos</span></div>
          <div style={{ color: T.textLight, fontSize: 14, marginBottom: 24 }}>Últimos trabajos realizados en el taller</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 16 }}>
            {[...galeria].reverse().map(g => (
              <Card key={g.id} style={{ overflow: "hidden" }}>
                <div style={{ height: 185, background: "#eef1f6", overflow: "hidden", display:"flex",alignItems:"center",justifyContent:"center" }}>
                  {g.fotos?.[0] ? <img src={g.fotos[0]} style={{width:"100%",height:"100%",objectFit:"cover"}} /> : <span style={{fontSize:40}}>📷</span>}
                </div>
                <div style={{ padding: 14 }}>
                  <div style={{ fontWeight: 700 }}>{g.titulo}</div>
                  <div style={{ fontSize: 12, color: T.textLight }}>{g.creadoEn}</div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <footer style={{ background: `linear-gradient(135deg,${primary},${secondary})`, padding: "24px 40px", textAlign: "center", color: "rgba(255,255,255,.7)", fontSize: 13 }}>
        © {new Date().getFullYear()} {cfg?.taller} — Datos guardados en Firebase ☁️
      </footer>

      <Modal open={loginAdmin} onClose={()=>setLoginAdmin(false)} title="⚙️ Panel Administrativo" size="sm">
        <div style={{ background: "#e3f2fd", border: "1px solid #90caf9", borderRadius: 8, padding: 12, fontSize: 13, color: "#1565c0", marginBottom: 14 }}>
          🔑 Contraseña inicial: <strong>admin123</strong>
        </div>
        <Field label="Contraseña"><Input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" primary={primary} onKeyDown={e=>e.key==="Enter"&&doAdmin()} autoFocus /></Field>
        {errA && <div style={{ color: T.danger, fontSize: 13, marginBottom: 8 }}>❌ {errA}</div>}
        <Btn cfg={cfg} style={{ width: "100%", marginTop: 6 }} onClick={doAdmin}>Entrar →</Btn>
      </Modal>

      <Modal open={loginCli} onClose={()=>setLoginCli(false)} title="👤 Portal del Cliente" size="sm">
        <div style={{ color: T.textLight, fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>Ingresa tu RUT para ver el estado y el historial de tu moto.</div>
        <Field label="RUT"><RutInput value={rut} onChange={v=>setRut(v)} cfg={cfg} /></Field>
        {errC && <div style={{ color: T.danger, fontSize: 13, marginBottom: 8 }}>❌ {errC}</div>}
        <Btn cfg={cfg} style={{ width: "100%", marginTop: 6 }} onClick={doCli}>Ver mis motos →</Btn>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════════
export default function App() {
  const [vista, setVista] = useState("landing");
  const [clienteActivo, setClienteActivo] = useState(null);

  const db = useFirebase();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700;900&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; font-family:'Barlow',system-ui,sans-serif; text-transform:uppercase; letter-spacing:0.03em; }
        body { background:#f0f4f8; }
        input, textarea, select { text-transform:uppercase !important; }
        ::placeholder { text-transform:uppercase; opacity:0.5; }
        @media print { header button, aside { display:none!important; } }
      `}</style>
      <Toasts />
      {vista === "landing"  && <Landing onAdmin={()=>setVista("admin")} onCliente={c=>{setClienteActivo(c);setVista("cliente");}} db={db} />}
      {vista === "admin"    && <AdminPanel onSalir={()=>setVista("landing")} db={db} />}
      {vista === "cliente"  && clienteActivo && <PortalCliente cliente={clienteActivo} onSalir={()=>setVista("landing")} db={db} />}
    </>
  );
}
