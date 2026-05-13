import { Link } from 'react-router';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center p-8">
      <div className="bg-white rounded-xl border border-gray-200 p-10 max-w-sm w-full text-center">
        <h1 className="text-7xl font-bold text-[#1B4F81] m-0 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Página não encontrada</h2>
        <p className="text-gray-500 mb-8">A página que você procura não existe.</p>
        <Link to="/" className="inline-block px-6 py-3 rounded-lg bg-[#1B4F81] text-white no-underline text-sm font-semibold hover:bg-[#164572] transition-colors">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
