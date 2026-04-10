import React, { useEffect, useState } from "react";
import API from "../api/api";
import { 
  Plus, Edit, Trash2, Power, Search,
  ChevronLeft, ChevronRight
} from "lucide-react";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [ragnerProducts, setRagnerProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price_etb: "",
    category_id: "",
    subcategory_id: "",
    product_type: "uc_manual",
    requires_fields: [],
    warning_message: "",
    position: 0,
    is_active: true
  });

  async function loadData() {
    setLoading(true);
    try {
      const [productsRes, categoriesRes, ragnerRes] = await Promise.all([
        API.get("/products"),
        API.get("/categories/with-subs"),
        API.get("/products/ragner/products").catch(() => ({ data: [] }))
      ]);
      
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
      setRagnerProducts(ragnerRes.data);
    } catch (error) {
      console.error("Load error:", error);
      alert("Failed to load data");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.category_id) {
      const selectedCat = categories.find(c => c.id === parseInt(formData.category_id));
      setSubcategories(selectedCat?.subcategories || []);
    } else {
      setSubcategories([]);
    }
  }, [formData.category_id, categories]);

  useEffect(() => {
    const type = formData.product_type;
    let requiredFields = [];
    let warningMsg = "";
    
    switch(type) {
      case "uc_instant":
      case "uc_manual":
      case "grospack":
      case "subscription":
      case "free_fire":
        requiredFields = ["player_id"];
        break;
      case "tiktok":
        requiredFields = ["email", "phone", "password"];
        warningMsg = "⚠️ IMPORTANT: Please turn off 2-step verification before sharing.";
        break;
      case "telegram":
        requiredFields = ["username", "phone"];
        break;
      default:
        requiredFields = [];
    }
    
    setFormData(prev => ({
      ...prev,
      requires_fields: requiredFields,
      warning_message: warningMsg
    }));
  }, [formData.product_type]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value
    });
  }

  function handleRequiresFieldsChange(e) {
    const value = e.target.value;
    const fields = value.split(',').map(f => f.trim()).filter(f => f);
    setFormData({
      ...formData,
      requires_fields: fields
    });
  }

  function openAddModal() {
    setEditingProduct(null);
    setFormData({
      name: "",
      description: "",
      price_etb: "",
      category_id: "",
      subcategory_id: "",
      product_type: "uc_manual",
      requires_fields: ["player_id"],
      warning_message: "",
      position: 0,
      is_active: true
    });
    setShowModal(true);
  }

  function openEditModal(product) {
    setEditingProduct(product);
    setFormData({
      name: product.name || "",
      description: product.description || "",
      price_etb: product.price_etb || "",
      category_id: product.category_id || "",
      subcategory_id: product.subcategory_id || "",
      product_type: product.product_type || "uc_manual",
      requires_fields: product.requires_fields || [],
      warning_message: product.warning_message || "",
      position: product.position || 0,
      is_active: product.is_active
    });
    setShowModal(true);
  }

  async function saveProduct() {
    if (!formData.name || !formData.price_etb || !formData.category_id || !formData.product_type) {
      alert("Please fill all required fields");
      return;
    }

    setLoading(true);
    try {
      if (editingProduct) {
        await API.put(`/products/${editingProduct.id}`, formData);
        alert("Product updated!");
      } else {
        await API.post("/products", formData);
        alert("Product created!");
      }
      setShowModal(false);
      loadData();
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save product");
    }
    setLoading(false);
  }

  async function deleteProduct(id, name) {
    if (!window.confirm(`Delete "${name}"?`)) return;
    setLoading(true);
    try {
      await API.delete(`/products/${id}`);
      alert("Product deleted!");
      loadData();
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete product");
    }
    setLoading(false);
  }

  async function toggleActive(product) {
    setLoading(true);
    try {
      await API.put(`/products/${product.id}`, { ...product, is_active: !product.is_active });
      loadData();
    } catch (error) {
      console.error("Toggle error:", error);
      alert("Failed to update status");
    }
    setLoading(false);
  }

  const filteredProducts = products.filter(p => {
    if (filterType !== "all" && p.product_type !== filterType) return false;
    if (search) {
      return p.name.toLowerCase().includes(search.toLowerCase()) ||
             p.price_etb?.toString().includes(search);
    }
    return true;
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getProductTypeBadge = (type) => {
    const types = {
      uc_instant: { bg: "bg-green-100 text-green-700", text: "⚡ UC Instant" },
      uc_manual: { bg: "bg-orange-100 text-orange-700", text: "📦 UC Manual" },
      grospack: { bg: "bg-purple-100 text-purple-700", text: "🎁 Grospack" },
      subscription: { bg: "bg-blue-100 text-blue-700", text: "👑 Subscription" },
      free_fire: { bg: "bg-red-100 text-red-700", text: "🔥 Free Fire" },
      tiktok: { bg: "bg-pink-100 text-pink-700", text: "📱 TikTok" },
      telegram: { bg: "bg-cyan-100 text-cyan-700", text: "✍️ Telegram" }
    };
    return types[type] || { bg: "bg-gray-100 text-gray-700", text: "Unknown" };
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800">Products</h2>
          <p className="text-sm text-gray-500">Manage your products and inventory</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center px-3 py-2 md:px-4 md:py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm md:text-base"
        >
          <Plus size={18} className="mr-2" />
          Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg md:rounded-xl shadow-sm p-3 md:p-4 border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {["all", "uc_instant", "uc_manual", "grospack", "subscription", "free_fire", "tiktok", "telegram"].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2 py-1 md:px-4 md:py-2 rounded-lg text-xs md:text-sm transition-colors ${
                  filterType === type
                    ? "bg-yellow-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {type === "all" ? "All" : type.replace("_", " ").toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Summary - Mobile Friendly */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white rounded-lg p-3 md:p-4 text-center border border-gray-100">
          <p className="text-xl md:text-2xl font-bold text-gray-800">{products.length}</p>
          <p className="text-xs md:text-sm text-gray-500">Total</p>
        </div>
        <div className="bg-white rounded-lg p-3 md:p-4 text-center border border-gray-100">
          <p className="text-xl md:text-2xl font-bold text-green-600">{products.filter(p => p.is_active).length}</p>
          <p className="text-xs md:text-sm text-gray-500">Active</p>
        </div>
        <div className="bg-white rounded-lg p-3 md:p-4 text-center border border-gray-100">
          <p className="text-xl md:text-2xl font-bold text-orange-600">{products.filter(p => p.product_type === "uc_instant").length}</p>
          <p className="text-xs md:text-sm text-gray-500">Instant</p>
        </div>
        <div className="bg-white rounded-lg p-3 md:p-4 text-center border border-gray-100">
          <p className="text-xl md:text-2xl font-bold text-blue-600">{products.filter(p => p.product_type !== "uc_instant").length}</p>
          <p className="text-xs md:text-sm text-gray-500">Manual</p>
        </div>
      </div>

      {/* Mobile Card View */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
        </div>
      ) : (
        <>
          {/* Mobile Cards - visible on small screens */}
          <div className="space-y-3 md:hidden">
            {paginatedProducts.map((p) => {
              const typeBadge = getProductTypeBadge(p.product_type);
              return (
                <div key={p.id} className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${typeBadge.bg} mb-2`}>
                        {typeBadge.text}
                      </span>
                      <h3 className="font-semibold text-gray-800 text-sm">{p.name}</h3>
                    </div>
                    <span className="font-bold text-yellow-600 text-sm">{p.price_etb} ETB</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-3">Category: {p.category_name || "-"}</div>
                  <div className="flex justify-between items-center">
                    <button
                      onClick={() => toggleActive(p)}
                      className={`px-2 py-1 rounded-lg text-xs ${
                        p.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      <Power size={12} className="inline mr-1" />
                      {p.is_active ? "Active" : "Inactive"}
                    </button>
                    <div className="flex space-x-2">
                      <button onClick={() => openEditModal(p)} className="p-2 text-blue-500">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => deleteProduct(p.id, p.name)} className="p-2 text-red-500">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table - hidden on mobile */}
          <div className="hidden md:block overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedProducts.map((p) => {
                  const typeBadge = getProductTypeBadge(p.product_type);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">#{p.id}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${typeBadge.bg}`}>
                          {typeBadge.text}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800">{p.name}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.price_etb} ETB</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{p.category_name || "-"}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleActive(p)}
                          className={`flex items-center px-2 py-1 rounded-lg text-xs ${
                            p.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          <Power size={12} className="mr-1" />
                          {p.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-2">
                          <button onClick={() => openEditModal(p)} className="p-1 text-blue-500 hover:text-blue-700">
                            <Edit size={18} />
                          </button>
                          <button onClick={() => deleteProduct(p.id, p.name)} className="p-1 text-red-500 hover:text-red-700">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
              <p className="text-xs md:text-sm text-gray-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredProducts.length)} of {filteredProducts.length} products
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="px-3 py-2 md:px-4 md:py-2 bg-yellow-500 text-white rounded-lg text-sm">{currentPage}</span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal - remains same */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-lg md:text-xl font-bold text-gray-800">
                {editingProduct ? "Edit Product" : "Add New Product"}
              </h3>
            </div>
            <div className="p-4 md:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Type *</label>
                <select
                  name="product_type"
                  value={formData.product_type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                >
                  <option value="uc_instant">⚡ UC Instant (PUBG - Ragner API)</option>
                  <option value="uc_manual">📦 UC Manual (PUBG)</option>
                  <option value="grospack">🎁 Grospack (PUBG)</option>
                  <option value="subscription">👑 Subscription (PUBG)</option>
                  <option value="free_fire">🔥 Free Fire Diamonds</option>
                  <option value="tiktok">📱 TikTok Coins</option>
                  <option value="telegram">✍️ Telegram Premium</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (ETB) *</label>
                <input
                  type="number"
                  name="price_etb"
                  value={formData.price_etb}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                >
                  <option value="">Select Category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.display_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory (Optional)</label>
                <select
                  name="subcategory_id"
                  value={formData.subcategory_id || ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                  disabled={!formData.category_id}
                >
                  <option value="">No Subcategory</option>
                  {subcategories.map(s => (
                    <option key={s.id} value={s.id}>{s.display_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="h-4 w-4 text-yellow-500 focus:ring-yellow-500 border-gray-300 rounded"
                />
                <label className="ml-2 text-sm text-gray-700">Active (visible to users)</label>
              </div>
            </div>
            <div className="p-4 md:p-6 border-t border-gray-100 flex justify-end space-x-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowModal(false)}
                className="px-3 py-2 md:px-4 md:py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveProduct}
                className="px-3 py-2 md:px-4 md:py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm"
              >
                {editingProduct ? "Update" : "Create"} Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}