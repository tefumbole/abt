import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Inbox, ListTodo, LogOut, UserCog } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

const navItems = [
  { label: 'Pending Tasks', path: '/user/tasks/pending-acceptances', icon: Inbox },
  { label: 'My Tasks', path: '/user/tasks', icon: ListTodo },
  { label: 'Profile', path: '/user/profile', icon: UserCog },
];

function TaskAssigneeLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#003D82] text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo alt="Alpha Bridge" className="h-10 w-auto" variant="onDark" />
            <div>
              <p className="text-sm font-semibold">Task Portal</p>
              <p className="text-xs text-blue-100">{profile?.full_name || user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" className="text-white hover:bg-white/10" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
        <nav className="border-t border-white/10">
          <div className="max-w-6xl mx-auto px-4 flex gap-1">
            {navItems.map(({ label, path, icon: Icon }) => {
              const active = location.pathname === path || location.pathname.startsWith(`${path}/`);
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    active
                      ? 'border-[#D4AF37] text-[#D4AF37]'
                      : 'border-transparent text-blue-100 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        {children || <Outlet />}
      </main>
    </div>
  );
}

export default TaskAssigneeLayout;
