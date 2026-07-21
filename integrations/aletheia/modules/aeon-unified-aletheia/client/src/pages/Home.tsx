import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, Brain, Zap, MessageCircle } from "lucide-react";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-2xl">
            <div className="mb-8">
              <Brain className="w-20 h-20 mx-auto text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-4" />
              <h1 className="text-5xl font-bold text-white mb-4">Aletheia</h1>
              <p className="text-xl text-slate-300 mb-2">Advanced AI Assistant</p>
              <p className="text-slate-400">Powered by the Entropic-Lagrangian Framework</p>
            </div>
            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-4 text-left">
                <Zap className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-white">Dual AI Backends</h3>
                  <p className="text-slate-400 text-sm">IONOS custom model + Google Gemini for enhanced capabilities</p>
                </div>
              </div>
              <div className="flex items-start gap-4 text-left">
                <Brain className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-white">ELF Framework</h3>
                  <p className="text-slate-400 text-sm">Entropic-Lagrangian Framework for advanced reasoning and philosophical depth</p>
                </div>
              </div>
              <div className="flex items-start gap-4 text-left">
                <MessageCircle className="w-6 h-6 text-purple-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-white">Prediction Engine</h3>
                  <p className="text-slate-400 text-sm">Forecasting and analysis with Reverse Solver system</p>
                </div>
              </div>
            </div>
            <Button
              onClick={() => window.location.href = getLoginUrl()}
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white px-8 py-3 rounded-lg font-semibold text-lg"
            >
              Sign In to Start
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Welcome, {user?.name || "User"}!</h1>
          <p className="text-slate-300 mb-8">Ready to explore advanced AI conversations?</p>
          <Link href="/chat">
            <Button className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white px-8 py-3 rounded-lg font-semibold text-lg gap-2">
              <MessageCircle className="w-5 h-5" />
              Start Chatting
            </Button>
          </Link>
          <Button
            onClick={logout}
            variant="outline"
            className="ml-4 border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
