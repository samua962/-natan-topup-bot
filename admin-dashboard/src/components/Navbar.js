import { Link } from "react-router-dom";
import { Menu, Bell, User, LogOut, Settings, Zap } from "lucide-react";
import { useState, useEffect } from "react";

export default function Navbar({ setSidebarOpen, onLogout }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const adminUser = JSON.parse(localStorage.getItem("adminUser") || "{}");

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
      <div className="flex items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center">
          <button
            onClick={() => setSidebarOpen(prev => !prev)}
            className="text-gray-500 hover:text-gray-700 md:mr-4"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center space-x-2 ml-2">
            <Zap className="h-5 w-5 text-yellow-500 md:h-6 md:w-6" />
            <h1 className="text-base md:text-xl font-semibold text-gray-800">Admin Panel</h1>
          </div>
        </div>

        <div className="flex items-center space-x-3 md:space-x-4">
          <button className="relative text-gray-500 hover:text-gray-700">
            <Bell size={20} />
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
              3
            </span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 text-gray-700 hover:text-gray-900"
            >
              <div className="h-8 w-8 rounded-full bg-yellow-500 flex items-center justify-center text-white font-semibold text-sm">
                {adminUser.username ? adminUser.username.charAt(0).toUpperCase() : "A"}
              </div>
              <span className="hidden sm:inline text-sm">{adminUser.username || "Admin"}</span>
            </button>

            {showUserMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <Link 
                    to="/profile" 
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <User size={16} className="mr-2" />
                    Profile
                  </Link>
                  <Link 
                    to="/settings" 
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <Settings size={16} className="mr-2" />
                    Settings
                  </Link>
                  <div className="border-t border-gray-100 my-1"></div>
                  <button 
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout();
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                  >
                    <LogOut size={16} className="mr-2" />
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}