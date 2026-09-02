import React, { useEffect, useState } from "react";
import API from "../api/api";
import { Save, Plus, Trash2, DollarSign, CreditCard, TrendingUp, Image, Lock } from "lucide-react";

export default function Settings() {
  const [rate, setRate] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [profitMargins, setProfitMargins] = useState({ categories: [] });
  const [loading, setLoading] = useState(false);
  const [newMethod, setNewMethod] = useState({ 
    name: "", 
    account_number: "", 
    account_name: "", 
    instructions: "",
    image_url: ""
  });
  const [depositAmounts, setDepositAmounts] = useState([50, 100, 200, 400, 500, 1000, 2000, 4000]);
  const [newAmount, setNewAmount] = useState("");
  
  // Webhook state
  const [webhookSecret, setWebhookSecret] = useState("");
  const [generatedSecret, setGeneratedSecret] = useState("");
  const [savingWebhook, setSavingWebhook] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await API.get("/settings");
      const exchange = res.data.find(s => s.key === "exchange_rate");
      setRate(exchange?.value || "");
      
      const banner = res.data.find(s => s.key === "main_menu_banner");
      setBannerUrl(banner?.value || "");
      
      const paymentRes = await API.get("/settings/payment-methods");
      setPaymentMethods(paymentRes.data.methods || []);
      
      const depositRes = res.data.find(s => s.key === "deposit_amounts");
      if (depositRes?.value) {
        setDepositAmounts(JSON.parse(depositRes.value));
      }
      const marginRes = res.data.find(s => s.key === "profit_margins");
      if (marginRes?.value) {
        const savedMargins = JSON.parse(marginRes.value);
        if (Array.isArray(savedMargins.categories)) {
          setProfitMargins(savedMargins);
        } else if (Array.isArray(savedMargins.ranges)) {
          setProfitMargins({ categories: [{ key: "default", name: "Default", ranges: savedMargins.ranges }] });
        }
      } else {
        setProfitMargins({
          categories: [
            { key: "pubg_mobile_auto", name: "PUBG Mobile Auto", ranges: [{ min_usd: 0, max_usd: 5, margin: 15 }, { min_usd: 5, max_usd: 15, margin: 12 }, { min_usd: 15, max_usd: 999, margin: 10 }] },
            { key: "free_fire_latam", name: "Free Fire LATAM", ranges: [{ min_usd: 0, max_usd: 5, margin: 15 }, { min_usd: 5, max_usd: 15, margin: 12 }, { min_usd: 15, max_usd: 999, margin: 10 }] },
            { key: "free_fire_mena", name: "Free Fire MENA", ranges: [{ min_usd: 0, max_usd: 5, margin: 15 }, { min_usd: 5, max_usd: 15, margin: 12 }, { min_usd: 15, max_usd: 999, margin: 10 }] },
            { key: "delta_force", name: "Delta Force", ranges: [{ min_usd: 0, max_usd: 5, margin: 15 }, { min_usd: 5, max_usd: 15, margin: 12 }, { min_usd: 15, max_usd: 999, margin: 10 }] },
            { key: "blood_strike", name: "Blood Strike", ranges: [{ min_usd: 0, max_usd: 5, margin: 15 }, { min_usd: 5, max_usd: 15, margin: 12 }, { min_usd: 15, max_usd: 999, margin: 10 }] },
            { key: "mobile_legends_global", name: "Mobile Legends Global", ranges: [{ min_usd: 0, max_usd: 5, margin: 15 }, { min_usd: 5, max_usd: 15, margin: 12 }, { min_usd: 15, max_usd: 999, margin: 10 }] },
            { key: "arena_breakout", name: "Arena Breakout", ranges: [{ min_usd: 0, max_usd: 5, margin: 15 }, { min_usd: 5, max_usd: 15, margin: 12 }, { min_usd: 15, max_usd: 999, margin: 10 }] },
            { key: "bigo_live", name: "Bigo Live", ranges: [{ min_usd: 0, max_usd: 5, margin: 15 }, { min_usd: 5, max_usd: 15, margin: 12 }, { min_usd: 15, max_usd: 999, margin: 10 }] },
            { key: "poppo_live", name: "Poppo Live", ranges: [{ min_usd: 0, max_usd: 5, margin: 15 }, { min_usd: 5, max_usd: 15, margin: 12 }, { min_usd: 15, max_usd: 999, margin: 10 }] },
            { key: "pubg_new_state", name: "PUBG: New State", ranges: [{ min_usd: 0, max_usd: 5, margin: 15 }, { min_usd: 5, max_usd: 15, margin: 12 }, { min_usd: 15, max_usd: 999, margin: 10 }] },
            { key: "app_store_itunes_us", name: "iTunes / App Store (US)", ranges: [{ min_usd: 0, max_usd: 5, margin: 15 }, { min_usd: 5, max_usd: 15, margin: 12 }, { min_usd: 15, max_usd: 999, margin: 10 }] },
            { key: "pubg_mobile_gift", name: "PUBG Mobile Gift Card", ranges: [{ min_usd: 0, max_usd: 5, margin: 15 }, { min_usd: 5, max_usd: 15, margin: 12 }, { min_usd: 15, max_usd: 999, margin: 10 }] },
            { key: "garena_free_fire_global", name: "Free Fire Vouchers (Global)", ranges: [{ min_usd: 0, max_usd: 5, margin: 15 }, { min_usd: 5, max_usd: 15, margin: 12 }, { min_usd: 15, max_usd: 999, margin: 10 }] },
            { key: "roblox_global", name: "Roblox (Global)", ranges: [{ min_usd: 0, max_usd: 5, margin: 15 }, { min_usd: 5, max_usd: 15, margin: 12 }, { min_usd: 15, max_usd: 999, margin: 10 }] },
            { key: "playstation_us", name: "PlayStation Network (US)", ranges: [{ min_usd: 0, max_usd: 5, margin: 15 }, { min_usd: 5, max_usd: 15, margin: 12 }, { min_usd: 15, max_usd: 999, margin: 10 }] },
            { key: "steam_wallet_us", name: "Steam Wallet (US)", ranges: [{ min_usd: 0, max_usd: 5, margin: 15 }, { min_usd: 5, max_usd: 15, margin: 12 }, { min_usd: 15, max_usd: 999, margin: 10 }] },
            { key: "fortnite", name: "Fortnite V-Bucks", ranges: [{ min_usd: 0, max_usd: 5, margin: 15 }, { min_usd: 5, max_usd: 15, margin: 12 }, { min_usd: 15, max_usd: 999, margin: 10 }] },
            { key: "google_play_us", name: "Google Play (US)", ranges: [{ min_usd: 0, max_usd: 5, margin: 15 }, { min_usd: 5, max_usd: 15, margin: 12 }, { min_usd: 15, max_usd: 999, margin: 10 }] },
            { key: "mobile_legends_voucher_global", name: "Mobile Legends Vouchers (Global)", ranges: [{ min_usd: 0, max_usd: 5, margin: 15 }, { min_usd: 5, max_usd: 15, margin: 12 }, { min_usd: 15, max_usd: 999, margin: 10 }] },
            { key: "steam_wallet_global", name: "Steam Wallet (Global)", ranges: [{ min_usd: 0, max_usd: 5, margin: 15 }, { min_usd: 5, max_usd: 15, margin: 12 }, { min_usd: 15, max_usd: 999, margin: 10 }] },
            { key: "xbox_gift_card_us", name: "Xbox Game Pass (US)", ranges: [{ min_usd: 0, max_usd: 5, margin: 15 }, { min_usd: 5, max_usd: 15, margin: 12 }, { min_usd: 15, max_usd: 999, margin: 10 }] },
          ]
        });
      }
      
      // Load webhook secret
      const webhookRes = await API.get("/settings/webhook-secret");
      if (webhookRes.data.secret) {
        setWebhookSecret(webhookRes.data.secret);
      }
    } catch (error) {
      console.error("Load error:", error);
      alert("Failed to load settings");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // Generate random secret
  function generateRandomSecret() {
    const secret = [...Array(32)].map(() => Math.random().toString(36)[2]).join('');
    setGeneratedSecret(secret);
    setWebhookSecret(secret);
  }

  // Save webhook secret
  async function saveWebhookSecret() {
    if (!webhookSecret || webhookSecret.length < 32) {
      alert("Secret must be at least 32 characters");
      return;
    }
    setSavingWebhook(true);
    try {
      await API.post("/settings/webhook-secret", { secret: webhookSecret });
      alert("Webhook secret saved!");
    } catch (error) {
      console.error("Save webhook secret error:", error);
      alert("Failed to save webhook secret");
    }
    setSavingWebhook(false);
  }

  // Deposit amounts functions
  async function saveDepositAmounts() {
    try {
      await API.post("/settings", {
        key: "deposit_amounts",
        value: JSON.stringify(depositAmounts)
      });
      alert("Deposit amounts saved!");
    } catch (error) {
      alert("Failed to save");
    }
  }

  function addDepositAmount() {
    if (newAmount && !depositAmounts.includes(parseInt(newAmount))) {
      setDepositAmounts([...depositAmounts, parseInt(newAmount)].sort((a,b) => a-b));
      setNewAmount("");
    }
  }

  function removeDepositAmount(amount) {
    setDepositAmounts(depositAmounts.filter(a => a !== amount));
  }

  async function updateRate() {
    if (!rate) {
      alert("Please enter exchange rate");
      return;
    }
    setLoading(true);
    try {
      await API.post("/settings", {
        key: "exchange_rate",
        value: rate
      });
      alert("Exchange rate updated!");
    } catch (error) {
      alert("Failed to update");
    }
    setLoading(false);
  }

  async function updateBanner() {
    if (!bannerUrl) {
      alert("Please enter banner image URL");
      return;
    }
    setLoading(true);
    try {
      await API.put("/settings/banner", { url: bannerUrl });
      alert("Banner updated! Restart bot to see changes.");
    } catch (error) {
      alert("Failed to update banner");
    }
    setLoading(false);
  }

  async function saveProfitMargins() {
    setLoading(true);
    try {
      await API.post("/settings", {
        key: "profit_margins",
        value: JSON.stringify(profitMargins)
      });
      alert("Profit margins saved!");
    } catch (error) {
      alert("Failed to save profit margins");
    }
    setLoading(false);
  }

  async function addPaymentMethod() {
    if (!newMethod.name || !newMethod.account_number) {
      alert("Name and account number are required");
      return;
    }

    const newId = paymentMethods.length + 1;
    const updatedMethods = [...paymentMethods, { id: newId, ...newMethod }];
    
    setLoading(true);
    try {
      await API.put("/settings/payment-methods", { methods: updatedMethods });
      setPaymentMethods(updatedMethods);
      setNewMethod({ name: "", account_number: "", account_name: "", instructions: "", image_url: "" });
      alert("Payment method added!");
    } catch (error) {
      alert("Failed to add");
    }
    setLoading(false);
  }

  async function deletePaymentMethod(id) {
    if (!window.confirm("Delete this payment method?")) return;
    
    const updatedMethods = paymentMethods.filter(m => m.id !== id);
    
    setLoading(true);
    try {
      await API.put("/settings/payment-methods", { methods: updatedMethods });
      setPaymentMethods(updatedMethods);
      alert("Payment method deleted!");
    } catch (error) {
      alert("Failed to delete");
    }
    setLoading(false);
  }

  async function updatePaymentMethod(id, field, value) {
    const updatedMethods = paymentMethods.map(m => 
      m.id === id ? { ...m, [field]: value } : m
    );
    
    try {
      await API.put("/settings/payment-methods", { methods: updatedMethods });
      setPaymentMethods(updatedMethods);
    } catch (error) {
      console.error("Update error:", error);
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">Settings</h2>
        <p className="text-sm text-gray-500">Configure exchange rates, banner, profit margins, payment methods, and webhook</p>
      </div>

      {/* Main Menu Banner Section */}
      <div className="bg-white rounded-lg md:rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 md:p-6 border-b border-gray-100">
          <div className="flex items-center">
            <Image className="h-5 w-5 text-purple-500 mr-2" />
            <h3 className="text-base md:text-lg font-semibold text-gray-800">Main Menu Banner</h3>
          </div>
          <p className="text-xs md:text-sm text-gray-500 mt-1">Change the banner image shown in the bot's main menu</p>
        </div>
        <div className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Banner Image URL</label>
              <input
                type="text"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                placeholder="https://example.com/banner.jpg"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
              />
            </div>
            <button
              onClick={updateBanner}
              disabled={loading}
              className="flex items-center justify-center px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 text-sm"
            >
              <Save size={16} className="mr-2" />
              Update Banner
            </button>
          </div>
          {bannerUrl && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Preview:</p>
              <img src={bannerUrl} alt="Banner Preview" className="w-full h-32 object-cover rounded-lg border" />
            </div>
          )}
        </div>
      </div>

      {/* Exchange Rate Section */}
      <div className="bg-white rounded-lg md:rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 md:p-6 border-b border-gray-100">
          <div className="flex items-center">
            <DollarSign className="h-5 w-5 text-yellow-500 mr-2" />
            <h3 className="text-base md:text-lg font-semibold text-gray-800">Exchange Rate</h3>
          </div>
          <p className="text-xs md:text-sm text-gray-500 mt-1">USD to Ethiopian Birr conversion rate</p>
        </div>
        <div className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">1 USD = ? ETB</label>
              <input
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="Enter exchange rate"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
              />
            </div>
            <button
              onClick={updateRate}
              disabled={loading}
              className="flex items-center justify-center px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 text-sm"
            >
              <Save size={16} className="mr-2" />
              Save Rate
            </button>
          </div>
        </div>
      </div>

      {/* Profit Margins Section */}
      <div className="bg-white rounded-lg md:rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 md:p-6 border-b border-gray-100">
          <div className="flex items-center">
            <TrendingUp className="h-5 w-5 text-green-500 mr-2" />
            <h3 className="text-base md:text-lg font-semibold text-gray-800">Profit Margins</h3>
          </div>
          <p className="text-xs md:text-sm text-gray-500 mt-1">Configure profit margins based on USD price ranges</p>
        </div>
        
        <div className="p-4 md:p-6 space-y-3">
          {profitMargins.categories.map((category, categoryIndex) => (
            <div key={`${category.key}-${categoryIndex}`} className="border border-gray-200 rounded-lg overflow-hidden">
              <button type="button" onClick={() => setExpandedCategory(expandedCategory === categoryIndex ? null : categoryIndex)} className="w-full px-3 py-3 flex items-center justify-between text-left hover:bg-gray-50">
                <span className="font-medium text-sm text-gray-800">{category.name || category.key}</span>
                <span className="text-xs text-gray-500">{category.key} · {category.ranges?.length || 0} tiers</span>
              </button>
              {expandedCategory === categoryIndex && (
                <div className="border-t border-gray-200 p-3 space-y-3 bg-gray-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={category.key} onChange={(e) => setProfitMargins(p => ({ ...p, categories: p.categories.map((c, i) => i === categoryIndex ? { ...c, key: e.target.value } : c) }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Category key" />
                    <input value={category.name || ""} onChange={(e) => setProfitMargins(p => ({ ...p, categories: p.categories.map((c, i) => i === categoryIndex ? { ...c, name: e.target.value } : c) }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Display name" />
                  </div>
                  {(category.ranges || []).map((range, rangeIndex) => (
                    <div key={rangeIndex} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                      <input type="number" step="0.01" value={range.min_usd} onChange={(e) => setProfitMargins(p => ({ ...p, categories: p.categories.map((c, i) => i === categoryIndex ? { ...c, ranges: c.ranges.map((r, j) => j === rangeIndex ? { ...r, min_usd: parseFloat(e.target.value) || 0 } : r) } : c) }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Min USD" />
                      <input type="number" step="0.01" value={range.max_usd} onChange={(e) => setProfitMargins(p => ({ ...p, categories: p.categories.map((c, i) => i === categoryIndex ? { ...c, ranges: c.ranges.map((r, j) => j === rangeIndex ? { ...r, max_usd: parseFloat(e.target.value) || 0 } : r) } : c) }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Max USD" />
                      <input type="number" step="0.5" value={range.margin} onChange={(e) => setProfitMargins(p => ({ ...p, categories: p.categories.map((c, i) => i === categoryIndex ? { ...c, ranges: c.ranges.map((r, j) => j === rangeIndex ? { ...r, margin: parseFloat(e.target.value) || 0 } : r) } : c) }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Margin %" />
                      <button type="button" onClick={() => setProfitMargins(p => ({ ...p, categories: p.categories.map((c, i) => i === categoryIndex ? { ...c, ranges: c.ranges.filter((_, j) => j !== rangeIndex) } : c) }))} className="flex items-center justify-center gap-1 px-3 py-2 text-red-500 border border-red-200 rounded-lg text-sm"><Trash2 size={15} /> Remove</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setProfitMargins(p => ({ ...p, categories: p.categories.map((c, i) => i === categoryIndex ? { ...c, ranges: [...(c.ranges || []), { min_usd: 0, max_usd: 999, margin: 10 }] } : c) }))} className="flex items-center gap-1 px-3 py-2 text-green-600 border border-green-200 rounded-lg text-sm"><Plus size={15} /> Add Tier</button>
                  <button type="button" onClick={() => setProfitMargins(p => ({ ...p, categories: p.categories.filter((_, i) => i !== categoryIndex) }))} className="flex items-center gap-1 px-3 py-2 text-red-600 border border-red-200 rounded-lg text-sm"><Trash2 size={15} /> Remove Category</button>
                </div>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setProfitMargins(p => ({ ...p, categories: [...p.categories, { key: "new_category", name: "New Category", ranges: [{ min_usd: 0, max_usd: 5, margin: 15 }] }] }))} className="flex items-center gap-1 px-3 py-2 text-blue-600 border border-blue-200 rounded-lg text-sm"><Plus size={15} /> Add Category</button>
        </div>

        <div className="p-4 md:p-6 border-t border-gray-100">
          <button
            onClick={saveProfitMargins}
            disabled={loading}
            className="flex items-center justify-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm w-full sm:w-auto"
          >
            <Save size={16} className="mr-2" />
            Save All Profit Margins
          </button>
        </div>
      </div>

      {/* Payment Methods Section */}
      <div className="bg-white rounded-lg md:rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 md:p-6 border-b border-gray-100">
          <div className="flex items-center">
            <CreditCard className="h-5 w-5 text-yellow-500 mr-2" />
            <h3 className="text-base md:text-lg font-semibold text-gray-800">Payment Methods</h3>
          </div>
          <p className="text-xs md:text-sm text-gray-500 mt-1">Manage available payment options for customers</p>
        </div>

        <div className="overflow-x-auto -mx-4 px-4">
          <table className="min-w-[700px] w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Number</th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Name</th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Image URL</th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paymentMethods.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-3 md:px-6 py-3">
                    <input
                      value={m.name}
                      onChange={(e) => updatePaymentMethod(m.id, "name", e.target.value)}
                      className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500 text-sm"
                    />
                    </td>
                  <td className="px-3 md:px-6 py-3">
                    <input
                      value={m.account_number}
                      onChange={(e) => updatePaymentMethod(m.id, "account_number", e.target.value)}
                      className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500 text-sm"
                    />
                    </td>
                  <td className="px-3 md:px-6 py-3">
                    <input
                      value={m.account_name || ""}
                      onChange={(e) => updatePaymentMethod(m.id, "account_name", e.target.value)}
                      className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500 text-sm"
                    />
                    </td>
                  <td className="px-3 md:px-6 py-3">
                    <div className="flex flex-col gap-1">
                      <input
                        value={m.image_url || ""}
                        onChange={(e) => updatePaymentMethod(m.id, "image_url", e.target.value)}
                        placeholder="https://example.com/guide.jpg"
                        className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500 text-sm"
                      />
                      {m.image_url && (
                        <img src={m.image_url} alt="preview" className="h-10 w-auto rounded border" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 md:px-6 py-3">
                    <button onClick={() => deletePaymentMethod(m.id)} className="p-1 text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {paymentMethods.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    No payment methods yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50 rounded-b-lg md:rounded-b-xl">
          <h4 className="text-sm md:text-md font-medium text-gray-800 mb-3">Add New Payment Method</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Method Name"
              value={newMethod.name}
              onChange={(e) => setNewMethod({ ...newMethod, name: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
            />
            <input
              type="text"
              placeholder="Account Number"
              value={newMethod.account_number}
              onChange={(e) => setNewMethod({ ...newMethod, account_number: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
            />
            <input
              type="text"
              placeholder="Account Name (optional)"
              value={newMethod.account_name}
              onChange={(e) => setNewMethod({ ...newMethod, account_name: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
            />
            <input
              type="text"
              placeholder="Instructions (optional)"
              value={newMethod.instructions}
              onChange={(e) => setNewMethod({ ...newMethod, instructions: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
            />
            <input
              type="text"
              placeholder="Image URL (optional) – guide screenshot"
              value={newMethod.image_url}
              onChange={(e) => setNewMethod({ ...newMethod, image_url: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm col-span-1 sm:col-span-2"
            />
          </div>
          <button
            onClick={addPaymentMethod}
            disabled={loading}
            className="flex items-center mt-3 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
          >
            <Plus size={16} className="mr-2" />
            Add Payment Method
          </button>
        </div>
      </div>

      {/* Webhook Configuration Section */}
      <div className="bg-white rounded-lg md:rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 md:p-6 border-b border-gray-100">
          <div className="flex items-center">
            <Lock className="h-5 w-5 text-red-500 mr-2" />
            <h3 className="text-base md:text-lg font-semibold text-gray-800">ShegerPay Webhook</h3>
          </div>
          <p className="text-xs md:text-sm text-gray-500 mt-1">Configure webhook for automatic payment verification</p>
        </div>
        <div className="p-4 md:p-6">
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Webhook Secret</label>
              <input
                type="text"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="Enter a secure secret (min 32 characters)"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">Used to verify that webhooks are coming from ShegerPay</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={generateRandomSecret}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
              >
                Generate Random Secret
              </button>
              <button
                onClick={saveWebhookSecret}
                disabled={savingWebhook}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm"
              >
                {savingWebhook ? "Saving..." : "Save Webhook Secret"}
              </button>
            </div>
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-2">📋 Your webhook URL for ShegerPay dashboard:</p>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded block break-all font-mono">
                {window.location.origin}/webhook/shegerpay
              </code>
              <p className="text-xs text-gray-500 mt-2">
                ⚠️ Add this URL to your ShegerPay dashboard and select events: <strong>payment.verified</strong> and <strong>payment.failed</strong>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Deposit Amounts Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">💰 Deposit Amounts</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {depositAmounts.map(amount => (
            <span key={amount} className="bg-gray-100 px-3 py-1 rounded-full flex items-center gap-2">
              {amount} ETB
              <button onClick={() => removeDepositAmount(amount)} className="text-red-500">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            placeholder="New amount"
            className="border rounded px-3 py-1"
          />
          <button onClick={addDepositAmount} className="bg-green-500 text-white px-3 py-1 rounded">Add</button>
          <button onClick={saveDepositAmounts} className="bg-blue-500 text-white px-3 py-1 rounded">Save</button>
        </div>
      </div>
    </div>
  );
}