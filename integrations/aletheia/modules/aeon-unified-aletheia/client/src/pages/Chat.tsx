import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Zap, Brain } from "lucide-react";
import { Streamdown } from "streamdown";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

interface Message {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string | null;
  createdAt: Date;
}

interface ChatSession {
  id: number;
  title: string;
  model: string;
  createdAt: Date;
  updatedAt: Date;
}

export default function Chat() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState<"ionos" | "gemini">("ionos");
  const [usePredictionMode, setUsePredictionMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const createSession = trpc.chat.createSession.useMutation();
  const getSession = trpc.chat.getSession.useQuery(
    { sessionId: sessionId || 0 },
    { enabled: !!sessionId }
  );
  const sendMessage = trpc.chat.sendMessage.useMutation();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!sessionId && isAuthenticated) {
      createSession.mutate(
        { model: selectedModel },
        {
          onSuccess: (session) => {
            setSessionId(session.id);
          },
        }
      );
    }
  }, [isAuthenticated, sessionId, selectedModel, createSession]);

  useEffect(() => {
    if (getSession.data && sessionId) {
      setMessages(
        getSession.data.messages
          .filter((msg) => msg.role !== "system")
          .map((msg) => ({
            ...msg,
            createdAt: new Date(msg.createdAt),
          }))
      );
    }
  }, [getSession.data, sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !sessionId || isLoading) return;

    const userMessage = inputValue;
    setInputValue("");
    setIsLoading(true);

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: "user",
        content: userMessage,
        createdAt: new Date(),
      },
    ]);

    try {
      const response = await sendMessage.mutateAsync({
        sessionId,
        message: userMessage,
        usePredictionMode,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: response.message.id,
          role: "assistant",
          content: response.message.content,
          model: response.message.model,
          createdAt: new Date(response.message.createdAt),
        },
      ]);
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <div className="border-b border-slate-700 bg-slate-900/50 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              Aletheia
            </h1>
            <p className="text-sm text-slate-400">Advanced AI Assistant with ELF Framework</p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as "ionos" | "gemini")}>
              <SelectTrigger className="w-40 bg-slate-800 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ionos">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    IONOS Custom
                  </div>
                </SelectItem>
                <SelectItem value="gemini">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    Google Gemini
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={usePredictionMode ? "default" : "outline"}
              size="sm"
              onClick={() => setUsePredictionMode(!usePredictionMode)}
              className="gap-2"
            >
              <Zap className="w-4 h-4" />
              Prediction
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <Brain className="w-16 h-16 mx-auto text-slate-600 mb-4" />
              <h2 className="text-xl font-semibold text-slate-300 mb-2">Start a Conversation</h2>
              <p className="text-slate-400 max-w-md">
                Ask me anything. I use the Entropic-Lagrangian Framework for advanced reasoning and philosophical depth.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <Card
                className={`max-w-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-0"
                    : "bg-slate-800 text-slate-100 border-slate-700"
                }`}
              >
                {msg.role === "assistant" ? (
                  <Streamdown>{msg.content}</Streamdown>
                ) : msg.role === "user" ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : null}
                {msg.model && (
                  <p className="text-xs mt-2 opacity-70">
                    {msg.model === "ionos" ? "IONOS Custom" : "Google Gemini"}
                  </p>
                )}
              </Card>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <Card className="bg-slate-800 border-slate-700 px-4 py-3">
              <div className="flex items-center gap-2 text-slate-300">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Thinking...</span>
              </div>
            </Card>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-slate-700 bg-slate-900/50 px-6 py-4 backdrop-blur">
        <div className="flex gap-3">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Ask me anything..."
            className="flex-1 bg-slate-800 border-slate-700 text-white placeholder-slate-500"
            disabled={isLoading}
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 gap-2"
          >
            <Send className="w-4 h-4" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
