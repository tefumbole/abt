import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

function MainLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-grow pb-[5.75rem] sm:pb-[4.75rem]">
        {children || <Outlet />}
      </main>
      <Footer />
    </div>
  );
}

export default MainLayout;