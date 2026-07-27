import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Phone, Mail, Scan, ChevronDown, User, LogIn, LogOut, LayoutDashboard, ListTodo, Inbox } from 'lucide-react';
import WhatsAppButton from '@/components/WhatsAppButton';
import BrandLogo from '@/components/BrandLogo';
import { useAuth } from '@/context/AuthContext';
import { isCurrentUserAdmin } from '@/services/whatsappAdminService';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useSiteLabel } from '@/hooks/useSiteLabel';
import { useSiteContent } from '@/hooks/useSiteContent';

const DEFAULT_LANDING_MENU = [
  { key: 'home', label: 'Home', path: '/' },
  { key: 'trainings', label: 'Training', path: '/trainings' },
  { key: 'events', label: 'Events', path: '/events' },
  { key: 'register', label: 'Register Now', path: '/register-now' },
  { key: 'apply', label: 'Apply Now', path: '/apply-now', special: true },
  { key: 'gallery', label: 'Gallery', path: '/gallery' },
  { key: 'about', label: 'About Us', path: '/about' },
  { key: 'shareholders', label: 'Shareholders', path: '/shareholders' },
  { key: 'contact', label: 'Contact Us', path: '/contact' },
  { key: 'qr', label: 'QR Scanner', path: '/qr-scanner', icon: 'scan' },
];

function Header() {
  const tl = useSiteLabel();
  const { landingMenu } = useSiteContent();
  const navItems = landingMenu?.length ? landingMenu : DEFAULT_LANDING_MENU;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, otpVerified, logout, profile, isProfileLoading, role } = useAuth();

  const isStaffRole = ['staff', 'employee', 'teacher', 'task_assignee'].includes(String(role || profile?.role || '').toLowerCase());

  // Check admin status when user changes
  useEffect(() => {
    let isMounted = true;
    
    const checkAdminStatus = async () => {
      if (!user || !otpVerified) {
        if (isMounted) {
          setIsAdmin(false);
          setCheckingAdmin(false);
        }
        return;
      }

      setCheckingAdmin(true);
      try {
        const adminStatus = await isCurrentUserAdmin();
        if (isMounted) {
          setIsAdmin(adminStatus);
        }
      } catch (error) {
        console.error('Header: Error checking admin status:', error);
        if (isMounted) setIsAdmin(false);
      } finally {
        if (isMounted) setCheckingAdmin(false);
      }
    };

    checkAdminStatus();

    return () => {
      isMounted = false;
    };
  }, [user, otpVerified]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => {
    if (path === '/' && location.pathname !== '/') return false;
    return location.pathname.startsWith(path);
  };

  const NavLink = ({ to, children, isSpecial }) => (
    <Link
      to={to}
      className={`text-sm xl:text-base font-medium transition-colors duration-300 ${
        isActive(to)
          ? 'text-[#D4AF37] border-b-2 border-[#D4AF37] pb-1'
          : isSpecial ? 'text-[#D4AF37] hover:text-white font-bold' : 'text-white hover:text-[#D4AF37]'
      }`}
    >
      {children}
    </Link>
  );

  return (
    <>
      <header className="bg-[#003D82] sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2 bg-transparent">
              <BrandLogo
                alt="Company Logo"
                className="h-[40px] md:h-[50px] lg:h-[60px] w-auto object-contain hover:scale-105 hover:opacity-90 transition-all duration-300"
                variant="onDark"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-4 xl:space-x-6">
              {navItems.map((item) => {
                if (item.key === 'qr' || item.icon === 'scan') {
                  return (
                    <Link
                      key={item.key}
                      to={item.path}
                      className={`text-white hover:text-[#D4AF37] transition-colors flex items-center gap-1 text-sm border border-white/20 px-2 py-1 rounded-md hover:border-[#D4AF37] ${isActive(item.path) ? 'border-[#D4AF37] text-[#D4AF37]' : ''}`}
                      title={tl('menu', item.label || 'QR Code Scanner')}
                    >
                      <Scan className="w-4 h-4" />
                      <span className="hidden xl:inline">{tl('menu', 'Scan QR')}</span>
                    </Link>
                  );
                }
                return (
                  <NavLink key={item.key} to={item.path} isSpecial={Boolean(item.special)}>
                    {tl('menu', item.label)}
                  </NavLink>
                );
              })}

              <LanguageSwitcher variant="header" />
            </nav>

            {/* Desktop Contact Links & Login */}
            <div className="hidden lg:flex items-center space-x-4">
              <a
                href="tel:+250794006160"
                className="flex items-center space-x-2 text-white hover:text-[#D4AF37] transition-colors"
                title="Call Us"
              >
                <Phone className="w-5 h-5" />
              </a>
              <a
                href="https://mail.hostinger.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 text-white hover:text-[#D4AF37] transition-colors mr-2"
                title="Webmail Login"
              >
                <Mail className="w-5 h-5" />
              </a>

              {user && otpVerified ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2 pl-2 pr-4 h-10 hover:bg-white/10 text-white border border-transparent hover:border-white/20 rounded-full">
                      <Avatar className="h-8 w-8 border-2 border-[#D4AF37]">
                        <AvatarImage src={profile?.avatar_url} />
                        <AvatarFallback className="bg-[#D4AF37] text-[#003D82] font-bold">
                          {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col items-start text-xs hidden xl:flex">
                        <span className="font-bold max-w-[100px] truncate">
                          {isProfileLoading ? tl('menu', 'Loading...') : (profile?.full_name || user.email?.split('@')[0])}
                        </span>
                        <span className="text-[#D4AF37] uppercase text-[10px] tracking-wider">
                          {checkingAdmin ? tl('menu', 'Checking...') : (isAdmin ? tl('menu', 'Administrator') : tl('menu', 'User'))}
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-white">
                    <div className="px-2 py-1.5 text-sm font-semibold border-b mb-1 text-gray-700 bg-gray-50/50">
                      {tl('menu', 'My Account')}
                    </div>
                    {isAdmin && (
                      <DropdownMenuItem asChild>
                        <Link to="/admin/dashboard" className="cursor-pointer">
                          <LayoutDashboard className="w-4 h-4 mr-2" /> {tl('menu', 'Admin Dashboard')}
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {isStaffRole && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to="/user/tasks" className="cursor-pointer">
                            <ListTodo className="w-4 h-4 mr-2" /> {tl('menu', 'My Tasks')}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/user/tasks/pending-acceptances" className="cursor-pointer">
                            <Inbox className="w-4 h-4 mr-2" /> {tl('menu', 'Pending Acceptances')}
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 cursor-pointer">
                      <LogOut className="w-4 h-4 mr-2" /> {tl('menu', 'Logout')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link to="/login">
                  <Button 
                    className="bg-[#002855] border border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#003D82] font-medium transition-all"
                  >
                    <LogIn className="w-4 h-4 mr-2" /> {tl('menu', 'Login')}
                  </Button>
                </Link>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden text-white hover:text-[#D4AF37] transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden pb-4 animate-slide-in-from-top bg-[#003D82] absolute left-0 right-0 top-20 px-4 shadow-xl border-t border-gray-800 z-50 overflow-y-auto max-h-[calc(100vh-5rem)]">
              <nav className="flex flex-col space-y-4 pt-4 pb-10">
                <div className="flex justify-end pb-2 border-b border-gray-700">
                  <LanguageSwitcher variant="header" />
                </div>
                {navItems.map((item) => {
                  if (item.key === 'qr' || item.icon === 'scan') {
                    return (
                      <Link
                        key={item.key}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2 text-lg font-medium text-white hover:text-[#D4AF37] pt-2 border-t border-gray-700"
                      >
                        <Scan className="w-5 h-5" /> {tl('menu', item.label || 'Scan QR Code')}
                      </Link>
                    );
                  }
                  const special = Boolean(item.special);
                  return (
                    <Link
                      key={item.key}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={
                        special
                          ? 'text-[#D4AF37] font-bold text-lg flex items-center gap-2 bg-white/10 p-2 rounded-md'
                          : 'text-white hover:text-[#D4AF37] text-lg font-medium'
                      }
                    >
                      {tl('menu', item.label)}
                    </Link>
                  );
                })}

                <div className="pt-4 border-t border-gray-700 space-y-3">
                  {user && otpVerified ? (
                    <>
                      <div className="flex items-center gap-3 mb-2 px-2">
                        <Avatar className="h-10 w-10 border-2 border-[#D4AF37]">
                          <AvatarImage src={profile?.avatar_url} />
                          <AvatarFallback className="bg-[#D4AF37] text-[#003D82] font-bold">
                            {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-white font-bold">{profile?.full_name || user.email?.split('@')[0]}</p>
                          <p className="text-[#D4AF37] text-xs uppercase">
                            {checkingAdmin ? tl('menu', 'Checking...') : (isAdmin ? tl('menu', 'Administrator') : tl('menu', 'User'))}
                          </p>
                        </div>
                      </div>

                      {isAdmin && (
                        <Link 
                          to="/admin/dashboard"
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center justify-center gap-2 w-full py-2 rounded bg-[#D4AF37] text-[#003D82] font-bold"
                        >
                          <LayoutDashboard className="w-5 h-5" /> {tl('menu', 'Admin Dashboard')}
                        </Link>
                      )}

                      {isStaffRole && (
                        <>
                          <Link
                            to="/user/tasks"
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center justify-center gap-2 w-full py-2 rounded border border-white/20 text-white"
                          >
                            <ListTodo className="w-5 h-5" /> {tl('menu', 'My Tasks')}
                          </Link>
                          <Link
                            to="/user/tasks/pending-acceptances"
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center justify-center gap-2 w-full py-2 rounded border border-white/20 text-white"
                          >
                            <Inbox className="w-5 h-5" /> {tl('menu', 'Pending Acceptances')}
                          </Link>
                        </>
                      )}
                      
                      <Button
                        onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                        variant="outline"
                        className="w-full text-white border-white/20 hover:bg-white/10"
                      >
                        <LogOut className="w-4 h-4 mr-2" /> {tl('menu', 'Logout')}
                      </Button>
                    </>
                  ) : (
                    <Link 
                      to="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-center gap-2 w-full py-2 rounded border border-[#D4AF37] text-[#D4AF37] font-medium"
                    >
                      <LogIn className="w-5 h-5" /> {tl('menu', 'Portal Login')}
                    </Link>
                  )}
                </div>

                <div className="pt-2 space-y-3 border-t border-gray-700 mt-2">
                  <a
                    href="tel:+250794006160"
                    className="flex items-center space-x-2 text-white hover:text-[#D4AF37] transition-colors"
                  >
                    <Phone className="w-5 h-5" />
                    <span>+250 794 006 160</span>
                  </a>
                  <a
                    href="https://mail.hostinger.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-white hover:text-[#D4AF37] transition-colors mt-2"
                  >
                    <Mail className="w-5 h-5" />
                    <span>{tl('menu', 'Webmail Login')}</span>
                  </a>
                </div>
              </nav>
            </div>
          )}
        </div>
      </header>
      {!location.pathname.startsWith('/shareholders') && (
        <WhatsAppButton variant="floating" className="fixed bottom-6 right-6 z-50" />
      )}
    </>
  );
}

export default Header;