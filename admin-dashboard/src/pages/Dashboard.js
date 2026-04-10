import { useEffect, useState } from "react";
import API from "../api/api";
import { 
  DollarSign, 
  Package, 
  ShoppingCart, 
  Users, 
  Clock,
  CheckCircle,
  XCircle,
  Zap,
  TrendingUp,
  ArrowUp,
  ArrowDown
} from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    approvedOrders: 0,
    completedOrders: 0,
    rejectedOrders: 0,
    totalRevenue: 0,
    totalProducts: 0,
    totalUsers: 0,
    recentOrders: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    try {
      const [ordersRes, productsRes, usersRes] = await Promise.all([
        API.get("/orders"),
        API.get("/products"),
        API.get("/users").catch(() => ({ data: [] }))
      ]);

      const orders = ordersRes.data;
      const products = productsRes.data;
      const users = usersRes.data;

      const pending = orders.filter(o => o.status === "PENDING");
      const approved = orders.filter(o => o.status === "APPROVED");
      const completed = orders.filter(o => o.status === "COMPLETED");
      const rejected = orders.filter(o => o.status === "REJECTED");
      
      const revenue = completed.reduce((sum, o) => sum + parseFloat(o.price_etb || 0), 0);
      const recent = orders.slice(0, 5);

      setStats({
        totalOrders: orders.length,
        pendingOrders: pending.length,
        approvedOrders: approved.length,
        completedOrders: completed.length,
        rejectedOrders: rejected.length,
        totalRevenue: revenue,
        totalProducts: products.length,
        totalUsers: users.length || 0,
        recentOrders: recent
      });
    } catch (error) {
      console.error("Dashboard error:", error);
    }
    setLoading(false);
  }

  const statCards = [
    { title: "Revenue", value: `${stats.totalRevenue} ETB`, icon: DollarSign, color: "bg-green-500", change: "+12%" },
    { title: "Orders", value: stats.totalOrders, icon: ShoppingCart, color: "bg-blue-500", change: "+8%" },
    { title: "Pending", value: stats.pendingOrders, icon: Clock, color: "bg-yellow-500", change: "-2%" },
    { title: "Products", value: stats.totalProducts, icon: Package, color: "bg-purple-500", change: "+5%" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">Dashboard</h2>
        <p className="text-sm text-gray-500">Welcome back! Here's what's happening.</p>
      </div>

      {/* Stats Cards - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="bg-white rounded-lg md:rounded-xl shadow-sm p-4 md:p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-gray-500 mb-1">{card.title}</p>
                  <p className="text-lg md:text-2xl font-bold text-gray-800">{card.value}</p>
                  <div className="flex items-center mt-2">
                    {card.change.startsWith('+') ? (
                      <ArrowUp size={12} className="text-green-500" />
                    ) : (
                      <ArrowDown size={12} className="text-red-500" />
                    )}
                    <span className={`text-xs ${card.change.startsWith('+') ? 'text-green-500' : 'text-red-500'} ml-1`}>
                      {card.change}
                    </span>
                  </div>
                </div>
                <div className={`${card.color} p-2 md:p-3 rounded-full`}>
                  <Icon className="h-4 w-4 md:h-6 md:w-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status Cards Row - Responsive */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg md:rounded-xl p-3 md:p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm opacity-90">Pending</p>
              <p className="text-xl md:text-3xl font-bold mt-1">{stats.pendingOrders}</p>
            </div>
            <Clock className="h-6 w-6 md:h-10 md:w-10 opacity-80" />
          </div>
        </div>
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg md:rounded-xl p-3 md:p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm opacity-90">Approved</p>
              <p className="text-xl md:text-3xl font-bold mt-1">{stats.approvedOrders}</p>
            </div>
            <CheckCircle className="h-6 w-6 md:h-10 md:w-10 opacity-80" />
          </div>
        </div>
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg md:rounded-xl p-3 md:p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm opacity-90">Completed</p>
              <p className="text-xl md:text-3xl font-bold mt-1">{stats.completedOrders}</p>
            </div>
            <Zap className="h-6 w-6 md:h-10 md:w-10 opacity-80" />
          </div>
        </div>
        <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-lg md:rounded-xl p-3 md:p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm opacity-90">Rejected</p>
              <p className="text-xl md:text-3xl font-bold mt-1">{stats.rejectedOrders}</p>
            </div>
            <XCircle className="h-6 w-6 md:h-10 md:w-10 opacity-80" />
          </div>
        </div>
      </div>

      {/* Recent Orders Table - Responsive */}
      <div className="bg-white rounded-lg md:rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 md:p-6 border-b border-gray-100">
          <h3 className="text-base md:text-lg font-semibold text-gray-800">Recent Orders</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-3 md:px-6 py-2 md:py-4 text-sm font-medium text-gray-900">#{order.id}</td>
                  <td className="px-3 md:px-6 py-2 md:py-4 text-sm text-gray-600 truncate max-w-[120px] md:max-w-none">{order.product_name}</td>
                  <td className="px-3 md:px-6 py-2 md:py-4 text-sm text-gray-600">{order.price_etb} ETB</td>
                  <td className="px-3 md:px-6 py-2 md:py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      order.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                      order.status === "APPROVED" ? "bg-blue-100 text-blue-700" :
                      order.status === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-3 md:px-6 py-2 md:py-4 text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}