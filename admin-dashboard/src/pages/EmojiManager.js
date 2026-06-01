import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { Edit2, Save, X } from 'lucide-react';

export default function EmojiManager() {
  const [activeTab, setActiveTab] = useState('system');
  const [systemEmojis, setSystemEmojis] = useState([]);
  const [categoryEmojis, setCategoryEmojis] = useState([]);
  const [productEmojis, setProductEmojis] = useState([]);
  const [subcategoryEmojis, setSubcategoryEmojis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  // Fetch emoji data based on active tab
  useEffect(() => {
    fetchEmojis();
  }, [activeTab]);

  const fetchEmojis = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (activeTab === 'system') {
        const response = await api.get('/emojis/system', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSystemEmojis(response.data);
      } else if (activeTab === 'categories') {
        const response = await api.get('/emojis/categories', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCategoryEmojis(response.data);
      } else if (activeTab === 'products') {
        const response = await api.get('/emojis/products', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProductEmojis(response.data);
      } else if (activeTab === 'subcategories') {
        const response = await api.get('/emojis/subcategories', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSubcategoryEmojis(response.data);
      }
    } catch (error) {
      console.error('Error fetching emojis:', error);
      setMessage('❌ Failed to fetch emojis');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (id, currentValue) => {
    setEditingId(id);
    setEditingValue(currentValue || '');
  };

  const handleSave = async (id, type) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      let endpoint = '';

      if (type === 'system') {
        endpoint = `/emojis/system/${id}`;
      } else if (type === 'categories') {
        endpoint = `/emojis/categories/${id}`;
      } else if (type === 'products') {
        endpoint = `/emojis/products/${id}`;
      } else if (type === 'subcategories') {
        endpoint = `/emojis/subcategories/${id}`;
      }

      const response = await api.put(endpoint, { emoji_id: editingValue }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessage('✅ Emoji updated successfully');
      setEditingId(null);
      
      // Refresh the list
      setTimeout(() => fetchEmojis(), 500);
    } catch (error) {
      console.error('Error updating emoji:', error);
      setMessage('❌ Failed to update emoji');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingValue('');
  };

  const renderSystemTable = () => (
    <>
      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {systemEmojis.map(emoji => (
          <div key={emoji.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-medium text-gray-800">{emoji.display_name}</p>
                <p className="text-xs text-gray-500 mt-1">Key: {emoji.setting_key}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${emoji.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                {emoji.is_active ? '✅ Active' : '❌ Inactive'}
              </span>
            </div>
            
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-600 block mb-1">Emoji ID</label>
                {editingId === emoji.id ? (
                  <input
                    type="text"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    placeholder="Enter emoji ID"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                ) : (
                  <code className="bg-gray-100 px-3 py-2 rounded text-sm block break-all">{emoji.emoji_id || 'Not set'}</code>
                )}
              </div>
              <p className="text-xs text-gray-600">Fallback: {emoji.fallback_emoji}</p>
            </div>
            
            <div className="flex gap-2 mt-3">
              {editingId === emoji.id ? (
                <>
                  <button
                    onClick={() => handleSave(emoji.id, 'system')}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-xs font-medium"
                  >
                    <Save size={14} /> Save
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 text-xs font-medium"
                  >
                    <X size={14} /> Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleEdit(emoji.id, emoji.emoji_id)}
                  className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs font-medium"
                >
                  <Edit2 size={14} /> Edit
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Setting Key</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Display Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Current Emoji ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Fallback</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {systemEmojis.map(emoji => (
              <tr key={emoji.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm"><code className="bg-gray-100 px-2 py-1 rounded">{emoji.setting_key}</code></td>
                <td className="px-6 py-4 text-sm text-gray-700">{emoji.display_name}</td>
                <td className="px-6 py-4 text-sm">
                  {editingId === emoji.id ? (
                    <input
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      placeholder="Enter emoji ID"
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <code className="bg-gray-100 px-2 py-1 rounded">{emoji.emoji_id || 'Not set'}</code>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{emoji.fallback_emoji}</td>
                <td className="px-6 py-4 text-sm">{emoji.is_active ? '✅ Active' : '❌ Inactive'}</td>
                <td className="px-6 py-4 text-sm">
                  {editingId === emoji.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(emoji.id, 'system')}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs"
                      >
                        <Save size={14} /> Save
                      </button>
                      <button
                        onClick={handleCancel}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 text-xs"
                      >
                        <X size={14} /> Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEdit(emoji.id, emoji.emoji_id)}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
                    >
                      <Edit2 size={14} /> Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderCategoryTable = () => (
    <>
      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {categoryEmojis.map(cat => (
          <div key={cat.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div>
              <p className="font-medium text-gray-800">{cat.display_name}</p>
              <p className="text-xs text-gray-500 mt-1">Name: {cat.name}</p>
            </div>
            
            <div className="mt-3">
              <label className="text-xs text-gray-600 block mb-1">Emoji ID</label>
              {editingId === cat.id ? (
                <input
                  type="text"
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  placeholder="Enter emoji ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              ) : (
                <code className="bg-gray-100 px-3 py-2 rounded text-sm block break-all">{cat.emoji_id || 'Not set'}</code>
              )}
            </div>
            
            <div className="flex gap-2 mt-3">
              {editingId === cat.id ? (
                <>
                  <button
                    onClick={() => handleSave(cat.id, 'categories')}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-xs font-medium"
                  >
                    <Save size={14} /> Save
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 text-xs font-medium"
                  >
                    <X size={14} /> Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleEdit(cat.id, cat.emoji_id)}
                  className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs font-medium"
                >
                  <Edit2 size={14} /> Edit
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Category Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Display Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Emoji ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {categoryEmojis.map(cat => (
              <tr key={cat.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm"><code className="bg-gray-100 px-2 py-1 rounded">{cat.name}</code></td>
                <td className="px-6 py-4 text-sm text-gray-700">{cat.display_name}</td>
                <td className="px-6 py-4 text-sm">
                  {editingId === cat.id ? (
                    <input
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      placeholder="Enter emoji ID"
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <code className="bg-gray-100 px-2 py-1 rounded">{cat.emoji_id || 'Not set'}</code>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  {editingId === cat.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(cat.id, 'categories')}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs"
                      >
                        <Save size={14} /> Save
                      </button>
                      <button
                        onClick={handleCancel}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 text-xs"
                      >
                        <X size={14} /> Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEdit(cat.id, cat.emoji_id)}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
                    >
                      <Edit2 size={14} /> Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderProductTable = () => (
    <>
      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {productEmojis.map(prod => (
          <div key={prod.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="font-medium text-gray-800 mb-3">{prod.name}</p>
            
            <div>
              <label className="text-xs text-gray-600 block mb-1">Emoji ID</label>
              {editingId === prod.id ? (
                <input
                  type="text"
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  placeholder="Enter emoji ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              ) : (
                <code className="bg-gray-100 px-3 py-2 rounded text-sm block break-all">{prod.emoji_id || 'Not set'}</code>
              )}
            </div>
            
            <div className="flex gap-2 mt-3">
              {editingId === prod.id ? (
                <>
                  <button
                    onClick={() => handleSave(prod.id, 'products')}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-xs font-medium"
                  >
                    <Save size={14} /> Save
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 text-xs font-medium"
                  >
                    <X size={14} /> Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleEdit(prod.id, prod.emoji_id)}
                  className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs font-medium"
                >
                  <Edit2 size={14} /> Edit
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Product Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Emoji ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {productEmojis.map(prod => (
              <tr key={prod.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm text-gray-700">{prod.name}</td>
                <td className="px-6 py-4 text-sm">
                  {editingId === prod.id ? (
                    <input
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      placeholder="Enter emoji ID"
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <code className="bg-gray-100 px-2 py-1 rounded">{prod.emoji_id || 'Not set'}</code>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  {editingId === prod.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(prod.id, 'products')}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs"
                      >
                        <Save size={14} /> Save
                      </button>
                      <button
                        onClick={handleCancel}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 text-xs"
                      >
                        <X size={14} /> Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEdit(prod.id, prod.emoji_id)}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
                    >
                      <Edit2 size={14} /> Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderSubcategoryTable = () => (
    <>
      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {subcategoryEmojis.map(sub => (
          <div key={sub.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div>
              <p className="font-medium text-gray-800">{sub.display_name}</p>
              <p className="text-xs text-gray-500 mt-1">Name: {sub.name}</p>
            </div>
            
            <div className="mt-3">
              <label className="text-xs text-gray-600 block mb-1">Emoji ID</label>
              {editingId === sub.id ? (
                <input
                  type="text"
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  placeholder="Enter emoji ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              ) : (
                <code className="bg-gray-100 px-3 py-2 rounded text-sm block break-all">{sub.emoji_id || 'Not set'}</code>
              )}
            </div>
            
            <div className="flex gap-2 mt-3">
              {editingId === sub.id ? (
                <>
                  <button
                    onClick={() => handleSave(sub.id, 'subcategories')}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-xs font-medium"
                  >
                    <Save size={14} /> Save
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 text-xs font-medium"
                  >
                    <X size={14} /> Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleEdit(sub.id, sub.emoji_id)}
                  className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs font-medium"
                >
                  <Edit2 size={14} /> Edit
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Subcategory Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Display Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Emoji ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {subcategoryEmojis.map(sub => (
              <tr key={sub.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm"><code className="bg-gray-100 px-2 py-1 rounded">{sub.name}</code></td>
                <td className="px-6 py-4 text-sm text-gray-700">{sub.display_name}</td>
                <td className="px-6 py-4 text-sm">
                  {editingId === sub.id ? (
                    <input
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      placeholder="Enter emoji ID"
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <code className="bg-gray-100 px-2 py-1 rounded">{sub.emoji_id || 'Not set'}</code>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  {editingId === sub.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(sub.id, 'subcategories')}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs"
                      >
                        <Save size={14} /> Save
                      </button>
                      <button
                        onClick={handleCancel}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 text-xs"
                      >
                        <X size={14} /> Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEdit(sub.id, sub.emoji_id)}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
                    >
                      <Edit2 size={14} /> Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">🎨 Emoji Manager</h2>
        <p className="text-sm text-gray-500">Manage custom premium emojis for your bot. Changes are automatically reflected in the bot UI.</p>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-lg ${message.includes('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-2 border-b border-gray-200">
          {['system', 'categories', 'products', 'subcategories'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium text-sm whitespace-nowrap border-b-2 transition ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab === 'system' && 'System Items'}
              {tab === 'categories' && 'Categories'}
              {tab === 'products' && 'Products'}
              {tab === 'subcategories' && 'Subcategories'}
            </button>
          ))}
        </div>

        <div className="pt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              {activeTab === 'system' && renderSystemTable()}
              {activeTab === 'categories' && renderCategoryTable()}
              {activeTab === 'products' && renderProductTable()}
              {activeTab === 'subcategories' && renderSubcategoryTable()}
            </>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 md:p-6">
        <h3 className="font-bold text-blue-900 mb-3">📝 How to use:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
          <li>Click "Edit" to change an emoji ID</li>
          <li>Paste your custom Telegram emoji ID (a long number)</li>
          <li>Click "Save" to apply changes</li>
          <li>Changes are reflected in the bot immediately</li>
          <li>If emoji ID is invalid, it will fall back to the standard emoji</li>
        </ul>
      </div>
    </div>
  );
}
