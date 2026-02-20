
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { 
  Home, 
  User, 
  FileText, 
  Calendar, 
  Newspaper,
  Bell, 
  LogOut,
  Building
} from 'lucide-react';

const Navbar = () => {
  const { profile, isAuthenticated, signOut } = useEmployeeAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!isAuthenticated || !profile) return null;

  const navItems = [
    { to: '/dashboard', icon: Home, label: 'หน้าหลัก' },
    { to: '/profile', icon: User, label: 'โปรไฟล์' },
    { to: '/leave-requests', icon: Calendar, label: 'ขอลา' },
    { to: '/newsfeed', icon: Newspaper, label: 'นิวส์ฟีด' },
    { to: '/documents', icon: FileText, label: 'เอกสารราชการ' },
    { to: '/notifications', icon: Bell, label: 'แจ้งเตือน' },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-sky-500 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center space-x-3">
            <Building className="h-8 w-8 text-white" />
            <div className="text-white">
              <div className="text-lg font-bold">RSEC6 OfficeHub</div>
              <div className="text-xs opacity-90">ศูนย์การศึกษาพิเศษ เขตการศึกษา 6</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === item.to
                    ? 'bg-white/20 text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <item.icon className="h-4 w-4 mr-2" />
                {item.label}
              </Link>
            ))}
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            <div className="text-white text-sm">
              <div className="font-medium">{profile?.first_name} {profile?.last_name}</div>
              <div className="text-xs opacity-80">{profile?.employee_id}</div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center px-3 py-2 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            >
              <LogOut className="h-4 w-4 mr-2" />
              ออกจากระบบ
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden bg-blue-700/50 px-4 py-2">
        <div className="flex justify-around">
          {navItems.slice(0, 5).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
                location.pathname === item.to
                  ? 'text-white'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
