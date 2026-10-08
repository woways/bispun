import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import prisma from "./lib/prisma.js";
import { syncSubscriptionLifecycle } from "./lib/subscriptions.js";

const COOKIE_NAME = "cb_client_token";

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
}

function authenticateSocket(socket) {
  try {
    const parsed = parseCookies(socket.handshake.headers.cookie || "");
    const token = parsed[COOKIE_NAME];
    if (!token) return null;
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
    if (!payload || typeof payload !== "object" || !payload.sub || !payload.companyId || payload.role === "SUPER_ADMIN") return null;
    return { userId: payload.sub, companyId: payload.companyId };
  } catch {
    return null;
  }
}

const miniUser = (u) => u ? ({ id: u.id, name: u.name, email: u.email }) : null;
const attachmentShape = (a) => ({
  id: a.id,
  url: a.url,
  publicId: a.publicId,
  resourceType: a.resourceType,
  fileName: a.fileName,
  mimeType: a.mimeType,
  size: a.size,
  width: a.width,
  height: a.height,
});

export function attachSocketServer(httpServer, config) {
  const io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin(origin, callback) {
        if (!origin || config.clientOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Origin not allowed by CORS"));
      },
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const auth = authenticateSocket(socket);
    if (!auth) return next(new Error("Unauthorized"));

    try {
      const lifecycle = await syncSubscriptionLifecycle(auth.companyId);
      if (lifecycle.accessRestricted) {
        return next(new Error("Subscription expired"));
      }
    } catch (error) {
      console.error("Socket subscription check failed:", error);
      return next(new Error("Unauthorized"));
    }

    socket.data.userId = auth.userId;
    socket.data.companyId = auth.companyId;
    next();
  });

  io.on("connection", (socket) => {
    const { userId, companyId } = socket.data;
    socket.join(`user:${userId}`);

    socket.on("conversation:join", async (conversationId) => {
      try {
        const member = await prisma.conversationMember.findUnique({
          where: { conversationId_userId: { conversationId: String(conversationId), userId } },
        });
        if (member) socket.join(`conversation:${conversationId}`);
      } catch (error) {
        console.error("conversation:join failed:", error);
      }
    });

    socket.on("conversation:leave", (conversationId) => socket.leave(`conversation:${conversationId}`));

    socket.on("message:send", async (data, ack) => {
      try {
        const conversationId = String(data?.conversationId || "");
        const body = String(data?.body || "").trim();
        const replyToId = data?.replyToId ? String(data.replyToId) : null;
        const attachments = Array.isArray(data?.attachments) ? data.attachments.slice(0, 10) : [];

        if (!conversationId || (!body && attachments.length === 0)) {
          ack?.({ ok: false, error: "Invalid message" });
          return;
        }
        if (body.length > 4000) {
          ack?.({ ok: false, error: "Message too long" });
          return;
        }

        const member = await prisma.conversationMember.findUnique({
          where: { conversationId_userId: { conversationId, userId } },
          include: { conversation: true },
        });
        if (!member || member.conversation.companyId !== companyId) {
          ack?.({ ok: false, error: "Not a member" });
          return;
        }

        if (replyToId) {
          const replyTarget = await prisma.chatMessage.findUnique({ where: { id: replyToId } });
          if (!replyTarget || replyTarget.conversationId !== conversationId) {
            ack?.({ ok: false, error: "Invalid reply target" });
            return;
          }
        }

        const safeAttachments = attachments
          .filter((a) => a && typeof a.url === "string" && a.url.startsWith("https://res.cloudinary.com/"))
          .map((a) => ({
            url: String(a.url),
            publicId: String(a.publicId || ""),
            resourceType: String(a.resourceType || "raw"),
            fileName: String(a.fileName || "attachment").slice(0, 255),
            mimeType: String(a.mimeType || "application/octet-stream").slice(0, 120),
            size: Number.isFinite(Number(a.size)) ? Math.max(0, Math.trunc(Number(a.size))) : 0,
            width: a.width ? Math.trunc(Number(a.width)) : null,
            height: a.height ? Math.trunc(Number(a.height)) : null,
          }));

        const message = await prisma.chatMessage.create({
          data: {
            conversationId,
            senderId: userId,
            body,
            replyToId,
            ...(safeAttachments.length ? { attachments: { create: safeAttachments } } : {}),
          },
          include: {
            sender: { select: { id: true, name: true, email: true } },
            replyTo: { include: { sender: { select: { id: true, name: true, email: true } } } },
            reactions: { include: { user: { select: { id: true, name: true, email: true } } } },
            attachments: true,
          },
        });

        await prisma.conversationMember.updateMany({
          where: { conversationId },
          data: { hiddenAt: null },
        });
        await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

        const payload = {
          id: message.id,
          conversationId,
          body: message.body,
          pinned: message.pinned,
          deletedForEveryone: false,
          createdAt: message.createdAt,
          sender: miniUser(message.sender),
          replyTo: message.replyTo ? { id: message.replyTo.id, body: message.replyTo.body, sender: miniUser(message.replyTo.sender) } : null,
          reactions: (message.reactions || []).map((r) => ({ id: r.id, emoji: r.emoji, user: miniUser(r.user) })),
          attachments: (message.attachments || []).map(attachmentShape),
        };

        io.to(`conversation:${conversationId}`).emit("message:new", payload);
        const members = await prisma.conversationMember.findMany({
          where: { conversationId },
          select: { userId: true, isMuted: true },
        });
        members.forEach((m) =>
          io.to(`user:${m.userId}`).emit("conversation:activity", {
            conversationId,
            lastMessage: payload,
            isMuted: Boolean(m.isMuted),
          })
        );
        ack?.({ ok: true, message: payload });
      } catch (error) {
        console.error("message:send failed:", error);
        ack?.({ ok: false, error: "Server error" });
      }
    });

    socket.on("message:react", async (data, ack) => {
      try {
        const messageId = String(data?.messageId || "");
        const emoji = String(data?.emoji || "").trim().slice(0, 16);
        const message = await prisma.chatMessage.findUnique({
          where: { id: messageId },
          include: { conversation: true },
        });
        if (!message || message.conversation.companyId !== companyId) return ack?.({ ok: false, error: "Message not found" });

        const member = await prisma.conversationMember.findUnique({
          where: { conversationId_userId: { conversationId: message.conversationId, userId } },
        });
        if (!member) return ack?.({ ok: false, error: "Not a member" });

        const existing = await prisma.chatReaction.findUnique({ where: { messageId_userId: { messageId, userId } } });
        if (existing && (!emoji || existing.emoji === emoji)) {
          await prisma.chatReaction.delete({ where: { id: existing.id } });
        } else if (existing) {
          await prisma.chatReaction.update({ where: { id: existing.id }, data: { emoji } });
        } else if (emoji) {
          await prisma.chatReaction.create({ data: { messageId, userId, emoji } });
        }

        const reactions = await prisma.chatReaction.findMany({
          where: { messageId },
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        });
        const payload = { messageId, conversationId: message.conversationId, reactions: reactions.map((r) => ({ id: r.id, emoji: r.emoji, user: miniUser(r.user) })) };
        io.to(`conversation:${message.conversationId}`).emit("message:reaction", payload);
        ack?.({ ok: true, ...payload });
      } catch (error) {
        console.error("message:react failed:", error);
        ack?.({ ok: false, error: "Server error" });
      }
    });
  });

  return io;
}