# BISPUN CRM — Manual Testing Checklist

**Branch:** `feat/mobile-ui-optimization` · **HEAD:** `213f21f` (your 5 fix commits + merged `origin/main`)
**Frontend:** http://localhost:5173 · **Backend:** http://localhost:4000 · **DB:** Neon **blue-mouse** (dev) — never `pond`.

## How to use
1. Open http://localhost:5173 and log in.
2. Go module by module, follow **Navigation → Action → Expected**.
3. Write what you saw in **Actual**, set **Result** to PASS / FAIL / NOT TESTED, add **Bug notes**.
4. **⛔ DO NOT EXECUTE** rows send real SMS/WhatsApp/email/Google invites or money — only run those if you explicitly decide to, with a test contact you own.

**Roles:** CA = Client Admin · MGR = Manager · EMP = Employee. Test the security rows with at least one Employee account and the Admin account.

Priority: **P1** = critical (security/login/data) · **P2** = important · **P3** = cosmetic.

---

## A. Login / Session (P1 — test first)
| ID | Role | Navigation | Action | Expected | Actual | Result | Prio |
|---|---|---|---|---|---|---|---|
| L1 | any | /login | Enter valid email+password, submit | Lands on Dashboard, no blank screen | | | P1 |
| L2 | any | after login | Hard-refresh (F5) | Stays logged in (session persists) | | | P1 |
| L3 | any | after login | Close tab, reopen http://localhost:5173 | Still logged in (valid session) | | | P1 |
| L4 | any | top bar / More | Click Log out | Returns to login; back button can't re-enter | | | P1 |
| L5 | any | — | Enter wrong password | Clear error, no crash, no lockout loop | | | P1 |
| L6 | EMP | — | Log in as Employee, then log out, log in as Admin | No Employee data leaks into Admin view (cache isolation) | | | P1 |

## B. Employee Lead Security (P1 — the key fix, Task 12)
| ID | Role | Navigation | Action | Expected | Actual | Result | Prio |
|---|---|---|---|---|---|---|---|
| S1 | EMP | Lead Store | View the leads list | Sees ONLY leads assigned to them (not all company leads) | | | P1 |
| S2 | EMP | Lead Store → Search / Filter | Search a lead known to be assigned to someone else | Not found / not shown | | | P1 |
| S3 | EMP | Lead Store → Export CSV | Export | CSV contains only their assigned leads | | | P1 |
| S4 | EMP | Dashboard | View KPIs / Leads by Source | Counts reflect only their leads | | | P1 |
| S5 | MGR | Lead Store | View list | Sees their team/department leads (not other teams) | | | P1 |
| S6 | CA | Lead Store | View list | Sees all company leads | | | P1 |
| S7 | EMP | — | Try opening another company's lead by direct URL/API | Blocked (404/unauthorized) | | | P1 |
| S8 | EMP | Dial & Track / Send Message | Try to call/message a non-assigned lead | Blocked | | | P1 |

## C. Dashboard (Tasks 8, 9)
| ID | Role | Navigation | Action | Expected | Actual | Result | Prio |
|---|---|---|---|---|---|---|---|
| D1 | any | Dashboard | Read "Leads by Source" donut + legend | Legend total reconciles with the center number (incl. "Unspecified"/"Direct Admission") | | | P2 |
| D2 | any | Dashboard | Change Period/Year filter | Chart + KPIs update correctly | | | P2 |
| D3 | any | Dashboard → Action Center → "Hot leads not contacted" | Click a lead row | Opens that exact Lead Details view | | | P1 |
| D4 | any | Dashboard → Action Center | Click a follow-up row | Opens the correct lead | | | P2 |
| D5 | mobile | Dashboard | View on phone width | Readable text, no horizontal overflow, cards legible | | | P2 |

## D. Lead Store (Tasks 11, 12 + existing)
| ID | Role | Navigation | Action | Expected | Actual | Result | Prio |
|---|---|---|---|---|---|---|---|
| LS1 | CA | Lead Store → Add Lead | Create a lead; in "Course / Interest" type to see suggestions | Searchable datalist suggests existing courses; custom value also accepted | | | P2 |
| LS2 | CA | Lead Store → Add Lead | Save | Lead appears in list with entered data | | | P1 |
| LS3 | CA | Lead Store → (row) Edit | Change a field, Save | Updates persist; Course/Interest preserved | | | P2 |
| LS4 | any | Lead Store → (row) View/Details | Open details | Correct lead data; read-only view; focus moves into the detail | | | P2 |
| LS5 | any | Lead Store → Search | Search by Lead ID, name, phone, email, course | Correct matches | | | P2 |
| LS6 | any | Lead Store → Filter | Filter by status / assignee / course / source | List filters correctly | | | P2 |
| LS7 | CA | Lead Store → Export CSV | Export | Downloads CSV of the currently visible leads | | | P2 |
| LS8 | CA | Lead Store → Import Leads | Import a small synthetic CSV | Imports; duplicates/invalid summarized | | | P2 |
| LS9 | CA | Lead Store → Bulk select → Assign | Reassign to a user | Assignment updates | | | P2 |
| LS10 | CA | Lead Store → Bulk select → **Send Message** | — | ⛔ **DO NOT EXECUTE** (real email) unless using your own test contact | | | P1 |
| LS11 | CA | Lead Store → Smart Nurture | Open; enroll a synthetic lead | UI works; ⛔ do not let it send real messages | | | P2 |
| LS12 | CA | Lead Store → column order | Reorder columns (merged main feature) | Order saves/persists | | | P3 |

## E. Departments (Task 10)
| ID | Role | Navigation | Action | Expected | Actual | Result | Prio |
|---|---|---|---|---|---|---|---|
| DP1 | CA | Settings → Users & Roles → Add User | Open the Department dropdown | Shows company departments (Admin, Sales, + any custom); no empty/stuck state | | | P2 |
| DP2 | CA | Settings → Users & Roles → Departments tab | Add a department | New department appears in the Add User dropdown | | | P2 |
| DP3 | CA | Add User | Submit with no department | Clear validation error (accessible) | | | P2 |
| DP4 | CA | Add User | Create a Manager, then assign an Employee to them | Works; manager relationship saved | | | P2 |

## F. Calendar & Google Meet (Tasks 1–5, 13)
| ID | Role | Navigation | Action | Expected | Actual | Result | Prio |
|---|---|---|---|---|---|---|---|
| G1 | EMP | Calendar → New event | Tick "Add video meeting", Save (Google NOT connected) | "Connect your Google account" **dialog** appears with a direct Connect button (no "go to Settings" dead-end) | | | P1 |
| G2 | EMP | that dialog | Click "Connect your Google account" | Opens Google consent (⚠ **NOT VERIFIED in dev — GOOGLE_CLIENT_ID not configured**) | | | BLOCKED |
| G3 | any | Calendar | View events created by colleagues | Event card shows the **organizer** name | | | P2 |
| G4 | any | Calendar | View week/day; events of the company | Company events visible; no cross-company events | | | P2 |
| G5 | any | New event + video meeting (Google connected) | Save | Meet link appears, or a "still generating" pending notice (never a fake link) | | | BLOCKED (needs Google) |

## G. Notifications (Tasks 6, 7)
| ID | Role | Navigation | Action | Expected | Actual | Result | Prio |
|---|---|---|---|---|---|---|---|
| N1 | any | Bell icon | Open notifications | List loads; unread badge correct | | | P2 |
| N2 | any | A lead follow-up notification | Click it | Opens that exact Lead Details (deep-link) | | | P1 |
| N3 | any | A calendar/other notification | Click it | Navigates to the correct module | | | P2 |
| N4 | any | — | Trigger a new notification (e.g. follow-up) | Sound plays, clearly audible, no distortion | | | P2 |
| N5 | any | repeated notifications | Observe | No duplicate/overlapping sounds | | | P2 |

## H. UTM Leads & Analytics (Task 14)
| ID | Role | Navigation | Action | Expected | Actual | Result | Prio |
|---|---|---|---|---|---|---|---|
| U1 | CA | UTM Leads | View links / leads / analytics | Loads without error | | | P2 |
| U2 | CA | UTM Leads → create a UTM link | Create (synthetic) | Link appears in the list | | | P2 |
| U3 | CA | UTM Leads → Import Leads | In the import modal, pick a **UTM link** in the new "Attribute to UTM link" dropdown + upload synthetic CSV | Imported leads attribute to that link | | | P2 |
| U4 | CA | UTM Analytics | After U3, view analytics | The imported leads now count under that campaign/source/medium | | | P2 |
| U5 | CA | UTM Leads → filters/search | Filter by source/medium/campaign | Filters correctly | | | P3 |

## I. Other modules (feature-preservation — must all still work)
| ID | Role | Navigation | Action | Expected | Actual | Result | Prio |
|---|---|---|---|---|---|---|---|
| M1 | CA | Admissions → Overall / Domestic / International | Open each | Loads; Walk-ins, Counselling, Admissions sub-tabs work | | | P2 |
| M2 | CA | Finance / Revenue | Open | Loads; figures render | | | P2 |
| M3 | CA | My Referrals / Referrals | Open | Loads | | | P2 |
| M4 | CA | Goals and Targets | Open; set a target | Loads; department filter works | | | P2 |
| M5 | CA | My Store | Open | Loads | | | P3 |
| M6 | CA | Chats | Open a conversation | Loads; messages render | | | P2 |
| M7 | CA | Insights / Analytics | Open | Loads | | | P2 |
| M8 | CA | Settings → Company/Branding/Lead Sources/Custom Fields/Notifications/Integrations/Activity Log | Open each tab | All present and load | | | P2 |
| M9 | any | Profile | Open; view | Loads | | | P3 |
| M10 | any | Help & Support | Open; create a ticket (synthetic) | Loads; ticket submits | | | P3 |
| M11 | any | Global Search | Search a term | Returns results / navigates | | | P3 |

## J. Mobile (phone width) — P1 visibility/navigation
| ID | Navigation | Action | Expected | Actual | Result | Prio |
|---|---|---|---|---|---|---|
| MO1 | any | Switch between Dashboard, Leads, Admissions, Finance | Fast navigation, no blank screens, keep-alive cache works | | | P1 |
| MO2 | Lead Store | Open a dropdown / form / bottom sheet | Usable on small screen; modal doesn't hide behind keyboard | | | P1 |
| MO3 | any | Scroll long lists | Smooth scrolling; no horizontal overflow | | | P2 |
| MO4 | any | Android back button (if on device) | Closes sheet/modal, not the whole app unexpectedly | | | P2 |
| MO5 | any | After editing a record | No stale data shown | | | P2 |

---

### Notes
- **DO NOT EXECUTE** without your explicit go-ahead: real Send Message / Bulk Messaging (LS10), Smart Nurture sends (LS11), real Google Meet invitations, any payment. Use only synthetic data.
- G2/G5 are **BLOCKED** in dev because Google OAuth (`GOOGLE_CLIENT_ID`) is not configured — mark them NOT TESTED unless you add dev Google credentials.
- Course/Interest is one combined field (no separate "Interest" DB column — see handoff report).
