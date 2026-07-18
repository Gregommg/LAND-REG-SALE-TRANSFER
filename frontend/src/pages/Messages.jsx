import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { messageService } from "../api/services";
import Layout from "../components/Layout";
import Alert from "../components/Alert";
import "../styles/Messages.css";

const POLL_INTERVAL_MS = 5000;

export default function Messages() {
  const { user } = useAuth();
  const { userId: activeUserIdParam } = useParams();
  const navigate = useNavigate();
  const activeUserId = activeUserIdParam ? Number(activeUserIdParam) : null;

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [text, setText] = useState("");
  const [message, setMessage] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await messageService.listConversations();
      setConversations(data);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load conversations." });
    } finally {
      setLoadingList(false);
    }
  }, []);

  const fetchActiveConversation = useCallback(async () => {
    if (!activeUserId) {
      setActiveConversation(null);
      return;
    }
    try {
      const { data } = await messageService.getConversation(activeUserId);
      setActiveConversation(data);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to load conversation." });
    }
  }, [activeUserId]);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  useEffect(() => {
    fetchActiveConversation();
    const interval = setInterval(fetchActiveConversation, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchActiveConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation]);

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim() || !activeUserId) return;
    setSending(true);
    try {
      await messageService.send(activeUserId, text.trim());
      setText("");
      await fetchActiveConversation();
      await fetchConversations();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to send message." });
    } finally {
      setSending(false);
    }
  }

  return (
    <Layout>
      <div className="page-header">
        <h2>Messages</h2>
        <p>Private one-to-one messages, encrypted at rest. Only you and the other person can read the content.</p>
      </div>

      <Alert type={message?.type} message={message?.text} onClose={() => setMessage(null)} />

      <div className="messages-layout">
        <aside className="conversation-list">
          {loadingList ? (
            <p className="muted">Loading...</p>
          ) : conversations.length === 0 ? (
            <p className="muted">No conversations yet. Start one from a transaction's details.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.userId}
                className={`conversation-item ${c.userId === activeUserId ? "active" : ""}`}
                onClick={() => navigate(`/messages/${c.userId}`)}
              >
                <span className="conversation-name">
                  {c.fullName}
                  {c.unreadCount > 0 && <span className="unread-dot">{c.unreadCount}</span>}
                </span>
                <span className="conversation-preview">
                  {c.lastMessageFromMe ? "You: " : ""}
                  {c.lastMessage}
                </span>
              </button>
            ))
          )}
        </aside>

        <section className="chat-panel">
          {!activeUserId ? (
            <div className="chat-empty">Select a conversation to view messages.</div>
          ) : !activeConversation ? (
            <div className="chat-empty">Loading conversation...</div>
          ) : (
            <>
              <div className="chat-header">
                <strong>{activeConversation.otherUser.full_name}</strong>
              </div>
              <div className="chat-messages">
                {activeConversation.messages.length === 0 ? (
                  <p className="muted chat-empty-messages">No messages yet - say hello.</p>
                ) : (
                  activeConversation.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`chat-bubble ${m.senderId === user.id ? "chat-bubble-mine" : "chat-bubble-theirs"}`}
                    >
                      <p>{m.text}</p>
                      <span className="chat-bubble-time">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <form className="chat-input-row" onSubmit={handleSend}>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a message..."
                  maxLength={2000}
                />
                <button className="btn btn-primary" type="submit" disabled={sending || !text.trim()}>
                  Send
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </Layout>
  );
}
