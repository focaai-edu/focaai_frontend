import Sidebar from './Sidebar';

export default function Layout({ children, role = 'student' }) {
  return (
    <div className="flex min-h-screen bg-[#F1F5F9] dark:bg-[#0F172A]">
      <Sidebar role={role} />
      <main className="flex-1 ml-[240px] p-8 text-gray-900 dark:text-[#F1F5F9] min-h-screen" role="main">
        {children}
      </main>
    </div>
  );
}
