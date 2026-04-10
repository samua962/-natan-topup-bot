import React, { useEffect, useState } from "react";
import API from "../api/api";
import { Save, Plus, Trash2, DollarSign, CreditCard, TrendingUp, Image } from "lucide-react";

export default function Settings() {
  const [rate, setRate] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [profitMargins, setProfitMargins] = useState({ ranges: [] });
  const [loading, setLoading] = useState(false);
  const [newMargin, setNewMargin] = useState({ min_usd: "", max_usd: "", margin: "", name: "" });
  const [newMethod, setNewMethod] = useState({ 
    name: "", 
    account_number: "", 
    account_name: "", 
    instructions: "" 
  });

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
      
      const marginRes = res.data.find(s => s.key === "profit_margins");
      if (marginRes?.value) {
        setProfitMargins(JSON.parse(marginRes.value));
      } else {
        setProfitMargins({
          ranges: [
            { min_usd: 0.99, max_usd: 4.99, margin: 15, name: "Small UC" },
            { min_usd: 5.00, max_usd: 19.99, margin: 10, name: "Medium UC" },
            { min_usd: 20.00, max_usd: 999.99, margin: 7, name: "Large UC" }
          ]
        });
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

  function addProfitMargin() {
    if (!newMargin.min_usd || !newMargin.max_usd || !newMargin.margin || !newMargin.name) {
      alert("All fields are required");
      return;
    }
    setProfitMargins({
      ranges: [...profitMargins.ranges, { 
        min_usd: parseFloat(newMargin.min_usd), 
        max_usd: parseFloat(newMargin.max_usd), 
        margin: parseFloat(newMargin.margin),
        name: newMargin.name
      }]
    });
    setNewMargin({ min_usd: "", max_usd: "", margin: "", name: "" });
  }

  function updateProfitMargin(index, field, value) {
    const updated = [...profitMargins.ranges];
    updated[index][field] = parseFloat(value);
    setProfitMargins({ ranges: updated });
  }

  function deleteProfitMargin(index) {
    const updated = profitMargins.ranges.filter((_, i) => i !== index);
    setProfitMargins({ ranges: updated });
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
      setNewMethod({ name: "", account_number: "", account_name: "", instructions: "" });
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
        <p className="text-sm text-gray-500">Configure exchange rates, banner, profit margins, and payment methods</p>
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

      {/* Profit Margins Section - Mobile scrollable */}
      <div className="bg-white rounded-lg md:rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 md:p-6 border-b border-gray-100">
          <div className="flex items-center">
            <TrendingUp className="h-5 w-5 text-green-500 mr-2" />
            <h3 className="text-base md:text-lg font-semibold text-gray-800">Profit Margins</h3>
          </div>
          <p className="text-xs md:text-sm text-gray-500 mt-1">Configure profit margins based on USD price ranges</p>
        </div>
        
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="min-w-[500px] w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Range Name</th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min USD</th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max USD</th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin</th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {profitMargins.ranges.map((range, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-3 md:px-6 py-3">
                    <input
                      value={range.name}
                      onChange={(e) => updateProfitMargin(index, "name", e.target.value)}
                      className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500 text-sm"
                    />
                    </td>
                  <td className="px-3 md:px-6 py-3">
                    <input
                      type="number"
                      step="0.01"
                      value={range.min_usd}
                      onChange={(e) => updateProfitMargin(index, "min_usd", e.target.value)}
                      className="w-20 px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500 text-sm"
                    />
                    </td>
                  <td className="px-3 md:px-6 py-3">
                    <input
                      type="number"
                      step="0.01"
                      value={range.max_usd}
                      onChange={(e) => updateProfitMargin(index, "max_usd", e.target.value)}
                      className="w-20 px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500 text-sm"
                    />
                    </td>
                  <td className="px-3 md:px-6 py-3">
                    <input
                      type="number"
                      step="1"
                      value={range.margin}
                      onChange={(e) => updateProfitMargin(index, "margin", e.target.value)}
                      className="w-16 px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500 text-sm"
                    />
                    <span className="ml-1 text-xs text-gray-500">%</span>
                    </td>
                  <td className="px-3 md:px-6 py-3">
                    <button onClick={() => deleteProfitMargin(index)} className="p-1 text-red-500">
                      <Trash2 size={16} />
                    </button>
                    </td>
                 </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50">
          <h4 className="text-sm md:text-md font-medium text-gray-800 mb-3">Add New Price Range</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Range Name"
              value={newMargin.name}
              onChange={(e) => setNewMargin({ ...newMargin, name: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Min USD"
              value={newMargin.min_usd}
              onChange={(e) => setNewMargin({ ...newMargin, min_usd: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Max USD"
              value={newMargin.max_usd}
              onChange={(e) => setNewMargin({ ...newMargin, max_usd: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
            />
            <input
              type="number"
              step="1"
              placeholder="Margin (%)"
              value={newMargin.margin}
              onChange={(e) => setNewMargin({ ...newMargin, margin: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
            />
          </div>
          <button
            onClick={addProfitMargin}
            className="flex items-center mt-3 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
          >
            <Plus size={16} className="mr-2" />
            Add Range
          </button>
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
          <table className="min-w-[500px] w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Number</th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Name</th>
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
                    <button onClick={() => deletePaymentMethod(m.id)} className="p-1 text-red-500">
                      <Trash2 size={16} />
                    </button>
                    </td>
                 </tr>
              ))}
              {paymentMethods.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
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
    </div>
  );
}