# 🚨 CRM/ERP Production QA Audit Report

**Date:** April 30, 2026
**Role:** Senior Full-Stack QA Engineer
**Focus:** Functional Completeness, Interaction Reliability, UX Edge Cases
**Overall Quality Score:** 6.5 / 10
**Production Readiness:** ❌ NOT READY FOR PRODUCTION

---

## 📋 Executive Summary
The application has a beautiful UI and a solid foundational architecture (React + Zustand + Supabase). However, under the hood, **it is riddled with "stubbed" functionality, silent failures, and missing UX protections**. Many buttons are purely decorative, critical table actions lack confirmation warnings, and several "Coming Soon" toast notifications block core functionality. 

**Major Risks:**
1. **Accidental Data Deletion**: Clicking a trash icon instantly deletes records without warning.
2. **Missing Forms**: Core CRUD operations (like creating Invoices or tracking Manual Time) do not have forms built.
3. **Ghost UI Actions**: Multiple kebab menus (⋯) are entirely empty or do not trigger state changes.
4. **Data Isolation**: Deleting a Project or Lead does not cleanly handle associated orphaned Tasks or Invoices in the UI.

---

## 🔍 1. Global Interaction Audit

| Severity | Component | Issue | Why It Fails | Fix Suggestion |
|---|---|---|---|---|
| 🔴 High | `TasksPage.tsx` | "Advanced filtering" button | Wired to `toast.info` | Implement actual filtering state in `tasksStore` and a UI popover. |
| 🔴 High | `BillingPage.tsx` | "Export" & "New Invoice" buttons | Wired to `toast.info` | Build `InvoiceForm.tsx` and a CSV export utility. |
| 🔴 High | `ReportsPage.tsx` | "Advanced Filter" & "Export PDF" | Wired to `toast.info` | Implement `jsPDF` for export and a filter dialog. |
| 🟡 Med | `Sidebar.tsx` | "Support" button | No `onClick` handler | Add `mailto:` link or a support modal. |
| 🟡 Med | `Dashboard.tsx` | Recent Activity List | Hardcoded "updated" actions | Map actual audit logs or activity feed from Supabase. |

---

## 🧩 2. Three-Dots (Kebab Menu) Audit

Dropdown menus are notorious for being overlooked. Here is the brutal truth:

| Location | Status | Findings | Action Required |
|---|---|---|---|
| **Dashboard Recent Activity** | ❌ BROKEN | The `<MoreVertical>` button in `Dashboard.tsx` (line 214) has absolutely no `DropdownMenu` wrapper. Clicking it does nothing. | Wrap icon in Radix `DropdownMenu` with "View Task" option. |
| **Settings Page (Users)** | ❌ BROKEN | The kebab menu in `SettingsPage.tsx` user list has no dropdown wrapper. Dead button. | Add `DropdownMenu` for "Edit Role", "Reset Password", "Revoke Access". |
| **Project Card** | ❌ MISSING | Cards lack quick actions. | Add kebab menu for quick Edit/Archive without entering the detail view. |

---

## 🧾 3. Form & Submission Audit

| Form | Validation | Error Handling | Loading State | Verdict |
|---|---|---|---|---|
| **LeadForm** | ✅ Zod schemas present | ✅ Toast errors | ❌ Missing loading spinner on submit button | **Passable**, but UX needs a loading state during Supabase delays. |
| **ProjectForm** | ✅ Zod schemas present | ✅ Toast errors | ❌ Missing loading spinner | **Passable**, needs loading spinner. |
| **TaskForm** | ✅ Zod schemas present | ✅ Toast errors | ❌ Missing loading spinner | **Passable**, needs loading spinner. |
| **InvoiceForm** | ❌ DOES NOT EXIST | N/A | N/A | **Critical Failure**. Cannot bill clients. |
| **Manual Time Log** | ❌ DOES NOT EXIST | N/A | N/A | **Critical Failure**. Can only use live timer, cannot log historical time. |

---

## 🔗 4. Navigation & Routing Audit

- **Client Portal Routes:** The routes `/portal/projects` and `/portal/invoices` render a raw text string `"Client Projects View Coming Soon"` inside a `PageWrapper`.
- **Breadcrumbs:** Missing entirely across the app. Deep linking to a Project Detail (`/projects/:id`) leaves the user with no easy way to navigate "Up" one level other than the browser back button or Sidebar.
- **Unauthorized Routing:** A logged-in user can navigate manually to `/login` and see the login screen again. It should redirect to `/` if a session exists.

---

## 📊 5. Table & Data Actions Audit

| Table | Edit Action | Delete Action | Filtering | Sorting |
|---|---|---|---|---|
| **LeadList** | Working | **DANGEROUS** (No confirmation prompt) | Basic local search | Missing |
| **InvoiceList**| N/A | Missing entirely | Missing | Missing |
| **TimeLogList**| Missing | Missing entirely | Missing | Missing |

**UX Violation:** In `LeadList.tsx`, clicking the Trash icon fires `deleteLead(lead.id)` instantly. One misclick destroys data permanently. A confirmation modal (e.g., Shadcn `AlertDialog`) is mandatory for production.

---

## 🔄 6. State Management Audit (Zustand)

- **Optimistic UI:** When deleting a lead, Zustand updates the local state array immediately, which is great. However, if the Supabase network request fails *after* local state updates, the UI will falsely show it as deleted until refreshed.
- **Data Fetching:** The app calls `fetchTasks()`, `fetchProjects()`, etc., repeatedly in `useEffect` hooks across multiple pages. This is inefficient. Zustand stores should cache data and only re-fetch if stale or manually refreshed.
- **Ghost Data:** Deleting a Project does not verify if Tasks are attached. Depending on Supabase cascade rules, this could leave "Ghost Tasks" in the Kanban board.

---

## 🔐 7. Supabase Integration Audit

- **RLS Policies:** Policies are applied strictly to `auth.role() = 'authenticated'`. This is a multi-tenant SaaS risk. Users can fetch data created by *other* users. Policies must be updated to restrict access to `user_id = auth.uid()` or via a shared `tenant_id` organization structure.
- **Error Handling:** `catch (error)` blocks in stores just push `err.message` to a toast. Supabase often returns cryptic PostgreSQL errors (e.g., `violates foreign key constraint`) which are terrible for end-users to see.

---

## 🧠 8. UX Logic Audit

1. **Kanban Board Drag-and-Drop:** While the UI is beautiful, dropping a task into a new column does not cleanly lock the UI or show a spinner while updating Supabase. If the network is slow, the card moves, but might bounce back later.
2. **Timer Start (TimeTrackingPage):** If the user forgets to type a description, the "Start" button is disabled. However, there is no tooltip explaining *why* it is disabled.
3. **Empty States:** `ProjectsPage.tsx` has a beautiful empty state. `InvoiceList` has a boring text row `No invoices found.` Consistency is needed.

---

## ⚠️ 9. Console & Runtime Errors

*(Currently resolved as of last build, but watch for these common react warnings:)*
- **React Keys:** Verify that mapped items in `Dashboard` recent activity use unique IDs.
- **Select.Item Empty Value:** Fixed previously, but ensure no other Radix `Select` components attempt to use `""` as a value.

---

## 🧪 10. Edge Case Testing Scenarios to Run

1. **Network Disconnect:** Start the timer, disable internet, try to stop the timer. (It will likely fail silently or crash).
2. **Rapid Clicking:** Click the "Delete Lead" button 5 times rapidly. Does it send 5 API requests to Supabase?
3. **Session Expiry:** Keep a tab open for 2 days. Click "New Project". Does it crash, or gracefully redirect to `/login`?

---

# 🚀 Top Priority Fixes (The "Do This Now" List)

If you have a meeting with your Team Lead tomorrow, focus on these immediately:

1. **Safety First:** Wrap the Delete Lead button in an `AlertDialog`. Never allow 1-click deletions.
2. **Missing Forms:** Build the `InvoiceForm` and `ManualTimeLogForm`. A CRM without invoicing is just a contact book.
3. **Clean Up Kebab Menus:** Remove the dead `<MoreVertical>` buttons in the Dashboard and Settings page, or wire them up to real dropdowns.
4. **Data Isolation:** Update Supabase RLS to filter by `user_id` so one user doesn't see another user's CRM leads.
