import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  FolderTree, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  Menu,
  X
} from "lucide-react";
import { useState, useEffect } from "react";

export default function Sidebar({ sidebarOpen, setSidebarOpen }) {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const menuItems = [
    { path: "/", name: "Dashboard", icon: LayoutDashboard },
    { path: "/products", name: "Products", icon: Package },
    { path: "/orders", name: "Orders", icon: ShoppingCart },
    { path: "/categories", name: "Categories", icon: FolderTree },
    { path: "/settings", name: "Settings", icon: Settings },
  ];

  // Mobile overlay
  if (isMobile && sidebarOpen) {
    return (
      <>
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
        <div className="fixed left-0 top-0 h-full w-64 bg-gray-900 text-white z-50 shadow-xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <div className="flex items-center space-x-2">
              <Zap className="h-6 w-6 text-yellow-500" />
              <span className="font-bold text-lg">Natan TopUp</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
          <nav className="flex-1 mt-6">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center px-4 py-3 mx-2 mb-1 rounded-lg transition-colors ${
                    isActive
                      ? "bg-yellow-500 text-gray-900"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  <Icon size={20} />
                  <span className="ml-3">{item.name}</span>
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-gray-800 text-xs text-gray-500">
            <p>© 2026 Natan TopUp</p>
            <p>Version 2.0.0</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className={`${sidebarOpen ? "w-64" : "w-20"} bg-gray-900 text-white transition-all duration-300 flex flex-col hidden md:flex`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        {sidebarOpen ? (
          <div className="flex items-center space-x-2">
            <Zap className="h-6 w-6 text-yellow-500" />
            <span className="font-bold text-lg">Natan TopUp</span>
          </div>
        ) : (
          <Zap className="h-6 w-6 text-yellow-500 mx-auto" />
        )}
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white">
          {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>
      <nav className="flex-1 mt-6">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-4 py-3 mx-2 mb-1 rounded-lg transition-colors ${
                isActive
                  ? "bg-yellow-500 text-gray-900"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <Icon size={20} />
              {sidebarOpen && <span className="ml-3">{item.name}</span>}
            </Link>
          );
        })}
      </nav>
      {sidebarOpen && (
        <div className="p-4 border-t border-gray-800 text-xs text-gray-500">
          <p>© 2026 Natan TopUp</p>
          <p>Version 2.0.0</p>
        </div>
      )}
    </div>
  );
}