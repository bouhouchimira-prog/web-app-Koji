'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

export default function DashboardShell({
  children
}: {
  children: React.ReactNode
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#F6F7FB]">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-[#0E172C] rounded-lg border border-gray-800 flex items-center justify-center overflow-hidden shrink-0">
            <img src="/logo.png" alt="Koji Logo" className="w-full h-full object-contain p-0.5" />
          </div>
          <span className="font-outfit font-bold text-[18px] text-[#0E172C] tracking-tight">Koji Admin</span>
        </div>
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 -mr-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content */}
      <main className={`min-h-screen flex flex-col transition-all duration-300 ${isSidebarOpen ? 'overflow-hidden' : ''} md:pl-[264px]`}>
        <TopBar />
        <div className="max-w-7xl mx-auto w-full p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  )
}
