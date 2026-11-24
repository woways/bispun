import {

  Router,

} from "express";



import prisma from "../lib/prisma.js";

import { canModifyCalendarEvent } from "../lib/calendarAccess.js";



import {

  requireClientUser,

} from "../middleware/clientAuth.js";



const router =

  Router();



router.use(

  requireClientUser

);



const VALID_TYPES = [

  "MEETING",

  "FOLLOW_UP",

  "COUNSELLING",

  "ADMISSION",

  "PAYMENT",

  "REMINDER",

  "OTHER",

];



const VALID_STATUSES = [

  "SCHEDULED",

  "COMPLETED",

  "CANCELLED",

];



const MIN_EVENT_YEAR = 2000;
const MAX_EVENT_YEAR = 2100;
const EVENT_TIME_ZONE = "Asia/Kolkata";

function cleanString(

  value

) {

  const result =

    String(

      value ?? ""

    ).trim();



  return (

    result ||

    null

  );

}



function parseDate(

  value

) {

  if (!value) {

    return null;

  }



  const date =

    new Date(

      value

    );



  return Number.isNaN(

    date.getTime()

  )

    ? null

    : date;

}

function isEventDateInAllowedRange(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return false;
  }

  const year = date.getUTCFullYear();
  return year >= MIN_EVENT_YEAR && year <= MAX_EVENT_YEAR;
}

function formatEventDateTime(date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: EVENT_TIME_ZONE,
  }).format(date);
}




function formatEvent(

  event

) {

  return {

    id:

      event.id,



    title:

      event.title,



    description:

      event.description,



    type:

      event.type,



    status:

      event.status,



    startAt:

      event.startAt,



    endAt:

      event.endAt,



    allDay:

      event.allDay,



    location:

      event.location,



    meetingRoom:

      event.meetingRoom,



    createdByUserId:

      event.createdByUserId,



    assignedToUserId:

      event.assignedToUserId,



    createdBy:

      event.createdByUser

        ? {

            id:

              event.createdByUser.id,



            name:

              event.createdByUser.name,



            email:

              event.createdByUser.email,

          }

        : null,



    assignedTo:

      event.assignedToUser

        ? {

            id:

              event.assignedToUser.id,



            name:

              event.assignedToUser.name,



            email:

              event.assignedToUser.email,



            role:

              event.assignedToUser.role,

          }

        : null,



    guests:

      Array.isArray(event.guests)

        ? event.guests.map((g) => ({

            id: g.id,

            userId: g.userId,

            name: g.user?.name || g.name || null,

            email: g.user?.email || g.email || null,

          }))

        : [],



    createdAt:

      event.createdAt,



    updatedAt:

      event.updatedAt,

  };

}



const includeUsers = {

  createdByUser: {

    select: {

      id:

        true,



      name:

        true,



      email:

        true,

    },

  },



  assignedToUser: {

    select: {

      id:

        true,



      name:

        true,



      email:

        true,



      role:

        true,

    },

  },

};



async function validateAssignee(

  companyId,

  userId

) {

  if (!userId) {

    return null;

  }



  return prisma.user.findFirst({

    where: {

      id:

        userId,



      companyId,



      active:

        true,

    },



    select: {

      id:

        true,

    },

  });

}



// --- Meeting guests -------------------------------------------------------
// The CalendarEventGuest table may not be migrated on every environment yet.
// Probe once and cache, so the calendar API degrades to "no guests" instead of
// returning 500s before the 0012 migration is applied.
let _guestsTableReady = null;

async function guestsEnabled() {
  if (_guestsTableReady !== null) return _guestsTableReady;
  try {
    const rows = await prisma.$queryRaw`SELECT to_regclass('"CalendarEventGuest"') AS t`;
    _guestsTableReady = Boolean(rows && rows[0] && rows[0].t);
  } catch {
    _guestsTableReady = false;
  }
  return _guestsTableReady;
}

const guestInclude = {
  guests: {
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  },
};

async function buildInclude() {
  return (await guestsEnabled())
    ? { ...includeUsers, ...guestInclude }
    : includeUsers;
}

// Normalise a guests payload (array of { userId?/id?, name?, email? }) to rows,
// de-duplicated. Only company users are linked by userId (validated below).
function normalizeGuests(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const g of input) {
    if (!g) continue;
    const userId = g.userId || g.id || null;
    const name = (g.name || "").toString().trim() || null;
    const email = (g.email || "").toString().trim() || null;
    if (!userId && !name && !email) continue;
    const key = userId || `${name}|${email}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ userId, name, email });
  }
  return out;
}

// Replace an event's guests (delete-all + recreate). No-op if table missing or
// the payload is undefined (so callers that don't send guests leave them alone).
async function syncGuests(companyId, eventId, input) {
  if (input === undefined) return;
  if (!(await guestsEnabled())) return;
  let rows = normalizeGuests(input);
  // Only keep userId links that belong to this company.
  const ids = rows.map((r) => r.userId).filter(Boolean);
  if (ids.length) {
    const valid = await prisma.user.findMany({
      where: { id: { in: ids }, companyId },
      select: { id: true },
    });
    const ok = new Set(valid.map((u) => u.id));
    rows = rows.map((r) => (r.userId && !ok.has(r.userId) ? { ...r, userId: null } : r));
  }
  await prisma.calendarEventGuest.deleteMany({ where: { eventId } });
  if (rows.length) {
    await prisma.calendarEventGuest.createMany({
      data: rows.map((r) => ({ ...r, eventId })),
    });
  }
}


/* GET USERS FOR ASSIGNMENT */



router.get(

  "/users",

  async (

    req,

    res

  ) => {

    try {

      const companyId =

        req.clientUser.companyId;



      const users =

        await prisma.user.findMany({

          where: {

            companyId,

            active:

              true,

          },



          select: {

            id:

              true,



            name:

              true,



            email:

              true,



            role:

              true,



            jobTitle:

              true,



            department:

              true,

          },



          orderBy: [

            {

              name:

                "asc",

            },

          ],

        });



      return res.json({

        success:

          true,



        users,

      });

    } catch (error) {

      console.error(

        "Failed to fetch calendar users:",

        error

      );



      return res

        .status(500)

        .json({

          success:

            false,



          message:

            "Unable to fetch users",

        });

    }

  }

);



/* GET EVENTS */



router.get(

  "/",

  async (

    req,

    res

  ) => {

    try {

      const companyId =

        req.clientUser.companyId;



      const from =

        parseDate(

          req.query.from

        );



      const to =

        parseDate(

          req.query.to

        );



      const where = {

        companyId,

      };



      if (

        from ||

        to

      ) {

        where.startAt = {};



        if (from) {

          where.startAt.gte =

            from;

        }



        if (to) {

          where.startAt.lte =

            to;

        }

      }



      const status =

        String(

          req.query.status ||

            ""

        )

          .trim()

          .toUpperCase();



      if (

        status &&

        VALID_STATUSES.includes(

          status

        )

      ) {

        where.status =

          status;

      }



      const assignedToUserId =

        cleanString(

          req.query

            .assignedToUserId

        );



      if (

        assignedToUserId

      ) {

        where.assignedToUserId =

          assignedToUserId;

      }



      const events =

        await prisma.calendarEvent.findMany({

          where,



          include:

            await buildInclude(),



          orderBy: {

            startAt:

              "asc",

          },

        });



      return res.json({

        success:

          true,



        events:

          events.map(

            formatEvent

          ),

      });

    } catch (error) {

      console.error(

        "Failed to fetch calendar events:",

        error

      );



      return res

        .status(500)

        .json({

          success:

            false,



          message:

            "Unable to fetch calendar events",

        });

    }

  }

);



/* FETCH ONE EVENT — resolves a notification deep-link to the exact event.
   Tenant-isolated: scoped strictly to the caller's company (same authorization
   as the list endpoint). A missing or other-company event returns 404 so the
   client shows a safe "no longer available" notice instead of leaking data. */

router.get("/:id", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    const id = cleanString(req.params.id);

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Event id is required" });
    }

    const event = await prisma.calendarEvent.findFirst({
      where: { id, companyId },
      include: await buildInclude(),
    });

    if (!event) {
      return res
        .status(404)
        .json({ success: false, message: "Calendar event not found" });
    }

    return res.json({ success: true, event: formatEvent(event) });
  } catch (error) {
    console.error("Failed to fetch calendar event:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to fetch calendar event" });
  }
});



/* CREATE EVENT */



router.post(

  "/",

  async (

    req,

    res

  ) => {

    try {

      const companyId =

        req.clientUser.companyId;



      const userId =

        req.clientUser.userId;



      const title =

        cleanString(

          req.body?.title

        );



      const description =

        cleanString(

          req.body

            ?.description

        );



      const location =

        cleanString(

          req.body?.location

        );



      const meetingRoom =

        cleanString(

          req.body?.meetingRoom

        ) || null;



      const type =

        String(

          req.body?.type ||

            "MEETING"

        )

          .trim()

          .toUpperCase();



      const status =

        String(

          req.body?.status ||

            "SCHEDULED"

        )

          .trim()

          .toUpperCase();



      const startAt =

        parseDate(

          req.body?.startAt

        );



      const endAt =

        parseDate(

          req.body?.endAt

        );



      const assignedToUserId =

        cleanString(

          req.body

            ?.assignedToUserId

        ) ||

        userId ||

        null;



      const allDay =

        req.body?.allDay ===

        true;



      if (!title) {

        return res

          .status(400)

          .json({

            success:

              false,



            message:

              "Event title is required",

          });

      }



      if (!startAt) {

        return res

          .status(400)

          .json({

            success:

              false,



            message:

              "A valid event start date and time is required",

          });

      }

      if (!isEventDateInAllowedRange(startAt)) {
        return res
          .status(400)
          .json({
            success: false,
            message: `Event date must be between ${MIN_EVENT_YEAR} and ${MAX_EVENT_YEAR}`,
          });
      }

      if (endAt && !isEventDateInAllowedRange(endAt)) {
        return res
          .status(400)
          .json({
            success: false,
            message: `Event end date must be between ${MIN_EVENT_YEAR} and ${MAX_EVENT_YEAR}`,
          });
      }



      if (

        !VALID_TYPES.includes(

          type

        )

      ) {

        return res

          .status(400)

          .json({

            success:

              false,



            message:

              "Invalid event type",

          });

      }



      if (

        !VALID_STATUSES.includes(

          status

        )

      ) {

        return res

          .status(400)

          .json({

            success:

              false,



            message:

              "Invalid event status",

          });

      }



      if (

        endAt &&

        endAt <

          startAt

      ) {

        return res

          .status(400)

          .json({

            success:

              false,



            message:

              "Event end time cannot be before the start time",

          });

      }



      if (

        assignedToUserId

      ) {

        const assignee =

          await validateAssignee(

            companyId,

            assignedToUserId

          );



        if (

          !assignee

        ) {

          return res

            .status(400)

            .json({

              success:

                false,



              message:

                "Assigned user is not available in this company",

            });

        }

      }



      const event =

        await prisma.calendarEvent.create({

          data: {

            companyId,



            title,



            description,



            type,



            status,



            startAt,



            endAt,



            allDay,



            location,



            meetingRoom,



            createdByUserId:

              userId ||

              null,



            assignedToUserId,

          },



          include:

            await buildInclude(),

        });



      if (

        event.assignedToUserId

      ) {

        await prisma.notification.create({

          data: {

            companyId,

            userId:

              event.assignedToUserId,

            title:

              "New calendar event assigned",

            message:

              `${event.title} is scheduled for ${formatEventDateTime(event.startAt)}.`,

            type:

              "INFO",

            actionModule:

              `calendar#event:${event.id}`,

            actionLabel:

              "Open calendar event",

          },

        });

      }



      await syncGuests(companyId, event.id, req.body?.guests);

      const createdEvent = await prisma.calendarEvent.findUnique({
        where: { id: event.id },
        include: await buildInclude(),
      });

      return res

        .status(201)

        .json({

          success:

            true,



          message:

            "Calendar event created",



          event:

            formatEvent(

              createdEvent || event

            ),

        });

    } catch (error) {

      console.error(

        "Failed to create calendar event:",

        error

      );



      return res

        .status(500)

        .json({

          success:

            false,



          message:

            "Unable to create calendar event",

        });

    }

  }

);



/* UPDATE EVENT */



router.patch(

  "/:id",

  async (

    req,

    res

  ) => {

    try {

      const companyId =

        req.clientUser.companyId;



      const existing =

        await prisma.calendarEvent.findFirst({

          where: {

            id:

              req.params.id,



            companyId,

          },

        });



      if (

        !existing

      ) {

        return res

          .status(404)

          .json({

            success:

              false,



            message:

              "Calendar event not found",

          });

      }



      if (!canModifyCalendarEvent(req.clientUser, existing)) {
        return res.status(403).json({
          success: false,
          forbidden: true,
          message: "You can only edit events you created or are assigned to",
        });
      }

      const data = {};



      if (

        req.body?.title !==

        undefined

      ) {

        const title =

          cleanString(

            req.body.title

          );



        if (!title) {

          return res

            .status(400)

            .json({

              success:

                false,



              message:

                "Event title cannot be empty",

            });

        }



        data.title =

          title;

      }



      if (

        req.body

          ?.description !==

        undefined

      ) {

        data.description =

          cleanString(

            req.body

              .description

          );

      }



      if (

        req.body

          ?.location !==

        undefined

      ) {

        data.location =

          cleanString(

            req.body.location

          );

      }



      if (

        req.body

          ?.meetingRoom !==

        undefined

      ) {

        data.meetingRoom =

          cleanString(

            req.body.meetingRoom

          ) || null;

      }



      if (

        req.body?.type !==

        undefined

      ) {

        const type =

          String(

            req.body.type

          )

            .trim()

            .toUpperCase();



        if (

          !VALID_TYPES.includes(

            type

          )

        ) {

          return res

            .status(400)

            .json({

              success:

                false,



              message:

                "Invalid event type",

            });

        }



        data.type =

          type;

      }



      if (

        req.body?.status !==

        undefined

      ) {

        const status =

          String(

            req.body.status

          )

            .trim()

            .toUpperCase();



        if (

          !VALID_STATUSES.includes(

            status

          )

        ) {

          return res

            .status(400)

            .json({

              success:

                false,



              message:

                "Invalid event status",

            });

        }



        data.status =

          status;

      }



      if (

        req.body

          ?.startAt !==

        undefined

      ) {

        const startAt =

          parseDate(

            req.body.startAt

          );



        if (

          !startAt

        ) {

          return res

            .status(400)

            .json({

              success:

                false,



              message:

                "Invalid event start date and time",

            });

        }
        if (!isEventDateInAllowedRange(startAt)) {
          return res
            .status(400)
            .json({
              success: false,
              message: `Event date must be between ${MIN_EVENT_YEAR} and ${MAX_EVENT_YEAR}`,
            });
        }




        data.startAt =

          startAt;

      }



      if (

        req.body?.endAt !==

        undefined

      ) {

        if (

          !req.body

            .endAt

        ) {

          data.endAt =

            null;

        } else {

          const endAt =

            parseDate(

              req.body.endAt

            );



          if (

            !endAt

          ) {

            return res

              .status(400)

              .json({

                success:

                  false,



                message:

                  "Invalid event end date and time",

              });

          }
          if (!isEventDateInAllowedRange(endAt)) {
            return res
              .status(400)
              .json({
                success: false,
                message: `Event end date must be between ${MIN_EVENT_YEAR} and ${MAX_EVENT_YEAR}`,
              });
          }




          data.endAt =

            endAt;

        }

      }



      if (

        req.body

          ?.allDay !==

        undefined

      ) {

        data.allDay =

          req.body

            .allDay ===

          true;

      }



      if (

        req.body

          ?.assignedToUserId !==

        undefined

      ) {

        const assignedToUserId =

          cleanString(

            req.body

              .assignedToUserId

          );



        if (

          assignedToUserId

        ) {

          const assignee =

            await validateAssignee(

              companyId,

              assignedToUserId

            );



          if (

            !assignee

          ) {

            return res

              .status(400)

              .json({

                success:

                  false,



                message:

                  "Assigned user is not available in this company",

              });

          }

        }



        data.assignedToUserId =

          assignedToUserId;

      }



      const finalStartAt =

        data.startAt ||

        existing.startAt;



      const finalEndAt =

        data.endAt !==

        undefined

          ? data.endAt

          : existing.endAt;



      if (

        finalEndAt &&

        finalEndAt <

          finalStartAt

      ) {

        return res

          .status(400)

          .json({

            success:

              false,



            message:

              "Event end time cannot be before the start time",

          });

      }



      const event =

        await prisma.calendarEvent.update({

          where: {

            id:

              existing.id,

          },



          data,



          include:

            await buildInclude(),

        });



      if (

        data.assignedToUserId &&

        data.assignedToUserId !==

          existing.assignedToUserId

      ) {

        await prisma.notification.create({

          data: {

            companyId,

            userId:

              data.assignedToUserId,

            title:

              "Calendar event assigned to you",

            message:

              `${event.title} is scheduled for ${formatEventDateTime(event.startAt)}.`,

            type:

              "INFO",

            actionModule:

              `calendar#event:${event.id}`,

            actionLabel:

              "Open calendar event",

          },

        });

      }



      await syncGuests(companyId, existing.id, req.body?.guests);

      const updatedEvent = await prisma.calendarEvent.findUnique({
        where: { id: existing.id },
        include: await buildInclude(),
      });

      return res.json({

        success:

          true,



        message:

          "Calendar event updated",



        event:

          formatEvent(

            updatedEvent || event

          ),

      });

    } catch (error) {

      console.error(

        "Failed to update calendar event:",

        error

      );



      return res

        .status(500)

        .json({

          success:

            false,



          message:

            "Unable to update calendar event",

        });

    }

  }

);



/* DELETE EVENT */



router.delete(

  "/:id",

  async (

    req,

    res

  ) => {

    try {

      const companyId =

        req.clientUser.companyId;



      const existing =

        await prisma.calendarEvent.findFirst({

          where: {

            id:

              req.params.id,



            companyId,

          },

        });



      if (

        !existing

      ) {

        return res

          .status(404)

          .json({

            success:

              false,



            message:

              "Calendar event not found",

          });

      }



      if (!canModifyCalendarEvent(req.clientUser, existing)) {
        return res.status(403).json({
          success: false,
          forbidden: true,
          message: "You can only delete events you created or are assigned to",
        });
      }

      await prisma.calendarEvent.delete({

        where: {

          id:

            existing.id,

        },

      });



      return res.json({

        success:

          true,



        message:

          "Calendar event deleted",

      });

    } catch (error) {

      console.error(

        "Failed to delete calendar event:",

        error

      );



      return res

        .status(500)

        .json({

          success:

            false,



          message:

            "Unable to delete calendar event",

        });

    }

  }

);



export default router;