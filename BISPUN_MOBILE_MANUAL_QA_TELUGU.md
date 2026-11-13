# Bispun CRM — Android Mobile Manual QA Guide (Romanized Telugu)

**App:** Bispun CRM Android (integration/mobile-perf-a11y-20261112)
**Backend:** dev `bispun-mobile-dev` via `http://10.0.2.2:4001` (emulator) — isolated, NOT production.
**Device:** Pixel 6 emulator (emulator-5554) or physical Android phone.
**Test account:** `bispun.qa.admin@example.com` (role CLIENT_ADMIN). Password: meeku teliసిన dev password.

## Ela use cheyyali (how to use)
- Prati test ki: **Steps** follow avvandi → **Expected** tho compare cheyyandi → **Result** lo `[P]` (PASS) / `[F]` (FAIL) / `[B]` (BLOCKED) raayandi.
- FAIL aite: screenshot teeyandi (power + volume-down), ఏ screen lo, ఏమి jarigindi (actual) raayandi.
- Emulator lo "Pixel Launcher isn't responding" / "System UI isn't responding" vaste → **"Wait"** nokkandi. **Idi emulator slow valla — Bispun app bug kaadu.** (Physical phone lo idi raadu.)
- Performance (fast/smooth) sarిగ్గా measure cheyyali ante **physical phone** vాడandi — software emulator slow untundi.

---

## 1. Login / Session
- **M1.1 Login success:** Login screen lo email `bispun.qa.admin@example.com`, password type cheyyandi, **Sign in** nokkandi. **Expected:** Konni seconds lo Dashboard open avvali; blank screen raakudadu. Result: [ ]
- **M1.2 Wrong password:** Thappu password tho Sign in. **Expected:** Clear error message ("Invalid credentials" type), app crash avvakudadu, same login screen lo undali. Result: [ ]
- **M1.3 Loading state:** Sign in nokkినapుడు button/loader kanipించాలి; rendu sార్లు submit avvakూడదు (double-submit block). Result: [ ]
- **M1.4 Session persist (reopen):** Login ayyaka app ని మూసి (recent apps → swipe) మళ్ళీ open cheyyandi. **Expected:** Malli login అడగకుండా Dashboard open avvali. Result: [ ]
- **M1.5 Background/resume:** Home button → 10 sec taruvata app malli open. **Expected:** Ekkada unnామో akkade undali, re-login అవసరం ledu. Result: [ ]
- **M1.6 Logout + re-login:** More sheet → Logout. **Expected:** Login screen vస్తుంది. Malli login అయితే Dashboard vస్తుంది. Result: [ ]
- **M1.7 Network off:** Phone lo internet off chేసి app open/navigate. **Expected:** "Can't reach the server" type screen + "Try again" button; blank screen kాదు. Net on chేసి Try again → data వస్తుంది. Result: [ ]

## 2. Dashboard
- **M2.1 Greeting:** Dashboard paiన "Good Morning/Afternoon/Evening, <mee peru>" undali — **company peru kాదు, mee peru** undali. Result: [ ]
- **M2.2 KPI cards:** KPI cards 2-column lo, numbers clip avvakుండా, readable గా undali. Result: [ ]
- **M2.3 Charts:** Revenue Trend, Leads by Source, Admissions by Month charts load avvali; mొదట skeleton (loading) kanిపించి tarవాత chart వస్తుంది; chart mobile width dాటి overflow avvakudadu. Result: [ ]
- **M2.4 Widgets:** Business Pulse, Action Center, Recent Admissions, Team Performance — anni kanిపిస్తున్నాయా, values unnాయా. Result: [ ]
- **M2.5 Year/Period filter:** Top bar lo year/period mార్చితే dashboard data update avvali. Result: [ ]

## 3. Mobile Top Bar
- **M3.1 Elements:** Bispun logo, Bell (notifications), Search, Calendar, Period/Year, Avatar — anni kanిపిస్తున్నాయా. Result: [ ]
- **M3.2 Status bar overlap:** Top bar Android status bar (time/battery) kింద సరిగ్గా undali, overlap avvakudadu. Result: [ ]
- **M3.3 Unread badge:** Bell paiన unread notification count (undaite) kanిపించాలి. Result: [ ]
- **M3.4 Notifications sheet:** Bell nొక్కితే notifications list (bottom sheet) open avvali; "Mark all read" undali. Result: [ ]

## 4. Bottom Navigation
- **M4.1 5 tabs:** Dashboard, Leads, Admissions, Finance, More — 5 kanిపిస్తున్నాయా. Result: [ ]
- **M4.2 Tap feedback:** Prati tab nొక్కగానే venటనే response (no freeze), correct screen open avvali. Result: [ ]
- **M4.3 Active state:** Current tab highlight avtందా. Result: [ ]
- **M4.4 No reload/blank:** Tab mారినapుడు full-page reload kాదు, blank screen rాదు. Result: [ ]
- **M4.5 Safe area:** Bottom nav phone kింద gesture bar tho overlap avvakudadu. Result: [ ]

## 5. More Sheet
- **M5.1 Open:** "More" nొక్కితే bottom sheet open avvali. Result: [ ]
- **M5.2 Modules:** Chats, Goals & Targets, UTM Leads, Walk-ins, Counselling, Analytics, My Store, My Referrals, Search, Calendar, Settings, Help & Support, Profile/Logout — mీ role ki permit chేసినవి anni kanిపిస్తున్నాయా. Result: [ ]
- **M5.3 Back/Escape close:** Android **Back button** nొక్కితే sheet close avvali (app bయటకు వెళ్ళకూడదు). Result: [ ]
- **M5.4 Focus/scroll:** Sheet open ayినapుడు background scroll aగాలి; close అయ్యాక malli normal. Result: [ ]

## 6. Lead Store
- **M6.1 List + Lead ID:** Leads list, prati lead ki Lead ID (LDxxx) kanిపిస్తున్నాయా. Result: [ ]
- **M6.2 Search:** Name/Lead ID tho search chేస్తే correct results. Result: [ ]
- **M6.3 Lead details:** Oka lead open chేస్తే full details (phone, status, follow-up, remarks, activity) kanిపించాలి. Result: [ ]
- **M6.4 Edit lead:** Edit → oka field mార్చి save → change save avvali. Result: [ ]
- **M6.5 Actions:** Dial & Track, WhatsApp/Smart Nurture, Remarks add — buttons pani chేస్తున్నాయా (native actions = Section 18). Result: [ ]
- **M6.6 Filters:** Filters apply/clear pani chేస్తున్నాయా. Result: [ ]
- **M6.7 Mobile layout:** Table/card mobile lo సరిగ్గా, amounts off-screen vెళ్ళకూడదు. Result: [ ]

## 7. Admissions
- **M7.1 List + search/filters:** Admissions list, search, filters pani chేస్తున్నాయా. Result: [ ]
- **M7.2 Create/Edit:** Kొత్త admission / edit form — College, Stream, Branch, Status fields, save avtందా. Result: [ ]
- **M7.3 Attachments:** Attachment add/view pani chేస్తుందా. Result: [ ]
- **M7.4 Locked/confidential folder:** Admin-only locked folder access సరిగ్గా (unauthorized ki kanిపించకూడదు). Result: [ ]

## 8. Chats  (⚠ special: chat-header first render)
- **M8.1 Chat list open:** More → Chats mొదటిసారి open chేసినapుడు — **header row (mీ avatar, "Chats", Select, "+ New") top bar kింద సరిగ్గా kanిపించాలి, top bar venుకాల దాక్కోకూడదు.** (Idi documented bug — mొదటి render lo గమనించండి.) Result: [ ]
- **M8.2 New chat:** "+ New" → people list → oka user select → conversation open. Result: [ ]
- **M8.3 Send/receive:** Message type chేసి send → mీ message kanిపించాలి. (Receive testing ki **rendవ account** kావాలి — Section below.) Result: [ ]
- **M8.4 Keyboard composer:** Keyboard open ayినapుడు message box + Send keyboard paiన kanిపించాలి (venుకాల దాక్కోకూడదు). Result: [ ]
- **M8.5 Scroll:** Old messages scroll, "New messages" pill (కొత్త message vస్తే) pani chేస్తుందా. Result: [ ]
- **M8.6 Unread badge:** Unread count సరిగ్గా kanిపిస్తుందా. Result: [ ]
- **M8.7 Delete/clear:** Delete for me / Delete for everyone / Clear chat — options pani chేస్తున్నాయా. Result: [ ]

## 9. Counselling
- **M9.1 List/details:** List + oka session details open. Result: [ ]
- **M9.2 Create/edit + schedule:** Kొత్త session, date/time schedule, lead link, save. Result: [ ]
- **M9.3 Follow-up + status:** Follow-up / status change save avtందా. Result: [ ]

## 10. Walk-ins
- **M10.1 List/details + filters/search.** Result: [ ]
- **M10.2 Create/edit form** mobile lo సరిగ్గా, save avtందా. Result: [ ]
- **M10.3 Lead conversion/link** pani chేస్తుందా. Result: [ ]

## 11. Revenue / Finance
- **M11.1 Summaries + KPI** numbers సరిగ్గా, readable. Result: [ ]
- **M11.2 Payments/Receipts** list + oka receipt open/view. Result: [ ]
- **M11.3 Filters + tables** mobile lo scroll/readable. Result: [ ]
- **M11.4 Permissions:** Finance kి permit లేని role ki kanిపించకూడదు. Result: [ ]

## 12. UTM Leads
- **M12.1 UTM link generator** form సరిగ్గా, overflow lేదు. Result: [ ]
- **M12.2 UTM leads tables** + filters + date/year. Result: [ ]

## 13. Analytics
- **M13.1 Charts + KPI cards** mobile lo సరిగ్గా. Result: [ ]
- **M13.2 Drill-down:** KPI/chart nొక్కితే detail/records open. Result: [ ]
- **M13.3 Date/Year selector** pani chేస్తుందా. Result: [ ]

## 14. Referrals (My Referrals / Referral home)
- **M14.1 Referral home + list** kanిపిస్తున్నాయా. Result: [ ]
- **M14.2 Referral lifecycle** (Link → Referred → Earned → Credited) status సరిగ్గా. Result: [ ]

## 15. Goals & Targets
- **M15.1 Goals list/cards** readable, values సరిగ్గా. Result: [ ]
- **M15.2 Create/edit (permit unte)** save avtందా. Result: [ ]

## 16. My Store
- **M16.1 Store items/cards** mobile lo సరిగ్గా, bottom-sheet modal pani chేస్తుందా. Result: [ ]

## 17. Settings / Help / Profile / Account
- **M17.1 Settings** sections open, forms save avtందా. Result: [ ]
- **M17.2 Users & Roles / Access** (admin) open avtందా. Result: [ ]
- **M17.3 Help & Support:** Tickets list, kొత్త ticket create. Result: [ ]
- **M17.4 Profile + Account deletion request** screen open avtందా. Result: [ ]
- **M17.5 Subscription** info screen kanిపిస్తుందా. Result: [ ]

## 18. Native Android Actions
- **M18.1 Hardware Back:** Prati screen/overlay lo Android back button సరిగ్గా (overlay mందు close, tarవాత back navigate). Result: [ ]
- **M18.2 Phone dialer:** Lead lo call button → phone dialer open avvali (number tho). Result: [ ]
- **M18.3 SMS:** SMS action → SMS app open avvali. Result: [ ]
- **M18.4 WhatsApp:** WhatsApp action → WhatsApp open avvali (number tho). Result: [ ]
- **M18.5 File upload/download** (attachment) pani chేస్తుందా. Result: [ ]
- **M18.6 Keyboard:** Forms lo keyboard fields ని kappకూడదు. Result: [ ]

## 19. Firebase Notifications  (physical device/2nd account అవసరం కావచ్చు)
- **M19.1 Permission prompt:** Mొదటిసారి notification permission అడుగుతుందా (Android 13+). Result: [ ]
- **M19.2 Token registration:** Login tarవాత device token register avtందా (backend log lo kanిపిస్తుంది). Result: [ ]
- **M19.3 Foreground notification:** App open unnapుడు notification వస్తుందా. Result: [ ]
- **M19.4 Background/terminated:** App background/close lo notification వస్తుందా. **(FCM delivery ki real device + Firebase test path కావాలి — emulator lో limited.)** Result: [ ]
- **M19.5 Tap navigation:** Notification tap chేస్తే సరైన screen/lead open avvali. Result: [ ]

## 20. Logout / Re-login (final)
- **M20.1 Logout** → login screen; token clear avvali. Result: [ ]
- **M20.2 Re-login** → Dashboard. Result: [ ]
- **M20.3 Desktop unchanged:** (Browser lo) desktop CRM mారలేదు ani confirm — sidebar, layout, workflows same. Result: [ ]

---

## 21. PR #25 kొత్త features (latest main integration)
- **M21.1 Order History:** Settings/Account area lo (Current Subscription paiన) "Order History" card kanిపించాలి; nొక్కితే modal open ayి previous purchases/invoices/order details list avvali; "✕" / bయట tap chేస్తే close avvali. Result: [ ]
- **M21.2 Order History a11y:** Modal ki "Order History" label undి, keyboard/focus సరిగ్గా (focus ring kనిపించాలి). Result: [ ]
- **M21.3 Grouped sign-in notifications:** rendu-mూడు sార్లు logout→login chేస్తే, notifications list lo prati sign-in ki kొత్త row rాకుండా **oke rolling "sign-in" notification** (count tho) undali; "Review sessions" action undali; Lead/CRM notifications burry avvakూడదు. Result: [ ]
- **M21.4 Help drill-downs / dashboard renames (12,14):** Help section drill-downs pani chేస్తున్నాయా; dashboard section peru-లు (renames) సరిగ్గా kanిపిస్తున్నాయా. Result: [ ]

## 22. D-07 — Calendar reminder (10 nిమిషాలు mundu) + sound
**Note:** Reminder architecture **already implemented** (server `calendarReminders.js`: 10-min, event title, dedup, owner/tenant scope → Notification → FCM; mobile `mobilePush.js`: channel `sound:"default"` + foreground sound + tap routing). **Verification ki kావలసినవి:** (a) dev backend lo calendar reminder worker ON undాలి (ippudు `DISABLE_BACKGROUND_WORKERS=true` valla OFF — backend owner/Track A tho isolated test path coordinate cheyyali, Production workers enable cheyyakూడదు), (b) **real device + Firebase** (emulator FCM limited). Kింది tests aa setup unnప్పుడే run cheyyandi.
**Preconditions:** latest APK, login, notification permission allowed, notification volume on, DND off, dev backend (worker ON), calendar accessible.
- **D07-01 Event create:** Mobile Calendar → event: Title `QA Mobile Reminder Test`, start = ippటి time + 12–15 nిమిషాలు. Save avvali, title సరిగ్గా. Result: [ ]
- **D07-02 Reminder timing:** Reminder = start − 10 min daగ్గర rావాలి (platform variability ok). Actual arrival time + difference raayandi. Result: [ ]
- **D07-03 Content:** Notification lo సరైన event title, సరైన recipient; vేరే tenant/user data undకూడదు. Result: [ ]
- **D07-04 Sound:** Notification తో audible sound (comfortable, noticeable) play avvali; duplicate sound rాకూడదు. Result: [ ]
- **D07-05 Foreground:** App open unnప్పుడు reminder + sound + tap→calendar. Result: [ ]
- **D07-06 Background:** Home nొక్కి app background lo unnప్పుడు (force-stop kాదు) → notification + sound + tap→calendar. Result: [ ]
- **D07-07 Update/cancel:** Reminder time mundu event reschedule/cancel chేస్తే → paత reminder rాకూడదు; kొత్తది సరిగ్గా. Result: [ ]
- **D07-08 Permission denied:** Notification permission deny chేస్తే → app crash avvakూండా gracefully handle cheyyali. Result: [ ]

## Known blockers / needs (report after testing)
- **2-user chat (M8.3 receive):** rendవ dev account (same tenant) kావాలి — cheppandi, create chేస్తాను/steps ఇస్తాను.
- **FCM delivery (M19.3–19.5):** real device + Firebase test notification path కావాలి.
- **Performance numbers:** physical phone meeda measure cheyyandi (emulator slow).
- **Chat-header (M8.1):** FAIL aite screenshot + "first render lo header ekkada undi" cheppandi — venటనే fix chేస్తాను.

Ye test FAIL ayినా, aa Test ID + screenshot + actual behavior cheppandi. Nenu Mobile-side defect ni fix chేసి, malli ఇస్తాను.
