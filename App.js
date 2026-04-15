import { useState, useMemo, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, Linking, Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import Svg, { Rect, Line, Circle, Path } from "react-native-svg";
import Swiper from "react-native-swiper";

const Tab = createBottomTabNavigator();

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const TAX_BRACKETS = [
  { min: 0, max: 11600, rate: 0.10 },
  { min: 11600, max: 47150, rate: 0.12 },
  { min: 47150, max: 100525, rate: 0.22 },
  { min: 100525, max: 191950, rate: 0.24 },
  { min: 191950, max: 243725, rate: 0.32 },
  { min: 243725, max: 609350, rate: 0.35 },
  { min: 609350, max: Infinity, rate: 0.37 },
];

const SE_TAX_RATE = 0.1413;

const CATEGORIES = {
  income: ["Client Payment", "Product Sale", "Consulting", "Royalties", "Grant", "Other Income"],
  expense: ["Software/Tools", "Hardware", "Marketing", "Travel", "Office Supplies", "Contractor", "Education", "Meals", "Insurance", "Utilities", "Other Expense"],
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
function generateId() { return Math.random().toString(36).slice(2, 9); }

function estimateTax(netProfit) {
  if (netProfit <= 0) return { federal: 0, selfEmployment: 0, total: 0, effectiveRate: 0 };
  const seTax = netProfit * SE_TAX_RATE;
  const seDeduction = seTax / 2;
  const taxableIncome = Math.max(0, netProfit - seDeduction);
  let federal = 0;
  for (const bracket of TAX_BRACKETS) {
    if (taxableIncome <= bracket.min) break;
    const taxable = Math.min(taxableIncome, bracket.max) - bracket.min;
    federal += taxable * bracket.rate;
  }
  const total = federal + seTax;
  const effectiveRate = netProfit > 0 ? (total / netProfit) * 100 : 0;
  return { federal, selfEmployment: seTax, total, effectiveRate };
}

function getNextDate(date, interval) {
  const d = new Date(date);
  if (interval === "weekly") d.setDate(d.getDate() + 7);
  if (interval === "monthly") d.setMonth(d.getMonth() + 1);
  if (interval === "yearly") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split("T")[0];
}

function isDue(nextDate) {
  return nextDate <= new Date().toISOString().split("T")[0];
}

// ─── YEAR SELECTOR ────────────────────────────────────────────────────────────

function YearSelector({ transactions, selectedYear, setSelectedYear }) {
  const years = [...new Set(transactions.map(t => t.date.slice(0, 4)))];
  if (!years.includes(selectedYear)) years.push(selectedYear);
  years.sort((a, b) => b - a);
  const [open, setOpen] = useState(false);

  return (
    <View style={{ marginBottom: 16 }}>
      <TouchableOpacity
        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#141517", borderWidth: 1, borderColor: "#333", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 }}
        onPress={() => setOpen(!open)}>
        <Text style={{ color: "#c9f542", fontFamily: "monospace", fontSize: 13 }}>📅 {selectedYear}</Text>
        <Text style={{ color: "#666", fontSize: 12 }}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {open && (
        <View style={{ backgroundColor: "#141517", borderWidth: 1, borderColor: "#333", borderRadius: 8, marginTop: 4, overflow: "hidden" }}>
          {years.map(y => (
            <TouchableOpacity
              key={y}
              style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1e1f23", backgroundColor: y === selectedYear ? "rgba(201,245,66,0.07)" : "transparent" }}
              onPress={() => { setSelectedYear(y); setOpen(false); }}>
              <Text style={{ color: y === selectedYear ? "#c9f542" : "#aaa", fontFamily: "monospace", fontSize: 13 }}>{y}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────

function OnboardingScreen({ onFinish }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#0e0f11" }}>
      <Swiper
        loop={false}
        dotColor="#333"
        activeDotColor="#c9f542"
        dotStyle={{ width: 6, height: 6, borderRadius: 3 }}
        activeDotStyle={{ width: 20, height: 6, borderRadius: 3 }}
        paginationStyle={{ bottom: 120 }}
      >
        {/* Slide 1 */}
        <View style={ob.slide}>
          <View style={ob.iconBox}>
            <Image source={require("./assets/icon.png")} style={{ width: 52, height: 52, borderRadius: 12 }} />
          </View>
          <Text style={ob.tag}>WELCOME TO</Text>
          <Text style={ob.title}>BizLedger</Text>
          <Text style={ob.body}>The no-nonsense finance tracker built for freelancers and small business owners.</Text>
        </View>

        {/* Slide 2 */}
        <View style={ob.slide}>
          <View style={[ob.iconBox, { backgroundColor: "rgba(78,205,196,0.1)", borderColor: "rgba(78,205,196,0.2)" }]}>
            <Svg width="48" height="48" viewBox="0 0 54 48">
              <Rect x="4" y="28" width="8" height="14" rx="2" fill="#4ecdc4" opacity="0.4"/>
              <Rect x="16" y="18" width="8" height="24" rx="2" fill="#4ecdc4" opacity="0.7"/>
              <Rect x="28" y="10" width="8" height="32" rx="2" fill="#4ecdc4"/>
              <Line x1="44" y1="20" x2="44" y2="4" stroke="#c9f542" strokeWidth="2.5" strokeLinecap="round"/>
              <Path d="M38 10 L44 4 L50 10" fill="none" stroke="#c9f542" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </Svg>
          </View>
          <Text style={ob.tag}>TRACK</Text>
          <Text style={ob.title}>Income &{"\n"}Expenses</Text>
          <Text style={ob.body}>Log every transaction in seconds. Categorize, edit, and export your full history as a CSV anytime.</Text>
          <View style={ob.featureList}>
            {["Multiple income categories", "Expense breakdown by category", "One-tap CSV export"].map(f => (
              <View key={f} style={ob.featureRow}>
                <Text style={ob.featureDot}>▸</Text>
                <Text style={ob.featureText}>{f}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Slide 3 */}
        <View style={ob.slide}>
          <View style={[ob.iconBox, { backgroundColor: "rgba(247,183,49,0.1)", borderColor: "rgba(247,183,49,0.2)" }]}>
            <Svg width="48" height="48" viewBox="0 0 48 48">
              <Path d="M24 6 A18 18 0 0 1 42 24 L34 24 A10 10 0 0 0 24 14 Z" fill="#f7b731"/>
              <Path d="M42 24 A18 18 0 0 1 12.5 37.5 L17.8 31 A10 10 0 0 0 34 24 Z" fill="#c9f542"/>
              <Path d="M12.5 37.5 A18 18 0 0 1 24 6 L24 14 A10 10 0 0 0 17.8 31 Z" fill="#4ecdc4"/>
              <Circle cx="24" cy="24" r="8" fill="#0e0f11"/>
            </Svg>
          </View>
          <Text style={ob.tag}>PLAN AHEAD</Text>
          <Text style={ob.title}>Taxes &{"\n"}Budgets</Text>
          <Text style={ob.body}>See your estimated federal, state, and self-employment taxes in real time — plus four budgeting frameworks to plan your money.</Text>
          <TouchableOpacity style={ob.btn} onPress={onFinish}>
            <Text style={ob.btnText}>Get Started →</Text>
          </TouchableOpacity>
        </View>
      </Swiper>
    </View>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function DashboardScreen({ transactions, selectedYear, setSelectedYear }) {
  const [showAbout, setShowAbout] = useState(false);
  const filtered = transactions.filter(t => t.date.startsWith(selectedYear));

  const totalIncome = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const netProfit = totalIncome - totalExpenses;
  const taxes = estimateTax(netProfit);

  const expenseByCategory = useMemo(() => {
    const map = {};
    filtered.filter(t => t.type === "expense").forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40, paddingTop: 50 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Text style={[s.pageTitle, { marginBottom: 0 }]}>Overview</Text>
        <TouchableOpacity onPress={() => setShowAbout(true)} style={{ borderWidth: 1, borderColor: "#333", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text style={{ color: "#666", fontSize: 12, fontFamily: "monospace" }}>About</Text>
        </TouchableOpacity>
      </View>

      {/* About Modal */}
      <Modal visible={showAbout} animationType="slide" transparent={true} onRequestClose={() => setShowAbout(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" }}>
          <View style={{ backgroundColor: "#141517", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 28, borderTopWidth: 1, borderColor: "#333" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <Text style={{ color: "#e8e3d9", fontSize: 20, fontWeight: "800" }}>About BizLedger</Text>
              <TouchableOpacity onPress={() => setShowAbout(false)} style={{ borderWidth: 1, borderColor: "#333", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: "#666", fontSize: 12 }}>✕ Close</Text>
              </TouchableOpacity>
            </View>
            <View style={{ borderBottomWidth: 1, borderBottomColor: "#1e1f23", paddingBottom: 16, marginBottom: 16 }}>
              <Text style={{ color: "#555", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Version</Text>
              <Text style={{ color: "#aaa", fontSize: 14, fontFamily: "monospace" }}>1.0.0</Text>
            </View>
            <View style={{ borderBottomWidth: 1, borderBottomColor: "#1e1f23", paddingBottom: 16, marginBottom: 16 }}>
              <Text style={{ color: "#555", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>About</Text>
              <Text style={{ color: "#aaa", fontSize: 14, lineHeight: 22 }}>BizLedger is a simple finance tracker built for freelancers and small business owners. Track income, expenses, taxes, and budget allocations all in one place.</Text>
            </View>
            <View style={{ borderBottomWidth: 1, borderBottomColor: "#1e1f23", paddingBottom: 16, marginBottom: 16 }}>
              <Text style={{ color: "#555", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Developer</Text>
              <Text style={{ color: "#aaa", fontSize: 14, fontFamily: "monospace" }}>Benaiah Whaley</Text>
            </View>
            <TouchableOpacity
              onPress={() => Linking.openURL("https://yourdonationlink.com")}
              style={{ backgroundColor: "#c9f542", borderRadius: 10, padding: 16, alignItems: "center", marginBottom: 8 }}>
              <Text style={{ color: "#0e0f11", fontWeight: "800", fontSize: 15 }}>☕ Support BizLedger</Text>
              <Text style={{ color: "#0e0f11", fontSize: 11, marginTop: 4, opacity: 0.7 }}>Every contribution helps!</Text>
            </TouchableOpacity>
            <Text style={{ color: "#333", fontSize: 11, textAlign: "center", marginTop: 12, lineHeight: 18 }}>
              Tax estimates are for informational purposes only.{"\n"}Consult a tax professional for advice.
            </Text>
          </View>
        </View>
      </Modal>

      <YearSelector transactions={transactions} selectedYear={selectedYear} setSelectedYear={setSelectedYear} />

      {/* KPI Cards */}
      {[
        { label: "Total Income", value: totalIncome, color: "#c9f542" },
        { label: "Total Expenses", value: totalExpenses, color: "#ff6b6b" },
        { label: "Net Profit", value: netProfit, color: netProfit >= 0 ? "#4ecdc4" : "#ff6b6b" },
        { label: "Est. Taxes Owed", value: taxes.total, color: "#f7b731" },
      ].map(card => (
        <View key={card.label} style={s.card}>
          <Text style={s.cardLabel}>{card.label}</Text>
          <Text style={[s.cardValue, { color: card.color }]}>{fmt(card.value)}</Text>
        </View>
      ))}

      {/* Expenses by Category */}
      {expenseByCategory.length > 0 && (
        <View style={[s.card, { marginTop: 8 }]}>
          <Text style={s.sectionTitle}>Expenses by Category</Text>
          {expenseByCategory.map(([cat, amount]) => (
            <View key={cat} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={s.catLabel}>{cat}</Text>
                <Text style={{ color: "#ff6b6b", fontSize: 12, fontFamily: "monospace" }}>{fmt(amount)}</Text>
              </View>
              <View style={s.barBg}>
                <View style={[s.barFill, { width: `${(amount / totalExpenses) * 100}%` }]} />
              </View>
            </View>
          ))}
        </View>
      )}

      {filtered.length === 0 && (
        <Text style={s.empty}>No transactions for {selectedYear}. Add one in the Transactions tab!</Text>
      )}
    </ScrollView>
  );
}

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

function TransactionsScreen({ transactions, setTransactions, recurring, setRecurring, selectedYear, setSelectedYear }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form, setForm] = useState({ type: "income", amount: "", category: CATEGORIES.income[0], description: "", date: new Date().toISOString().split("T")[0] });
  const [typeOpen, setTypeOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterTypeOpen, setFilterTypeOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [recurringForm, setRecurringForm] = useState({ type: "expense", amount: "", category: CATEGORIES.expense[0], description: "", interval: "monthly", nextDate: new Date().toISOString().split("T")[0] });
  const [recurringTypeOpen, setRecurringTypeOpen] = useState(false);
  const [recurringCatOpen, setRecurringCatOpen] = useState(false);
  const [recurringIntervalOpen, setRecurringIntervalOpen] = useState(false);
  const [showRecurringDatePicker, setShowRecurringDatePicker] = useState(false);

  function handleFormChange(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === "type") next.category = CATEGORIES[value][0];
      return next;
    });
  }

  function handleSubmit() {
    if (!form.amount || isNaN(parseFloat(form.amount))) return;
    const entry = { ...form, amount: parseFloat(form.amount), id: editingId || generateId() };
    if (editingId) {
      setTransactions(prev => prev.map(t => t.id === editingId ? entry : t));
      setEditingId(null);
    } else {
      setTransactions(prev => [...prev, entry]);
    }
    setForm({ type: "income", amount: "", category: CATEGORIES.income[0], description: "", date: new Date().toISOString().split("T")[0] });
    setShowForm(false);
  }

  function handleEdit(t) {
    setForm({ type: t.type, amount: String(t.amount), category: t.category, description: t.description, date: t.date });
    setEditingId(t.id);
    setShowForm(true);
  }

  function handleDelete(id) {
    setTransactions(prev => prev.filter(t => t.id !== id));
    setDeleteConfirm(null);
  }

  function handleAddRecurring() {
    if (!recurringForm.amount || isNaN(parseFloat(recurringForm.amount))) return;
    const entry = { ...recurringForm, amount: parseFloat(recurringForm.amount), id: generateId() };
    setRecurring(prev => [...prev, entry]);
    setRecurringForm({ type: "expense", amount: "", category: CATEGORIES.expense[0], description: "", interval: "monthly", nextDate: new Date().toISOString().split("T")[0] });
    setShowRecurringForm(false);
  }

  function handleLogRecurring(r) {
    const transaction = { id: generateId(), type: r.type, amount: r.amount, category: r.category, description: r.description, date: new Date().toISOString().split("T")[0] };
    setTransactions(prev => [...prev, transaction]);
    setRecurring(prev => prev.map(item => item.id === r.id ? { ...item, nextDate: getNextDate(r.nextDate, r.interval) } : item));
  }

  function handleSkipRecurring(r) {
    setRecurring(prev => prev.map(item => item.id === r.id ? { ...item, nextDate: getNextDate(r.nextDate, r.interval) } : item));
  }

  function handleDeleteRecurring(id) {
    setRecurring(prev => prev.filter(r => r.id !== id));
  }

  const sorted = [...transactions]
    .filter(t => {
      const matchesYear = t.date.startsWith(selectedYear);
      const matchesSearch = search === "" ||
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType === "all" || t.type === filterType;
      const matchesFrom = dateFrom === "" || t.date >= dateFrom;
      const matchesTo = dateTo === "" || t.date <= dateTo;
      return matchesYear && matchesSearch && matchesType && matchesFrom && matchesTo;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40, paddingTop: 50 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Text style={[s.pageTitle, { marginBottom: 0 }]}>Transactions</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => { setEditingId(null); setShowForm(!showForm); }}>
          <Text style={s.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <YearSelector transactions={transactions} selectedYear={selectedYear} setSelectedYear={setSelectedYear} />

      {/* Add/Edit Form */}
      {showForm && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>{editingId ? "Edit Transaction" : "New Transaction"}</Text>

          <Text style={s.fieldLabel}>Type</Text>
          <TouchableOpacity style={s.picker} onPress={() => setTypeOpen(!typeOpen)}>
            <Text style={s.pickerText}>{form.type === "income" ? "Income" : "Expense"}</Text>
          </TouchableOpacity>
          {typeOpen && ["income", "expense"].map(t => (
            <TouchableOpacity key={t} style={s.pickerOption} onPress={() => { handleFormChange("type", t); setTypeOpen(false); }}>
              <Text style={s.pickerOptionText}>{t === "income" ? "Income" : "Expense"}</Text>
            </TouchableOpacity>
          ))}

          <Text style={s.fieldLabel}>Category</Text>
          <TouchableOpacity style={s.picker} onPress={() => setCatOpen(!catOpen)}>
            <Text style={s.pickerText}>{form.category}</Text>
          </TouchableOpacity>
          {catOpen && CATEGORIES[form.type].map(c => (
            <TouchableOpacity key={c} style={s.pickerOption} onPress={() => { handleFormChange("category", c); setCatOpen(false); }}>
              <Text style={s.pickerOptionText}>{c}</Text>
            </TouchableOpacity>
          ))}

          <Text style={s.fieldLabel}>Amount ($)</Text>
          <TextInput style={s.input} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#555" value={form.amount} onChangeText={v => handleFormChange("amount", v)} />

          <Text style={s.fieldLabel}>Description</Text>
          <TextInput style={s.input} placeholder="What's this for?" placeholderTextColor="#555" value={form.description} onChangeText={v => handleFormChange("description", v)} />

          <Text style={s.fieldLabel}>Date</Text>
          <TouchableOpacity style={s.picker} onPress={() => setShowDatePicker(true)}>
            <Text style={s.pickerText}>{form.date}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={new Date(form.date)}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) handleFormChange("date", selectedDate.toISOString().split("T")[0]);
              }}
            />
          )}

          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <TouchableOpacity style={[s.submitBtn, { flex: 1 }]} onPress={handleSubmit}>
              <Text style={s.submitBtnText}>{editingId ? "Save Changes" : "Add Transaction"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowForm(false); setEditingId(null); }}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Recurring Transactions */}
      <TouchableOpacity
        style={[s.card, { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }]}
        onPress={() => setShowRecurring(!showRecurring)}>
        <View>
          <Text style={{ color: "#e8e3d9", fontSize: 14, fontWeight: "700" }}>Recurring Transactions</Text>
          <Text style={{ color: "#555", fontSize: 11, marginTop: 2 }}>{recurring.length} active · {recurring.filter(r => isDue(r.nextDate)).length} due</Text>
        </View>
        <Text style={{ color: "#666", fontSize: 18 }}>{showRecurring ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {showRecurring && (
        <View style={[s.card, { marginBottom: 12 }]}>
          {recurring.filter(r => isDue(r.nextDate)).length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={[s.sectionTitle, { color: "#ff6b6b" }]}>Due Now</Text>
              {recurring.filter(r => isDue(r.nextDate)).map(r => (
                <View key={r.id} style={{ backgroundColor: "rgba(255,107,107,0.07)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ color: "#ddd", fontSize: 13 }} numberOfLines={1}>{r.description || r.category}</Text>
                      <Text style={{ color: "#555", fontSize: 11 }}>{r.category} · {r.interval}</Text>
                    </View>
                    <Text style={{ color: r.type === "income" ? "#c9f542" : "#ff6b6b", fontWeight: "700", fontSize: 14 }}>
                      {r.type === "income" ? "+" : "-"}{fmt(r.amount)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity style={[s.submitBtn, { flex: 1, paddingVertical: 8 }]} onPress={() => handleLogRecurring(r)}>
                      <Text style={s.submitBtnText}>Log it</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.cancelBtn, { paddingVertical: 8, paddingHorizontal: 16 }]} onPress={() => handleSkipRecurring(r)}>
                      <Text style={s.cancelBtnText}>Skip</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {recurring.filter(r => !isDue(r.nextDate)).length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={s.sectionTitle}>Upcoming</Text>
              {recurring.filter(r => !isDue(r.nextDate)).map(r => (
                <View key={r.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1e1f23" }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ color: "#ddd", fontSize: 13 }} numberOfLines={1}>{r.description || r.category}</Text>
                    <Text style={{ color: "#555", fontSize: 11 }}>{r.interval} · next {r.nextDate}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: r.type === "income" ? "#c9f542" : "#ff6b6b", fontSize: 13, fontWeight: "700" }}>
                      {r.type === "income" ? "+" : "-"}{fmt(r.amount)}
                    </Text>
                    <TouchableOpacity style={s.txBtn} onPress={() => handleDeleteRecurring(r.id)}>
                      <Text style={s.txBtnText}>del</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {recurring.length === 0 && <Text style={s.empty}>No recurring transactions yet.</Text>}

          {showRecurringForm && (
            <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: "#1e1f23", paddingTop: 12 }}>
              <Text style={s.sectionTitle}>New Recurring Transaction</Text>

              <Text style={s.fieldLabel}>Type</Text>
              <TouchableOpacity style={s.picker} onPress={() => setRecurringTypeOpen(!recurringTypeOpen)}>
                <Text style={s.pickerText}>{recurringForm.type === "income" ? "Income" : "Expense"}</Text>
              </TouchableOpacity>
              {recurringTypeOpen && ["income", "expense"].map(t => (
                <TouchableOpacity key={t} style={s.pickerOption} onPress={() => { setRecurringForm(p => ({ ...p, type: t, category: CATEGORIES[t][0] })); setRecurringTypeOpen(false); }}>
                  <Text style={s.pickerOptionText}>{t === "income" ? "Income" : "Expense"}</Text>
                </TouchableOpacity>
              ))}

              <Text style={s.fieldLabel}>Category</Text>
              <TouchableOpacity style={s.picker} onPress={() => setRecurringCatOpen(!recurringCatOpen)}>
                <Text style={s.pickerText}>{recurringForm.category}</Text>
              </TouchableOpacity>
              {recurringCatOpen && CATEGORIES[recurringForm.type].map(c => (
                <TouchableOpacity key={c} style={s.pickerOption} onPress={() => { setRecurringForm(p => ({ ...p, category: c })); setRecurringCatOpen(false); }}>
                  <Text style={s.pickerOptionText}>{c}</Text>
                </TouchableOpacity>
              ))}

              <Text style={s.fieldLabel}>Amount ($)</Text>
              <TextInput style={s.input} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#555" value={recurringForm.amount} onChangeText={v => setRecurringForm(p => ({ ...p, amount: v }))} />

              <Text style={s.fieldLabel}>Description</Text>
              <TextInput style={s.input} placeholder="e.g. Adobe CC subscription" placeholderTextColor="#555" value={recurringForm.description} onChangeText={v => setRecurringForm(p => ({ ...p, description: v }))} />

              <Text style={s.fieldLabel}>Interval</Text>
              <TouchableOpacity style={s.picker} onPress={() => setRecurringIntervalOpen(!recurringIntervalOpen)}>
                <Text style={s.pickerText}>{recurringForm.interval.charAt(0).toUpperCase() + recurringForm.interval.slice(1)}</Text>
              </TouchableOpacity>
              {recurringIntervalOpen && ["weekly", "monthly", "yearly"].map(i => (
                <TouchableOpacity key={i} style={s.pickerOption} onPress={() => { setRecurringForm(p => ({ ...p, interval: i })); setRecurringIntervalOpen(false); }}>
                  <Text style={s.pickerOptionText}>{i.charAt(0).toUpperCase() + i.slice(1)}</Text>
                </TouchableOpacity>
              ))}

              <Text style={s.fieldLabel}>First Due Date</Text>
              <TouchableOpacity style={s.picker} onPress={() => setShowRecurringDatePicker(true)}>
                <Text style={s.pickerText}>{recurringForm.nextDate}</Text>
              </TouchableOpacity>
              {showRecurringDatePicker && (
                <DateTimePicker
                  value={new Date(recurringForm.nextDate)}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowRecurringDatePicker(false);
                    if (selectedDate) setRecurringForm(p => ({ ...p, nextDate: selectedDate.toISOString().split("T")[0] }));
                  }}
                />
              )}

              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <TouchableOpacity style={[s.submitBtn, { flex: 1 }]} onPress={handleAddRecurring}>
                  <Text style={s.submitBtnText}>Add Recurring</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowRecurringForm(false)}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!showRecurringForm && (
            <TouchableOpacity style={[s.addBtn, { marginTop: 8, alignItems: "center" }]} onPress={() => setShowRecurringForm(true)}>
              <Text style={s.addBtnText}>+ Add Recurring</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Search bar */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <TextInput
          style={[s.input, { flex: 1 }]}
          placeholder="Search description or category..."
          placeholderTextColor="#555"
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity
          style={[s.txBtn, { paddingHorizontal: 12, justifyContent: "center", borderColor: showFilters ? "#c9f542" : "#2a2b2f" }]}
          onPress={() => setShowFilters(!showFilters)}>
          <Text style={[s.txBtnText, { color: showFilters ? "#c9f542" : "#666" }]}>⚙ Filter</Text>
        </TouchableOpacity>
      </View>

      {/* Filter panel */}
      {showFilters && (
        <View style={[s.card, { marginBottom: 12 }]}>
          <Text style={s.sectionTitle}>Filters</Text>

          <Text style={s.fieldLabel}>Type</Text>
          <TouchableOpacity style={s.picker} onPress={() => setFilterTypeOpen(!filterTypeOpen)}>
            <Text style={s.pickerText}>{filterType === "all" ? "All Types" : filterType === "income" ? "Income" : "Expense"}</Text>
          </TouchableOpacity>
          {filterTypeOpen && ["all", "income", "expense"].map(t => (
            <TouchableOpacity key={t} style={s.pickerOption} onPress={() => { setFilterType(t); setFilterTypeOpen(false); }}>
              <Text style={s.pickerOptionText}>{t === "all" ? "All Types" : t === "income" ? "Income" : "Expense"}</Text>
            </TouchableOpacity>
          ))}

          <Text style={s.fieldLabel}>Show transactions after</Text>
          <TouchableOpacity style={s.picker} onPress={() => setShowFromPicker(true)}>
            <Text style={s.pickerText}>{dateFrom || "Select a date..."}</Text>
          </TouchableOpacity>
          {showFromPicker && (
            <DateTimePicker
              value={dateFrom ? new Date(dateFrom) : new Date()}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowFromPicker(false);
                if (selectedDate) setDateFrom(selectedDate.toISOString().split("T")[0]);
              }}
            />
          )}

          <Text style={s.fieldLabel}>Show transactions before</Text>
          <TouchableOpacity style={s.picker} onPress={() => setShowToPicker(true)}>
            <Text style={s.pickerText}>{dateTo || "Select a date..."}</Text>
          </TouchableOpacity>
          {showToPicker && (
            <DateTimePicker
              value={dateTo ? new Date(dateTo) : new Date()}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowToPicker(false);
                if (selectedDate) setDateTo(selectedDate.toISOString().split("T")[0]);
              }}
            />
          )}

          <TouchableOpacity
            style={[s.cancelBtn, { marginTop: 12, alignItems: "center" }]}
            onPress={() => { setSearch(""); setFilterType("all"); setDateFrom(""); setDateTo(""); }}>
            <Text style={s.cancelBtnText}>Clear All Filters</Text>
          </TouchableOpacity>
        </View>
      )}

      {(search || filterType !== "all" || dateFrom || dateTo) && (
        <Text style={{ color: "#555", fontSize: 11, marginBottom: 8, fontFamily: "monospace" }}>
          {sorted.length} result{sorted.length !== 1 ? "s" : ""}
        </Text>
      )}

      {/* Transaction list */}
      {sorted.length === 0 && <Text style={s.empty}>No transactions found.</Text>}
      {sorted.map(t => (
        <View key={t.id} style={s.txRow}>
          <View style={[s.txIcon, { backgroundColor: t.type === "income" ? "rgba(201,245,66,0.1)" : "rgba(255,107,107,0.1)" }]}>
            <Text style={{ color: t.type === "income" ? "#c9f542" : "#ff6b6b", fontSize: 18 }}>{t.type === "income" ? "↑" : "↓"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.txDesc} numberOfLines={1}>{t.description || t.category}</Text>
            <Text style={s.txMeta}>{t.category} · {t.date}</Text>
          </View>
          <Text style={[s.txAmount, { color: t.type === "income" ? "#c9f542" : "#ff6b6b" }]}>
            {t.type === "income" ? "+" : "-"}{fmt(t.amount)}
          </Text>
          <View style={{ flexDirection: "row", gap: 4, marginLeft: 8 }}>
            <TouchableOpacity style={s.txBtn} onPress={() => handleEdit(t)}>
              <Text style={s.txBtnText}>edit</Text>
            </TouchableOpacity>
            {deleteConfirm === t.id ? (
              <>
                <TouchableOpacity style={[s.txBtn, { backgroundColor: "#ff6b6b", borderColor: "#ff6b6b" }]} onPress={() => handleDelete(t.id)}>
                  <Text style={[s.txBtnText, { color: "#fff" }]}>confirm</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.txBtn} onPress={() => setDeleteConfirm(null)}>
                  <Text style={s.txBtnText}>✕</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={s.txBtn} onPress={() => setDeleteConfirm(t.id)}>
                <Text style={s.txBtnText}>del</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── ALLOCATIONS ──────────────────────────────────────────────────────────────

function AllocationsScreen({ transactions, selectedYear, setSelectedYear }) {
  const filtered = transactions.filter(t => t.date.startsWith(selectedYear));
  const totalIncome = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const netProfit = totalIncome - totalExpenses;
  const taxes = estimateTax(netProfit);
  const afterTax = Math.max(0, netProfit - taxes.total);

  const frameworks = [
    {
      name: "50/30/20",
      description: "Needs / Wants / Savings",
      color: "#c9f542",
      slices: [
        { label: "Needs", pct: 0.50, color: "#c9f542" },
        { label: "Wants", pct: 0.30, color: "#4ecdc4" },
        { label: "Savings", pct: 0.20, color: "#f7b731" },
      ],
    },
    {
      name: "70/20/10",
      description: "Living / Saving / Giving",
      color: "#4ecdc4",
      slices: [
        { label: "Living", pct: 0.70, color: "#4ecdc4" },
        { label: "Saving", pct: 0.20, color: "#f7b731" },
        { label: "Giving", pct: 0.10, color: "#ff6b6b" },
      ],
    },
    {
      name: "Dave Ramsey",
      description: "7-category envelope method",
      color: "#f7b731",
      slices: [
        { label: "Housing", pct: 0.25, color: "#c9f542" },
        { label: "Food", pct: 0.10, color: "#4ecdc4" },
        { label: "Transport", pct: 0.10, color: "#f7b731" },
        { label: "Health", pct: 0.10, color: "#ff6b6b" },
        { label: "Insurance", pct: 0.10, color: "#a78bfa" },
        { label: "Savings", pct: 0.15, color: "#38bdf8" },
        { label: "Personal", pct: 0.20, color: "#fb923c" },
      ],
    },
    {
      name: "FIRE",
      description: "Financial Independence focus",
      color: "#a78bfa",
      slices: [
        { label: "Investing", pct: 0.50, color: "#a78bfa" },
        { label: "Needs", pct: 0.30, color: "#c9f542" },
        { label: "Wants", pct: 0.20, color: "#4ecdc4" },
      ],
    },
    {
      name: "Benaiah Whaley",
      description: "Benaiah Whaley's personal allocation method",
      color: "#b3n1ah",
      slices: [
        { label: "Investing", pct: 0.40, color: "a78bfa" },
        { label: "Business/Needs", pct: 0.25, color: "#c9f542" },
        { label: "Wants", pct: 0.25, color: "#4ecdc4" },
        { label: "Giving", pct: 0.10, color: "ff6b6b" },
      ],
    },
  ];

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40, paddingTop: 50 }}>
      <Text style={s.pageTitle}>Allocations</Text>
      <YearSelector transactions={transactions} selectedYear={selectedYear} setSelectedYear={setSelectedYear} />

      <View style={[s.card, { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }]}>
        <View>
          <Text style={s.cardLabel}>Gross Profit</Text>
          <Text style={[s.cardValue, { fontSize: 20, color: "#c9f542" }]}>{fmt(netProfit)}</Text>
        </View>
        <View>
          <Text style={s.cardLabel}>Est. Taxes</Text>
          <Text style={[s.cardValue, { fontSize: 20, color: "#ff6b6b" }]}>− {fmt(taxes.total)}</Text>
        </View>
        <View>
          <Text style={s.cardLabel}>After Tax</Text>
          <Text style={[s.cardValue, { fontSize: 20, color: "#f7b731" }]}>{fmt(afterTax)}</Text>
        </View>
      </View>

      {frameworks.map(fw => (
        <View key={fw.name} style={[s.card, { marginBottom: 12 }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <Text style={{ color: fw.color, fontSize: 16, fontWeight: "800" }}>{fw.name}</Text>
            <Text style={{ color: "#555", fontSize: 11 }}>{fw.description}</Text>
          </View>
          <View style={{ flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 14, marginTop: 8 }}>
            {fw.slices.map(slice => (
              <View key={slice.label} style={{ flex: slice.pct, backgroundColor: slice.color }} />
            ))}
          </View>
          {fw.slices.map(slice => (
            <View key={slice.label} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#1e1f23" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: slice.color }} />
                <Text style={s.catLabel}>{slice.label}</Text>
                <Text style={{ color: "#444", fontSize: 11 }}>{(slice.pct * 100).toFixed(0)}%</Text>
              </View>
              <Text style={{ color: "#e8e3d9", fontFamily: "monospace", fontSize: 13 }}>{fmt(afterTax * slice.pct)}</Text>
            </View>
          ))}
        </View>
      ))}

      {netProfit <= 0 && <Text style={s.empty}>Add some income to see your allocations!</Text>}
    </ScrollView>
  );
}

// ─── TAXES ────────────────────────────────────────────────────────────────────

function TaxesScreen({ transactions, selectedYear, setSelectedYear }) {
  const [stateTaxRate, setStateTaxRate] = useState("0");
  const filtered = transactions.filter(t => t.date.startsWith(selectedYear));
  const totalIncome = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const netProfit = totalIncome - totalExpenses;
  const taxes = estimateTax(netProfit);
  const stateTax = (parseFloat(stateTaxRate) / 100) * netProfit;
  const totalWithState = taxes.total + stateTax;

  async function exportCSV() {
    try {
      const header = "Date,Type,Category,Description,Amount\n";
      const rows = filtered
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(t => `${t.date},${t.type},${t.category},"${t.description}",${t.amount}`)
        .join("\n");
      const csv = header + rows;
      const fileUri = FileSystem.documentDirectory + "bizledger-export.csv";
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) await Sharing.shareAsync(fileUri);
    } catch (e) {
      console.error("Export error:", e);
    }
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40, paddingTop: 50 }}>
      <Text style={s.pageTitle}>Tax Estimate</Text>
      <YearSelector transactions={transactions} selectedYear={selectedYear} setSelectedYear={setSelectedYear} />

      <View style={[s.card, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
        <Text style={s.cardLabel}>Your State Tax Rate (%)</Text>
        <TextInput
          style={[s.input, { width: 80, textAlign: "center" }]}
          keyboardType="decimal-pad"
          placeholder="0.0"
          placeholderTextColor="#555"
          value={stateTaxRate}
          onChangeText={setStateTaxRate}
        />
      </View>

      {[
        { label: "Self-Employment Tax", value: taxes.selfEmployment, sub: "14.13% on net profit" },
        { label: "Federal Income Tax", value: taxes.federal, sub: "After SE deduction" },
        { label: "State Income Tax", value: stateTax, sub: `${stateTaxRate}% state rate` },
        { label: "Total Estimated Tax", value: totalWithState, sub: `${((totalWithState / netProfit) * 100 || 0).toFixed(1)}% effective rate`, highlight: true },
      ].map(c => (
        <View key={c.label} style={[s.card, c.highlight && { borderColor: "#f7b731" }]}>
          <Text style={s.cardLabel}>{c.label}</Text>
          <Text style={[s.cardValue, { color: c.highlight ? "#f7b731" : "#e8e3d9" }]}>{fmt(c.value)}</Text>
          <Text style={s.cardSub}>{c.sub}</Text>
        </View>
      ))}

      <View style={s.card}>
        <Text style={s.sectionTitle}>Quarterly Payments</Text>
        {["Q1 — Apr 15", "Q2 — Jun 16", "Q3 — Sep 15", "Q4 — Jan 15"].map(q => (
          <View key={q} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1e1f23" }}>
            <Text style={s.catLabel}>{q}</Text>
            <Text style={{ color: "#f7b731", fontFamily: "monospace", fontSize: 14 }}>{fmt(totalWithState / 4)}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={[s.addBtn, { marginTop: 16, alignItems: "center" }]} onPress={exportCSV}>
        <Text style={s.addBtnText}>Export CSV</Text>
      </TouchableOpacity>

      <Text style={s.disclaimer}>⚠️ Estimate only. Consult a tax professional for advice.</Text>
    </ScrollView>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [onboarded, setOnboarded] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    AsyncStorage.getItem("transactions").then(data => { if (data) setTransactions(JSON.parse(data)); });
    AsyncStorage.getItem("recurring").then(data => { if (data) setRecurring(JSON.parse(data)); });
    AsyncStorage.getItem("onboarded").then(val => { setOnboarded(val === "true"); });
  }, []);

  useEffect(() => { AsyncStorage.setItem("transactions", JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { AsyncStorage.setItem("recurring", JSON.stringify(recurring)); }, [recurring]);

  async function handleOnboardingFinish() {
    await AsyncStorage.setItem("onboarded", "true");
    setOnboarded(true);
  }

  if (onboarded === null) return null;
  if (!onboarded) return <OnboardingScreen onFinish={handleOnboardingFinish} />;

  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#141517", borderTopColor: "#222" },
        tabBarActiveTintColor: "#c9f542",
        tabBarInactiveTintColor: "#555",
        tabBarLabelStyle: { fontFamily: "monospace", fontSize: 11 },
      }}>
        <Tab.Screen name="Dashboard" children={() => <DashboardScreen transactions={transactions} selectedYear={selectedYear} setSelectedYear={setSelectedYear} />} />
        <Tab.Screen
          name="Transactions"
          children={() => <TransactionsScreen transactions={transactions} setTransactions={setTransactions} recurring={recurring} setRecurring={setRecurring} selectedYear={selectedYear} setSelectedYear={setSelectedYear} />}
          options={{
            tabBarBadge: recurring.filter(r => isDue(r.nextDate)).length > 0 ? recurring.filter(r => isDue(r.nextDate)).length : undefined,
            tabBarBadgeStyle: { backgroundColor: "#ff6b6b" }
          }}
        />
        <Tab.Screen name="Allocations" children={() => <AllocationsScreen transactions={transactions} selectedYear={selectedYear} setSelectedYear={setSelectedYear} />} />
        <Tab.Screen name="Taxes" children={() => <TaxesScreen transactions={transactions} selectedYear={selectedYear} setSelectedYear={setSelectedYear} />} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0e0f11" },
  pageTitle: { color: "#e8e3d9", fontSize: 24, fontWeight: "800", marginBottom: 16 },
  card: { backgroundColor: "#141517", borderWidth: 1, borderColor: "#222", borderRadius: 12, padding: 18, marginBottom: 12 },
  cardLabel: { color: "#666", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 },
  cardValue: { fontSize: 28, fontWeight: "800", marginBottom: 4 },
  cardSub: { color: "#555", fontSize: 11 },
  sectionTitle: { color: "#666", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 },
  catLabel: { color: "#aaa", fontSize: 12 },
  barBg: { height: 4, backgroundColor: "#1e1f23", borderRadius: 2 },
  barFill: { height: 4, backgroundColor: "#ff6b6b", borderRadius: 2, opacity: 0.7 },
  empty: { color: "#444", textAlign: "center", marginTop: 40, fontSize: 13 },
  addBtn: { backgroundColor: "#c9f542", borderRadius: 6, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: "#0e0f11", fontWeight: "700", fontSize: 13 },
  fieldLabel: { color: "#555", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: "#0e0f11", borderWidth: 1, borderColor: "#2a2b2f", borderRadius: 6, color: "#e8e3d9", padding: 10, fontSize: 13 },
  picker: { backgroundColor: "#0e0f11", borderWidth: 1, borderColor: "#2a2b2f", borderRadius: 6, padding: 10 },
  pickerText: { color: "#e8e3d9", fontSize: 13 },
  pickerOption: { backgroundColor: "#1a1b1e", borderWidth: 1, borderColor: "#2a2b2f", padding: 10 },
  pickerOptionText: { color: "#aaa", fontSize: 13 },
  submitBtn: { backgroundColor: "#c9f542", borderRadius: 6, paddingHorizontal: 16, paddingVertical: 10, flex: 1 },
  submitBtnText: { color: "#0e0f11", fontWeight: "700", fontSize: 13, textAlign: "center" },
  cancelBtn: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#333", borderRadius: 6, paddingHorizontal: 16, paddingVertical: 10 },
  cancelBtnText: { color: "#666", fontSize: 13 },
  txRow: { backgroundColor: "#141517", borderWidth: 1, borderColor: "#1e1f23", borderRadius: 10, padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 10 },
  txIcon: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  txDesc: { color: "#ddd", fontSize: 13, marginBottom: 2 },
  txMeta: { color: "#555", fontSize: 11 },
  txAmount: { fontSize: 14, fontWeight: "700" },
  txBtn: { borderWidth: 1, borderColor: "#2a2b2f", borderRadius: 5, paddingHorizontal: 8, paddingVertical: 4 },
  txBtnText: { color: "#666", fontSize: 11 },
  disclaimer: { color: "#444", fontSize: 11, marginTop: 12, lineHeight: 18 },
});

const ob = StyleSheet.create({
  slide: { flex: 1, backgroundColor: "#0e0f11", paddingHorizontal: 32, justifyContent: "center", paddingBottom: 80 },
  iconBox: { width: 80, height: 80, borderRadius: 20, backgroundColor: "rgba(201,245,66,0.1)", borderWidth: 1, borderColor: "rgba(201,245,66,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 32 },
  iconText: { fontSize: 36, color: "#c9f542" },
  tag: { color: "#555", fontSize: 10, letterSpacing: 3, marginBottom: 8 },
  title: { color: "#e8e3d9", fontSize: 42, fontWeight: "800", lineHeight: 48, marginBottom: 16 },
  body: { color: "#666", fontSize: 15, lineHeight: 24, marginBottom: 24 },
  featureList: { gap: 10 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureDot: { color: "#4ecdc4", fontSize: 12 },
  featureText: { color: "#555", fontSize: 13 },
  btn: { backgroundColor: "#c9f542", borderRadius: 12, paddingVertical: 16, paddingHorizontal: 32, alignItems: "center", marginTop: 8 },
  btnText: { color: "#0e0f11", fontWeight: "800", fontSize: 16 },
});
