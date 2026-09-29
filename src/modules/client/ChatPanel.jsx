import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { io } from "socket.io-client";

import {
  X,
  Search,
  Plus,
  Send,
  Video,
  Smile,
  PinOff,
  Pin,
  Bell,
  BellOff,
  Star,
  Loader2,
  Camera,
  Pencil,
  Users,
  AlertCircle,
  MessageSquare,
  ChevronLeft,
  Check,
  Archive,
  Mail,
  Reply,
  MoreVertical,
  Copy,
  Info,
  Forward,
  Trash2,
  Eraser,
  ListChecks,
  Square,
  CheckSquare,
} from "lucide-react";

import { apiRequest, API_URL } from "../../lib/api";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function initialsOf(name) {
  return String(name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

const AVATAR_GRADIENTS = [
  "from-indigo-500 to-violet-500",
  "from-rose-400 to-pink-500",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-fuchsia-400 to-purple-500",
  "from-cyan-400 to-sky-500",
];

function avatarGradient(name) {
  const str = String(name || "?");
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDay(iso) {
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (isToday) return "Today";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return "—";
  return value.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const EMOJI_CATEGORIES = {
  Smileys: [
    "😀","😃","😄","😁","😆","😅","😂","🤣","🥲","☺️","😊","😇","🙂","🙃","😉","😌",
    "😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥸",
    "🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢",
    "😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔",
    "🫣","🤭","🫢","🫡","🤫","🫠","🤥","😶","🫥","😐","🫤","😑","😬","🙄","😯","😦",
    "😧","😮","😲","🥱","😴","🤤","😪","😵","😵‍💫","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕",
  ],
  People: [
    "👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","👌","🤌","🤏","✌️","🤞","🫰","🤟",
    "🤘","🤙","👈","👉","👆","👇","☝️","🫵","👍","👎","✊","👊","🤛","🤜","👏","🙌",
    "🫶","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦿","🦵","🦶","👂","👃","🧠",
    "🫀","🫁","🦷","🦴","👀","👁️","👅","👄","🫦","👶","🧒","👦","👧","🧑","👱","👨",
    "👩","🧔","👴","👵","🙍","🙎","🙅","🙆","💁","🙋","🧏","🙇","🤦","🤷","👮","👷",
    "💂","🕵️","👩‍⚕️","👨‍⚕️","👩‍🎓","👨‍🎓","👩‍💻","👨‍💻","👩‍💼","👨‍💼","👩‍🔧","👨‍🔧",
  ],
  Animals: [
    "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷","🐽","🐸",
    "🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦅","🦉","🦇","🐺",
    "🐗","🐴","🦄","🐝","🪱","🐛","🦋","🐌","🐞","🐜","🪰","🪲","🪳","🦟","🦗","🕷️",
    "🦂","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳",
    "🐋","🦈","🐊","🐅","🐆","🦓","🦍","🦧","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🦬",
    "🐃","🐂","🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩","🦮","🐕‍🦺","🐈","🐓",
  ],
  Food: [
    "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥",
    "🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🫒","🧄","🧅","🥔","🍠",
    "🥐","🥯","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🌭",
    "🍔","🍟","🍕","🫓","🥪","🥙","🧆","🌮","🌯","🫔","🥗","🥘","🫕","🥫","🍝","🍜",
    "🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧",
    "🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","☕",
  ],
  Activities: [
    "⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🏒","🏑","🥍",
    "🏏","🪃","🥅","⛳","🪁","🏹","🎣","🤿","🥊","🥋","🎽","🛹","🛼","🛷","⛸️","🥌",
    "🎿","⛷️","🏂","🪂","🏋️","🤼","🤸","⛹️","🤺","🤾","🏌️","🏇","🧘","🏄","🏊","🤽",
    "🚣","🧗","🚵","🚴","🏆","🥇","🥈","🥉","🏅","🎖️","🏵️","🎗️","🎫","🎟️","🎪","🤹",
    "🎭","🩰","🎨","🎬","🎤","🎧","🎼","🎹","🥁","🪘","🎷","🎺","🪗","🎸","🪕","🎻",
    "🎲","♟️","🎯","🎳","🎮","🎰","🧩",
  ],
  Travel: [
    "🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🏍️","🛵",
    "🚲","🛴","🛹","🛼","🚨","🚔","🚍","🚘","🚖","🚡","🚠","🚟","🚃","🚋","🚞","🚝",
    "🚄","🚅","🚈","🚂","🚆","🚇","🚊","🚉","✈️","🛫","🛬","🛩️","💺","🛰️","🚀","🛸",
    "🚁","🛶","⛵","🚤","🛥️","🛳️","⛴️","🚢","⚓","🛟","⛽","🚧","🚦","🚥","🗺️","🗿",
    "🗽","🗼","🏰","🏯","🏟️","🎡","🎢","🎠","⛲","⛱️","🏖️","🏝️","🏜️","🌋","⛰️","🏕️",
    "🏠","🏡","🏢","🏥","🏦","🏨","🏪","🏫","🏬","🏭","🏛️","⛪","🕌","🛕","🕍","🌃",
  ],
  Objects: [
    "⌚","📱","📲","💻","⌨️","🖥️","🖨️","🖱️","🖲️","🕹️","🗜️","💽","💾","💿","📀","📼",
    "📷","📸","📹","🎥","📽️","🎞️","📞","☎️","📟","📠","📺","📻","🎙️","🎚️","🎛️","🧭",
    "⏱️","⏲️","⏰","🕰️","⌛","⏳","📡","🔋","🪫","🔌","💡","🔦","🕯️","🧯","🛢️","💸",
    "💵","💴","💶","💷","🪙","💰","💳","💎","⚖️","🪜","🧰","🪛","🔧","🔨","⚒️","🛠️",
    "⛏️","🪚","🔩","⚙️","🧱","⛓️","🧲","🔫","💣","🧨","🪓","🔪","🗡️","🛡️","🚬","⚰️",
    "🔮","📿","🧿","💈","⚗️","🔭","🔬","🕳️","🩹","🩺","💊","💉","🩸","🧬","🦠","🧫",
  ],
  Symbols: [
    "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","❣️","💕","💞","💓",
    "💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️","☦️","🛐",
    "⛎","♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","🆔","⚛️","🉑",
    "☢️","☣️","📴","📳","🈶","🈚","🈸","🈺","🈷️","✴️","🆚","💮","🉐","㊙️","㊗️","🈴",
    "🈵","🈹","🈲","🅰️","🅱️","🆎","🆑","🅾️","🆘","❌","⭕","🛑","⛔","📛","🚫","💯",
    "💢","♨️","🚷","🚯","🚳","🚱","🔞","📵","🚭","❗","❕","❓","❔","‼️","⁉️","🔅",
    "🔆","〽️","⚠️","🚸","🔱","⚜️","🔰","♻️","✅","🈯","💹","❇️","✳️","❎","🌐","💠",
  ],
  Flags: [
    "🏳️","🏴","🏁","🚩","🏳️‍🌈","🏳️‍⚧️","🇮🇳","🇺🇸","🇬🇧","🇨🇦","🇦🇺","🇩🇪","🇫🇷","🇮🇹","🇪🇸","🇵🇹",
    "🇧🇷","🇦🇷","🇲🇽","🇯🇵","🇰🇷","🇨🇳","🇸🇬","🇦🇪","🇸🇦","🇶🇦","🇿🇦","🇳🇬","🇰🇪","🇪🇬","🇳🇵","🇧🇩",
    "🇱🇰","🇵🇰","🇮🇩","🇲🇾","🇹🇭","🇻🇳","🇵🇭","🇳🇿","🇳🇱","🇧🇪","🇨🇭","🇦🇹","🇸🇪","🇳🇴","🇩🇰","🇫🇮",
    "🇵🇱","🇨🇿","🇬🇷","🇹🇷","🇮🇪","🇮🇱","🇷🇺","🇺🇦",
  ],
};

const EMOJI_CATEGORY_ORDER = Object.keys(EMOJI_CATEGORIES);

const EMOJI_CATEGORY_ICONS = {
  Smileys: "😀",
  People: "👋",
  Animals: "🐻",
  Food: "🍔",
  Activities: "⚽",
  Travel: "🚗",
  Objects: "💡",
  Symbols: "❤️",
  Flags: "🚩",
};

const MEETING_PREFIX = "\uD83D\uDCF9 Meeting started \u2014 join: ";

function groupMessageReactions(reactions, myId) {
  const groups = new Map();

  (Array.isArray(reactions) ? reactions : []).forEach((reaction) => {
    const emoji = String(reaction?.emoji || "").trim();
    if (!emoji) return;

    if (!groups.has(emoji)) {
      groups.set(emoji, {
        emoji,
        count: 0,
        reactedByMe: false,
        names: [],
      });
    }

    const group = groups.get(emoji);
    group.count += 1;

    if (reaction?.user?.id === myId) {
      group.reactedByMe = true;
    }

    if (reaction?.user?.name) {
      group.names.push(reaction.user.name);
    }
  });

  return Array.from(groups.values());
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function ChatPanel({ currentUser }) {
  const myId = currentUser?.id;

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [composerEmojiCategory, setComposerEmojiCategory] = useState("Smileys");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [messageMenuId, setMessageMenuId] = useState(null);
  const [messageReactionMoreId, setMessageReactionMoreId] = useState(null);
  const [reactionCategory, setReactionCategory] = useState("Smileys");
  const [messageMenuPosition, setMessageMenuPosition] = useState({ top: 12, left: 12 });
  const [messageInfoOpen, setMessageInfoOpen] = useState(false);
  const [messageInfoLoading, setMessageInfoLoading] = useState(false);
  const [messageInfoData, setMessageInfoData] = useState(null);
  const [forwardingMessageItem, setForwardingMessageItem] = useState(null);
  const [forwardSelectedIds, setForwardSelectedIds] = useState([]);
  const [forwardSearch, setForwardSearch] = useState("");
  const [forwarding, setForwarding] = useState(false);
  const [threadSearchOpen, setThreadSearchOpen] = useState(false);
  const [threadSearch, setThreadSearch] = useState("");
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedConversationIds, setSelectedConversationIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

  const [myAvatar, setMyAvatar] = useState(currentUser?.avatarUrl || null);
  const avatarInputRef = useRef(null);
  const groupAvatarInputRef = useRef(null);
  const messageMenuAnchorRef = useRef(null);
  const messageMenuPopoverRef = useRef(null);

  function closeMessageMenu() {
    setMessageMenuId(null);
    setMessageReactionMoreId(null);
    setReactionCategory("Smileys");
    messageMenuAnchorRef.current = null;
  }

  function openMessageMenu(message, event, mine) {
    if (messageMenuId === message.id) {
      closeMessageMenu();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const viewportPadding = 12;
    const gap = 8;
    const popoverWidth = 300;
    const estimatedHeight = message.deletedForEveryone ? 90 : mine ? 430 : 390;
    const openBelow = rect.top < window.innerHeight * 0.5;

    let top = openBelow ? rect.bottom + gap : rect.top - estimatedHeight - gap;
    let left = mine ? rect.right - popoverWidth : rect.left;

    top = Math.max(
      viewportPadding,
      Math.min(top, window.innerHeight - estimatedHeight - viewportPadding)
    );
    left = Math.max(
      viewportPadding,
      Math.min(left, window.innerWidth - popoverWidth - viewportPadding)
    );

    messageMenuAnchorRef.current = { rect, mine };
    setMessageReactionMoreId(null);
    setReactionCategory("Smileys");
    setMessageMenuPosition({ top, left });
    setMessageMenuId(message.id);
  }

  useEffect(() => {
    if (!messageMenuId) return undefined;

    const frame = window.requestAnimationFrame(() => {
      const popover = messageMenuPopoverRef.current;
      const anchorData = messageMenuAnchorRef.current;
      if (!popover || !anchorData) return;

      const menuRect = popover.getBoundingClientRect();
      const { rect, mine } = anchorData;
      const viewportPadding = 12;
      const gap = 8;
      const openBelow = rect.top < window.innerHeight * 0.5;

      let top = openBelow ? rect.bottom + gap : rect.top - menuRect.height - gap;
      let left = mine ? rect.right - menuRect.width : rect.left;

      top = Math.max(
        viewportPadding,
        Math.min(top, window.innerHeight - menuRect.height - viewportPadding)
      );
      left = Math.max(
        viewportPadding,
        Math.min(left, window.innerWidth - menuRect.width - viewportPadding)
      );

      setMessageMenuPosition((current) => {
        if (Math.abs(current.top - top) < 1 && Math.abs(current.left - left) < 1) {
          return current;
        }
        return { top, left };
      });
    });

    const closeOnResize = () => closeMessageMenu();
    window.addEventListener("resize", closeOnResize);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", closeOnResize);
    };
  }, [messageMenuId, messageReactionMoreId]);

  async function onPickAvatar(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Please choose a PNG, JPG or WEBP image");
      return;
    }
    if (file.size > 500 * 1024) {
      setError("Image must be under 500 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || "");
      try {
        const res = await apiRequest("/api/client/chat/me/avatar", {
          method: "PATCH",
          body: JSON.stringify({ avatarUrl: dataUrl }),
        });
        setMyAvatar(res.avatarUrl || dataUrl);
      } catch (err) {
        setError(err?.data?.message || "Unable to update photo");
      }
    };
    reader.readAsDataURL(file);
  }

  async function onPickGroupAvatar(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activeId) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Please choose a PNG, JPG or WEBP image");
      return;
    }
    if (file.size > 500 * 1024) {
      setError("Image must be under 500 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || "");
      try {
        const res = await apiRequest(`/api/client/chat/${activeId}/avatar`, {
          method: "PATCH",
          body: JSON.stringify({ avatarUrl: dataUrl }),
        });
        setConversations((prev) =>
          prev.map((c) => (c.id === activeId ? { ...c, avatarUrl: res.avatarUrl || dataUrl } : c))
        );
      } catch (err) {
        setError(err?.data?.message || "Unable to update group photo");
      }
    };
    reader.readAsDataURL(file);
  }

  async function renameGroup() {
    const name = window.prompt("Group name", activeConversation?.title || "");
    if (name == null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await apiRequest(`/api/client/chat/${activeId}/name`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });
      setConversations((prev) =>
        prev.map((c) => (c.id === activeId ? { ...c, name: trimmed, title: c.nickname || trimmed } : c))
      );
      setHeaderMenuOpen(false);
    } catch (err) {
      setError(err?.data?.message || "Unable to rename group");
    }
  }

  async function setChatNickname() {
    const name = window.prompt("Rename this chat (only you will see this)", activeConversation?.title || "");
    if (name == null) return;
    const trimmed = name.trim();
    try {
      const res = await apiRequest(`/api/client/chat/${activeId}/nickname`, {
        method: "PATCH",
        body: JSON.stringify({ nickname: trimmed || null }),
      });
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeId) return c;
          const base = c.isGroup ? c.name || "Group chat" : c.otherMembers?.[0]?.name || c.title;
          return { ...c, nickname: res.nickname || null, title: res.nickname || base };
        })
      );
      setHeaderMenuOpen(false);
    } catch (err) {
      setError(err?.data?.message || "Unable to rename chat");
    }
  }

  const [newOpen, setNewOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const socketRef = useRef(null);
  const threadEndRef = useRef(null);
  const activeIdRef = useRef(null);

  activeIdRef.current = activeId;

  useEffect(() => {
    const socket = io(API_URL, {
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect_error", (err) => {
      console.error("Chat socket error:", err.message);
    });

    socket.on("message:new", (msg) => {
      if (msg.conversationId === activeIdRef.current) {
        setMessages((current) => {
          if (current.some((m) => m.id === msg.id)) return current;
          return [...current, msg];
        });
      }
    });

    socket.on("conversation:activity", ({ conversationId, lastMessage }) => {
      setConversations((current) => {
        const idx = current.findIndex((c) => c.id === conversationId);
        if (idx === -1) {
          loadConversations();
          return current;
        }
        const isOpen = conversationId === activeIdRef.current;
        const updated = {
          ...current[idx],
          lastMessage,
          updatedAt: lastMessage.createdAt,
          unreadCount: isOpen ? 0 : (current[idx].unreadCount || 0) + 1,
        };
        const next = current.slice();
        next.splice(idx, 1);
        return [updated, ...next];
      });
    });

    socket.on("message:reaction", ({ messageId, reactions }) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, reactions: Array.isArray(reactions) ? reactions : [] }
            : message
        )
      );
    });

    socket.on("user:avatar", ({ userId, avatarUrl }) => {
      setConversations((prev) =>
        prev.map((c) => (c.otherUserId === userId ? { ...c, avatarUrl } : c))
      );
    });

    socket.on("conversation:renamed", ({ conversationId, name }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, name, title: c.nickname || name } : c
        )
      );
    });

    socket.on("conversation:avatar", ({ conversationId, avatarUrl }) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, avatarUrl } : c))
      );
    });

    socket.on("message:deleted", ({ messageId, scope }) => {
      if (scope !== "everyone") return;
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                body: "",
                deletedForEveryone: true,
                pinned: false,
                starred: false,
                reactions: [],
                attachments: [],
          }
            : message
        )
      );
      setConversations((current) =>
        current.map((conversation) =>
          conversation.lastMessage?.id === messageId
            ? {
                ...conversation,
                lastMessage: {
                  ...conversation.lastMessage,
                  body: "This message was deleted",
                  deletedForEveryone: true,
                },
              }
            : conversation
        )
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadConversations() {
    setLoadingList(true);
    setError("");
    try {
      const data = await apiRequest("/api/client/chat");
      setConversations(Array.isArray(data.conversations) ? data.conversations : []);
    } catch (err) {
      setError(err?.data?.message || "Unable to load chats");
    } finally {
      setLoadingList(false);
    }
  }

  async function loadMessages(conversationId) {
    setLoadingThread(true);
    setError("");
    try {
      const data = await apiRequest(`/api/client/chat/${conversationId}/messages`);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (err) {
      setError(err?.data?.message || "Unable to load messages");
    } finally {
      setLoadingThread(false);
    }
  }

  async function loadUsers() {
    try {
      const data = await apiRequest("/api/client/chat/users");
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (err) {
      console.error("Unable to load users:", err);
    }
  }

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !activeId) return undefined;
    socket.emit("conversation:join", activeId);
    loadMessages(activeId);
    setConversations((current) =>
      current.map((c) => (c.id === activeId ? { ...c, unreadCount: 0 } : c))
    );
    return () => socket.emit("conversation:leave", activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function insertEmoji(emoji) {
    setDraft((current) => current + emoji);
  }

  async function toggleFavorite(conv, e) {
    e?.stopPropagation();
    const next = !conv.isFavorite;
    setConversations((current) =>
      current.map((c) => (c.id === conv.id ? { ...c, isFavorite: next } : c))
    );
    try {
      await apiRequest(`/api/client/chat/${conv.id}/favorite`, {
        method: "PATCH",
        body: JSON.stringify({ isFavorite: next }),
      });
    } catch {
      setConversations((current) =>
        current.map((c) => (c.id === conv.id ? { ...c, isFavorite: !next } : c))
      );
    }
  }

  async function toggleMute(conv) {
    const next = !conv.isMuted;
    setConversations((current) =>
      current.map((c) => (c.id === conv.id ? { ...c, isMuted: next } : c))
    );
    try {
      await apiRequest(`/api/client/chat/${conv.id}/mute`, {
        method: "PATCH",
        body: JSON.stringify({ isMuted: next }),
      });
    } catch {
      setConversations((current) =>
        current.map((c) => (c.id === conv.id ? { ...c, isMuted: !next } : c))
      );
    }
  }

  async function toggleArchive(conv) {
    const next = !conv.isArchived;
    setConversations((current) =>
      current.map((c) => (c.id === conv.id ? { ...c, isArchived: next } : c))
    );
    try {
      await apiRequest(`/api/client/chat/${conv.id}/archive`, {
        method: "PATCH",
        body: JSON.stringify({ isArchived: next }),
      });
      if (next && activeId === conv.id) setActiveId(null);
    } catch {
      setConversations((current) =>
        current.map((c) => (c.id === conv.id ? { ...c, isArchived: !next } : c))
      );
    }
  }

  async function togglePin(message) {
    if (message.deletedForEveryone) return;
    const next = !message.pinned;
    setMessages((current) =>
      current.map((m) => (m.id === message.id ? { ...m, pinned: next } : m))
    );
    try {
      await apiRequest(`/api/client/chat/messages/${message.id}/pin`, {
        method: "PATCH",
        body: JSON.stringify({ pinned: next }),
      });
    } catch {
      setMessages((current) =>
        current.map((m) => (m.id === message.id ? { ...m, pinned: !next } : m))
      );
    }
  }

  async function toggleMessageStar(message) {
    if (message.deletedForEveryone) return;

    const next = !message.starred;
    setMessages((current) =>
      current.map((item) =>
        item.id === message.id ? { ...item, starred: next } : item
      )
    );

    try {
      await apiRequest(`/api/client/chat/messages/${message.id}/star`, {
        method: "PATCH",
        body: JSON.stringify({ starred: next }),
      });
    } catch (err) {
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id ? { ...item, starred: !next } : item
        )
      );
      setError(err?.data?.message || "Unable to update star");
    }
  }

  async function openMessageInfo(message) {
    if (!message?.id) return;

    closeMessageMenu();
    setMessageInfoData(null);
    setMessageInfoOpen(true);
    setMessageInfoLoading(true);
    setError("");

    try {
      const data = await apiRequest(`/api/client/chat/messages/${message.id}/info`);
      setMessageInfoData(data);
    } catch (err) {
      setMessageInfoOpen(false);
      setError(err?.data?.message || "Unable to load message info");
    } finally {
      setMessageInfoLoading(false);
    }
  }

  function openForwardModal(message) {
    if (!message?.id || message.deletedForEveryone) return;
    closeMessageMenu();
    setForwardingMessageItem(message);
    setForwardSelectedIds([]);
    setForwardSearch("");
  }

  function toggleForwardConversation(conversationId) {
    setForwardSelectedIds((current) => {
      if (current.includes(conversationId)) {
        return current.filter((id) => id !== conversationId);
      }

      if (current.length >= 5) {
        setError("You can forward to up to 5 chats at once");
        return current;
      }

      return [...current, conversationId];
    });
  }

  async function submitForward() {
    if (!forwardingMessageItem?.id || !forwardSelectedIds.length || forwarding) return;

    setForwarding(true);
    setError("");

    try {
      await apiRequest(
        `/api/client/chat/messages/${forwardingMessageItem.id}/forward`,
        {
          method: "POST",
          body: JSON.stringify({ conversationIds: forwardSelectedIds }),
        }
      );

      setForwardingMessageItem(null);
      setForwardSelectedIds([]);
      setForwardSearch("");
      await loadConversations();
    } catch (err) {
      setError(err?.data?.message || "Unable to forward message");
    } finally {
      setForwarding(false);
    }
  }

  async function deleteMessage(message, scope) {
    if (!message?.id || deleting) return;
    setDeleting(true);
    setError("");
    try {
      await apiRequest(`/api/client/chat/messages/${message.id}?scope=${scope}`, {
        method: "DELETE",
      });
      if (scope === "everyone") {
        setMessages((current) =>
          current.map((item) =>
            item.id === message.id
              ? {
                  ...item,
                  body: "",
                  deletedForEveryone: true,
                  pinned: false,
                  starred: false,
                  reactions: [],
                  attachments: [],
                }
              : item
          )
        );
      } else {
        setMessages((current) => current.filter((item) => item.id !== message.id));
      }
      setMessageMenuId(null);
      await loadConversations();
    } catch (err) {
      setError(err?.data?.message || "Unable to delete message");
    } finally {
      setDeleting(false);
    }
  }

  async function clearActiveChat() {
    if (!activeId || deleting) return;
    if (!window.confirm("Clear this chat for you? The other participants will keep their messages.")) return;
    setDeleting(true);
    setError("");
    try {
      await apiRequest(`/api/client/chat/${activeId}/clear`, { method: "POST" });
      setMessages([]);
      setReplyTo(null);
      setThreadSearch("");
      setHeaderMenuOpen(false);
      await loadConversations();
    } catch (err) {
      setError(err?.data?.message || "Unable to clear chat");
    } finally {
      setDeleting(false);
    }
  }

  function toggleConversationSelection(id) {
    setSelectedConversationIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function leaveSelectionMode() {
    setSelectionMode(false);
    setSelectedConversationIds([]);
  }

  async function deleteSelectedChats() {
    if (!selectedConversationIds.length || deleting) return;
    if (!window.confirm(`Delete ${selectedConversationIds.length} selected chat${selectedConversationIds.length > 1 ? "s" : ""} for you?`)) return;
    setDeleting(true);
    setError("");
    try {
      await apiRequest("/api/client/chat/delete-many", {
        method: "POST",
        body: JSON.stringify({ conversationIds: selectedConversationIds }),
      });
      if (selectedConversationIds.includes(activeId)) {
        setActiveId(null);
        setMessages([]);
      }
      setConversations((current) =>
        current.filter((conversation) => !selectedConversationIds.includes(conversation.id))
      );
      leaveSelectionMode();
    } catch (err) {
      setError(err?.data?.message || "Unable to delete selected chats");
    } finally {
      setDeleting(false);
    }
  }

  async function startMeeting() {
    if (!activeId) return;
    try {
      const now = Date.now();
      const data = await apiRequest("/api/client/google/meet", {
        method: "POST",
        body: JSON.stringify({
          summary: "Bispun call",
          startISO: new Date(now).toISOString(),
          endISO: new Date(now + 60 * 60 * 1000).toISOString(),
        }),
      });
      const link = data?.meetLink;
      if (!link) return;

      const socket = socketRef.current;
      if (socket) {
        socket.emit(
          "message:send",
          { conversationId: activeId, body: `${MEETING_PREFIX}${link}` },
          (resp) => {
            if (resp?.ok) {
              setMessages((current) => {
                if (current.some((m) => m.id === resp.message.id)) return current;
                return [...current, resp.message];
              });
            }
          }
        );
      }
      window.open(link, "_blank", "noopener");
    } catch (error) {
      window.alert(
        error?.data?.message ||
          "Unable to start a Google Meet. Connect Google in Settings → Integrations."
      );
    }
  }

  function joinMeeting(url) {
    if (url) window.open(url, "_blank", "noopener");
  }

  function meetingRoomFromBody(body) {
    const s = String(body || "");
    const idx = s.indexOf("https://meet.google.com/");
    if (idx === -1) return null;
    const url = s.slice(idx).split(/\s/)[0].trim();
    return url.split(/\s/)[0] || null;
  }

  function sendMessage() {
    const body = draft.trim();
    if (!body || !activeId || sending) return;
    const socket = socketRef.current;
    if (!socket) return;

    setSending(true);
    socket.emit(
      "message:send",
      { conversationId: activeId, body, replyToId: replyTo?.id || null },
      (resp) => {
        setSending(false);
        if (resp?.ok) {
          setDraft("");
          setReplyTo(null);
          setMessages((current) => {
            if (current.some((m) => m.id === resp.message.id)) return current;
            return [...current, resp.message];
          });
        } else {
          setError(resp?.error || "Message failed to send");
        }
      }
    );
  }

  function reactToMessage(messageId, emoji) {
    const socket = socketRef.current;
    if (!socket || !messageId) return;

    socket.emit("message:react", { messageId, emoji }, (resp) => {
      if (!resp?.ok) {
        setError(resp?.error || "Unable to react to message");
        return;
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, reactions: Array.isArray(resp.reactions) ? resp.reactions : [] }
            : message
        )
      );
    });
  }

  function openNewChat() {
    setSelectedIds([]);
    setGroupName("");
    setUserSearch("");
    setNewOpen(true);
    loadUsers();
  }

  function toggleUser(id) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  }

  async function createConversation() {
    if (selectedIds.length === 0 || creating) return;
    const isGroup = selectedIds.length > 1;
    if (isGroup && !groupName.trim()) {
      setError("Group name is required");
      return;
    }

    setCreating(true);
    setError("");
    try {
      const data = await apiRequest("/api/client/chat", {
        method: "POST",
        body: JSON.stringify({
          isGroup,
          name: isGroup ? groupName.trim() : null,
          memberIds: selectedIds,
        }),
      });
      setNewOpen(false);
      await loadConversations();
      if (data.conversation?.id) setActiveId(data.conversation.id);
    } catch (err) {
      setError(err?.data?.message || "Unable to start chat");
    } finally {
      setCreating(false);
    }
  }

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = conversations.filter((c) => !c.isArchived);
    if (q) {
      list = list.filter((c) =>
        String(c.title || "").toLowerCase().includes(q) ||
        String(c.lastMessage?.body || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [conversations, search]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const pinnedMessages = useMemo(() => messages.filter((m) => m.pinned), [messages]);

  const forwardTargets = useMemo(() => {
    const query = forwardSearch.trim().toLowerCase();

    return conversations
      .filter((conversation) => !conversation.isArchived)
      .filter((conversation) => {
        if (!query) return true;
        return String(conversation.title || "")
          .toLowerCase()
          .includes(query);
      });
  }, [conversations, forwardSearch]);

  const visibleMessages = useMemo(() => {
    const q = threadSearch.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      (message) =>
        !message.deletedForEveryone &&
        (String(message.body || "").toLowerCase().includes(q) ||
          String(message.sender?.name || "").toLowerCase().includes(q))
    );
  }, [messages, threadSearch]);

  const groupedMessages = useMemo(() => {
    const groups = [];
    let currentDay = null;
    visibleMessages.forEach((m) => {
      const day = formatDay(m.createdAt);
      if (day !== currentDay) {
        groups.push({ type: "day", day, key: `day-${m.id}` });
        currentDay = day;
      }
      groups.push({ type: "msg", message: m, key: m.id });
    });
    return groups;
  }, [visibleMessages]);


  return (
    <div className="flex h-[calc(100vh-104px)] w-full flex-col overflow-hidden bg-[#f5f5f4]">
      <style>{`
        .cb-bubble { transition: transform .15s ease, box-shadow .15s ease; }
        .cb-bubble:hover { transform: translateY(-1px); }
        .cb-send { transition: transform .15s ease, box-shadow .15s ease; }
        .cb-send:hover:not(:disabled) { transform: translateY(-1px) scale(1.03); box-shadow: 0 8px 20px rgba(79,70,229,.28); }
      `}</style>

      {error && (
        <div className="flex items-start gap-2 border-b border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="mx-5 mb-5 flex min-h-0 flex-1 overflow-hidden rounded-[16px] border border-neutral-200 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)] sm:mx-7">
        {/* LEFT NAV + CHAT LIST */}
        <div className={`w-full flex-shrink-0 border-r border-slate-200 bg-white lg:flex lg:w-[350px] lg:flex-col ${activeId ? "hidden" : "flex flex-col"}`}>
          <div className="flex h-[66px] items-center justify-between border-b border-neutral-200 px-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="group relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-xs font-bold text-indigo-600 shadow-sm"
                title="Change your photo"
              >
                {myAvatar ? (
                  <img src={myAvatar} alt="You" className="h-full w-full object-cover" />
                ) : (
                  initialsOf(currentUser?.name)
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100">
                  <Camera size={14} className="text-white" />
                </span>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onPickAvatar}
                className="hidden"
              />
              <input
                ref={groupAvatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onPickGroupAvatar}
                className="hidden"
              />
              <div>
                <div className="text-[18px] font-semibold tracking-[-0.015em] text-neutral-950">
                  {selectionMode ? `${selectedConversationIds.length} selected` : "Chats"}
                </div>
                {selectionMode && <div className="text-[11px] text-slate-500">Select one or multiple chats</div>}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {selectionMode ? (
                <>
                  <button type="button" onClick={leaveSelectionMode} className="h-9 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                  <button type="button" onClick={deleteSelectedChats} disabled={!selectedConversationIds.length || deleting} className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-40" aria-label="Delete selected chats"><Trash2 size={15} /></button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setSelectionMode(true)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Select chats" title="Select chats"><ListChecks size={16} /></button>
                  <button type="button" onClick={openNewChat} className="inline-flex h-9 items-center gap-2 rounded-[9px] border border-neutral-300 bg-white px-3.5 text-[13px] font-semibold text-neutral-800 shadow-sm hover:bg-neutral-50"><Plus size={14} />New</button>
                </>
              )}
            </div>
          </div>

          <div className="px-3 pb-2 pt-3">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats, people and messages..."
                className="h-10 w-full rounded-[9px] border border-neutral-400 bg-white pl-9 pr-3 text-[14px] font-medium text-neutral-800 outline-none placeholder:text-neutral-500 focus:border-neutral-700"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500">
                <Loader2 size={14} className="animate-spin" /> Loading...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="px-5 py-12 text-center text-xs leading-5 text-slate-400">
                No chats found.
              </div>
            ) : (
              filteredConversations.map((c) => {
                const active = c.id === activeId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectionMode ? toggleConversationSelection(c.id) : setActiveId(c.id)}
                    className={`mx-2 flex w-[calc(100%-16px)] items-center gap-3 rounded-[11px] border px-3 py-2.5 text-left transition ${active ? "border-indigo-200 bg-indigo-50/90 shadow-[inset_3px_0_0_#4f46e5]" : "border-transparent hover:bg-neutral-50"}`}
                  >
                    <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold shadow-sm ${selectedConversationIds.includes(c.id) ? "bg-indigo-600 text-white" : c.isGroup ? "bg-neutral-100 text-neutral-600" : "bg-indigo-100 text-indigo-600"}`}>
                      {selectionMode ? (selectedConversationIds.includes(c.id) ? <CheckSquare size={17} /> : <Square size={17} />) : c.isGroup ? (c.avatarUrl ? <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" /> : <Users size={16} />) : c.avatarUrl ? <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" /> : initialsOf(c.title)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <div className="truncate text-[15px] font-semibold tracking-[-0.01em] text-slate-900">{c.title}</div>
                        {c.isMuted && <BellOff size={11} className="flex-shrink-0 text-slate-400" />}
                      </div>
                      <div className="mt-1 truncate text-[13px] leading-5 font-medium text-slate-500">
                        {c.lastMessage ? c.lastMessage.body : c.isGroup ? `${c.members.length} members` : "No messages yet"}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1">
                      {c.lastMessage && <span className="text-[12px] font-medium text-slate-400">{formatTime(c.lastMessage.createdAt)}</span>}
                      <div className="flex items-center gap-1.5">
                        {c.isFavorite && <Star size={12} className="fill-amber-400 text-amber-400" />}
                        {(c.unreadCount || 0) > 0 && !c.isMuted && (
                          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-indigo-600 px-1 text-[11px] font-semibold text-white">
                            {c.unreadCount > 9 ? "9+" : c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* CENTER THREAD */}
        <div className={`min-h-0 min-w-0 flex-1 flex-col ${activeId ? "flex" : "hidden lg:flex"}`}>
          {activeConversation ? (
            <>
              <div className="flex h-[66px] flex-shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-4">
                <button type="button" onClick={() => setActiveId(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Back">
                  <ChevronLeft size={17} />
                </button>
                <span className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white shadow-sm ${activeConversation.isGroup ? "bg-gradient-to-br from-violet-500 to-purple-600" : `bg-gradient-to-br ${avatarGradient(activeConversation.title)}`}`}>
                  {activeConversation.isGroup ? (activeConversation.avatarUrl ? <img src={activeConversation.avatarUrl} alt="" className="h-full w-full object-cover" /> : <Users size={16} />) : activeConversation.avatarUrl ? <img src={activeConversation.avatarUrl} alt="" className="h-full w-full object-cover" /> : initialsOf(activeConversation.title)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16px] font-semibold tracking-[-0.01em] text-slate-900">{activeConversation.title}</div>
                  <div className="truncate text-[13px] text-slate-500">
                    {activeConversation.isGroup ? `${activeConversation.members.length} members` : activeConversation.otherMembers[0]?.email || "Team member"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={startMeeting}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 text-[13px] font-bold text-indigo-700 transition hover:bg-indigo-100"
                  title="Start meeting"
                >
                  <Video size={14} />
                  <span className="hidden sm:inline">Meet now</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setThreadSearchOpen((open) => !open);
                    setHeaderMenuOpen(false);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
                  aria-label="Search this chat"
                  title="Search this chat"
                >
                  <Search size={16} />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setHeaderMenuOpen((open) => !open)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                    aria-label="Chat options"
                    title="Chat options"
                  >
                    <MoreVertical size={17} />
                  </button>
                  {headerMenuOpen && (
                    <div className="absolute right-0 top-11 z-40 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                      {activeConversation.isGroup ? (
                        <button type="button" onClick={renameGroup} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50"><Pencil size={14} />Rename group</button>
                      ) : (
                        <button type="button" onClick={setChatNickname} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50"><Pencil size={14} />Rename (only you)</button>
                      )}
                      {activeConversation.isGroup && (
                        <button type="button" onClick={() => { setHeaderMenuOpen(false); groupAvatarInputRef.current?.click(); }} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50"><Camera size={14} />Change group photo</button>
                      )}
                      <button type="button" onClick={clearActiveChat} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50"><Eraser size={14} />Clear chat for me</button>
                    </div>
                  )}
                </div>
              </div>

              {threadSearchOpen && (
                <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
                  <Search size={14} className="text-slate-400" />
                  <input autoFocus value={threadSearch} onChange={(e) => setThreadSearch(e.target.value)} placeholder="Search messages in this chat" className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-[13px] outline-none focus:border-indigo-400" />
                  <span className="whitespace-nowrap text-[11px] font-semibold text-slate-500">{visibleMessages.length} found</span>
                  <button type="button" onClick={() => { setThreadSearchOpen(false); setThreadSearch(""); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white" aria-label="Close chat search"><X size={14} /></button>
                </div>
              )}

              {pinnedMessages.length > 0 && (
                <div className="border-b border-amber-200 bg-amber-50/80 px-4 py-2">
                  <div className="flex items-center gap-2 text-[12px] font-bold text-amber-700">
                    <Pin size={11} /> {pinnedMessages.length} pinned message{pinnedMessages.length > 1 ? "s" : ""}
                    <span className="min-w-0 flex-1 truncate font-medium text-amber-900">{pinnedMessages[0]?.body}</span>
                  </div>
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-5 sm:px-5">
                {loadingThread ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-400">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm"><MessageSquare size={21} strokeWidth={1.6} /></span>
                    <div><div className="text-sm font-bold text-slate-600">Start the conversation</div><div className="mt-1 text-[13px]">Send a message or start a meeting.</div></div>
                  </div>
                ) : visibleMessages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-slate-400">
                    <Search size={21} />
                    <div className="text-sm font-semibold text-slate-600">No matching messages</div>
                    <div className="text-[12px]">Try another word or sender name.</div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {groupedMessages.map((item) => {
                      if (item.type === "day") {
                        return (
                          <div key={item.key} className="my-4 flex items-center justify-center">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[13px] font-bold text-slate-500">{item.day}</span>
                          </div>
                        );
                      }
                      const m = item.message;
                      const mine = m.sender?.id === myId;
                      const room = meetingRoomFromBody(m.body);
                      const reactionGroups = groupMessageReactions(m.reactions, myId);
                      return (
                        <div key={item.key} className={`group flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                          {!mine && (
                            <span className={`mb-7 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[13px] font-bold text-white ${avatarGradient(m.sender?.name)}`}>{initialsOf(m.sender?.name)}</span>
                          )}

                          <div className={`flex max-w-[76%] flex-col sm:max-w-[70%] ${mine ? "items-end" : "items-start"}`}>
                            <div className={`cb-bubble relative px-4 py-2.5 text-[14px] leading-5.5 ${mine ? "rounded-[16px] rounded-br-[5px] bg-indigo-50 text-neutral-900" : "rounded-[16px] rounded-bl-[5px] bg-neutral-100 text-neutral-900"} ${m.pinned ? "ring-1 ring-amber-300" : ""}`}>
                              {!mine && activeConversation.isGroup && <div className="mb-1 text-[13px] font-semibold text-indigo-600">{m.sender?.name}</div>}

                              {m.replyTo && (
                                <div className="mb-2 rounded-lg border-l-[3px] border-indigo-400 bg-white/70 px-2.5 py-2">
                                  <div className="text-[13px] font-bold text-indigo-700">
                                    {m.replyTo.sender?.name || "Message"}
                                  </div>
                                  <div className="mt-0.5 line-clamp-2 text-[12px] leading-4 text-slate-500">
                                    {m.replyTo.body}
                                  </div>
                                </div>
                              )}

                              {m.deletedForEveryone ? (
                                <div className="flex items-center gap-2 italic text-slate-500">
                                  <Trash2 size={13} /> This message was deleted
                                </div>
                              ) : room ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-indigo-600">
                                    <Video size={13} />
                                  </span>
                                  <span className="text-[14px] font-semibold">Meeting started</span>
                                  <button
                                    type="button"
                                    onClick={() => joinMeeting(room)}
                                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-indigo-700"
                                  >
                                    Join
                                  </button>
                                </div>
                              ) : (
                                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                              )}

                              <div className="mt-1.5 flex items-center justify-end gap-1 text-right text-[11px] text-neutral-400">
                                {m.starred && (
                                  <Star
                                    size={10}
                                    className="fill-amber-400 text-amber-400"
                                    aria-label="Starred message"
                                  />
                                )}
                                {formatTime(m.createdAt)}
                              </div>
                            </div>

                            {reactionGroups.length > 0 && (
                              <div
                                className={`mt-1 flex flex-wrap items-center gap-1 ${
                                  mine ? "justify-end" : "justify-start"
                                }`}
                              >
                                {reactionGroups.map((reaction) => (
                                  <button
                                    key={reaction.emoji}
                                    type="button"
                                    title={
                                      reaction.names.length
                                        ? reaction.names.join(", ")
                                        : "Message reaction"
                                    }
                                    onClick={() => reactToMessage(m.id, reaction.emoji)}
                                    className={`inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[12px] font-medium transition ${
                                      reaction.reactedByMe
                                        ? "border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/60"
                                    }`}
                                  >
                                    <span className="text-[14px] leading-none">
                                      {reaction.emoji}
                                    </span>
                                    {reaction.count > 1 && (
                                      <span className="text-[11px] tabular-nums">
                                        {reaction.count}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}

                            <div className={`relative mt-1 flex items-center ${mine ? "justify-end" : "justify-start"}`}>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={(event) => openMessageMenu(m, event, mine)}
                                  title="Message options"
                                  aria-label="Message options"
                                  className={`flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 ${
                                    messageMenuId === m.id
                                      ? "bg-slate-100 text-slate-700 opacity-100"
                                      : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                  }`}
                                >
                                  <MoreVertical size={13} />
                                </button>

                                {messageMenuId === m.id && (
                                  <>
                                    <button
                                      type="button"
                                      aria-label="Close message menu"
                                      onClick={closeMessageMenu}
                                      className="fixed inset-0 z-[9990] cursor-default bg-transparent"
                                    />

                                    <div
                                      ref={messageMenuPopoverRef}
                                      className="fixed z-[9999] w-[300px] max-h-[calc(100vh-24px)] overflow-y-auto overscroll-contain"
                                      style={{
                                        top: `${messageMenuPosition.top}px`,
                                        left: `${messageMenuPosition.left}px`,
                                      }}
                                    >
                                      {!m.deletedForEveryone && (
                                        <>
                                          <div className="mb-2 flex items-center justify-between gap-1 rounded-full border border-slate-200 bg-white p-1.5 shadow-xl">
                                            {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                                              <button
                                                key={emoji}
                                                type="button"
                                                onClick={() => {
                                                  reactToMessage(m.id, emoji);
                                                  closeMessageMenu();
                                                }}
                                                className="flex h-8 w-8 items-center justify-center rounded-full text-base transition hover:bg-slate-100 hover:scale-110"
                                                title={`React ${emoji}`}
                                              >
                                                {emoji}
                                              </button>
                                            ))}
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setMessageReactionMoreId((current) =>
                                                  current === m.id ? null : m.id
                                                )
                                              }
                                              className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                                                messageReactionMoreId === m.id
                                                  ? "bg-slate-100 text-slate-900"
                                                  : "text-slate-700 hover:bg-slate-100"
                                              }`}
                                              title="More reactions"
                                              aria-label="More reactions"
                                            >
                                              <Plus size={18} strokeWidth={2.2} />
                                            </button>
                                          </div>

                                          {messageReactionMoreId === m.id && (
                                            <div className="mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                                              <div className="border-b border-slate-100 px-2 pt-2">
                                                <div className="mb-1 px-1 text-[11px] font-semibold text-slate-500">
                                                  Reactions
                                                </div>
                                                <div className="flex gap-0.5 overflow-x-auto pb-1">
                                                  {EMOJI_CATEGORY_ORDER.map((category) => (
                                                    <button
                                                      key={category}
                                                      type="button"
                                                      onClick={() => setReactionCategory(category)}
                                                      className={`flex h-8 min-w-8 items-center justify-center rounded-lg text-base transition ${
                                                        reactionCategory === category
                                                          ? "bg-indigo-50 ring-1 ring-indigo-100"
                                                          : "hover:bg-slate-100"
                                                      }`}
                                                      title={category}
                                                    >
                                                      {EMOJI_CATEGORY_ICONS[category]}
                                                    </button>
                                                  ))}
                                                </div>
                                              </div>

                                              <div className="grid max-h-[220px] grid-cols-8 gap-1 overflow-y-auto p-2">
                                                {EMOJI_CATEGORIES[reactionCategory].map((emoji, index) => (
                                                  <button
                                                    key={`message-reaction-${reactionCategory}-${emoji}-${index}`}
                                                    type="button"
                                                    onClick={() => {
                                                      reactToMessage(m.id, emoji);
                                                      closeMessageMenu();
                                                    }}
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition hover:bg-slate-100 hover:scale-110"
                                                    title={`React ${emoji}`}
                                                  >
                                                    {emoji}
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </>
                                      )}

                                      <div className={`w-[236px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl ${mine ? "ml-auto" : "mr-auto"}`}>
                                        {!m.deletedForEveryone && (
                                          <>
                                            {mine && (
                                              <button
                                                type="button"
                                                onClick={() => openMessageInfo(m)}
                                                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                                              >
                                                <Info size={15} />Message info
                                              </button>
                                            )}

                                            <button
                                              type="button"
                                              onClick={() => {
                                                setReplyTo(m);
                                                closeMessageMenu();
                                              }}
                                              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                                            >
                                              <Reply size={15} />Reply
                                            </button>

                                            <button
                                              type="button"
                                              onClick={async () => {
                                                try {
                                                  await navigator.clipboard?.writeText(String(m.body || ""));
                                                } catch {
                                                  setError("Unable to copy message");
                                                }
                                                closeMessageMenu();
                                              }}
                                              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                                            >
                                              <Copy size={15} />Copy
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() =>
                                                setMessageReactionMoreId((current) =>
                                                  current === m.id ? null : m.id
                                                )
                                              }
                                              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                                            >
                                              <Smile size={15} />React
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => openForwardModal(m)}
                                              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                                            >
                                              <Forward size={15} />Forward
                                            </button>

                                            <button
                                              type="button"
                                              onClick={async () => {
                                                await togglePin(m);
                                                closeMessageMenu();
                                              }}
                                              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                                            >
                                              {m.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                                              {m.pinned ? "Unpin" : "Pin"}
                                            </button>

                                            <button
                                              type="button"
                                              onClick={async () => {
                                                await toggleMessageStar(m);
                                                closeMessageMenu();
                                              }}
                                              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                                            >
                                              <Star
                                                size={15}
                                                className={m.starred ? "fill-amber-400 text-amber-400" : ""}
                                              />
                                              {m.starred ? "Unstar" : "Star"}
                                            </button>

                                            <div className="my-1 border-t border-slate-100" />
                                          </>
                                        )}

                                        <button
                                          type="button"
                                          onClick={() => deleteMessage(m, "me")}
                                          disabled={deleting}
                                          className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                        >
                                          <Trash2 size={15} />Delete for me
                                        </button>

                                        {mine && !m.deletedForEveryone && (
                                          <button
                                            type="button"
                                            onClick={() => deleteMessage(m, "everyone")}
                                            disabled={deleting}
                                            className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                          >
                                            <Trash2 size={15} />Delete for everyone
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={threadEndRef} />
                  </div>
                )}
              </div>

              <div className="border-t border-neutral-200 bg-white p-3">
                {replyTo && (
                  <div className="mb-2 flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2">
                    <Reply size={13} className="mt-0.5 flex-shrink-0 text-indigo-600" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-bold text-indigo-700">
                        Replying to {replyTo.sender?.name || "message"}
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-slate-500">{replyTo.body}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-slate-700"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                <div className="flex min-h-[46px] items-end gap-1 rounded-[9px] border border-neutral-400 bg-white p-1.5 transition focus-within:border-indigo-400">
                  <div className="relative">
                    <button type="button" onClick={() => setEmojiOpen((o) => !o)} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-indigo-50 hover:text-indigo-600" aria-label="Emoji"><Smile size={17} /></button>
                    {emojiOpen && (
                      <>
                        <button
                          type="button"
                          aria-label="Close emoji picker"
                          onClick={() => setEmojiOpen(false)}
                          className="fixed inset-0 z-[10] cursor-default"
                        />
                        <div className="absolute bottom-12 left-0 z-[20] w-[304px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                          <div className="border-b border-slate-100 px-2 pt-2">
                            <div className="flex gap-0.5 overflow-x-auto pb-1">
                              {EMOJI_CATEGORY_ORDER.map((category) => (
                                <button
                                  key={`composer-${category}`}
                                  type="button"
                                  onClick={() => setComposerEmojiCategory(category)}
                                  className={`flex h-8 min-w-8 items-center justify-center rounded-lg text-base transition ${
                                    composerEmojiCategory === category
                                      ? "bg-indigo-50 ring-1 ring-indigo-100"
                                      : "hover:bg-slate-100"
                                  }`}
                                  title={category}
                                >
                                  {EMOJI_CATEGORY_ICONS[category]}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid max-h-[240px] grid-cols-8 gap-1 overflow-y-auto p-2">
                            {EMOJI_CATEGORIES[composerEmojiCategory].map((emoji, index) => (
                              <button
                                key={`composer-${composerEmojiCategory}-${emoji}-${index}`}
                                type="button"
                                onClick={() => insertEmoji(emoji)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition hover:bg-slate-100 hover:scale-110"
                                title={emoji}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={startMeeting}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                    aria-label="Start meeting"
                    title="Start meeting"
                  >
                    <Video size={16} />
                  </button>
                  <div className="mx-1 h-6 w-px self-center bg-slate-200" />

                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    rows={1}
                    placeholder="Type a message..."
                    className="max-h-28 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-2 text-[14px] font-medium text-slate-800 outline-none placeholder:text-slate-400"
                  />
                  <button type="button" onClick={sendMessage} disabled={sending || !draft.trim()} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-40" aria-label="Send">
                    {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_center,_rgba(99,102,241,0.055),_transparent_30%)] text-slate-400">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm"><MessageSquare size={25} strokeWidth={1.5} /></span>
              <div className="text-center"><div className="text-sm font-bold text-slate-600">Select a conversation</div><div className="mt-1 text-[13px]">Choose a chat from the left to start messaging.</div></div>
            </div>
          )}
        </div>


      </div>


      {newOpen && (
        <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <div className="text-[14px] font-semibold text-slate-950">New chat</div>
              <button type="button" onClick={() => setNewOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={16} /></button>
            </div>
            <div className="border-b border-slate-100 p-3">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search people" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-medium text-slate-700 outline-none focus:border-indigo-400" />
              </div>
              {selectedIds.length > 1 && <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" className="mt-2 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400" />}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {filteredUsers.length === 0 ? <div className="px-3 py-8 text-center text-xs text-slate-500">No people found.</div> : filteredUsers.map((u) => {
                const selected = selectedIds.includes(u.id);
                return (
                  <button key={u.id} type="button" onClick={() => toggleUser(u.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${selected ? "bg-indigo-50" : "hover:bg-slate-50"}`}>
                    <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[12px] font-black text-white ${avatarGradient(u.name)}`}>{initialsOf(u.name)}</span>
                    <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold text-slate-900">{u.name}</div><div className="truncate text-[13px] text-slate-500">{u.email}</div></div>
                    <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border ${selected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}>{selected && <Check size={12} />}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5">
              <span className="text-[13px] font-semibold text-slate-500">{selectedIds.length === 0 ? "Select people" : selectedIds.length === 1 ? "1-to-1 chat" : `Group of ${selectedIds.length}`}</span>
              <button type="button" onClick={createConversation} disabled={selectedIds.length === 0 || creating} className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50">{creating && <Loader2 size={14} className="animate-spin" />} Start chat</button>
            </div>
          </div>
        </div>
      )}

      {messageInfoOpen && (
        <div className="fixed inset-0 z-[10040] flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Close message info"
            onClick={() => {
              setMessageInfoOpen(false);
              setMessageInfoData(null);
            }}
            className="absolute inset-0 cursor-default"
          />

          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-[15px] font-bold text-slate-950">Message info</div>
                <div className="mt-0.5 text-[12px] text-slate-500">
                  Sent and read details for this message
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMessageInfoOpen(false);
                  setMessageInfoData(null);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            {messageInfoLoading ? (
              <div className="flex items-center justify-center gap-2 px-5 py-12 text-[13px] text-slate-500">
                <Loader2 size={15} className="animate-spin" />
                Loading message info...
              </div>
            ) : messageInfoData?.message ? (
              <div className="max-h-[70vh] overflow-y-auto">
                <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                  <div className="line-clamp-3 whitespace-pre-wrap text-[13px] font-medium leading-5 text-slate-700">
                    {messageInfoData.message.body || "This message was deleted"}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
                    <div>
                      <div className="font-semibold uppercase tracking-wide text-slate-400">Sent</div>
                      <div className="mt-1 font-semibold text-slate-700">
                        {formatDateTime(messageInfoData.message.createdAt)}
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold uppercase tracking-wide text-slate-400">Starred</div>
                      <div className="mt-1 font-semibold text-slate-700">
                        {messageInfoData.message.starred ? "Yes" : "No"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-4">
                  <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-slate-800">
                    <Check size={14} className="text-emerald-600" />
                    Read by
                  </div>

                  {messageInfoData.readBy?.length ? (
                    <div className="space-y-2">
                      {messageInfoData.readBy.map((person) => (
                        <div
                          key={person.id}
                          className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5"
                        >
                          <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br text-[11px] font-bold text-white ${avatarGradient(person.name)}`}>
                            {person.avatarUrl ? (
                              <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              initialsOf(person.name)
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-semibold text-slate-800">
                              {person.name}
                            </div>
                            <div className="truncate text-[11px] text-slate-500">
                              {formatDateTime(person.readAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-slate-50 px-3 py-3 text-[12px] text-slate-500">
                      Nobody else has read this message yet.
                    </div>
                  )}

                  {messageInfoData.notReadBy?.length > 0 && (
                    <>
                      <div className="mb-2 mt-5 flex items-center gap-2 text-[13px] font-bold text-slate-800">
                        <Users size={14} className="text-slate-500" />
                        Not read yet
                      </div>

                      <div className="space-y-2">
                        {messageInfoData.notReadBy.map((person) => (
                          <div
                            key={person.id}
                            className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5"
                          >
                            <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br text-[11px] font-bold text-white ${avatarGradient(person.name)}`}>
                              {person.avatarUrl ? (
                                <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                initialsOf(person.name)
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[13px] font-semibold text-slate-800">
                                {person.name}
                              </div>
                              <div className="truncate text-[11px] text-slate-500">
                                {person.email || "Member"}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-[11px] leading-4 text-amber-800">
                    Bispun currently tracks message read status using each member's last-read time. Delivery receipts are not stored separately yet.
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {forwardingMessageItem && (
        <div className="fixed inset-0 z-[10030] flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Close forward dialog"
            onClick={() => {
              if (forwarding) return;
              setForwardingMessageItem(null);
              setForwardSelectedIds([]);
              setForwardSearch("");
            }}
            className="absolute inset-0 cursor-default"
          />

          <div className="relative z-10 flex max-h-[78vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-[15px] font-bold text-slate-950">Forward message</div>
                <div className="mt-0.5 text-[12px] text-slate-500">
                  Select up to 5 chats
                </div>
              </div>

              <button
                type="button"
                disabled={forwarding}
                onClick={() => {
                  setForwardingMessageItem(null);
                  setForwardSelectedIds([]);
                  setForwardSearch("");
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="border-b border-slate-100 p-3">
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  autoFocus
                  value={forwardSearch}
                  onChange={(event) => setForwardSearch(event.target.value)}
                  placeholder="Search chats"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] font-medium text-slate-700 outline-none focus:border-indigo-400"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {forwardTargets.length ? (
                forwardTargets.map((conversation) => {
                  const selected = forwardSelectedIds.includes(conversation.id);

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => toggleForwardConversation(conversation.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                        selected ? "bg-indigo-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br text-[12px] font-bold text-white ${
                        conversation.isGroup
                          ? "from-violet-500 to-purple-600"
                          : avatarGradient(conversation.title)
                      }`}>
                        {conversation.avatarUrl ? (
                          <img src={conversation.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : conversation.isGroup ? (
                          <Users size={15} />
                        ) : (
                          initialsOf(conversation.title)
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-slate-900">
                          {conversation.title}
                        </div>
                        <div className="truncate text-[11px] text-slate-500">
                          {conversation.isGroup
                            ? `${conversation.members?.length || 0} members`
                            : conversation.otherMembers?.[0]?.email || "Direct chat"}
                        </div>
                      </div>

                      <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border ${
                        selected
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-300"
                      }`}>
                        {selected && <Check size={12} />}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-10 text-center text-[12px] text-slate-500">
                  No chats found.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5">
              <span className="text-[12px] font-semibold text-slate-500">
                {forwardSelectedIds.length
                  ? `${forwardSelectedIds.length} selected`
                  : "Select chats"}
              </span>

              <button
                type="button"
                onClick={submitForward}
                disabled={!forwardSelectedIds.length || forwarding}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-[12px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {forwarding ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Forward size={14} />
                )}
                {forwarding ? "Forwarding..." : "Forward"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
