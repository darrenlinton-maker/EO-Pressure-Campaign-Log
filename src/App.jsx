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
function copyToClipboard(text) {
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
}

function contactToRow(c) {
  return {
    id: c.id, campaign: c.campaign, method: c.method,
    caller_name: c.callerName || "", caller_location: c.callerLocation || "",
    identified: c.identified, source: c.source, register: c.register,
    tier: c.tier, key_phrases: c.keyPhrases || "", notes: c.notes || "",
    follow_up: c.followUp || false, staff_initials: c.staffInitials || "",
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
  { value: "civil", label: "Civil", color: "#2d6a4f", bg: "#d8f3dc" },
  { value: "agitated", label: "Agitated", color: "#e77c05", bg: "#fef3c7" },
  { value: "abusive", label: "Abusive", color: "#c2410c", bg: "#fed7aa" },
  { value: "threatening", label: "Threatening", color: "#991b1b", bg: "#fecaca" },
];
const TIERS = [
  { value: "1", label: "Tier 1 — Standard", desc: "Civil, use acknowledge-pivot-close" },
  { value: "2", label: "Tier 2 — Disengage", desc: "Abusive, end call per protocol" },
  { value: "3", label: "Tier 3 — Security", desc: "Threat made, contact police" },
];
const EMPTY_FORM = {
  campaign: "brs-2026", method: "Phone", callerName: "", callerLocation: "",
  identified: true, source: "Constituent (organic)", register: "civil",
  tier: "1", keyPhrases: "", notes: "", followUp: false, staffInitials: "",
};

export default function App() {
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
  const [editingPlaybookId, setEditingPlaybookId] = useState(null);
  const [editingPlaybookText, setEditingPlaybookText] = useState("");
  const [expandedScript, setExpandedScript] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterCampaign, setFilterCampaign] = useState("all");
  const [filterRegister, setFilterRegister] = useState("all");
  const [filterDate, setFilterDate] = useState("all");

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }, []);

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
        setError(null);
      } catch (err) {
        console.error("Load error:", err);
        setError("Could not connect to database. Check your Supabase configuration.");
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("eo-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setContacts((prev) => {
            if (prev.find((c) => c.id === payload.new.id)) return prev;
            return [rowToContact(payload.new), ...prev];
          });
        } else if (payload.eventType === "UPDATE") {
          setContacts((prev) => prev.map((c) => c.id === payload.new.id ? rowToContact(payload.new) : c));
        } else if (payload.eventType === "DELETE") {
          setContacts((prev) => prev.filter((c) => c.id !== payload.old.id));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "campaigns" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setCampaigns((prev) => {
            if (prev.find((c) => c.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        } else if (payload.eventType === "UPDATE") {
          setCampaigns((prev) => prev.map((c) => c.id === payload.new.id ? payload.new : c));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "playbook" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setPlaybookItems((prev) => {
            if (prev.find((p) => p.id === payload.new.id)) return prev;
            return [...prev, rowToPlaybook(payload.new)];
          });
        } else if (payload.eventType === "UPDATE") {
          setPlaybookItems((prev) => prev.map((p) => p.id === payload.new.id ? rowToPlaybook(payload.new) : p));
        } else if (payload.eventType === "DELETE") {
          setPlaybookItems((prev) => prev.filter((p) => p.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    setSyncing(true);
    const entry = {
      ...form, id: editingId || generateId(),
      timestamp: editingId ? contacts.find((c) => c.id === editingId)?.timestamp : new Date().toISOString(),
    };
    const row = contactToRow(entry);
    try {
      if (editingId) {
        const { error } = await supabase.from("contacts").update(row).eq("id", editingId);
        if (error) throw error;
        setContacts((prev) => prev.map((c) => c.id === editingId ? { ...entry, updatedAt: new Date().toISOString() } : c));
        showToast("Contact updated");
      } else {
        const { error } = await supabase.from("contacts").insert(row);
        if (error) throw error;
        setContacts((prev) => [{ ...entry, updatedAt: new Date().toISOString() }, ...prev]);
        showToast("Contact logged");
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (err) {
      console.error(err);
      showToast("Error saving — check connection");
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
      setContacts((prev) => prev.filter((c) => c.id !== id));
      showToast("Deleted");
    } catch (err) {
      console.error(err);
      showToast("Error deleting");
    }
  };

  const handleEdit = (contact) => {
    setForm({
      campaign: contact.campaign, method: contact.method, callerName: contact.callerName,
      callerLocation: contact.callerLocation, identified: contact.identified, source: contact.source,
      register: contact.register, tier: contact.tier, keyPhrases: contact.keyPhrases,
      notes: contact.notes, followUp: contact.followUp, staffInitials: contact.staffInitials,
    });
    setEditingId(contact.id);
    setView("log");
  };

  const addCampaign = async (name) => {
    const camp = { id: generateId(), name, active: true };
    try {
      const { error } = await supabase.from("campaigns").insert(camp);
      if (error) throw error;
      setCampaigns((prev) => [...prev, camp]);
      showToast("Campaign added");
    } catch (err) {
      console.error(err);
      showToast("Error adding campaign");
    }
  };

  const playbook = useMemo(() => ({
    phoneScripts: playbookItems.filter((p) => p.section === "phoneScripts"),
    emailTemplates: playbookItems.filter((p) => p.section === "emailTemplates"),
    talkingPoints: playbookItems.filter((p) => p.section === "talkingPoints"),
  }), [playbookItems]);

  const savePlaybookEdit = async (section, id, newContent) => {
    try {
      const { error } = await supabase.from("playbook").update({
        content: newContent, updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
      setPlaybookItems((prev) => prev.map((p) => p.id === id ? { ...p, content: newContent } : p));
      setEditingPlaybookId(null);
      showToast("Playbook updated");
    } catch (err) {
      console.error(err);
      showToast("Error saving");
    }
  };

  const addPlaybookItem = async (section, item) => {
    const row = {
      id: item.id, section, title: item.title, campaign: item.campaign || "",
      tier: item.tier || "", subject: item.subject || "", content: item.content,
      sort_order: playbookItems.filter((p) => p.section === section).length + 1,
    };
    try {
      const { error } = await supabase.from("playbook").insert(row);
      if (error) throw error;
      setPlaybookItems((prev) => [...prev, rowToPlaybook(row)]);
      showToast("Added to playbook");
    } catch (err) {
      console.error(err);
      showToast("Error adding");
    }
  };

  const deletePlaybookItem = async (section, id) => {
    try {
      const { error } = await supabase.from("playbook").delete().eq("id", id);
      if (error) throw error;
      setPlaybookItems((prev) => prev.filter((p) => p.id !== id));
      showToast("Removed from playbook");
    } catch (err) {
      console.error(err);
      showToast("Error removing");
    }
  };

  const exportCSV = () => {
    const headers = ["Timestamp","Campaign","Method","Caller Name","Location","Identified","Source","Register","Tier","Key Phrases","Notes","Follow-up","Staff"];
    const rows = filteredContacts.map((c) => [
      c.timestamp, campaigns.find((camp) => camp.id === c.campaign)?.name || c.campaign,
      c.method, c.callerName, c.callerLocation, c.identified ? "Yes" : "No",
      c.source, c.register, "Tier " + c.tier,
      `"${(c.keyPhrases || "").replace(/"/g, '""')}"`,
      `"${(c.notes || "").replace(/"/g, '""')}"`,
      c.followUp ? "Yes" : "No", c.staffInitials,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eo-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredContacts = useMemo(() => {
    let fc = contacts;
    if (filterCampaign !== "all") fc = fc.filter((c) => c.campaign === filterCampaign);
    if (filterRegister !== "all") fc = fc.filter((c) => c.register === filterRegister);
    if (filterDate === "today") {
      const today = new Date().toDateString();
      fc = fc.filter((c) => new Date(c.timestamp).toDateString() === today);
    } else if (filterDate === "week") {
      const week = Date.now() - 7 * 86400000;
      fc = fc.filter((c) => new Date(c.timestamp).getTime() > week);
    }
    return fc;
  }, [contacts, filterCampaign, filterRegister, filterDate]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayContacts = contacts.filter((c) => new Date(c.timestamp).toDateString() === today);
    const weekAgo = Date.now() - 7 * 86400000;
    const weekContacts = contacts.filter((c) => new Date(c.timestamp).getTime() > weekAgo);
    const byRegister = REGISTERS.map((r) => ({ ...r, count: weekContacts.filter((c) => c.register === r.value).length }));
    const bySource = SOURCES.map((s) => ({ source: s, count: weekContacts.filter((c) => c.source === s).length }));
    const byMethod = CONTACT_METHODS.map((m) => ({ method: m, count: weekContacts.filter((c) => c.method === m).length }));
    const phraseMap = {};
    weekContacts.forEach((c) => {
      if (c.keyPhrases) c.keyPhrases.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean).forEach((p) => { phraseMap[p] = (phraseMap[p] || 0) + 1; });
    });
    const topPhrases = Object.entries(phraseMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const tier2Plus = weekContacts.filter((c) => parseInt(c.tier) >= 2).length;
    const outsideElectorate = weekContacts.filter((c) => c.source === "Outside electorate").length;
    const needFollowUp = contacts.filter((c) => c.followUp).length;
    const dailyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      dailyTrend.push({
        date: d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric" }),
        count: contacts.filter((c) => new Date(c.timestamp).toDateString() === d.toDateString()).length,
      });
    }
    return { todayCount: todayContacts.length, weekCount: weekContacts.length, byRegister, bySource, byMethod, topPhrases, tier2Plus, outsideElectorate, needFollowUp, dailyTrend };
  }, [contacts]);

  const maxDaily = Math.max(...stats.dailyTrend.map((d) => d.count), 1);

  const navItems = [
    { key: "log", label: "Log Contact", icon: "+" },
    { key: "playbook", label: "Playbook", icon: "📋" },
    { key: "list", label: "History", icon: "☰" },
    { key: "dashboard", label: "Dashboard", icon: "◫" },
    { key: "settings", label: "Settings", icon: "⚙" },
  ];
  const playbookSections = [
    { key: "phone", label: "Phone Scripts", data: playbook.phoneScripts, section: "phoneScripts" },
    { key: "email", label: "Email Templates", data: playbook.emailTemplates, section: "emailTemplates" },
    { key: "talking", label: "Talking Points", data: playbook.talkingPoints, section: "talkingPoints" },
  ];
  const currentPBSection = playbookSections.find((s) => s.key === playbookTab);

  if (loading) return (
    <div style={S.loadingWrap}>
      <div style={S.loadingInner}>
        <div style={S.logoMark}>EO</div>
        <div style={S.loadingText}>Connecting to database…</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={S.loadingWrap}>
      <div style={S.errorBox}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Connection Error</div>
        <div style={{ marginBottom: 12 }}>{error}</div>
        <button style={S.submitBtn} onClick={() => window.location.reload()}>Retry</button>
      </div>
    </div>
  );

  return (
    <div style={S.container}>
      {toast && <div style={S.toast} className="toast-anim">{toast}</div>}

      <div style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.logoMark}>EO</div>
          <div>
            <div style={S.headerTitle}>Electorate Office Contact Logger</div>
            <div style={S.headerSub}>
              Pressure Campaign Tracking & Response System
              {syncing && <span style={S.syncBadge}> Saving…</span>}
              {!syncing && <span style={S.liveBadge}> ● Live</span>}
            </div>
          </div>
        </div>
        <div style={S.headerRight}>
          <div style={S.statPill}><span style={S.statNum}>{stats.todayCount}</span> today</div>
          <div style={{ ...S.statPill, ...(stats.tier2Plus > 0 ? S.statPillWarn : {}) }}>
            <span style={S.statNum}>{stats.tier2Plus}</span> T2+
          </div>
        </div>
      </div>

      <div style={S.nav}>
        {navItems.map((tab) => (
          <button key={tab.key}
            onClick={() => { setView(tab.key); if (tab.key !== "log") { setEditingId(null); setForm(EMPTY_FORM); } }}
            style={{ ...S.navBtn, ...(view === tab.key ? S.navBtnActive : {}) }}>
            <span style={S.navIcon}>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {view === "log" && (
        <div style={S.card} className="card-anim">
          <div style={S.formHeader}>
            {editingId ? "Edit Contact" : "Log New Contact"}
            <span style={S.formHeaderHint}>Target: under 30 seconds</span>
          </div>
          <div style={S.formGrid} className="form-grid-responsive">
            <div style={S.fieldGroup}>
              <label style={S.label}>Campaign</label>
              <select style={S.select} value={form.campaign} onChange={(e) => updateField("campaign", e.target.value)}>
                {campaigns.filter((c) => c.active).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </div>
            <div style={S.fieldGroup}>
              <label style={S.label}>Contact Method</label>
              <div style={S.chipRow}>
                {CONTACT_METHODS.map((m) => (
                  <button key={m} onClick={() => updateField("method", m)}
                    style={{ ...S.chip, ...(form.method === m ? S.chipActive : {}) }}>{m}</button>
                ))}
              </div>
            </div>
            <div style={S.fieldGroup}>
              <label style={S.label}>Caller / Sender Name</label>
              <input style={S.input} value={form.callerName} onChange={(e) => updateField("callerName", e.target.value)} placeholder="Leave blank if refused" />
            </div>
            <div style={S.fieldGroup}>
              <label style={S.label}>Location / Town</label>
              <input style={S.input} value={form.callerLocation} onChange={(e) => updateField("callerLocation", e.target.value)} placeholder="e.g. Echuca, Tatura" />
            </div>
            <div style={S.fieldGroup}>
              <label style={S.label}>Identified themselves?</label>
              <div style={S.chipRow}>
                <button onClick={() => updateField("identified", true)} style={{ ...S.chip, ...(form.identified ? S.chipActive : {}) }}>Yes</button>
                <button onClick={() => updateField("identified", false)} style={{ ...S.chip, ...(!form.identified ? S.chipActiveWarn : {}) }}>Refused</button>
              </div>
            </div>
            <div style={S.fieldGroup}>
              <label style={S.label}>Source Assessment</label>
              <select style={S.select} value={form.source} onChange={(e) => updateField("source", e.target.value)}>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ ...S.fieldGroup, ...S.fieldHL }}>
              <label style={S.label}>Emotional Register</label>
              <div style={S.chipRow}>
                {REGISTERS.map((r) => (
                  <button key={r.value} onClick={() => updateField("register", r.value)}
                    style={{ ...S.chip, ...(form.register === r.value ? { background: r.bg, color: r.color, borderColor: r.color, fontWeight: 700 } : {}) }}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ ...S.fieldGroup, ...S.fieldHL }}>
              <label style={S.label}>Response Tier</label>
              {TIERS.map((t) => (
                <label key={t.value} style={{ ...S.tierOpt, ...(form.tier === t.value ? S.tierOptActive : {}) }} onClick={() => updateField("tier", t.value)}>
                  <input type="radio" name="tier" checked={form.tier === t.value} onChange={() => {}} style={{ display: "none" }} />
                  <span style={S.tierLabel}>{t.label}</span>
                  <span style={S.tierDesc}>{t.desc}</span>
                </label>
              ))}
            </div>
            <div style={S.fieldGroup}>
              <label style={S.label}>Key Phrases Used <span style={S.labelH}>(comma-separated)</span></label>
              <input style={S.input} value={form.keyPhrases} onChange={(e) => updateField("keyPhrases", e.target.value)} placeholder='"$300 million", "abandon our heroes"' />
            </div>
            <div style={S.fieldGroup}>
              <label style={S.label}>Staff Initials</label>
              <input style={{ ...S.input, maxWidth: 120 }} value={form.staffInitials} onChange={(e) => updateField("staffInitials", e.target.value.toUpperCase())} placeholder="e.g. JM" maxLength={4} />
            </div>
            <div style={{ ...S.fieldGroup, gridColumn: "1 / -1" }}>
              <label style={S.label}>Notes <span style={S.labelH}>(one line is fine)</span></label>
              <textarea style={{ ...S.input, minHeight: 52, resize: "vertical" }} value={form.notes} onChange={(e) => updateField("notes", e.target.value)} placeholder="Brief summary" />
            </div>
            <div style={{ ...S.fieldGroup, gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <label style={{ ...S.chipRow, gap: 8, cursor: "pointer" }} onClick={() => updateField("followUp", !form.followUp)}>
                <span style={{ ...S.checkbox, ...(form.followUp ? S.checkboxChecked : {}) }}>{form.followUp ? "✓" : ""}</span>
                <span style={S.label}>Requires follow-up from MP</span>
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                {editingId && <button style={S.cancelBtn} onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }}>Cancel</button>}
                <button style={{ ...S.submitBtn, opacity: syncing ? 0.6 : 1 }} onClick={handleSubmit} disabled={syncing}>
                  {syncing ? "Saving…" : editingId ? "Update" : "Log Contact"}
                </button>
              </div>
            </div>
          </div>
          {form.tier === "3" && <div style={S.tier3Warn}><strong>TIER 3 PROTOCOL:</strong> End the interaction. Contact local police. Document everything immediately. Brief CoS / MP.</div>}
          <div style={S.scriptLink} onClick={() => { setView("playbook"); setPlaybookTab("phone"); }}>
            📋 View {form.tier === "3" ? "Tier 3 security" : form.tier === "2" ? "Tier 2 disengagement" : "Tier 1 response"} script in Playbook →
          </div>
        </div>
      )}

      {view === "playbook" && (
        <div>
          <div style={S.pbNav}>
            {playbookSections.map((s) => (
              <button key={s.key} onClick={() => { setPlaybookTab(s.key); setEditingPlaybookId(null); }}
                style={{ ...S.pbNavBtn, ...(playbookTab === s.key ? S.pbNavBtnActive : {}) }}>
                {s.label}<span style={S.pbNavCount}>{s.data.length}</span>
              </button>
            ))}
          </div>
          {currentPBSection.data.map((item) => {
            const isExpanded = expandedScript === item.id;
            const isEditing = editingPlaybookId === item.id;
            const campName = item.campaign ? campaigns.find((c) => c.id === item.campaign)?.name : null;
            const tierInfo = item.tier ? TIERS.find((t) => t.value === item.tier) : null;
            return (
              <div key={item.id} style={S.pbCard}>
                <div style={S.pbCardHeader} onClick={() => setExpandedScript(isExpanded ? null : item.id)}>
                  <div style={S.pbCardTitleRow}>
                    <span style={S.pbCardTitle}>{item.title}</span>
                    <div style={S.pbCardBadges}>
                      {campName && <span style={S.pbCampBadge}>{campName}</span>}
                      {tierInfo && <span style={S.pbTierBadge}>Tier {item.tier}</span>}
                    </div>
                  </div>
                  <span style={{ ...S.pbChevron, transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
                </div>
                {isExpanded && (
                  <div style={S.pbCardBody}>
                    {item.subject && <div style={S.pbSubject}>Subject: <strong>{item.subject}</strong></div>}
                    {isEditing ? (
                      <div>
                        <textarea style={S.pbEditArea} value={editingPlaybookText} onChange={(e) => setEditingPlaybookText(e.target.value)} />
                        <div style={S.pbEditActions}>
                          <button style={S.submitBtn} onClick={() => savePlaybookEdit(currentPBSection.section, item.id, editingPlaybookText)}>Save Changes</button>
                          <button style={S.cancelBtn} onClick={() => setEditingPlaybookId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <pre style={S.pbContent}>{item.content}</pre>
                    )}
                    {!isEditing && (
                      <div style={S.pbActions}>
                        <button style={S.pbActionBtn} onClick={() => { copyToClipboard(item.content); showToast("Copied to clipboard"); }}>📋 Copy Text</button>
                        {playbookTab === "email" && item.subject && (
                          <button style={S.pbActionBtn} onClick={() => { copyToClipboard(`Subject: ${item.subject}\n\n${item.content}`); showToast("Email copied with subject"); }}>✉️ Copy with Subject</button>
                        )}
                        <button style={S.pbActionBtn} onClick={() => { setEditingPlaybookId(item.id); setEditingPlaybookText(item.content); }}>✏️ Edit</button>
                        <button style={{ ...S.pbActionBtn, color: "#991b1b" }} onClick={() => deletePlaybookItem(currentPBSection.section, item.id)}>🗑️ Delete</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ ...S.card, marginTop: 16 }}>
            <div style={S.label}>Add New {playbookTab === "phone" ? "Phone Script" : playbookTab === "email" ? "Email Template" : "Talking Points"}</div>
            <input id="pb-title" style={{ ...S.input, marginTop: 8, marginBottom: 8 }} placeholder="Title" />
            {playbookTab === "email" && <input id="pb-subject" style={{ ...S.input, marginBottom: 8 }} placeholder="Email subject line" />}
            <select id="pb-campaign" style={{ ...S.select, marginBottom: 8, width: "100%" }}>
              <option value="">No specific campaign (general use)</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <textarea id="pb-content" style={{ ...S.input, minHeight: 100, resize: "vertical" }} placeholder="Content — this is what staff will see and copy" />
            <button style={{ ...S.submitBtn, marginTop: 10 }} onClick={() => {
              const title = document.getElementById("pb-title").value.trim();
              const content = document.getElementById("pb-content").value.trim();
              const campaign = document.getElementById("pb-campaign").value;
              const subject = playbookTab === "email" ? document.getElementById("pb-subject")?.value?.trim() || "" : undefined;
              if (!title || !content) { showToast("Title and content required"); return; }
              addPlaybookItem(currentPBSection.section, { id: generateId(), title, content, campaign, ...(subject !== undefined ? { subject } : {}) });
              document.getElementById("pb-title").value = "";
              document.getElementById("pb-content").value = "";
              if (document.getElementById("pb-subject")) document.getElementById("pb-subject").value = "";
            }}>Add to Playbook</button>
          </div>
        </div>
      )}

      {view === "list" && (
        <div>
          <div style={S.listHeader}>
            <div style={S.filterRow}>
              <select style={S.filterSel} value={filterCampaign} onChange={(e) => setFilterCampaign(e.target.value)}>
                <option value="all">All campaigns</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select style={S.filterSel} value={filterRegister} onChange={(e) => setFilterRegister(e.target.value)}>
                <option value="all">All registers</option>
                {REGISTERS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <select style={S.filterSel} value={filterDate} onChange={(e) => setFilterDate(e.target.value)}>
                <option value="all">All time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 days</option>
              </select>
              <button style={S.exportBtn} onClick={exportCSV}>Export CSV</button>
            </div>
            <div style={S.listCount}>{filteredContacts.length} contact{filteredContacts.length !== 1 ? "s" : ""}</div>
          </div>
          {filteredContacts.length === 0 ? (
            <div style={S.emptyState}>No contacts match these filters.</div>
          ) : (
            <div style={S.contactList}>
              {filteredContacts.map((c) => {
                const reg = REGISTERS.find((r) => r.value === c.register);
                const campName = campaigns.find((camp) => camp.id === c.campaign)?.name || c.campaign;
                return (
                  <div key={c.id} style={S.contactCard}>
                    <div style={S.cardTop}>
                      <div style={S.cardMeta}>
                        <span style={{ ...S.regBadge, background: reg?.bg, color: reg?.color }}>{reg?.label}</span>
                        <span style={S.tierBadge}>Tier {c.tier}</span>
                        <span style={S.methodBadge}>{c.method}</span>
                        {c.followUp && <span style={S.followUpBadge}>Follow-up</span>}
                      </div>
                      <div style={S.cardActions}>
                        <button style={S.cardActBtn} onClick={() => handleEdit(c)}>Edit</button>
                        <button style={{ ...S.cardActBtn, color: "#991b1b" }} onClick={() => handleDelete(c.id)}>Delete</button>
                      </div>
                    </div>
                    <div style={S.cardBody}>
                      <div style={S.cardName}>{c.callerName || "Unidentified"}{c.callerLocation ? ` — ${c.callerLocation}` : ""}</div>
                      {c.notes && <div style={S.cardNotes}>{c.notes}</div>}
                      {c.keyPhrases && <div style={S.cardPhrases}>Phrases: {c.keyPhrases}</div>}
                    </div>
                    <div style={S.cardFooter}>
                      <span>{formatDate(c.timestamp)}</span>
                      <span>{campName}</span>
                      <span>Source: {c.source}</span>
                      {c.staffInitials && <span>Staff: {c.staffInitials}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === "dashboard" && (
        <div>
          <div style={S.dashTitle}>7-Day Overview</div>
          <div style={S.dashStatRow} className="stat-row-responsive">
            {[
              { n: stats.weekCount, l: "Contacts this week" },
              { n: stats.todayCount, l: "Contacts today" },
              { n: stats.tier2Plus, l: "Tier 2+ incidents", warn: stats.tier2Plus > 0 },
              { n: stats.outsideElectorate, l: "Outside electorate" },
              { n: stats.needFollowUp, l: "Pending follow-ups", info: stats.needFollowUp > 0 },
            ].map((s, i) => (
              <div key={i} style={{ ...S.dashStatCard, ...(s.warn ? { borderColor: "#c2410c" } : s.info ? { borderColor: "#1d4ed8" } : {}) }}>
                <div style={{ ...S.dashStatNum, ...(s.warn ? { color: "#c2410c" } : s.info ? { color: "#1d4ed8" } : {}) }}>{s.n}</div>
                <div style={S.dashStatLabel}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={S.dashSection}>
            <div style={S.dashSecTitle}>Daily Volume</div>
            <div style={S.barChart}>
              {stats.dailyTrend.map((d, i) => (
                <div key={i} style={S.barCol}>
                  <div style={S.barCount}>{d.count}</div>
                  <div style={{ ...S.bar, height: `${Math.max((d.count / maxDaily) * 120, 2)}px` }} />
                  <div style={S.barLabel}>{d.date}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={S.dashGrid} className="dash-grid-responsive">
            <div style={S.dashSection}>
              <div style={S.dashSecTitle}>By Register</div>
              {stats.byRegister.map((r) => (
                <div key={r.value} style={S.breakdownRow}>
                  <span style={{ ...S.regDot, background: r.color }} />
                  <span style={S.bdLabel}>{r.label}</span>
                  <span style={S.bdBar}><span style={{ ...S.bdFill, width: `${stats.weekCount ? (r.count / stats.weekCount) * 100 : 0}%`, background: r.color }} /></span>
                  <span style={S.bdCount}>{r.count}</span>
                </div>
              ))}
            </div>
            <div style={S.dashSection}>
              <div style={S.dashSecTitle}>By Source</div>
              {stats.bySource.filter((s) => s.count > 0).map((s) => (
                <div key={s.source} style={S.breakdownRow}>
                  <span style={S.bdLabel}>{s.source}</span>
                  <span style={S.bdBar}><span style={{ ...S.bdFill, width: `${stats.weekCount ? (s.count / stats.weekCount) * 100 : 0}%`, background: "#475569" }} /></span>
                  <span style={S.bdCount}>{s.count}</span>
                </div>
              ))}
              {stats.bySource.every((s) => s.count === 0) && <div style={S.emptyMini}>No data</div>}
            </div>
            <div style={S.dashSection}>
              <div style={S.dashSecTitle}>Recurring Phrases</div>
              {stats.topPhrases.length > 0 ? stats.topPhrases.map(([p, c]) => (
                <div key={p} style={S.phraseRow}><span style={S.phraseText}>"{p}"</span><span style={S.phraseCount}>×{c}</span></div>
              )) : <div style={S.emptyMini}>No phrases logged</div>}
              <div style={S.phraseHint}>Track these to identify coordinated campaigns</div>
            </div>
            <div style={S.dashSection}>
              <div style={S.dashSecTitle}>By Method</div>
              {stats.byMethod.filter((m) => m.count > 0).map((m) => (
                <div key={m.method} style={S.breakdownRow}>
                  <span style={S.bdLabel}>{m.method}</span>
                  <span style={S.bdBar}><span style={{ ...S.bdFill, width: `${stats.weekCount ? (m.count / stats.weekCount) * 100 : 0}%`, background: "#6366f1" }} /></span>
                  <span style={S.bdCount}>{m.count}</span>
                </div>
              ))}
              {stats.byMethod.every((m) => m.count === 0) && <div style={S.emptyMini}>No data</div>}
            </div>
          </div>
          <div style={S.briefingBox}>
            <div style={S.briefingTitle}>MP Briefing Summary</div>
            <div style={S.briefingText}>
              This week: {stats.weekCount} contacts. {stats.tier2Plus > 0 ? `${stats.tier2Plus} required Tier 2+ response. ` : "No Tier 2+ incidents. "}
              {stats.outsideElectorate > 0 ? `${stats.outsideElectorate} from outside the electorate. ` : ""}
              {stats.needFollowUp > 0 ? `${stats.needFollowUp} flagged for MP follow-up.` : "No pending follow-ups."}
            </div>
          </div>
        </div>
      )}

      {view === "settings" && (
        <div style={S.card}>
          <div style={S.dashSecTitle}>Manage Campaigns</div>
          <p style={S.settingsHint}>Add new pressure campaigns as they emerge. Changes sync across all staff in real time.</p>
          <div style={S.campaignList}>
            {campaigns.map((c) => (
              <div key={c.id} style={S.campaignRow}>
                <span style={{ ...S.campaignDot, background: c.active ? "#2d6a4f" : "#94a3b8" }} />
                <span style={S.campaignName}>{c.name}</span>
                <span style={S.campaignStatus}>{c.active ? "Active" : "Archived"}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <input id="new-camp" style={S.input} placeholder='e.g. "Immigration Policy (May 2026)"' />
            <button style={S.submitBtn} onClick={() => {
              const input = document.getElementById("new-camp");
              if (input.value.trim()) { addCampaign(input.value.trim()); input.value = ""; }
            }}>Add</button>
          </div>
          <div style={{ ...S.dashSecTitle, marginTop: 32 }}>Data</div>
          <p style={S.settingsHint}>Export all logged contacts for briefing documents or records management.</p>
          <button style={S.exportBtn} onClick={exportCSV}>Export All Contacts as CSV</button>
          <div style={{ ...S.dashSecTitle, marginTop: 32 }}>Database Status</div>
          <div style={S.connectedBox}>
            <span style={S.connectedDot} /> Connected to Supabase — real-time sync active across all devices
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  container: { fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif", maxWidth: 960, margin: "0 auto", padding: "16px 16px 40px", color: "#1e293b", fontSize: 14, position: "relative" },
  loadingWrap: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" },
  loadingInner: { textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  loadingText: { color: "#64748b", fontSize: 14 },
  errorBox: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 24, textAlign: "center", color: "#991b1b", maxWidth: 400 },
  toast: { position: "fixed", top: 16, right: 16, background: "#1e293b", color: "#fff", padding: "10px 20px", borderRadius: 6, fontSize: 13, zIndex: 999, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0 12px", borderBottom: "2px solid #1e293b", flexWrap: "wrap", gap: 12 },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logoMark: { width: 38, height: 38, background: "#1e293b", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, letterSpacing: 1, borderRadius: 4, flexShrink: 0 },
  headerTitle: { fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: "#0f172a" },
  headerSub: { fontSize: 11, color: "#64748b", letterSpacing: "0.02em", textTransform: "uppercase", marginTop: 1 },
  syncBadge: { color: "#e77c05", fontWeight: 600 },
  liveBadge: { color: "#2d6a4f", fontWeight: 600 },
  headerRight: { display: "flex", gap: 8 },
  statPill: { background: "#f1f5f9", padding: "6px 12px", borderRadius: 20, fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 4 },
  statPillWarn: { background: "#fef3c7", color: "#92400e" },
  statNum: { fontWeight: 700, fontSize: 16 },
  nav: { display: "flex", gap: 0, borderBottom: "1px solid #e2e8f0", marginBottom: 20, overflowX: "auto" },
  navBtn: { flex: "1 0 auto", padding: "12px 8px", border: "none", borderBottom: "2px solid transparent", background: "none", cursor: "pointer", fontSize: 13, color: "#64748b", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, whiteSpace: "nowrap" },
  navBtnActive: { color: "#0f172a", borderBottomColor: "#1e293b", fontWeight: 700 },
  navIcon: { fontSize: 14 },
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
  formHeader: { fontSize: 16, fontWeight: 700, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  formHeaderHint: { fontSize: 11, color: "#94a3b8", fontWeight: 400 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 24px" },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 6 },
  fieldHL: { background: "#fafbfc", padding: 12, borderRadius: 6, border: "1px solid #e2e8f0" },
  label: { fontSize: 12, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em" },
  labelH: { fontWeight: 400, textTransform: "none", color: "#94a3b8", letterSpacing: 0 },
  input: { padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 5, fontSize: 14, outline: "none", fontFamily: "inherit", color: "#1e293b", background: "#fff", width: "100%", boxSizing: "border-box" },
  select: { padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 5, fontSize: 14, outline: "none", fontFamily: "inherit", color: "#1e293b", background: "#fff", cursor: "pointer" },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" },
  chip: { padding: "5px 12px", border: "1.5px solid #d1d5db", borderRadius: 20, fontSize: 12, cursor: "pointer", background: "#fff", color: "#475569", fontFamily: "inherit", fontWeight: 500 },
  chipActive: { background: "#1e293b", color: "#fff", borderColor: "#1e293b" },
  chipActiveWarn: { background: "#fef3c7", color: "#92400e", borderColor: "#f59e0b" },
  tierOpt: { display: "flex", flexDirection: "column", padding: "8px 12px", border: "1.5px solid #e2e8f0", borderRadius: 6, cursor: "pointer", marginBottom: 4 },
  tierOptActive: { borderColor: "#1e293b", background: "#f8fafc" },
  tierLabel: { fontSize: 13, fontWeight: 600 },
  tierDesc: { fontSize: 11, color: "#64748b", marginTop: 2 },
  checkbox: { width: 20, height: 20, border: "1.5px solid #d1d5db", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 },
  checkboxChecked: { background: "#1e293b", color: "#fff", borderColor: "#1e293b" },
  submitBtn: { padding: "10px 24px", background: "#1e293b", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  cancelBtn: { padding: "10px 20px", background: "#f1f5f9", color: "#475569", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  tier3Warn: { marginTop: 16, padding: "14px 18px", background: "#fef2f2", border: "2px solid #dc2626", borderRadius: 6, color: "#991b1b", fontSize: 13, lineHeight: 1.5 },
  scriptLink: { marginTop: 12, padding: "10px 14px", background: "#eff6ff", borderRadius: 6, color: "#1d4ed8", fontSize: 13, cursor: "pointer", fontWeight: 500, textAlign: "center" },
  pbNav: { display: "flex", gap: 0, borderBottom: "1px solid #e2e8f0", marginBottom: 16 },
  pbNavBtn: { flex: 1, padding: "10px 8px", border: "none", borderBottom: "2px solid transparent", background: "none", cursor: "pointer", fontSize: 13, color: "#64748b", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 },
  pbNavBtnActive: { color: "#0f172a", borderBottomColor: "#1e293b", fontWeight: 700 },
  pbNavCount: { background: "#f1f5f9", padding: "1px 7px", borderRadius: 10, fontSize: 11, fontWeight: 700, color: "#475569" },
  pbCard: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 8, overflow: "hidden" },
  pbCardHeader: { padding: "14px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  pbCardTitleRow: { display: "flex", flexDirection: "column", gap: 4, flex: 1 },
  pbCardTitle: { fontSize: 14, fontWeight: 600, color: "#0f172a" },
  pbCardBadges: { display: "flex", gap: 6, flexWrap: "wrap" },
  pbCampBadge: { padding: "1px 8px", borderRadius: 10, fontSize: 10, background: "#eff6ff", color: "#1d4ed8", fontWeight: 600 },
  pbTierBadge: { padding: "1px 8px", borderRadius: 10, fontSize: 10, background: "#f1f5f9", color: "#475569", fontWeight: 600 },
  pbChevron: { fontSize: 16, color: "#94a3b8", transition: "transform 0.2s", flexShrink: 0 },
  pbCardBody: { padding: "0 16px 16px", borderTop: "1px solid #f1f5f9" },
  pbSubject: { fontSize: 13, color: "#475569", padding: "10px 0 6px", borderBottom: "1px solid #f8fafc", marginBottom: 8 },
  pbContent: { fontSize: 13, lineHeight: 1.6, color: "#374151", whiteSpace: "pre-wrap", fontFamily: "'Segoe UI', -apple-system, sans-serif", background: "#fafbfc", padding: 16, borderRadius: 6, border: "1px solid #f1f5f9", margin: "8px 0", maxHeight: 500, overflow: "auto" },
  pbActions: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 },
  pbActionBtn: { padding: "6px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: "#374151", fontWeight: 500 },
  pbEditArea: { width: "100%", minHeight: 200, padding: 14, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "'Segoe UI', -apple-system, sans-serif", lineHeight: 1.6, color: "#1e293b", resize: "vertical", boxSizing: "border-box", marginTop: 8 },
  pbEditActions: { display: "flex", gap: 8, marginTop: 10 },
  listHeader: { marginBottom: 16 },
  filterRow: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 },
  filterSel: { padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 5, fontSize: 13, fontFamily: "inherit", color: "#374151", background: "#fff" },
  exportBtn: { padding: "6px 14px", background: "#f1f5f9", border: "1px solid #d1d5db", borderRadius: 5, fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: "#374151", fontWeight: 500 },
  listCount: { fontSize: 12, color: "#94a3b8" },
  contactList: { display: "flex", flexDirection: "column", gap: 8 },
  contactCard: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: "12px 16px" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 },
  cardMeta: { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" },
  regBadge: { padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" },
  tierBadge: { padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: "#f1f5f9", color: "#475569" },
  methodBadge: { padding: "2px 8px", borderRadius: 12, fontSize: 11, background: "#eff6ff", color: "#1d4ed8" },
  followUpBadge: { padding: "2px 8px", borderRadius: 12, fontSize: 11, background: "#dbeafe", color: "#1e40af", fontWeight: 600 },
  cardActions: { display: "flex", gap: 4 },
  cardActBtn: { padding: "4px 10px", background: "none", border: "1px solid #e2e8f0", borderRadius: 4, fontSize: 11, cursor: "pointer", color: "#475569", fontFamily: "inherit" },
  cardBody: { marginBottom: 8 },
  cardName: { fontSize: 14, fontWeight: 600, marginBottom: 4 },
  cardNotes: { fontSize: 13, color: "#475569", lineHeight: 1.4 },
  cardPhrases: { fontSize: 12, color: "#64748b", fontStyle: "italic", marginTop: 4 },
  cardFooter: { display: "flex", gap: 16, fontSize: 11, color: "#94a3b8", borderTop: "1px solid #f1f5f9", paddingTop: 8, flexWrap: "wrap" },
  emptyState: { textAlign: "center", color: "#94a3b8", padding: "40px 0", fontSize: 14 },
  dashTitle: { fontSize: 18, fontWeight: 700, marginBottom: 16 },
  dashStatRow: { display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  dashStatCard: { flex: "1 1 140px", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "16px 12px", textAlign: "center" },
  dashStatNum: { fontSize: 28, fontWeight: 800, color: "#0f172a", lineHeight: 1 },
  dashStatLabel: { fontSize: 10, color: "#64748b", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.03em" },
  barChart: { display: "flex", gap: 8, alignItems: "flex-end", justifyContent: "space-between", height: 160, marginBottom: 8, padding: "0 8px" },
  barCol: { display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 4 },
  bar: { width: "100%", maxWidth: 48, background: "#1e293b", borderRadius: "4px 4px 0 0", minHeight: 2 },
  barCount: { fontSize: 12, fontWeight: 700, color: "#374151" },
  barLabel: { fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap" },
  dashGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 },
  dashSection: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, marginBottom: 8 },
  dashSecTitle: { fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#374151", marginBottom: 12 },
  breakdownRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 },
  regDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  bdLabel: { fontSize: 12, color: "#475569", minWidth: 80, flexShrink: 0 },
  bdBar: { flex: 1, height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" },
  bdFill: { height: "100%", borderRadius: 4, display: "block" },
  bdCount: { fontSize: 13, fontWeight: 700, color: "#374151", minWidth: 24, textAlign: "right" },
  phraseRow: { display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f8fafc" },
  phraseText: { fontSize: 13, color: "#475569" },
  phraseCount: { fontSize: 12, fontWeight: 700, color: "#374151" },
  phraseHint: { fontSize: 11, color: "#94a3b8", marginTop: 8, fontStyle: "italic" },
  emptyMini: { fontSize: 12, color: "#cbd5e1", fontStyle: "italic" },
  briefingBox: { background: "#fefce8", border: "1px solid #fbbf24", borderRadius: 8, padding: 16, marginTop: 8 },
  briefingTitle: { fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#92400e", marginBottom: 8 },
  briefingText: { fontSize: 13, color: "#78350f", lineHeight: 1.5 },
  settingsHint: { fontSize: 13, color: "#64748b", marginBottom: 16, lineHeight: 1.4 },
  campaignList: { display: "flex", flexDirection: "column", gap: 4 },
  campaignRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#f8fafc", borderRadius: 6 },
  campaignDot: { width: 8, height: 8, borderRadius: "50%" },
  campaignName: { fontSize: 14, fontWeight: 500, flex: 1 },
  campaignStatus: { fontSize: 11, color: "#94a3b8", textTransform: "uppercase" },
  connectedBox: { padding: "12px 16px", background: "#d8f3dc", borderRadius: 6, fontSize: 13, color: "#2d6a4f", fontWeight: 500, display: "flex", alignItems: "center", gap: 8 },
  connectedDot: { width: 8, height: 8, borderRadius: "50%", background: "#2d6a4f", flexShrink: 0 },
};
