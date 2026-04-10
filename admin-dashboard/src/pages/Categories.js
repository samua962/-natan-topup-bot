import React, { useEffect, useState } from "react";
import API from "../api/api";
import { Plus, Edit, Trash2, Power, FolderPlus, ChevronDown, ChevronUp } from "lucide-react";

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [editingSub, setEditingSub] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  
  const [catForm, setCatForm] = useState({ 
    name: "", 
    display_name: "", 
    icon: "", 
    image_url: "", 
    position: 0,
    is_active: true 
  });
  
  const [subForm, setSubForm] = useState({ 
    category_id: "", 
    name: "", 
    display_name: "", 
    position: 0,
    is_active: true 
  });

  async function loadData() {
    setLoading(true);
    try {
      const res = await API.get("/categories/with-subs");
      setCategories(res.data);
    } catch (error) {
      console.error("Load error:", error);
      alert("Failed to load categories");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const toggleCategory = (id) => {
    setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  async function addCategory() {
    if (!catForm.name || !catForm.display_name) {
      alert("Name and Display Name are required");
      return;
    }
    try {
      if (editingCat) {
        await API.put(`/categories/${editingCat}`, catForm);
        alert("Category updated!");
      } else {
        await API.post("/categories", catForm);
        alert("Category added!");
      }
      setShowCatModal(false);
      setCatForm({ name: "", display_name: "", icon: "", image_url: "", position: 0, is_active: true });
      setEditingCat(null);
      loadData();
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save category");
    }
  }

  async function deleteCategory(id, name) {
    if (!window.confirm(`Delete category "${name}"? All subcategories will also be deleted!`)) return;
    try {
      await API.delete(`/categories/${id}`);
      loadData();
      alert("Category deleted!");
    } catch (error) {
      alert("Failed to delete category");
    }
  }

  async function toggleCategoryActive(cat) {
    try {
      const updatedCat = { 
        display_name: cat.display_name,
        icon: cat.icon,
        image_url: cat.image_url,
        position: cat.position,
        is_active: !cat.is_active 
      };
      await API.put(`/categories/${cat.id}`, updatedCat);
      loadData();
    } catch (error) {
      console.error("Toggle error:", error);
      alert("Failed to update status");
    }
  }

  async function updateCategoryField(cat, field, value) {
    try {
      const updatedCat = { 
        display_name: cat.display_name,
        icon: cat.icon,
        image_url: cat.image_url,
        position: cat.position,
        is_active: cat.is_active,
        [field]: value
      };
      await API.put(`/categories/${cat.id}`, updatedCat);
      loadData();
    } catch (error) {
      console.error("Update field error:", error);
    }
  }

  async function addSubcategory() {
    if (!subForm.category_id || !subForm.name || !subForm.display_name) {
      alert("All fields are required");
      return;
    }
    try {
      if (editingSub) {
        await API.put(`/categories/subcategories/${editingSub}`, subForm);
        alert("Subcategory updated!");
      } else {
        await API.post("/categories/subcategories", subForm);
        alert("Subcategory added!");
      }
      setShowSubModal(false);
      setSubForm({ category_id: "", name: "", display_name: "", position: 0, is_active: true });
      setEditingSub(null);
      loadData();
    } catch (error) {
      alert("Failed to save subcategory");
    }
  }

  async function deleteSubcategory(id) {
    if (!window.confirm("Delete this subcategory?")) return;
    try {
      await API.delete(`/categories/subcategories/${id}`);
      loadData();
      alert("Subcategory deleted!");
    } catch (error) {
      alert("Failed to delete subcategory");
    }
  }

  async function toggleSubcategoryActive(sub) {
    try {
      await API.put(`/categories/subcategories/${sub.id}`, { 
        display_name: sub.display_name,
        position: sub.position,
        is_active: !sub.is_active 
      });
      loadData();
    } catch (error) {
      alert("Failed to update status");
    }
  }

  async function updateSubcategoryField(sub, field, value) {
    try {
      await API.put(`/categories/subcategories/${sub.id}`, { 
        display_name: sub.display_name,
        position: sub.position,
        is_active: sub.is_active,
        [field]: value 
      });
      loadData();
    } catch (error) {
      console.error("Update field error:", error);
    }
  }

  function openEditCategory(cat) {
    setEditingCat(cat.id);
    setCatForm({
      name: cat.name,
      display_name: cat.display_name,
      icon: cat.icon || "",
      image_url: cat.image_url || "",
      position: cat.position || 0,
      is_active: cat.is_active
    });
    setShowCatModal(true);
  }

  function openEditSubcategory(sub, catId) {
    setEditingSub(sub.id);
    setSubForm({
      category_id: catId,
      name: sub.name,
      display_name: sub.display_name,
      position: sub.position || 0,
      is_active: sub.is_active
    });
    setShowSubModal(true);
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800">Categories</h2>
          <p className="text-sm text-gray-500">Manage product categories and subcategories</p>
          <p className="text-xs text-gray-400 mt-1">Each category can have its own image for the bot</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => {
              setEditingCat(null);
              setCatForm({ name: "", display_name: "", icon: "", image_url: "", position: 0, is_active: true });
              setShowCatModal(true);
            }}
            className="flex items-center px-3 py-2 md:px-4 md:py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm"
          >
            <Plus size={16} className="mr-1 md:mr-2" />
            <span className="hidden sm:inline">Add Category</span>
            <span className="sm:hidden">Category</span>
          </button>
          <button
            onClick={() => {
              setEditingSub(null);
              setSubForm({ category_id: "", name: "", display_name: "", position: 0, is_active: true });
              setShowSubModal(true);
            }}
            className="flex items-center px-3 py-2 md:px-4 md:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
          >
            <FolderPlus size={16} className="mr-1 md:mr-2" />
            <span className="hidden sm:inline">Add Subcategory</span>
            <span className="sm:hidden">Sub</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
        </div>
      ) : (
        <div className="space-y-4 md:space-y-6">
          {categories.map((cat) => (
            <div key={cat.id} className={`bg-white rounded-lg md:rounded-xl shadow-sm border ${!cat.is_active ? 'opacity-60' : ''}`}>
              {/* Category Header - Clickable on mobile */}
              <div 
                className="p-4 md:p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white rounded-t-lg md:rounded-t-xl cursor-pointer md:cursor-default"
                onClick={() => toggleCategory(cat.id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="text-2xl md:text-3xl">{cat.icon || "📁"}</div>
                    <div className="flex-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <input
                          type="text"
                          value={cat.display_name}
                          onChange={(e) => updateCategoryField(cat, "display_name", e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="text-base md:text-lg font-semibold text-gray-800 border-b border-transparent hover:border-gray-300 focus:border-yellow-500 focus:outline-none bg-transparent"
                        />
                        <span className="text-xs text-gray-500">(ID: {cat.id})</span>
                      </div>
                      <p className="text-xs text-gray-400">Slug: {cat.name}</p>
                    </div>
                  </div>
                  <div className="flex space-x-1 md:space-x-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleCategoryActive(cat); }}
                      className={`flex items-center px-2 py-1 rounded-lg text-xs ${
                        cat.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      <Power size={12} className="mr-1" />
                      <span className="hidden sm:inline">{cat.is_active ? "Active" : "Inactive"}</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditCategory(cat); }}
                      className="p-1 text-blue-500"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id, cat.display_name); }}
                      className="p-1 text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="md:hidden">
                      {expandedCategories[cat.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </div>
                
                {/* Category Image URL Field */}
                <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                  <label className="text-xs text-gray-500 block mb-1">Category Image URL</label>
                  <input
                    type="text"
                    value={cat.image_url || ""}
                    onChange={(e) => updateCategoryField(cat, "image_url", e.target.value)}
                    placeholder="https://example.com/category-image.jpg"
                    className="w-full px-3 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-500"
                  />
                  {cat.image_url && (
                    <img src={cat.image_url} alt={cat.display_name} className="mt-2 h-20 w-full object-cover rounded-lg" />
                  )}
                  <p className="text-xs text-gray-400 mt-1">Shown when users click this category</p>
                </div>
              </div>

              {/* Subcategories - Expandable on mobile */}
              <div className={`${expandedCategories[cat.id] ? 'block' : 'hidden md:block'}`}>
                <div className="overflow-x-auto">
                  {/* Mobile Subcategory Cards */}
                  <div className="p-3 space-y-2 md:hidden">
                    {cat.subcategories && cat.subcategories.length > 0 ? (
                      cat.subcategories.map((sub) => (
                        <div key={sub.id} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-gray-800 text-sm">{sub.display_name}</span>
                            <button
                              onClick={() => toggleSubcategoryActive(sub)}
                              className={`px-2 py-1 rounded-lg text-xs ${
                                sub.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
                              }`}
                            >
                              {sub.is_active ? "Active" : "Inactive"}
                            </button>
                          </div>
                          <div className="text-xs text-gray-500 mb-2">Slug: {sub.name}</div>
                          <div className="flex justify-end space-x-2">
                            <button onClick={() => openEditSubcategory(sub, cat.id)} className="p-1 text-blue-500">
                              <Edit size={14} />
                            </button>
                            <button onClick={() => deleteSubcategory(sub.id)} className="p-1 text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-gray-500 py-4 text-sm">
                        No subcategories yet.
                      </div>
                    )}
                  </div>

                  {/* Desktop Subcategory Table */}
                  <div className="hidden md:block">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Display Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {cat.subcategories && cat.subcategories.length > 0 ? (
                          cat.subcategories.map((sub) => (
                            <tr key={sub.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm text-gray-600">{sub.id}</td>
                              <td className="px-6 py-4 text-sm text-gray-800">{sub.name}</td>
                              <td className="px-6 py-4">
                                <input
                                  type="text"
                                  value={sub.display_name}
                                  onChange={(e) => updateSubcategoryField(sub, "display_name", e.target.value)}
                                  className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500 text-sm"
                                />
                              </td>
                              <td className="px-6 py-4">
                                <input
                                  type="number"
                                  value={sub.position || 0}
                                  onChange={(e) => updateSubcategoryField(sub, "position", parseInt(e.target.value))}
                                  className="w-20 px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500 text-sm"
                                />
                              </td>
                              <td className="px-6 py-4">
                                <button
                                  onClick={() => toggleSubcategoryActive(sub)}
                                  className={`flex items-center px-2 py-1 rounded-lg text-xs ${
                                    sub.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  <Power size={12} className="mr-1" />
                                  {sub.is_active ? "Active" : "Inactive"}
                                </button>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex space-x-2">
                                  <button onClick={() => openEditSubcategory(sub, cat.id)} className="p-1 text-blue-500">
                                    <Edit size={16} />
                                  </button>
                                  <button onClick={() => deleteSubcategory(sub.id)} className="p-1 text-red-500">
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                              No subcategories yet. Click "Add Subcategory" to create one.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category Modal - Mobile responsive */}
      {showCatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-lg md:text-xl font-bold text-gray-800">
                {editingCat ? "Edit Category" : "Add Category"}
              </h3>
            </div>
            <div className="p-4 md:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (slug) *</label>
                <input
                  type="text"
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  placeholder="pubg, free_fire, tiktok"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name *</label>
                <input
                  type="text"
                  value={catForm.display_name}
                  onChange={(e) => setCatForm({ ...catForm, display_name: e.target.value })}
                  placeholder="PUBG, Free Fire, TikTok"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon (emoji)</label>
                <input
                  type="text"
                  value={catForm.icon}
                  onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })}
                  placeholder="🎮, 🔥, 📱"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                <input
                  type="text"
                  value={catForm.image_url}
                  onChange={(e) => setCatForm({ ...catForm, image_url: e.target.value })}
                  placeholder="https://example.com/category-image.jpg"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                />
                {catForm.image_url && (
                  <img src={catForm.image_url} alt="Preview" className="mt-2 h-20 w-full object-cover rounded-lg" />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                <input
                  type="number"
                  value={catForm.position}
                  onChange={(e) => setCatForm({ ...catForm, position: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={catForm.is_active}
                  onChange={(e) => setCatForm({ ...catForm, is_active: e.target.checked })}
                  className="h-4 w-4 text-yellow-500 focus:ring-yellow-500 border-gray-300 rounded"
                />
                <label className="ml-2 text-sm text-gray-700">Active (visible to users)</label>
              </div>
            </div>
            <div className="p-4 md:p-6 border-t border-gray-100 flex justify-end space-x-3 sticky bottom-0 bg-white">
              <button onClick={() => setShowCatModal(false)} className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
                Cancel
              </button>
              <button onClick={addCategory} className="px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm">
                {editingCat ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subcategory Modal */}
      {showSubModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-4 md:p-6 border-b border-gray-100">
              <h3 className="text-lg md:text-xl font-bold text-gray-800">
                {editingSub ? "Edit Subcategory" : "Add Subcategory"}
              </h3>
            </div>
            <div className="p-4 md:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={subForm.category_id}
                  onChange={(e) => setSubForm({ ...subForm, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                >
                  <option value="">Select Category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.display_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (slug) *</label>
                <input
                  type="text"
                  value={subForm.name}
                  onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
                  placeholder="instant, manual, diamonds"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name *</label>
                <input
                  type="text"
                  value={subForm.display_name}
                  onChange={(e) => setSubForm({ ...subForm, display_name: e.target.value })}
                  placeholder="Instant Delivery, Manual, Diamonds"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                <input
                  type="number"
                  value={subForm.position}
                  onChange={(e) => setSubForm({ ...subForm, position: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={subForm.is_active}
                  onChange={(e) => setSubForm({ ...subForm, is_active: e.target.checked })}
                  className="h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 text-sm text-gray-700">Active (visible to users)</label>
              </div>
            </div>
            <div className="p-4 md:p-6 border-t border-gray-100 flex justify-end space-x-3">
              <button onClick={() => setShowSubModal(false)} className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
                Cancel
              </button>
              <button onClick={addSubcategory} className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm">
                {editingSub ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}