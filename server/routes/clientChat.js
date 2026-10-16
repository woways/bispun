import { Router } from "express";
import crypto from "crypto";

import prisma from "../lib/prisma.js";
import { deleteChatFile, uploadChatFile } from "../lib/chatStorage.js";
import { requireClientUser } from "../middleware/clientAuth.js";

const router = Router();

router.use(requireClientUser);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function userMini(user) {
  return user
    ? { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl || null }
    : null;
}

// Shape a conversation for the list: for 1-to-1, the "title" is the other
// person's name; for a group, the group name.
function formatConversation(conversation, currentUserId, unreadCount = 0) {
  const others = conversation.members
    .map((m) => m.user)
    .filter((u) => u && u.id !== currentUserId);

  const myMembership = conversation.members.find(
    (m) => m.userId === currentUserId
  );

  const baseTitle = conversation.isGroup
    ? conversation.name || "Group chat"
    : others[0]?.name || "Conversation";
  const title = myMembership?.nickname || baseTitle;

  const visibleMessages = (conversation.messages || []).filter(
    (message) => !myMembership?.clearedAt || message.createdAt > myMembership.clearedAt
  );
  const lastMessage = visibleMessages[0]
    ? {
        id: visibleMessages[0].id,
        body: visibleMessages[0].deletedForEveryoneAt
          ? "This message was deleted"
          : visibleMessages[0].body,
        createdAt: visibleMessages[0].createdAt,
        senderId: visibleMessages[0].senderId,
        deletedForEveryone: Boolean(visibleMessages[0].deletedForEveryoneAt),
      }
    : null;

  return {
    id: conversation.id,
    isGroup: conversation.isGroup,
    name: conversation.name,
    title,
    nickname: myMembership?.nickname || null,
    avatarUrl: conversation.isGroup ? conversation.avatarUrl || null : others[0]?.avatarUrl || null,
    otherUserId: conversation.isGroup ? null : others[0]?.id || null,
    members: conversation.members.map((m) => userMini(m.user)),
    otherMembers: others.map(userMini),
    lastMessage,
    unreadCount,
    isFavorite: Boolean(myMembership?.isFavorite),
    isMuted: Boolean(myMembership?.isMuted),
    isArchived: Boolean(myMembership?.isArchived),
    updatedAt: conversation.updatedAt,
  };
}

/* ------------------------------------------------------------------ */
/* GET /users — company users you can start a chat with                */
/* ------------------------------------------------------------------ */

router.get("/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        companyId: req.clientUser.companyId,
        active: true,
        id: { not: req.clientUser.userId },
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
      orderBy: { name: "asc" },
    });
    return res.json({ success: true, users });
  } catch (error) {
    console.error("Failed to fetch chat users:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to fetch users" });
  }
});

/* ------------------------------------------------------------------ */
/* GET / — my conversations, most-recent first                         */
/* ------------------------------------------------------------------ */

router.get("/", async (req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        companyId: req.clientUser.companyId,
        members: {
          some: { userId: req.clientUser.userId, hiddenAt: null },
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
        messages: {
          where: {
            deletions: { none: { userId: req.clientUser.userId } },
          },
          orderBy: { createdAt: "desc" },
          take: 25,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const me = req.clientUser.userId;

    // Compute unread counts: messages after my lastReadAt, not sent by me.
    const withUnread = await Promise.all(
      conversations.map(async (c) => {
        const myMembership = c.members.find((m) => m.userId === me);
        const lastReadAt = [myMembership?.lastReadAt, myMembership?.clearedAt]
          .filter(Boolean)
          .sort((a, b) => b.getTime() - a.getTime())[0] || null;

        const unreadCount = await prisma.chatMessage.count({
          where: {
            conversationId: c.id,
            senderId: { not: me },
            deletedForEveryoneAt: null,
            deletions: { none: { userId: me } },
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
          },
        });

        return formatConversation(c, me, unreadCount);
      })
    );

    return res.json({
      success: true,
      conversations: withUnread,
    });
  } catch (error) {
    console.error("Failed to fetch conversations:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to fetch conversations" });
  }
});

/* ------------------------------------------------------------------ */
/* GET /:id/messages — paginated messages for a conversation           */
/* ------------------------------------------------------------------ */

router.get("/:id/messages", async (req, res) => {
  try {
    const conversationId = req.params.id;

    // Membership + company check.
    const member = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: req.clientUser.userId,
        },
      },
      include: { conversation: true },
    });

    if (
      !member ||
      member.conversation.companyId !== req.clientUser.companyId
    ) {
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found" });
    }

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const before = req.query.before
      ? new Date(String(req.query.before))
      : null;

    const messages = await prisma.chatMessage.findMany({
      where: {
        conversationId,
        deletions: { none: { userId: req.clientUser.userId } },
        ...((member.clearedAt || before) ? {
          createdAt: {
            ...(member.clearedAt ? { gt: member.clearedAt } : {}),
            ...(before ? { lt: before } : {}),
          },
        } : {}),
      },
      include: {
        sender: { select: { id: true, name: true, email: true, avatarUrl: true } },
        replyTo: {
          include: {
            sender: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
        reactions: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        stars: {
          where: { userId: req.clientUser.userId },
          select: { id: true },
        },
        attachments: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Return oldest-first for rendering.
    const ordered = messages.reverse().map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      body: m.body,
      deletedForEveryone: Boolean(m.deletedForEveryoneAt),
      pinned: m.pinned,
      starred: Boolean(m.stars?.length),
      createdAt: m.createdAt,
      sender: userMini(m.sender),
      replyTo: m.replyTo
        ? { id: m.replyTo.id, body: m.replyTo.body, sender: userMini(m.replyTo.sender) }
        : null,
      reactions: (m.reactions || []).map((r) => ({
        id: r.id,
        emoji: r.emoji,
        user: userMini(r.user),
      })),
      attachments: m.deletedForEveryoneAt ? [] : (m.attachments || []).map((a) => ({
        id: a.id,
        url: a.url,
        publicId: a.publicId,
        resourceType: a.resourceType,
        fileName: a.fileName,
        mimeType: a.mimeType,
        size: a.size,
        width: a.width,
        height: a.height,
      })),
    }));

    // Mark as read up to now.
    await prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: req.clientUser.userId,
        },
      },
      data: { lastReadAt: new Date() },
    });

    return res.json({ success: true, messages: ordered });
  } catch (error) {
    console.error("Failed to fetch messages:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to fetch messages" });
  }
});

/* ------------------------------------------------------------------ */
/* POST / — create a conversation (1-to-1 or group)                    */
/* ------------------------------------------------------------------ */

router.post("/", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    const me = req.clientUser.userId;

    const isGroup = Boolean(req.body?.isGroup);
    const name = String(req.body?.name || "").trim();
    const memberIds = Array.isArray(req.body?.memberIds)
      ? req.body.memberIds.filter((id) => typeof id === "string")
      : [];

    if (memberIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Select at least one member" });
    }

    if (isGroup && !name) {
      return res
        .status(400)
        .json({ success: false, message: "Group name is required" });
    }

    // Verify all selected members belong to the same company.
    const validMembers = await prisma.user.findMany({
      where: {
        id: { in: memberIds },
        companyId,
        active: true,
      },
      select: { id: true },
    });

    if (validMembers.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No valid members selected" });
    }

    const allMemberIds = Array.from(
      new Set([me, ...validMembers.map((u) => u.id)])
    );

    // For 1-to-1, reuse an existing conversation between the two users.
    if (!isGroup && allMemberIds.length === 2) {
      const existing = await prisma.conversation.findFirst({
        where: {
          companyId,
          isGroup: false,
          AND: allMemberIds.map((uid) => ({
            members: { some: { userId: uid } },
          })),
        },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
          },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });

      if (existing && existing.members.length === 2) {
        await prisma.conversationMember.update({
          where: { conversationId_userId: { conversationId: existing.id, userId: me } },
          data: { hiddenAt: null },
        });
        return res.json({
          success: true,
          conversation: formatConversation(existing, me),
          existed: true,
        });
      }
    }

    const conversation = await prisma.conversation.create({
      data: {
        companyId,
        isGroup,
        name: isGroup ? name : null,
        createdByUserId: me,
        members: {
          create: allMemberIds.map((uid) => ({ userId: uid })),
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    return res.json({
      success: true,
      conversation: formatConversation(conversation, me),
      existed: false,
    });
  } catch (error) {
    console.error("Failed to create conversation:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to create conversation" });
  }
});

/* ------------------------------------------------------------------ */
/* PATCH /:id/favorite — toggle favorite for the current user          */
/* ------------------------------------------------------------------ */

router.patch("/:id/favorite", async (req, res) => {
  try {
    const conversationId = req.params.id;
    const isFavorite = Boolean(req.body?.isFavorite);

    const member = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: req.clientUser.userId,
        },
      },
    });
    if (!member) {
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found" });
    }

    await prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: req.clientUser.userId,
        },
      },
      data: { isFavorite },
    });

    return res.json({ success: true, isFavorite });
  } catch (error) {
    console.error("Toggle favorite failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to update favorite" });
  }
});

/* ------------------------------------------------------------------ */
/* PATCH /:id/mute — toggle mute for the current user                  */
/* ------------------------------------------------------------------ */

router.patch("/:id/mute", async (req, res) => {
  try {
    const conversationId = req.params.id;
    const isMuted = Boolean(req.body?.isMuted);

    const member = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: req.clientUser.userId,
        },
      },
    });
    if (!member) {
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found" });
    }

    await prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: req.clientUser.userId,
        },
      },
      data: { isMuted },
    });

    return res.json({ success: true, isMuted });
  } catch (error) {
    console.error("Toggle mute failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to update mute" });
  }
});


/* ------------------------------------------------------------------ */
/* PATCH /:id/archive — archive/unarchive for the current user         */
/* ------------------------------------------------------------------ */

router.patch("/:id/archive", async (req, res) => {
  try {
    const conversationId = req.params.id;
    const isArchived = Boolean(req.body?.isArchived);

    const member = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: req.clientUser.userId,
        },
      },
    });

    if (!member) {
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found" });
    }

    await prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: req.clientUser.userId,
        },
      },
      data: { isArchived },
    });

    return res.json({ success: true, isArchived });
  } catch (error) {
    console.error("Toggle archive failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to update archive" });
  }
});

/* ------------------------------------------------------------------ */
/* PATCH /messages/:messageId/pin — toggle a message's pinned state     */
/* ------------------------------------------------------------------ */

router.patch("/messages/:messageId/pin", async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const pinned = Boolean(req.body?.pinned);

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (
      !message ||
      message.conversation.companyId !== req.clientUser.companyId
    ) {
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
    }

    // Must be a member of the conversation to pin.
    const member = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: message.conversationId,
          userId: req.clientUser.userId,
        },
      },
    });
    if (!member) {
      return res
        .status(403)
        .json({ success: false, message: "Not a member" });
    }

    await prisma.chatMessage.update({
      where: { id: messageId },
      data: { pinned },
    });

    return res.json({ success: true, pinned });
  } catch (error) {
    console.error("Toggle pin failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to update pin" });
  }
});


/* ------------------------------------------------------------------ */
/* PATCH /messages/:messageId/star — private per-user star             */
/* ------------------------------------------------------------------ */

router.patch("/messages/:messageId/star", async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const me = req.clientUser.userId;
    const starred = Boolean(req.body?.starred);

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (!message || message.conversation.companyId !== req.clientUser.companyId) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    const membership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: message.conversationId,
          userId: me,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({ success: false, message: "Not a member" });
    }

    if (starred) {
      await prisma.chatMessageStar.upsert({
        where: {
          messageId_userId: {
            messageId,
            userId: me,
          },
        },
        update: {},
        create: {
          messageId,
          userId: me,
        },
      });
    } else {
      await prisma.chatMessageStar.deleteMany({
        where: {
          messageId,
          userId: me,
        },
      });
    }

    return res.json({ success: true, messageId, starred });
  } catch (error) {
    console.error("Toggle message star failed:", error);
    return res.status(500).json({ success: false, message: "Unable to update star" });
  }
});

/* ------------------------------------------------------------------ */
/* GET /messages/:messageId/info — sent/read information               */
/* ------------------------------------------------------------------ */

router.get("/messages/:messageId/info", async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const me = req.clientUser.userId;

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: {
        conversation: true,
        sender: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    if (!message || message.conversation.companyId !== req.clientUser.companyId) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    const myMembership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: message.conversationId,
          userId: me,
        },
      },
    });

    if (!myMembership) {
      return res.status(403).json({ success: false, message: "Not a member" });
    }

    const members = await prisma.conversationMember.findMany({
      where: {
        conversationId: message.conversationId,
        userId: { not: message.senderId },
        joinedAt: { lte: message.createdAt },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    const readBy = [];
    const notReadBy = [];

    members.forEach((member) => {
      const item = {
        ...userMini(member.user),
        readAt:
          member.lastReadAt && member.lastReadAt >= message.createdAt
            ? member.lastReadAt
            : null,
      };

      if (item.readAt) {
        readBy.push(item);
      } else {
        notReadBy.push(item);
      }
    });

    const myStar = await prisma.chatMessageStar.findUnique({
      where: {
        messageId_userId: {
          messageId,
          userId: me,
        },
      },
      select: { id: true },
    });

    return res.json({
      success: true,
      message: {
        id: message.id,
        body: message.body,
        createdAt: message.createdAt,
        deletedForEveryone: Boolean(message.deletedForEveryoneAt),
        sender: userMini(message.sender),
        isMine: message.senderId === me,
        starred: Boolean(myStar),
      },
      readBy,
      notReadBy,
    });
  } catch (error) {
    console.error("Load message info failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load message info" });
  }
});

/* ------------------------------------------------------------------ */
/* POST /messages/:messageId/forward — forward text to chats           */
/* ------------------------------------------------------------------ */

router.post("/messages/:messageId/forward", async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const me = req.clientUser.userId;
    const companyId = req.clientUser.companyId;
    const conversationIds = Array.from(
      new Set(
        (Array.isArray(req.body?.conversationIds) ? req.body.conversationIds : [])
          .filter((id) => typeof id === "string" && id.trim())
          .map((id) => id.trim())
          .slice(0, 5)
      )
    );

    if (!conversationIds.length) {
      return res.status(400).json({ success: false, message: "Select at least one chat" });
    }

    const source = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (
      !source ||
      source.conversation.companyId !== companyId ||
      source.deletedForEveryoneAt
    ) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    const sourceMembership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: source.conversationId,
          userId: me,
        },
      },
    });

    if (!sourceMembership) {
      return res.status(403).json({ success: false, message: "Not a member" });
    }

    const memberships = await prisma.conversationMember.findMany({
      where: {
        userId: me,
        conversationId: { in: conversationIds },
        conversation: { companyId },
      },
      include: { conversation: true },
    });

    if (!memberships.length) {
      return res.status(400).json({ success: false, message: "No valid destination chats selected" });
    }

    const sender = await prisma.user.findUnique({
      where: { id: me },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });

    const io = req.app.get("io");
    const forwarded = [];

    for (const membership of memberships) {
      const created = await prisma.$transaction(async (tx) => {
        const item = await tx.chatMessage.create({
          data: {
            conversationId: membership.conversationId,
            senderId: me,
            body: source.body,
          },
        });

        await tx.conversation.update({
          where: { id: membership.conversationId },
          data: { updatedAt: new Date() },
        });

        await tx.conversationMember.update({
          where: {
            conversationId_userId: {
              conversationId: membership.conversationId,
              userId: me,
            },
          },
          data: { hiddenAt: null },
        });

        return item;
      });

      const payload = {
        id: created.id,
        conversationId: created.conversationId,
        body: created.body,
        deletedForEveryone: false,
        pinned: false,
        starred: false,
        createdAt: created.createdAt,
        sender: userMini(sender),
        replyTo: null,
        reactions: [],
        attachments: [],
      };

      forwarded.push(payload);

      io?.to(`conversation:${membership.conversationId}`).emit("message:new", payload);

      if (io) {
        const activityMembers = await prisma.conversationMember.findMany({
          where: { conversationId: membership.conversationId },
          select: { userId: true, isMuted: true },
        });

        activityMembers.forEach((member) => {
          io.to(`user:${member.userId}`).emit("conversation:activity", {
            conversationId: membership.conversationId,
            lastMessage: payload,
            isMuted: Boolean(member.isMuted),
          });
        });
      }
    }

    return res.json({
      success: true,
      forwardedCount: forwarded.length,
      messages: forwarded,
    });
  } catch (error) {
    console.error("Forward message failed:", error);
    return res.status(500).json({ success: false, message: "Unable to forward message" });
  }
});


/* ------------------------------------------------------------------ */
/* POST /upload — upload a chat attachment to Bispun S3                */
/* Accepts a JSON body: { fileName, mimeType, fileSize, dataUrl }      */
/* (base64 data URL), mirroring the expense-proof upload pattern.      */
/* ------------------------------------------------------------------ */

router.post("/upload", async (req, res) => {
  try {
    const { fileName, mimeType, fileSize, dataUrl } = req.body || {};

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "application/pdf",
    ];

    if (!fileName || !mimeType || !dataUrl) {
      return res.status(400).json({ success: false, message: "File is required" });
    }
    if (!allowedTypes.includes(String(mimeType))) {
      return res.status(400).json({
        success: false,
        message: "Only PNG, JPG, WEBP and PDF files are allowed",
      });
    }

    const base64 = String(dataUrl).includes(",")
      ? String(dataUrl).split(",")[1]
      : String(dataUrl);
    const buffer = Buffer.from(base64, "base64");

    if (!buffer.length || buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: "File must be 10 MB or smaller",
      });
    }

    const stored = await uploadChatFile(
      {
        buffer,
        originalname: String(fileName),
        mimetype: String(mimeType),
        size: Number(fileSize || buffer.length),
      },
      req.clientUser.companyId
    );

    return res.json({
      success: true,
      url: stored.url,
      publicId: stored.publicId,
      resourceType: stored.resourceType,
      fileName: stored.originalName,
      mimeType: stored.mimeType,
      size: stored.sizeBytes,
    });
  } catch (error) {
    console.error("Chat file upload failed:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Unable to upload file",
    });
  }
});

/* ------------------------------------------------------------------ */
/* DELETE /messages/:messageId — WhatsApp-style per-user deletion      */
/* ------------------------------------------------------------------ */

router.delete("/messages/:messageId", async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const me = req.clientUser.userId;
    const scope = String(req.query.scope || "me").toLowerCase();

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { conversation: true, attachments: true },
    });

    if (!message || message.conversation.companyId !== req.clientUser.companyId) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }
    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: message.conversationId, userId: me } },
    });
    if (!membership) {
      return res.status(403).json({ success: false, message: "Not a member" });
    }

    if (scope === "everyone") {
      if (message.senderId !== me) {
        return res.status(403).json({ success: false, message: "You can delete for everyone only messages you sent" });
      }
      if (!message.deletedForEveryoneAt) {
        await Promise.allSettled(
          message.attachments
            .filter((attachment) => attachment.publicId)
            .map((attachment) => deleteChatFile({ publicId: attachment.publicId, resourceType: attachment.resourceType }))
        );
        await prisma.$transaction([
          prisma.chatReaction.deleteMany({ where: { messageId } }),
          prisma.chatMessageStar.deleteMany({ where: { messageId } }),
          prisma.chatAttachment.deleteMany({ where: { messageId } }),
          prisma.chatMessage.update({
            where: { id: messageId },
            data: { body: "", pinned: false, deletedForEveryoneAt: new Date() },
          }),
        ]);
      }
      const payload = { messageId, conversationId: message.conversationId, scope: "everyone" };
      req.app.get("io")?.to(`conversation:${message.conversationId}`).emit("message:deleted", payload);
      return res.json({ success: true, ...payload });
    }

    await prisma.chatMessageDeletion.upsert({
      where: { messageId_userId: { messageId, userId: me } },
      update: { deletedAt: new Date() },
      create: { messageId, userId: me },
    });
    return res.json({ success: true, messageId, conversationId: message.conversationId, scope: "me" });
  } catch (error) {
    console.error("Delete message failed:", error);
    return res.status(500).json({ success: false, message: "Unable to delete message" });
  }
});

/* ------------------------------------------------------------------ */
/* POST /:id/clear — clear only the current user's message history     */
/* ------------------------------------------------------------------ */

router.post("/:id/clear", async (req, res) => {
  try {
    const conversationId = req.params.id;
    const me = req.clientUser.userId;
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: me } },
      include: { conversation: true },
    });
    if (!member || member.conversation.companyId !== req.clientUser.companyId) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }
    const clearedAt = new Date();
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: me } },
      data: { clearedAt, lastReadAt: clearedAt },
    });
    return res.json({ success: true, conversationId, clearedAt });
  } catch (error) {
    console.error("Clear conversation failed:", error);
    return res.status(500).json({ success: false, message: "Unable to clear conversation" });
  }
});

/* POST /delete-many — hide selected chats for the current user        */
/* ------------------------------------------------------------------ */

router.post("/delete-many", async (req, res) => {
  try {
    const ids = Array.from(new Set(
      (Array.isArray(req.body?.conversationIds) ? req.body.conversationIds : [])
        .filter((id) => typeof id === "string")
        .slice(0, 100)
    ));
    if (!ids.length) {
      return res.status(400).json({ success: false, message: "Select at least one chat" });
    }
    const now = new Date();
    const result = await prisma.conversationMember.updateMany({
      where: {
        userId: req.clientUser.userId,
        conversationId: { in: ids },
        conversation: { companyId: req.clientUser.companyId },
      },
      data: { hiddenAt: now, clearedAt: now, lastReadAt: now },
    });
    return res.json({ success: true, conversationIds: ids, deletedCount: result.count });
  } catch (error) {
    console.error("Delete selected chats failed:", error);
    return res.status(500).json({ success: false, message: "Unable to delete selected chats" });
  }
});

/* DELETE /:id — hide one chat only for the current user               */
/* ------------------------------------------------------------------ */

router.delete("/:id", async (req, res) => {
  try {
    const conversationId = req.params.id;
    const me = req.clientUser.userId;

    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: me } },
      include: { conversation: true },
    });

    if (!member || member.conversation.companyId !== req.clientUser.companyId) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    const now = new Date();
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: me } },
      data: { hiddenAt: now, clearedAt: now, lastReadAt: now },
    });
    return res.json({ success: true, conversationId });
  } catch (error) {
    console.error("Delete conversation failed:", error);
    return res.status(500).json({ success: false, message: "Unable to delete conversation" });
  }
});


/* ------------------------------------------------------------------ */
/* PATCH /me/avatar — set or remove my display picture (shown to all)   */
/* ------------------------------------------------------------------ */

router.patch("/me/avatar", async (req, res) => {
  try {
    const me = req.clientUser.userId;
    let avatarUrl = req.body?.avatarUrl ?? null;

    if (avatarUrl) {
      avatarUrl = String(avatarUrl);
      if (!/^data:image\/(png|jpe?g|webp);base64,/.test(avatarUrl)) {
        return res
          .status(400)
          .json({ success: false, message: "Please upload a PNG, JPG or WEBP image" });
      }
      // base64 is ~1.37x the byte size; 500 KB image ≈ 685 KB string
      if (avatarUrl.length > 700 * 1024) {
        return res
          .status(400)
          .json({ success: false, message: "Image must be under 500 KB" });
      }
    }

    await prisma.user.update({
      where: { id: me },
      data: { avatarUrl },
    });

    // Push the new photo live to everyone who shares a chat with me.
    const memberships = await prisma.conversationMember.findMany({
      where: { userId: me },
      select: { conversationId: true },
    });
    const io = req.app.get("io");
    memberships.forEach((m) =>
      io
        ?.to(`conversation:${m.conversationId}`)
        .emit("user:avatar", { userId: me, avatarUrl })
    );

    return res.json({ success: true, avatarUrl });
  } catch (error) {
    console.error("Update avatar failed:", error);
    return res.status(500).json({ success: false, message: "Unable to update photo" });
  }
});

/* ------------------------------------------------------------------ */
/* PATCH /:id/name — rename a group chat (shared with all members)      */
/* ------------------------------------------------------------------ */

router.patch("/:id/name", async (req, res) => {
  try {
    const conversationId = req.params.id;
    const me = req.clientUser.userId;
    const name = String(req.body?.name || "").trim().slice(0, 80);
    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: me } },
      include: { conversation: true },
    });
    if (!member || member.conversation.companyId !== req.clientUser.companyId) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }
    if (!member.conversation.isGroup) {
      return res.status(400).json({ success: false, message: "Only group chats can be renamed" });
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { name },
    });
    req.app
      .get("io")
      ?.to(`conversation:${conversationId}`)
      .emit("conversation:renamed", { conversationId, name });

    return res.json({ success: true, conversationId, name });
  } catch (error) {
    console.error("Rename group failed:", error);
    return res.status(500).json({ success: false, message: "Unable to rename group" });
  }
});

/* ------------------------------------------------------------------ */
/* PATCH /:id/nickname — private per-user chat name (only I see it)     */
/* ------------------------------------------------------------------ */

router.patch("/:id/nickname", async (req, res) => {
  try {
    const conversationId = req.params.id;
    const me = req.clientUser.userId;
    const raw = req.body?.nickname;
    const nickname =
      raw == null || String(raw).trim() === "" ? null : String(raw).trim().slice(0, 80);

    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: me } },
      include: { conversation: true },
    });
    if (!member || member.conversation.companyId !== req.clientUser.companyId) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: me } },
      data: { nickname },
    });
    return res.json({ success: true, conversationId, nickname });
  } catch (error) {
    console.error("Set nickname failed:", error);
    return res.status(500).json({ success: false, message: "Unable to rename chat" });
  }
});

/* ------------------------------------------------------------------ */
/* PATCH /:id/avatar — set or remove a group's photo (shared with all)  */
/* ------------------------------------------------------------------ */

router.patch("/:id/avatar", async (req, res) => {
  try {
    const conversationId = req.params.id;
    const me = req.clientUser.userId;
    let avatarUrl = req.body?.avatarUrl ?? null;

    if (avatarUrl) {
      avatarUrl = String(avatarUrl);
      if (!/^data:image\/(png|jpe?g|webp);base64,/.test(avatarUrl)) {
        return res
          .status(400)
          .json({ success: false, message: "Please upload a PNG, JPG or WEBP image" });
      }
      if (avatarUrl.length > 700 * 1024) {
        return res
          .status(400)
          .json({ success: false, message: "Image must be under 500 KB" });
      }
    }

    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: me } },
      include: { conversation: true },
    });
    if (!member || member.conversation.companyId !== req.clientUser.companyId) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }
    if (!member.conversation.isGroup) {
      return res
        .status(400)
        .json({ success: false, message: "Only group chats have a group photo" });
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { avatarUrl },
    });
    req.app
      .get("io")
      ?.to(`conversation:${conversationId}`)
      .emit("conversation:avatar", { conversationId, avatarUrl });

    return res.json({ success: true, conversationId, avatarUrl });
  } catch (error) {
    console.error("Group avatar update failed:", error);
    return res.status(500).json({ success: false, message: "Unable to update group photo" });
  }
});

export default router;