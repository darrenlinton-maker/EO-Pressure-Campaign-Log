import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabase.js";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}
function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function formatDateShort(iso) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
function toLocalDatetimeValue(iso) {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}
function copyToClipboard(text) {
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
}
function getInitials(email) {
  if (!email) return "";
  const name = email.split("@")[0];
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}
function getDisplayName(user) {
  if (!user) return "";
  const meta = user.user_metadata;
  if (meta?.full_name) return meta.full_name;
  if (meta?.name) return meta.name;
  const email = user.email || "";
  const name = email.split("@")[0];
  return name.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function contactToRow(c) {
  return {
    id: c.id, campaign: c.campaign, method: c.method,
    caller_name: c.callerName || "", caller_location: c.callerLocation || "",
    identified: c.identified, source: c.source, register: c.register,
    tier: c.tier, key_phrases: c.keyPhrases || "", notes: c.notes || "",
    follow_up: c.followUp || false, staff_initials: c.staffInitials || "",
    follow_up_email: c.followUpEmail || "", follow_up_phone: c.followUpPhone || "",
    follow_up_completed: c.followUpCompleted || false,
    created_at: c.timestamp || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
function rowToContact(r) {
  return {
    id: r.id, campaign: r.campaign, method: r.method,
    callerName: r.caller_name || "", callerLocation: r.caller_location || "",
    identified: r.identified, source: r.source, register: r.register,
    tier: r.tier, keyPhrases: r.key_phrases || "", notes: r.notes || "",
    followUp: r.follow_up || false, staffInitials: r.staff_initials || "",
    followUpEmail: r.follow_up_email || "", followUpPhone: r.follow_up_phone || "",
    followUpCompleted: r.follow_up_completed || false,
    timestamp: r.created_at, updatedAt: r.updated_at,
  };
}
function rowToPlaybook(r) {
  return {
    id: r.id, section: r.section, title: r.title,
    campaign: r.campaign || "", tier: r.tier || "",
    subject: r.subject || "", content: r.content,
    sortOrder: r.sort_order || 0,
  };
}

const CONTACT_METHODS = ["Phone", "Email", "Walk-in", "Letter", "Social Media"];
const SOURCES = [
  "Constituent (organic)", "Outside electorate",
  "Prompted by social media", "Coordinated campaign", "Unknown",
];
const REGISTERS = [
  { value: "civil", label: "Civil", color: "#1B8838", bg: "#E6F4EA" },
  { value: "agitated", label: "Agitated", color: "#E0A100", bg: "#FFF8E1" },
  { value: "abusive", label: "Abusive", color: "#C23934", bg: "#FDE8E8" },
  { value: "threatening", label: "Threatening", color: "#7A1F1A", bg: "#F8D0CE" },
];
const TIERS = [
  { value: "1", label: "Tier 1 — Standard", desc: "Civil, use acknowledge-pivot-close" },
  { value: "2", label: "Tier 2 — Disengage", desc: "Abusive, end call per protocol" },
  { value: "3", label: "Tier 3 — Security", desc: "Threat made, contact police" },
];

// ============================================================
// LOGIN
// ============================================================
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      onLogin(data.session);
    } catch (err) {
      setError(err.message === "Invalid login credentials"
        ? "Invalid email or password. Contact your office administrator if you need access."
        : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.loginWrap}>
      <div style={S.loginCard}>
        <div style={S.loginHeader}>
          <div style={S.logoMark}>EO</div>
          <div>
            <div style={S.loginTitle}>Electorate Office</div>
            <div style={S.loginSubtitle}>Contact Logger</div>
          </div>
        </div>
        <div style={S.loginDivider} />
        <div style={S.loginLabel}>Sign in to continue</div>
        <form onSubmit={handleSubmit}>
          <div style={S.loginField}>
            <label style={S.label}>Email</label>
            <input type="email" style={S.input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@electorate.gov.au" required autoFocus autoComplete="email" />
          </div>
          <div style={S.loginField}>
            <label style={S.label}>Password</label>
            <input type="password" style={S.input} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required autoComplete="current-password" />
          </div>
          {error && <div style={S.loginError}>{error}</div>}
          <button type="submit" style={{ ...S.submitBtn, width: "100%", marginTop: 16, opacity: loading ? 0.6 : 1 }} disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
        <div style={S.loginFooter}>Contact your office administrator for login credentials.</div>
      </div>
    </div>
  );
}

// ============================================================
// APP WRAPPER
// ============================================================
export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); });
    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) return <div style={S.loadingWrap}><div style={S.loadingInner}><div style={S.logoMark}>EO</div><div style={S.loadingText}>Loading…</div></div></div>;
  if (!session) return <LoginScreen onLogin={setSession} />;
  return <MainApp session={session} />;
}

// ============================================================
// MAIN APP
// ============================================================
function MainApp({ session }) {
  const user = session?.user;
  const userInitials = getInitials(user?.email);
  const userName = getDisplayName(user);

  const [contacts, setContacts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [playbookItems, setPlaybookItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState("log");
  const [toast, setToast] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [playbookTab, setPlaybookTab] = useState("phone");
  const [pbFilterCampaign, setPbFilterCampaign] = useState("all");
  const [editingPlaybookId, setEditingPlaybookId] = useState(null);
  const [editingPlaybookText, setEditingPlaybookText] = useState("");
  const [expandedScript, setExpandedScript] = useState(null);

  const EMPTY_FORM = useMemo(() => ({
    campaign: "brs-2026", method: "Phone", callerName: "", callerLocation: "",
    identified: true, source: "Constituent (organic)", register: "civil",
    tier: "1", keyPhrases: "", notes: "", followUp: false, staffInitials: userInitials,
    contactDate: toLocalDatetimeValue(new Date().toISOString()),
    followUpEmail: "", followUpPhone: "", followUpCompleted: false,
  }), [userInitials]);

  const [form, setForm] = useState(EMPTY_FORM);
  const [filterCampaign, setFilterCampaign] = useState("all");
  const [filterRegister, setFilterRegister] = useState("all");
  const [filterDate, setFilterDate] = useState("all");

  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(null), 2400); }, []);

  useEffect(() => {
    async function loadAll() {
      try {
        const [cRes, campRes, pbRes] = await Promise.all([
          supabase.from("contacts").select("*").order("created_at", { ascending: false }),
          supabase.from("campaigns").select("*").order("created_at", { ascending: true }),
          supabase.from("playbook").select("*").order("sort_order", { ascending: true }),
        ]);
        if (cRes.error) throw cRes.error;
        if (campRes.error) throw campRes.error;
        if (pbRes.error) throw pbRes.error;
        setContacts((cRes.data || []).map(rowToContact));
        setCampaigns(campRes.data || []);
        setPlaybookItems((pbRes.data || []).map(rowToPlaybook));
      } catch (err) { console.error(err); setError("Could not load data."); }
      finally { setLoading(false); }
    }
    loadAll();
  }, []);

  useEffect(() => {
    const channel = supabase.channel("eo-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, (p) => {
        if (p.eventType === "INSERT") setContacts((prev) => prev.find((c) => c.id === p.new.id) ? prev : [rowToContact(p.new), ...prev]);
        else if (p.eventType === "UPDATE") setContacts((prev) => prev.map((c) => c.id === p.new.id ? rowToContact(p.new) : c));
        else if (p.eventType === "DELETE") setContacts((prev) => prev.filter((c) => c.id !== p.old.id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "campaigns" }, (p) => {
        if (p.eventType === "INSERT") setCampaigns((prev) => prev.find((c) => c.id === p.new.id) ? prev : [...prev, p.new]);
        else if (p.eventType === "UPDATE") setCampaigns((prev) => prev.map((c) => c.id === p.new.id ? p.new : c));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "playbook" }, (p) => {
        if (p.eventType === "INSERT") setPlaybookItems((prev) => prev.find((x) => x.id === p.new.id) ? prev : [...prev, rowToPlaybook(p.new)]);
        else if (p.eventType === "UPDATE") setPlaybookItems((prev) => prev.map((x) => x.id === p.new.id ? rowToPlaybook(p.new) : x));
        else if (p.eventType === "DELETE") setPlaybookItems((prev) => prev.filter((x) => x.id !== p.old.id));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const updateField = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const handleLogout = async () => { await supabase.auth.signOut(); };

  const handleSubmit = async () => {
    setSyncing(true);
    const chosenDate = new Date(form.contactDate).toISOString();
    const entry = { ...form, id: editingId || generateId(), timestamp: editingId ? (form.contactDate ? chosenDate : contacts.find((c) => c.id === editingId)?.timestamp) : chosenDate };
    const row = contactToRow(entry);
    try {
      if (editingId) { const { error } = await supabase.from("contacts").update(row).eq("id", editingId); if (error) throw error; setContacts((prev) => prev.map((c) => c.id === editingId ? { ...entry, updatedAt: new Date().toISOString() } : c)); showToast("Contact updated"); }
      else { const { error } = await supabase.from("contacts").insert(row); if (error) throw error; setContacts((prev) => [{ ...entry, updatedAt: new Date().toISOString() }, ...prev]); showToast("Contact logged"); }
      setForm({ ...EMPTY_FORM, contactDate: toLocalDatetimeValue(new Date().toISOString()) }); setEditingId(null);
    } catch (err) { console.error(err); showToast("Error saving"); }
    finally { setSyncing(false); }
  };

  const handleDelete = async (id) => { try { await supabase.from("contacts").delete().eq("id", id); setContacts((p) => p.filter((c) => c.id !== id)); showToast("Deleted"); } catch { showToast("Error"); } };
  const handleEdit = (c) => {
    setForm({ campaign: c.campaign, method: c.method, callerName: c.callerName, callerLocation: c.callerLocation, identified: c.identified, source: c.source, register: c.register, tier: c.tier, keyPhrases: c.keyPhrases, notes: c.notes, followUp: c.followUp, staffInitials: c.staffInitials, contactDate: toLocalDatetimeValue(c.timestamp), followUpEmail: c.followUpEmail || "", followUpPhone: c.followUpPhone || "", followUpCompleted: c.followUpCompleted || false });
    setEditingId(c.id); setView("log");
  };
  const toggleFollowUpCompleted = async (c) => {
    const v = !c.followUpCompleted;
    try { await supabase.from("contacts").update({ follow_up_completed: v, updated_at: new Date().toISOString() }).eq("id", c.id); setContacts((p) => p.map((x) => x.id === c.id ? { ...x, followUpCompleted: v } : x)); showToast(v ? "Follow-up complete" : "Reopened"); } catch { showToast("Error"); }
  };
  const addCampaign = async (name) => { const camp = { id: generateId(), name, active: true }; try { await supabase.from("campaigns").insert(camp); setCampaigns((p) => [...p, camp]); showToast("Added"); } catch { showToast("Error"); } };

  const playbook = useMemo(() => ({
    phoneScripts: playbookItems.filter((p) => p.section === "phoneScripts"),
    emailTemplates: playbookItems.filter((p) => p.section === "emailTemplates"),
    talkingPoints: playbookItems.filter((p) => p.section === "talkingPoints"),
  }), [playbookItems]);

  const savePlaybookEdit = async (section, id, content) => { try { await supabase.from("playbook").update({ content, updated_at: new Date().toISOString() }).eq("id", id); setPlaybookItems((p) => p.map((x) => x.id === id ? { ...x, content } : x)); setEditingPlaybookId(null); showToast("Saved"); } catch { showToast("Error"); } };
  const addPlaybookItem = async (section, item) => { const row = { id: item.id, section, title: item.title, campaign: item.campaign || "", tier: item.tier || "", subject: item.subject || "", content: item.content, sort_order: playbookItems.filter((p) => p.section === section).length + 1 }; try { await supabase.from("playbook").insert(row); setPlaybookItems((p) => [...p, rowToPlaybook(row)]); showToast("Added"); } catch { showToast("Error"); } };
  const deletePlaybookItem = async (section, id) => { try { await supabase.from("playbook").delete().eq("id", id); setPlaybookItems((p) => p.filter((x) => x.id !== id)); showToast("Removed"); } catch { showToast("Error"); } };

  const exportCSV = (data, filename) => {
    const headers = ["Date","Campaign","Method","Caller Name","Location","Identified","Source","Register","Tier","Key Phrases","Notes","Follow-up","Follow-up Email","Follow-up Phone","Follow-up Completed","Staff"];
    const rows = data.map((c) => [formatDateShort(c.timestamp), campaigns.find((x) => x.id === c.campaign)?.name || c.campaign, c.method, c.callerName, c.callerLocation, c.identified ? "Yes" : "No", c.source, c.register, "Tier " + c.tier, `"${(c.keyPhrases || "").replace(/"/g, '""')}"`, `"${(c.notes || "").replace(/"/g, '""')}"`, c.followUp ? "Yes" : "No", c.followUpEmail || "", c.followUpPhone || "", c.followUpCompleted ? "Yes" : "No", c.staffInitials]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };
  const exportAllCSV = () => exportCSV(filteredContacts, `eo-contacts-${new Date().toISOString().slice(0, 10)}.csv`);
  const exportFollowUpCSV = () => exportCSV(contacts.filter((c) => c.followUp), `eo-followups-${new Date().toISOString().slice(0, 10)}.csv`);

  const filteredContacts = useMemo(() => {
    let fc = contacts;
    if (filterCampaign !== "all") fc = fc.filter((c) => c.campaign === filterCampaign);
    if (filterRegister !== "all") fc = fc.filter((c) => c.register === filterRegister);
    if (filterDate === "today") { const t = new Date().toDateString(); fc = fc.filter((c) => new Date(c.timestamp).toDateString() === t); }
    else if (filterDate === "week") { const w = Date.now() - 7 * 86400000; fc = fc.filter((c) => new Date(c.timestamp).getTime() > w); }
    return fc;
  }, [contacts, filterCampaign, filterRegister, filterDate]);

  const followUpContacts = useMemo(() => contacts.filter((c) => c.followUp), [contacts]);
  const pendingFollowUps = useMemo(() => followUpContacts.filter((c) => !c.followUpCompleted), [followUpContacts]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayC = contacts.filter((c) => new Date(c.timestamp).toDateString() === today);
    const wk = Date.now() - 7 * 86400000;
    const weekC = contacts.filter((c) => new Date(c.timestamp).getTime() > wk);
    const byRegister = REGISTERS.map((r) => ({ ...r, count: weekC.filter((c) => c.register === r.value).length }));
    const bySource = SOURCES.map((s) => ({ source: s, count: weekC.filter((c) => c.source === s).length }));
    const byMethod = CONTACT_METHODS.map((m) => ({ method: m, count: weekC.filter((c) => c.method === m).length }));
    const pm = {}; weekC.forEach((c) => { if (c.keyPhrases) c.keyPhrases.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean).forEach((p) => { pm[p] = (pm[p] || 0) + 1; }); });
    const topPhrases = Object.entries(pm).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const tier2Plus = weekC.filter((c) => parseInt(c.tier) >= 2).length;
    const outside = weekC.filter((c) => c.source === "Outside electorate").length;
    const daily = []; for (let i = 6; i >= 0; i--) { const d = new Date(Date.now() - i * 86400000); daily.push({ date: d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric" }), count: contacts.filter((c) => new Date(c.timestamp).toDateString() === d.toDateString()).length }); }
    return { todayCount: todayC.length, weekCount: weekC.length, byRegister, bySource, byMethod, topPhrases, tier2Plus, outsideElectorate: outside, pendingFollowUps: pendingFollowUps.length, dailyTrend: daily };
  }, [contacts, pendingFollowUps]);

  const maxDaily = Math.max(...stats.dailyTrend.map((d) => d.count), 1);
  const navItems = [
    { key: "log", label: "Log Contact", icon: "+" },
    { key: "playbook", label: "Playbook", icon: "📋" },
    { key: "list", label: "History", icon: "☰" },
    { key: "dashboard", label: "Dashboard", icon: "◫" },
    { key: "settings", label: "Settings", icon: "⚙" },
  ];
  const filterPB = (items) => pbFilterCampaign === "all" ? items : items.filter((p) => !p.campaign || p.campaign === pbFilterCampaign);
  const playbookSections = [
    { key: "phone", label: "Phone Scripts", data: filterPB(playbook.phoneScripts), allCount: playbook.phoneScripts.length, section: "phoneScripts" },
    { key: "email", label: "Email Templates", data: filterPB(playbook.emailTemplates), allCount: playbook.emailTemplates.length, section: "emailTemplates" },
    { key: "talking", label: "Talking Points", data: filterPB(playbook.talkingPoints), allCount: playbook.talkingPoints.length, section: "talkingPoints" },
  ];
  const currentPBSection = playbookSections.find((s) => s.key === playbookTab);

  if (loading) return <div style={S.loadingWrap}><div style={S.loadingInner}><div style={S.logoMark}>EO</div><div style={S.loadingText}>Loading data…</div></div></div>;
  if (error) return <div style={S.loadingWrap}><div style={S.errorBox}><div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Error</div><div style={{ marginBottom: 12 }}>{error}</div><button style={S.submitBtn} onClick={() => window.location.reload()}>Retry</button></div></div>;

  return (
    <div style={S.container}>
      {toast && <div style={S.toast} className="toast-anim">{toast}</div>}

      {/* HEADER */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.logoMark}>EO</div>
          <div>
            <div style={S.headerTitle}>Electorate Office Contact Logger</div>
            <div style={S.headerSub}>{syncing ? <span style={S.syncBadge}>Saving…</span> : <span style={S.liveBadge}>● Live</span>}</div>
          </div>
        </div>
        <div style={S.headerRight}>
          <div style={S.statPill}><span style={S.statNum}>{stats.todayCount}</span> today</div>
          <div style={{ ...S.statPill, ...(stats.tier2Plus > 0 ? S.statPillWarn : {}) }}><span style={S.statNum}>{stats.tier2Plus}</span> T2+</div>
          {stats.pendingFollowUps > 0 && <div style={{ ...S.statPill, ...S.statPillInfo }}><span style={S.statNum}>{stats.pendingFollowUps}</span> follow-ups</div>}
          <div style={S.userPill}>
            <div style={S.userAvatar}>{userInitials}</div>
            <span style={S.userName}>{userName}</span>
            <button style={S.logoutBtn} onClick={handleLogout} title="Sign out">✕</button>
          </div>
        </div>
      </div>

      {/* NAV */}
      <div style={S.nav}>
        {navItems.map((tab) => (
          <button key={tab.key} onClick={() => { setView(tab.key); if (tab.key !== "log") { setEditingId(null); setForm({ ...EMPTY_FORM, contactDate: toLocalDatetimeValue(new Date().toISOString()) }); } }}
            style={{ ...S.navBtn, ...(view === tab.key ? S.navBtnActive : {}) }}>
            <span style={S.navIcon}>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== LOG ==================== */}
      {view === "log" && (
        <div style={S.card} className="card-anim">
          <div style={S.formHeader}>{editingId ? "Edit Contact" : "Log New Contact"}<span style={S.formHeaderHint}>Target: under 30 seconds</span></div>
          <div style={S.formGrid} className="form-grid-responsive">
            <div style={S.fieldGroup}><label style={S.label}>Campaign</label><select style={S.select} value={form.campaign} onChange={(e) => updateField("campaign", e.target.value)}>{campaigns.filter((c) => c.active).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}</select></div>
            <div style={S.fieldGroup}><label style={S.label}>Date & Time <span style={S.labelH}>(change for historic entries)</span></label><input type="datetime-local" style={S.input} value={form.contactDate} onChange={(e) => updateField("contactDate", e.target.value)} /></div>
            <div style={S.fieldGroup}><label style={S.label}>Contact Method</label><div style={S.chipRow}>{CONTACT_METHODS.map((m) => (<button key={m} onClick={() => updateField("method", m)} style={{ ...S.chip, ...(form.method === m ? S.chipActive : {}) }}>{m}</button>))}</div></div>
            <div style={S.fieldGroup}><label style={S.label}>Caller / Sender Name</label><input style={S.input} value={form.callerName} onChange={(e) => updateField("callerName", e.target.value)} placeholder="Leave blank if refused" /></div>
            <div style={S.fieldGroup}><label style={S.label}>Location / Town</label><input style={S.input} value={form.callerLocation} onChange={(e) => updateField("callerLocation", e.target.value)} placeholder="e.g. Echuca, Tatura" /></div>
            <div style={S.fieldGroup}><label style={S.label}>Identified?</label><div style={S.chipRow}><button onClick={() => updateField("identified", true)} style={{ ...S.chip, ...(form.identified ? S.chipActive : {}) }}>Yes</button><button onClick={() => updateField("identified", false)} style={{ ...S.chip, ...(!form.identified ? S.chipActiveWarn : {}) }}>Refused</button></div></div>
            <div style={S.fieldGroup}><label style={S.label}>Source</label><select style={S.select} value={form.source} onChange={(e) => updateField("source", e.target.value)}>{SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            <div style={{ ...S.fieldGroup, ...S.fieldHL }}><label style={S.label}>Emotional Register</label><div style={S.chipRow}>{REGISTERS.map((r) => (<button key={r.value} onClick={() => updateField("register", r.value)} style={{ ...S.chip, ...(form.register === r.value ? { background: r.bg, color: r.color, borderColor: r.color, fontWeight: 700 } : {}) }}>{r.label}</button>))}</div></div>
            <div style={{ ...S.fieldGroup, ...S.fieldHL }}><label style={S.label}>Response Tier</label>{TIERS.map((t) => (<label key={t.value} style={{ ...S.tierOpt, ...(form.tier === t.value ? S.tierOptActive : {}) }} onClick={() => updateField("tier", t.value)}><input type="radio" name="tier" checked={form.tier === t.value} onChange={() => {}} style={{ display: "none" }} /><span style={S.tierLabel}>{t.label}</span><span style={S.tierDesc}>{t.desc}</span></label>))}</div>
            <div style={S.fieldGroup}><label style={S.label}>Key Phrases <span style={S.labelH}>(comma-separated)</span></label><input style={S.input} value={form.keyPhrases} onChange={(e) => updateField("keyPhrases", e.target.value)} placeholder='"$300 million", "abandon"' /></div>
            <div style={S.fieldGroup}><label style={S.label}>Staff Initials</label><input style={{ ...S.input, maxWidth: 120 }} value={form.staffInitials} onChange={(e) => updateField("staffInitials", e.target.value.toUpperCase())} placeholder={userInitials} maxLength={4} /></div>
            <div style={{ ...S.fieldGroup, gridColumn: "1 / -1" }}><label style={S.label}>Notes <span style={S.labelH}>(one line is fine)</span></label><textarea style={{ ...S.input, minHeight: 52, resize: "vertical" }} value={form.notes} onChange={(e) => updateField("notes", e.target.value)} placeholder="Brief summary" /></div>
            <div style={{ ...S.fieldGroup, gridColumn: "1 / -1" }}>
              <label style={{ ...S.chipRow, gap: 8, cursor: "pointer" }} onClick={() => updateField("followUp", !form.followUp)}><span style={{ ...S.checkbox, ...(form.followUp ? S.checkboxChecked : {}) }}>{form.followUp ? "✓" : ""}</span><span style={S.label}>Requires follow-up from MP</span></label>
            </div>
            {form.followUp && (<>
              <div style={S.fieldGroup}><label style={S.label}>Follow-up Email</label><input type="email" style={S.input} value={form.followUpEmail} onChange={(e) => updateField("followUpEmail", e.target.value)} placeholder="constituent@email.com" /></div>
              <div style={S.fieldGroup}><label style={S.label}>Follow-up Phone</label><input type="tel" style={S.input} value={form.followUpPhone} onChange={(e) => updateField("followUpPhone", e.target.value)} placeholder="04XX XXX XXX" /></div>
              <div style={{ ...S.fieldGroup, gridColumn: "1 / -1" }}><label style={{ ...S.chipRow, gap: 8, cursor: "pointer" }} onClick={() => updateField("followUpCompleted", !form.followUpCompleted)}><span style={{ ...S.checkbox, ...(form.followUpCompleted ? S.checkboxCompleted : {}) }}>{form.followUpCompleted ? "✓" : ""}</span><span style={S.label}>Follow-up completed</span></label></div>
            </>)}
            <div style={{ ...S.fieldGroup, gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 8 }}>
              {editingId && <button style={S.cancelBtn} onClick={() => { setEditingId(null); setForm({ ...EMPTY_FORM, contactDate: toLocalDatetimeValue(new Date().toISOString()) }); }}>Cancel</button>}
              <button style={{ ...S.submitBtn, opacity: syncing ? 0.6 : 1 }} onClick={handleSubmit} disabled={syncing}>{syncing ? "Saving…" : editingId ? "Update" : "Log Contact"}</button>
            </div>
          </div>
          {form.tier === "3" && <div style={S.tier3Warn}><strong>TIER 3 PROTOCOL:</strong> End the interaction. Contact local police. Document everything. Brief CoS / MP.</div>}
          <div style={S.scriptLink} onClick={() => { setView("playbook"); setPlaybookTab("phone"); }}>📋 View {form.tier === "3" ? "Tier 3 security" : form.tier === "2" ? "Tier 2 disengagement" : "Tier 1 response"} script in Playbook →</div>
        </div>
      )}

      {/* ==================== PLAYBOOK ==================== */}
      {view === "playbook" && (
        <div>
          <div style={S.pbNav}>{playbookSections.map((s) => (<button key={s.key} onClick={() => { setPlaybookTab(s.key); setEditingPlaybookId(null); }} style={{ ...S.pbNavBtn, ...(playbookTab === s.key ? S.pbNavBtnActive : {}) }}>{s.label}<span style={S.pbNavCount}>{s.data.length}{pbFilterCampaign !== "all" && s.data.length !== s.allCount ? `/${s.allCount}` : ""}</span></button>))}</div>
          <div style={S.pbFilterRow}>
            <label style={S.pbFilterLabel}>Show:</label>
            <select style={S.filterSel} value={pbFilterCampaign} onChange={(e) => setPbFilterCampaign(e.target.value)}>
              <option value="all">All campaigns + general</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {pbFilterCampaign !== "all" && <span style={S.pbFilterHint}>Also showing general-use items</span>}
          </div>
          {currentPBSection.data.map((item) => {
            const isExpanded = expandedScript === item.id;
            const isEditing = editingPlaybookId === item.id;
            const campName = item.campaign ? campaigns.find((c) => c.id === item.campaign)?.name : null;
            const tierInfo = item.tier ? TIERS.find((t) => t.value === item.tier) : null;
            return (
              <div key={item.id} style={S.pbCard}>
                <div style={S.pbCardHeader} onClick={() => setExpandedScript(isExpanded ? null : item.id)}>
                  <div style={S.pbCardTitleRow}><span style={S.pbCardTitle}>{item.title}</span><div style={S.pbCardBadges}>{campName && <span style={S.pbCampBadge}>{campName}</span>}{tierInfo && <span style={S.pbTierBadge}>Tier {item.tier}</span>}</div></div>
                  <span style={{ ...S.pbChevron, transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
                </div>
                {isExpanded && (<div style={S.pbCardBody}>
                  {item.subject && <div style={S.pbSubject}>Subject: <strong>{item.subject}</strong></div>}
                  {isEditing ? (<div><textarea style={S.pbEditArea} value={editingPlaybookText} onChange={(e) => setEditingPlaybookText(e.target.value)} /><div style={S.pbEditActions}><button style={S.submitBtn} onClick={() => savePlaybookEdit(currentPBSection.section, item.id, editingPlaybookText)}>Save</button><button style={S.cancelBtn} onClick={() => setEditingPlaybookId(null)}>Cancel</button></div></div>) : (<pre style={S.pbContent}>{item.content}</pre>)}
                  {!isEditing && (<div style={S.pbActions}>
                    <button style={S.pbActionBtn} onClick={() => { copyToClipboard(item.content); showToast("Copied"); }}>📋 Copy</button>
                    {playbookTab === "email" && item.subject && <button style={S.pbActionBtn} onClick={() => { copyToClipboard(`Subject: ${item.subject}\n\n${item.content}`); showToast("Email copied"); }}>✉️ Copy with Subject</button>}
                    <button style={S.pbActionBtn} onClick={() => { setEditingPlaybookId(item.id); setEditingPlaybookText(item.content); }}>✏️ Edit</button>
                    <button style={{ ...S.pbActionBtn, color: "#C23934" }} onClick={() => deletePlaybookItem(currentPBSection.section, item.id)}>🗑️ Delete</button>
                  </div>)}
                </div>)}
              </div>
            );
          })}
          <div style={{ ...S.card, marginTop: 16 }}>
            <div style={S.label}>Add New {playbookTab === "phone" ? "Phone Script" : playbookTab === "email" ? "Email Template" : "Talking Points"}</div>
            <input id="pb-title" style={{ ...S.input, marginTop: 8, marginBottom: 8 }} placeholder="Title" />
            {playbookTab === "email" && <input id="pb-subject" style={{ ...S.input, marginBottom: 8 }} placeholder="Email subject line" />}
            <select id="pb-campaign" style={{ ...S.select, marginBottom: 8, width: "100%" }}><option value="">No specific campaign</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <textarea id="pb-content" style={{ ...S.input, minHeight: 100, resize: "vertical" }} placeholder="Content" />
            <button style={{ ...S.submitBtn, marginTop: 10 }} onClick={() => {
              const title = document.getElementById("pb-title").value.trim(); const content = document.getElementById("pb-content").value.trim(); const campaign = document.getElementById("pb-campaign").value;
              const subject = playbookTab === "email" ? document.getElementById("pb-subject")?.value?.trim() || "" : undefined;
              if (!title || !content) { showToast("Title and content required"); return; }
              addPlaybookItem(currentPBSection.section, { id: generateId(), title, content, campaign, ...(subject !== undefined ? { subject } : {}) });
              document.getElementById("pb-title").value = ""; document.getElementById("pb-content").value = "";
              if (document.getElementById("pb-subject")) document.getElementById("pb-subject").value = "";
            }}>Add to Playbook</button>
          </div>
        </div>
      )}

      {/* ==================== LIST ==================== */}
      {view === "list" && (
        <div>
          <div style={S.listHeader}>
            <div style={S.filterRow}>
              <select style={S.filterSel} value={filterCampaign} onChange={(e) => setFilterCampaign(e.target.value)}><option value="all">All campaigns</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <select style={S.filterSel} value={filterRegister} onChange={(e) => setFilterRegister(e.target.value)}><option value="all">All registers</option>{REGISTERS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
              <select style={S.filterSel} value={filterDate} onChange={(e) => setFilterDate(e.target.value)}><option value="all">All time</option><option value="today">Today</option><option value="week">Last 7 days</option></select>
              <button style={S.exportBtn} onClick={exportAllCSV}>Export CSV</button>
              <button style={{ ...S.exportBtn, ...S.exportFollowUp }} onClick={exportFollowUpCSV}>Export Follow-ups ({followUpContacts.length})</button>
            </div>
            <div style={S.listCount}>{filteredContacts.length} contact{filteredContacts.length !== 1 ? "s" : ""}</div>
          </div>
          {filteredContacts.length === 0 ? <div style={S.emptyState}>No contacts match these filters.</div> : (
            <div style={S.contactList}>{filteredContacts.map((c) => {
              const reg = REGISTERS.find((r) => r.value === c.register);
              const campName = campaigns.find((x) => x.id === c.campaign)?.name || c.campaign;
              return (<div key={c.id} style={{ ...S.contactCard, ...(c.followUp && !c.followUpCompleted ? S.contactCardFollowUp : {}) }}>
                <div style={S.cardTop}>
                  <div style={S.cardMeta}><span style={{ ...S.regBadge, background: reg?.bg, color: reg?.color }}>{reg?.label}</span><span style={S.tierBadge}>Tier {c.tier}</span><span style={S.methodBadge}>{c.method}</span>{c.followUp && !c.followUpCompleted && <span style={S.followUpBadge}>Follow-up pending</span>}{c.followUp && c.followUpCompleted && <span style={S.followUpDoneBadge}>Follow-up done</span>}</div>
                  <div style={S.cardActions}>
                    {c.followUp && <button style={{ ...S.cardActBtn, ...(c.followUpCompleted ? { color: "#1B8838" } : { color: "#1A73A7", fontWeight: 600 }) }} onClick={() => toggleFollowUpCompleted(c)}>{c.followUpCompleted ? "Reopen" : "✓ Complete"}</button>}
                    <button style={S.cardActBtn} onClick={() => handleEdit(c)}>Edit</button>
                    <button style={{ ...S.cardActBtn, color: "#C23934" }} onClick={() => handleDelete(c.id)}>Delete</button>
                  </div>
                </div>
                <div style={S.cardBody}><div style={S.cardName}>{c.callerName || "Unidentified"}{c.callerLocation ? ` — ${c.callerLocation}` : ""}</div>{c.notes && <div style={S.cardNotes}>{c.notes}</div>}{c.keyPhrases && <div style={S.cardPhrases}>Phrases: {c.keyPhrases}</div>}{c.followUp && (c.followUpEmail || c.followUpPhone) && <div style={S.followUpDetails}>Follow-up: {c.followUpEmail && <span>{c.followUpEmail}</span>}{c.followUpEmail && c.followUpPhone && " · "}{c.followUpPhone && <span>{c.followUpPhone}</span>}</div>}</div>
                <div style={S.cardFooter}><span>{formatDate(c.timestamp)}</span><span>{campName}</span><span>Source: {c.source}</span>{c.staffInitials && <span>Staff: {c.staffInitials}</span>}</div>
              </div>);
            })}</div>
          )}
        </div>
      )}

      {/* ==================== DASHBOARD ==================== */}
      {view === "dashboard" && (
        <div>
          <div style={S.dashTitle}>7-Day Overview</div>
          <div style={S.dashStatRow} className="stat-row-responsive">
            {[{ n: stats.weekCount, l: "This week" }, { n: stats.todayCount, l: "Today" }, { n: stats.tier2Plus, l: "Tier 2+", warn: stats.tier2Plus > 0 }, { n: stats.outsideElectorate, l: "Outside electorate" }, { n: stats.pendingFollowUps, l: "Follow-ups pending", info: stats.pendingFollowUps > 0 }].map((s, i) => (
              <div key={i} style={{ ...S.dashStatCard, ...(s.warn ? { borderColor: "#C23934" } : s.info ? { borderColor: "#1A73A7" } : {}) }}><div style={{ ...S.dashStatNum, ...(s.warn ? { color: "#C23934" } : s.info ? { color: "#1A73A7" } : {}) }}>{s.n}</div><div style={S.dashStatLabel}>{s.l}</div></div>
            ))}
          </div>
          <div style={S.dashSection}><div style={S.dashSecTitle}>Daily Volume</div><div style={S.barChart}>{stats.dailyTrend.map((d, i) => (<div key={i} style={S.barCol}><div style={S.barCount}>{d.count}</div><div style={{ ...S.bar, height: `${Math.max((d.count / maxDaily) * 120, 2)}px` }} /><div style={S.barLabel}>{d.date}</div></div>))}</div></div>
          <div style={S.dashGrid} className="dash-grid-responsive">
            <div style={S.dashSection}><div style={S.dashSecTitle}>By Register</div>{stats.byRegister.map((r) => (<div key={r.value} style={S.breakdownRow}><span style={{ ...S.regDot, background: r.color }} /><span style={S.bdLabel}>{r.label}</span><span style={S.bdBar}><span style={{ ...S.bdFill, width: `${stats.weekCount ? (r.count / stats.weekCount) * 100 : 0}%`, background: r.color }} /></span><span style={S.bdCount}>{r.count}</span></div>))}</div>
            <div style={S.dashSection}><div style={S.dashSecTitle}>By Source</div>{stats.bySource.filter((s) => s.count > 0).map((s) => (<div key={s.source} style={S.breakdownRow}><span style={S.bdLabel}>{s.source}</span><span style={S.bdBar}><span style={{ ...S.bdFill, width: `${stats.weekCount ? (s.count / stats.weekCount) * 100 : 0}%`, background: "#6B7266" }} /></span><span style={S.bdCount}>{s.count}</span></div>))}{stats.bySource.every((s) => s.count === 0) && <div style={S.emptyMini}>No data</div>}</div>
            <div style={S.dashSection}><div style={S.dashSecTitle}>Recurring Phrases</div>{stats.topPhrases.length > 0 ? stats.topPhrases.map(([p, c]) => (<div key={p} style={S.phraseRow}><span style={S.phraseText}>"{p}"</span><span style={S.phraseCount}>×{c}</span></div>)) : <div style={S.emptyMini}>No phrases</div>}<div style={S.phraseHint}>Track to identify coordinated campaigns</div></div>
            <div style={S.dashSection}><div style={S.dashSecTitle}>By Method</div>{stats.byMethod.filter((m) => m.count > 0).map((m) => (<div key={m.method} style={S.breakdownRow}><span style={S.bdLabel}>{m.method}</span><span style={S.bdBar}><span style={{ ...S.bdFill, width: `${stats.weekCount ? (m.count / stats.weekCount) * 100 : 0}%`, background: "#1A73A7" }} /></span><span style={S.bdCount}>{m.count}</span></div>))}{stats.byMethod.every((m) => m.count === 0) && <div style={S.emptyMini}>No data</div>}</div>
          </div>
          <div style={S.briefingBox}><div style={S.briefingTitle}>MP Briefing Summary</div><div style={S.briefingText}>This week: {stats.weekCount} contacts. {stats.tier2Plus > 0 ? `${stats.tier2Plus} Tier 2+. ` : "No Tier 2+. "}{stats.outsideElectorate > 0 ? `${stats.outsideElectorate} outside electorate. ` : ""}{stats.pendingFollowUps > 0 ? `${stats.pendingFollowUps} pending MP follow-up.` : "No pending follow-ups."}</div></div>
        </div>
      )}

      {/* ==================== SETTINGS ==================== */}
      {view === "settings" && (
        <div style={S.card}>
          <div style={S.dashSecTitle}>Signed in as</div>
          <div style={{ ...S.connectedBox, marginBottom: 20 }}><div style={S.userAvatar}>{userInitials}</div><div><div style={{ fontWeight: 600 }}>{userName}</div><div style={{ fontSize: 12, color: "#6B7266" }}>{user?.email}</div></div></div>
          <div style={S.dashSecTitle}>Manage Campaigns</div>
          <p style={S.settingsHint}>Changes sync across all staff in real time.</p>
          <div style={S.campaignList}>{campaigns.map((c) => (<div key={c.id} style={S.campaignRow}><span style={{ ...S.campaignDot, background: c.active ? "#1B8838" : "#CDD1CA" }} /><span style={S.campaignName}>{c.name}</span><span style={S.campaignStatus}>{c.active ? "Active" : "Archived"}</span></div>))}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}><input id="new-camp" style={S.input} placeholder='e.g. "Immigration Policy (May 2026)"' /><button style={S.submitBtn} onClick={() => { const input = document.getElementById("new-camp"); if (input.value.trim()) { addCampaign(input.value.trim()); input.value = ""; } }}>Add</button></div>
          <div style={{ ...S.dashSecTitle, marginTop: 32 }}>Data</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button style={S.exportBtn} onClick={exportAllCSV}>Export All Contacts</button><button style={{ ...S.exportBtn, ...S.exportFollowUp }} onClick={exportFollowUpCSV}>Export Follow-ups ({followUpContacts.length})</button></div>
          <div style={{ ...S.dashSecTitle, marginTop: 32 }}>Session</div>
          <button style={{ ...S.exportBtn, color: "#C23934", borderColor: "#F8D0CE" }} onClick={handleLogout}>Sign Out</button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// STYLES — Nationals Brand (Green #1B8838 / Gold #FFD200)
// ============================================================
const S = {
  container: { fontFamily: "'Source Sans 3', 'Helvetica Neue', Arial, sans-serif", maxWidth: 960, margin: "0 auto", padding: "16px 16px 40px", color: "#2C3029", fontSize: 14, position: "relative" },
  loadingWrap: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" },
  loadingInner: { textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  loadingText: { color: "#6B7266", fontSize: 14 },
  errorBox: { background: "#FDE8E8", border: "1px solid #F8D0CE", borderRadius: 8, padding: 24, textAlign: "center", color: "#C23934", maxWidth: 400 },
  toast: { position: "fixed", top: 16, right: 16, background: "#0E4A1E", color: "#FFFFFF", padding: "10px 20px", borderRadius: 8, fontSize: 13, zIndex: 999, boxShadow: "0 4px 12px rgba(26,29,24,0.15)", fontWeight: 500 },

  // Login
  loginWrap: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#F7F8F6", padding: 16 },
  loginCard: { background: "#FFFFFF", borderRadius: 12, padding: 32, width: "100%", maxWidth: 400, boxShadow: "0 8px 24px rgba(26,29,24,0.12)", border: "1px solid #EAECE8" },
  loginHeader: { display: "flex", alignItems: "center", gap: 12, marginBottom: 24 },
  loginTitle: { fontSize: 20, fontWeight: 700, color: "#1A1D18", fontFamily: "'Montserrat', sans-serif" },
  loginSubtitle: { fontSize: 12, color: "#6B7266", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
  loginDivider: { height: 2, background: "linear-gradient(to right, #1B8838, #FFD200)", margin: "0 0 24px", borderRadius: 1 },
  loginLabel: { fontSize: 14, color: "#6B7266", marginBottom: 16 },
  loginField: { marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 },
  loginError: { background: "#FDE8E8", border: "1px solid #F8D0CE", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#C23934", marginBottom: 8 },
  loginFooter: { marginTop: 24, fontSize: 12, color: "#CDD1CA", textAlign: "center", lineHeight: 1.5 },

  // Header
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0 12px", borderBottom: "3px solid #1B8838", flexWrap: "wrap", gap: 12 },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logoMark: { width: 40, height: 40, background: "#1B8838", color: "#FFD200", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, letterSpacing: 1, borderRadius: 8, flexShrink: 0, fontFamily: "'Montserrat', sans-serif" },
  headerTitle: { fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", color: "#1A1D18", fontFamily: "'Montserrat', sans-serif" },
  headerSub: { fontSize: 11, color: "#6B7266", letterSpacing: "0.02em", textTransform: "uppercase", marginTop: 2, fontWeight: 500 },
  syncBadge: { color: "#E0A100", fontWeight: 600 },
  liveBadge: { color: "#1B8838", fontWeight: 600 },
  headerRight: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  statPill: { background: "#E6F4EA", padding: "6px 14px", borderRadius: 20, fontSize: 12, color: "#0E4A1E", display: "flex", alignItems: "center", gap: 4, fontWeight: 500 },
  statPillWarn: { background: "#FDE8E8", color: "#C23934" },
  statPillInfo: { background: "#E3F2FD", color: "#1A73A7" },
  statNum: { fontWeight: 700, fontSize: 16, fontFamily: "'Montserrat', sans-serif" },
  userPill: { display: "flex", alignItems: "center", gap: 6, background: "#F7F8F6", border: "1px solid #EAECE8", borderRadius: 20, padding: "4px 10px 4px 4px" },
  userAvatar: { width: 30, height: 30, borderRadius: "50%", background: "#1B8838", color: "#FFD200", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, letterSpacing: "0.02em", flexShrink: 0, fontFamily: "'Montserrat', sans-serif" },
  userName: { fontSize: 12, fontWeight: 500, color: "#2C3029", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  logoutBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#CDD1CA", padding: "0 2px", lineHeight: 1, minHeight: 48, minWidth: 32, display: "flex", alignItems: "center", justifyContent: "center" },

  // Nav
  nav: { display: "flex", gap: 0, borderBottom: "1px solid #EAECE8", marginBottom: 20, overflowX: "auto" },
  navBtn: { flex: "1 0 auto", padding: "14px 8px", border: "none", borderBottom: "3px solid transparent", background: "none", cursor: "pointer", fontSize: 13, color: "#6B7266", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, whiteSpace: "nowrap", minHeight: 48 },
  navBtnActive: { color: "#1B8838", borderBottomColor: "#1B8838", fontWeight: 700 },
  navIcon: { fontSize: 14 },

  // Form
  card: { background: "#FFFFFF", border: "1px solid #EAECE8", borderRadius: 12, padding: 24, boxShadow: "0 1px 2px rgba(26,29,24,0.06)" },
  formHeader: { fontSize: 18, fontWeight: 700, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: "'Montserrat', sans-serif", color: "#1A1D18" },
  formHeaderHint: { fontSize: 11, color: "#CDD1CA", fontWeight: 400, fontFamily: "'Source Sans 3', sans-serif" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 24px" },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 6 },
  fieldHL: { background: "#F7F8F6", padding: 12, borderRadius: 8, border: "1px solid #EAECE8" },
  label: { fontSize: 12, fontWeight: 600, color: "#2C3029", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "'Montserrat', sans-serif" },
  labelH: { fontWeight: 400, textTransform: "none", color: "#CDD1CA", letterSpacing: 0, fontFamily: "'Source Sans 3', sans-serif" },
  input: { padding: "10px 12px", border: "1px solid #CDD1CA", borderRadius: 8, fontSize: 14, outline: "none", fontFamily: "'Source Sans 3', sans-serif", color: "#2C3029", background: "#FFFFFF", width: "100%", boxSizing: "border-box", minHeight: 44, transition: "border-color 150ms ease, box-shadow 150ms ease" },
  select: { padding: "10px 12px", border: "1px solid #CDD1CA", borderRadius: 8, fontSize: 14, outline: "none", fontFamily: "'Source Sans 3', sans-serif", color: "#2C3029", background: "#FFFFFF", cursor: "pointer", minHeight: 44 },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" },
  chip: { padding: "6px 14px", border: "1.5px solid #CDD1CA", borderRadius: 20, fontSize: 12, cursor: "pointer", background: "#FFFFFF", color: "#6B7266", fontFamily: "'Source Sans 3', sans-serif", fontWeight: 500, minHeight: 36, display: "inline-flex", alignItems: "center", transition: "all 150ms ease" },
  chipActive: { background: "#1B8838", color: "#FFFFFF", borderColor: "#1B8838" },
  chipActiveWarn: { background: "#FFF8E1", color: "#E0A100", borderColor: "#E0A100" },
  tierOpt: { display: "flex", flexDirection: "column", padding: "10px 14px", border: "1.5px solid #EAECE8", borderRadius: 8, cursor: "pointer", marginBottom: 4, transition: "all 150ms ease", minHeight: 48, justifyContent: "center" },
  tierOptActive: { borderColor: "#1B8838", background: "#E6F4EA" },
  tierLabel: { fontSize: 13, fontWeight: 600, color: "#1A1D18", fontFamily: "'Montserrat', sans-serif" },
  tierDesc: { fontSize: 11, color: "#6B7266", marginTop: 2 },
  checkbox: { width: 22, height: 22, border: "2px solid #CDD1CA", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0, transition: "all 150ms ease" },
  checkboxChecked: { background: "#1B8838", color: "#FFFFFF", borderColor: "#1B8838" },
  checkboxCompleted: { background: "#14652A", color: "#FFD200", borderColor: "#14652A" },
  submitBtn: { padding: "12px 24px", background: "#1B8838", color: "#FFFFFF", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", whiteSpace: "nowrap", minHeight: 48, transition: "background-color 150ms ease" },
  cancelBtn: { padding: "12px 20px", background: "#F7F8F6", color: "#6B7266", border: "1px solid #CDD1CA", borderRadius: 8, fontSize: 14, cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif", whiteSpace: "nowrap", minHeight: 48 },
  tier3Warn: { marginTop: 16, padding: "14px 18px", background: "#FDE8E8", border: "2px solid #C23934", borderRadius: 8, color: "#7A1F1A", fontSize: 13, lineHeight: 1.5 },
  scriptLink: { marginTop: 12, padding: "12px 14px", background: "#E6F4EA", borderRadius: 8, color: "#14652A", fontSize: 13, cursor: "pointer", fontWeight: 600, textAlign: "center", transition: "background-color 150ms ease", minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center" },

  // Playbook
  pbNav: { display: "flex", gap: 0, borderBottom: "1px solid #EAECE8", marginBottom: 0 },
  pbNavBtn: { flex: 1, padding: "12px 8px", border: "none", borderBottom: "3px solid transparent", background: "none", cursor: "pointer", fontSize: 13, color: "#6B7266", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 48 },
  pbNavBtnActive: { color: "#1B8838", borderBottomColor: "#1B8838", fontWeight: 700 },
  pbNavCount: { background: "#E6F4EA", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700, color: "#14652A" },
  pbFilterRow: { display: "flex", alignItems: "center", gap: 10, padding: "12px 0 16px", flexWrap: "wrap" },
  pbFilterLabel: { fontSize: 12, fontWeight: 600, color: "#6B7266", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "'Montserrat', sans-serif" },
  pbFilterHint: { fontSize: 11, color: "#CDD1CA", fontStyle: "italic" },
  pbCard: { background: "#FFFFFF", border: "1px solid #EAECE8", borderRadius: 8, marginBottom: 8, overflow: "hidden" },
  pbCardHeader: { padding: "14px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, transition: "background-color 150ms ease", minHeight: 48 },
  pbCardTitleRow: { display: "flex", flexDirection: "column", gap: 4, flex: 1 },
  pbCardTitle: { fontSize: 14, fontWeight: 600, color: "#1A1D18", fontFamily: "'Montserrat', sans-serif" },
  pbCardBadges: { display: "flex", gap: 6, flexWrap: "wrap" },
  pbCampBadge: { padding: "2px 10px", borderRadius: 10, fontSize: 10, background: "#E6F4EA", color: "#14652A", fontWeight: 600 },
  pbTierBadge: { padding: "2px 10px", borderRadius: 10, fontSize: 10, background: "#F7F8F6", color: "#6B7266", fontWeight: 600 },
  pbChevron: { fontSize: 16, color: "#CDD1CA", transition: "transform 200ms ease", flexShrink: 0 },
  pbCardBody: { padding: "0 16px 16px", borderTop: "1px solid #EAECE8" },
  pbSubject: { fontSize: 13, color: "#6B7266", padding: "12px 0 8px", borderBottom: "1px solid #EAECE8", marginBottom: 8 },
  pbContent: { fontSize: 13, lineHeight: 1.7, color: "#2C3029", whiteSpace: "pre-wrap", fontFamily: "'Source Sans 3', sans-serif", background: "#F7F8F6", padding: 16, borderRadius: 8, border: "1px solid #EAECE8", margin: "8px 0", maxHeight: 500, overflow: "auto" },
  pbActions: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 },
  pbActionBtn: { padding: "8px 14px", background: "#F7F8F6", border: "1px solid #EAECE8", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif", color: "#2C3029", fontWeight: 500, minHeight: 36, display: "inline-flex", alignItems: "center", transition: "all 150ms ease" },
  pbEditArea: { width: "100%", minHeight: 200, padding: 14, border: "1px solid #CDD1CA", borderRadius: 8, fontSize: 13, fontFamily: "'Source Sans 3', sans-serif", lineHeight: 1.7, color: "#2C3029", resize: "vertical", boxSizing: "border-box", marginTop: 8 },
  pbEditActions: { display: "flex", gap: 8, marginTop: 12 },

  // List
  listHeader: { marginBottom: 16 },
  filterRow: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 },
  filterSel: { padding: "8px 12px", border: "1px solid #CDD1CA", borderRadius: 8, fontSize: 13, fontFamily: "'Source Sans 3', sans-serif", color: "#2C3029", background: "#FFFFFF", minHeight: 40 },
  exportBtn: { padding: "8px 16px", background: "#F7F8F6", border: "1px solid #CDD1CA", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif", color: "#2C3029", fontWeight: 500, minHeight: 40, display: "inline-flex", alignItems: "center" },
  exportFollowUp: { background: "#E6F4EA", borderColor: "#1B8838", color: "#14652A" },
  listCount: { fontSize: 12, color: "#CDD1CA" },
  contactList: { display: "flex", flexDirection: "column", gap: 8 },
  contactCard: { background: "#FFFFFF", border: "1px solid #EAECE8", borderRadius: 8, padding: "14px 16px" },
  contactCardFollowUp: { borderLeft: "4px solid #1A73A7" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 },
  cardMeta: { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" },
  regBadge: { padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", fontFamily: "'Montserrat', sans-serif" },
  tierBadge: { padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: "#F7F8F6", color: "#6B7266" },
  methodBadge: { padding: "3px 10px", borderRadius: 12, fontSize: 11, background: "#E6F4EA", color: "#14652A" },
  followUpBadge: { padding: "3px 10px", borderRadius: 12, fontSize: 11, background: "#E3F2FD", color: "#1A73A7", fontWeight: 600 },
  followUpDoneBadge: { padding: "3px 10px", borderRadius: 12, fontSize: 11, background: "#E6F4EA", color: "#1B8838", fontWeight: 600 },
  cardActions: { display: "flex", gap: 4, flexWrap: "wrap" },
  cardActBtn: { padding: "6px 12px", background: "none", border: "1px solid #EAECE8", borderRadius: 8, fontSize: 11, cursor: "pointer", color: "#6B7266", fontFamily: "'Source Sans 3', sans-serif", minHeight: 32, display: "inline-flex", alignItems: "center", transition: "all 150ms ease" },
  cardBody: { marginBottom: 10 },
  cardName: { fontSize: 15, fontWeight: 600, marginBottom: 4, color: "#1A1D18", fontFamily: "'Montserrat', sans-serif" },
  cardNotes: { fontSize: 13, color: "#6B7266", lineHeight: 1.5 },
  cardPhrases: { fontSize: 12, color: "#CDD1CA", fontStyle: "italic", marginTop: 4 },
  followUpDetails: { fontSize: 12, color: "#1A73A7", marginTop: 8, padding: "8px 12px", background: "#E3F2FD", borderRadius: 6, fontWeight: 500 },
  cardFooter: { display: "flex", gap: 16, fontSize: 11, color: "#CDD1CA", borderTop: "1px solid #EAECE8", paddingTop: 10, flexWrap: "wrap" },
  emptyState: { textAlign: "center", color: "#CDD1CA", padding: "40px 0", fontSize: 14 },

  // Dashboard
  dashTitle: { fontSize: 20, fontWeight: 700, marginBottom: 16, fontFamily: "'Montserrat', sans-serif", color: "#1A1D18" },
  dashStatRow: { display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  dashStatCard: { flex: "1 1 140px", background: "#FFFFFF", border: "1.5px solid #EAECE8", borderRadius: 12, padding: "16px 12px", textAlign: "center" },
  dashStatNum: { fontSize: 28, fontWeight: 800, color: "#1A1D18", lineHeight: 1, fontFamily: "'Montserrat', sans-serif" },
  dashStatLabel: { fontSize: 10, color: "#6B7266", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
  barChart: { display: "flex", gap: 8, alignItems: "flex-end", justifyContent: "space-between", height: 160, marginBottom: 8, padding: "0 8px" },
  barCol: { display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 4 },
  bar: { width: "100%", maxWidth: 48, background: "#1B8838", borderRadius: "4px 4px 0 0", minHeight: 2 },
  barCount: { fontSize: 12, fontWeight: 700, color: "#2C3029", fontFamily: "'Montserrat', sans-serif" },
  barLabel: { fontSize: 10, color: "#CDD1CA", whiteSpace: "nowrap" },
  dashGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 },
  dashSection: { background: "#FFFFFF", border: "1px solid #EAECE8", borderRadius: 12, padding: 16, marginBottom: 8 },
  dashSecTitle: { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#2C3029", marginBottom: 12, fontFamily: "'Montserrat', sans-serif" },
  breakdownRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 },
  regDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  bdLabel: { fontSize: 12, color: "#6B7266", minWidth: 80, flexShrink: 0 },
  bdBar: { flex: 1, height: 8, background: "#EAECE8", borderRadius: 4, overflow: "hidden" },
  bdFill: { height: "100%", borderRadius: 4, display: "block" },
  bdCount: { fontSize: 13, fontWeight: 700, color: "#2C3029", minWidth: 24, textAlign: "right", fontFamily: "'Montserrat', sans-serif" },
  phraseRow: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #EAECE8" },
  phraseText: { fontSize: 13, color: "#6B7266" },
  phraseCount: { fontSize: 12, fontWeight: 700, color: "#2C3029", fontFamily: "'Montserrat', sans-serif" },
  phraseHint: { fontSize: 11, color: "#CDD1CA", marginTop: 8, fontStyle: "italic" },
  emptyMini: { fontSize: 12, color: "#CDD1CA", fontStyle: "italic" },
  briefingBox: { background: "#FFF8E1", border: "1px solid #FFD200", borderRadius: 12, padding: 16, marginTop: 8 },
  briefingTitle: { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#E0A100", marginBottom: 8, fontFamily: "'Montserrat', sans-serif" },
  briefingText: { fontSize: 13, color: "#2C3029", lineHeight: 1.6 },

  // Settings
  settingsHint: { fontSize: 13, color: "#6B7266", marginBottom: 16, lineHeight: 1.5 },
  campaignList: { display: "flex", flexDirection: "column", gap: 4 },
  campaignRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#F7F8F6", borderRadius: 8 },
  campaignDot: { width: 8, height: 8, borderRadius: "50%" },
  campaignName: { fontSize: 14, fontWeight: 500, flex: 1, color: "#1A1D18" },
  campaignStatus: { fontSize: 11, color: "#CDD1CA", textTransform: "uppercase", fontWeight: 600, fontFamily: "'Montserrat', sans-serif" },
  connectedBox: { padding: "14px 16px", background: "#F7F8F6", border: "1px solid #EAECE8", borderRadius: 8, fontSize: 13, color: "#2C3029", display: "flex", alignItems: "center", gap: 12 },
};
