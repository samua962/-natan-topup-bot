import React, { useEffect, useState } from "react";
import API from "../api/api";
import { 
  Search, Eye, CheckCircle, XCircle, Zap, Clock,
  ChevronLeft, ChevronRight, Filter
} from "lucide-react";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const itemsPerPage = 10;

  async function loadOrders() {
    setLoading(true);
    try {
      const res = await API.get("/orders");
      setOrders(res.data);
    } catch (error) {
      console.error("Load orders error:", error);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function approve(id) {
    if (!window.confirm("Approve this order?")) return;
    try {
      await API.post(`/orders/${id}/approve`);
      loadOrders();
    } catch (error) {
      alert("Failed to approve order");
    }
  }

  async function reject(id) {
    if (!window.confirm("Reject this order?")) return;
    try {
      await API.post(`/orders/${id}/reject`);
      loadOrders();
    } catch (error) {
      alert("Failed to reject order");
    }
  }

  async function complete(id) {
    if (!window.confirm("Mark as completed?")) return;
    try {
      await API.post(`/orders/${id}/complete`);
      loadOrders();
    } catch (error) {
      alert("Failed to complete order");
    }
  }

  const filteredOrders = orders.filter(o => {
    if (filter !== "ALL" && o.status !== filter) return false;
    if (search) {
      return o.id.toString().includes(search) || 
             o.product_name?.toLowerCase().includes(search.toLowerCase()) ||
             o.player_id?.includes(search);
    }
    return true;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusBadge = (status) => {
    const styles = {
      PENDING: "bg-yellow-100 text-yellow-700",
      APPROVED: "bg-blue-100 text-blue-700",
      COMPLETED: "bg-green-100 text-green-700",
      REJECTED: "bg-red-100 text-red-700"
    };
    return styles[status] || "bg-gray-100 text-gray-700";
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case "PENDING": return <Clock size={14} className="mr-1" />;
      case "APPROVED": return <CheckCircle size={14} className="mr-1" />;
      case "COMPLETED": return <Zap size={14} className="mr-1" />;
      case "REJECTED": return <XCircle size={14} className="mr-1" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800">Orders</h2>
          <p className="text-sm text-gray-500">Manage and track all customer orders</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg md:rounded-xl shadow-sm p-3 md:p-4 border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by Order ID, Product, Player ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
              />
            </div>
          </div>
          
          {/* Mobile Filter Dropdown */}
          <div className="relative sm:hidden">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 rounded-lg"
            >
              <Filter size={16} className="mr-2" />
              {filter}
            </button>
            {showFilterMenu && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                {["ALL", "PENDING", "APPROVED", "COMPLETED", "REJECTED"].map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setFilter(status);
                      setShowFilterMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${filter === status ? "bg-yellow-50 text-yellow-600" : ""}`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Desktop Filter Buttons */}
          <div className="hidden sm:flex gap-2">
            {["ALL", "PENDING", "APPROVED", "COMPLETED", "REJECTED"].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1 md:px-4 md:py-2 rounded-lg text-sm transition-colors ${
                  filter === status
                    ? "bg-yellow-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Summary - Mobile Friendly */}
      <div className="grid grid-cols-5 gap-2 md:gap-4">
        <div className="bg-white rounded-lg p-2 md:p-4 text-center border border-gray-100">
          <p className="text-sm md:text-2xl font-bold text-gray-800">{orders.length}</p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
        <div className="bg-white rounded-lg p-2 md:p-4 text-center border border-gray-100">
          <p className="text-sm md:text-2xl font-bold text-yellow-600">{orders.filter(o => o.status === "PENDING").length}</p>
          <p className="text-xs text-gray-500">Pending</p>
        </div>
        <div className="bg-white rounded-lg p-2 md:p-4 text-center border border-gray-100">
          <p className="text-sm md:text-2xl font-bold text-blue-600">{orders.filter(o => o.status === "APPROVED").length}</p>
          <p className="text-xs text-gray-500">Approved</p>
        </div>
        <div className="bg-white rounded-lg p-2 md:p-4 text-center border border-gray-100">
          <p className="text-sm md:text-2xl font-bold text-green-600">{orders.filter(o => o.status === "COMPLETED").length}</p>
          <p className="text-xs text-gray-500">Completed</p>
        </div>
        <div className="bg-white rounded-lg p-2 md:p-4 text-center border border-gray-100">
          <p className="text-sm md:text-2xl font-bold text-red-600">{orders.filter(o => o.status === "REJECTED").length}</p>
          <p className="text-xs text-gray-500">Rejected</p>
        </div>
      </div>

      {/* Mobile Card View */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {paginatedOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-semibold text-gray-800 text-sm">#{order.id}</span>
                    <p className="text-sm text-gray-600 mt-1">{order.product_name}</p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${getStatusBadge(order.status)}`}>
                    {getStatusIcon(order.status)}
                    {order.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mb-3 space-y-1">
                  <div>👤 User: {order.telegram_id}</div>
                  <div>💰 {order.price_etb} ETB</div>
                  <div>📅 {new Date(order.created_at).toLocaleDateString()}</div>
                </div>
                <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100">
                  <button onClick={() => setSelectedOrder(order)} className="p-2 text-blue-500">
                    <Eye size={16} />
                  </button>
                  {order.status === "PENDING" && (
                    <>
                      <button onClick={() => approve(order.id)} className="p-2 text-green-500">
                        <CheckCircle size={16} />
                      </button>
                      <button onClick={() => reject(order.id)} className="p-2 text-red-500">
                        <XCircle size={16} />
                      </button>
                    </>
                  )}
                  {order.status === "APPROVED" && (
                    <button onClick={() => complete(order.id)} className="p-2 text-yellow-500">
                      <Zap size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">#{order.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{order.telegram_id}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{order.product_name}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.price_etb} ETB</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${getStatusBadge(order.status)}`}>
                        {getStatusIcon(order.status)}
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button onClick={() => setSelectedOrder(order)} className="p-1 text-blue-500 hover:text-blue-700">
                          <Eye size={18} />
                        </button>
                        {order.status === "PENDING" && (
                          <>
                            <button onClick={() => approve(order.id)} className="p-1 text-green-500 hover:text-green-700">
                              <CheckCircle size={18} />
                            </button>
                            <button onClick={() => reject(order.id)} className="p-1 text-red-500 hover:text-red-700">
                              <XCircle size={18} />
                            </button>
                          </>
                        )}
                        {order.status === "APPROVED" && (
                          <button onClick={() => complete(order.id)} className="p-1 text-yellow-500 hover:text-yellow-700">
                            <Zap size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
              <p className="text-xs md:text-sm text-gray-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length} orders
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

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6 border-b border-gray-100 sticky top-0 bg-white">
              <div className="flex justify-between items-center">
                <h3 className="text-lg md:text-xl font-bold text-gray-800">Order #{selectedOrder.id}</h3>
                <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
            </div>
            <div className="p-4 md:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs md:text-sm text-gray-500">Product</p>
                  <p className="text-sm md:text-base font-medium">{selectedOrder.product_name}</p>
                </div>
                <div>
                  <p className="text-xs md:text-sm text-gray-500">Amount</p>
                  <p className="text-sm md:text-base font-medium">{selectedOrder.price_etb} ETB</p>
                </div>
                <div>
                  <p className="text-xs md:text-sm text-gray-500">Player ID</p>
                  <p className="text-sm md:text-base font-mono">{selectedOrder.player_id || "-"}</p>
                </div>
                <div>
                  <p className="text-xs md:text-sm text-gray-500">Status</p>
                  <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${getStatusBadge(selectedOrder.status)}`}>
                    {getStatusIcon(selectedOrder.status)}
                    {selectedOrder.status}
                  </span>
                </div>
              </div>
              {selectedOrder.user_inputs && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">User Information</p>
                  <div className="bg-gray-50 rounded-lg p-3 md:p-4 overflow-x-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap">
                      {JSON.stringify(JSON.parse(selectedOrder.user_inputs), null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 md:p-6 border-t border-gray-100 flex flex-wrap justify-end gap-2">
              <button onClick={() => setSelectedOrder(null)} className="px-3 py-2 md:px-4 md:py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
                Close
              </button>
              {selectedOrder.status === "PENDING" && (
                <>
                  <button onClick={() => { approve(selectedOrder.id); setSelectedOrder(null); }} className="px-3 py-2 md:px-4 md:py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm">
                    Approve
                  </button>
                  <button onClick={() => { reject(selectedOrder.id); setSelectedOrder(null); }} className="px-3 py-2 md:px-4 md:py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm">
                    Reject
                  </button>
                </>
              )}
              {selectedOrder.status === "APPROVED" && (
                <button onClick={() => { complete(selectedOrder.id); setSelectedOrder(null); }} className="px-3 py-2 md:px-4 md:py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm">
                  Complete Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}