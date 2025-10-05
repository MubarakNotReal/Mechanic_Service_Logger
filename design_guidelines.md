# Design Guidelines: Mechanic Shop Management System

## Design Approach

**Selected Approach:** Design System - Productivity Application Focus

**Justification:** This is a utility-focused, information-dense business management tool where efficiency, data clarity, and learnability are paramount. Drawing inspiration from modern productivity tools like Linear, Notion, and enterprise applications, prioritizing clean data presentation and workflow efficiency.

**Key Design Principles:**
- Data-first clarity: Information should be scannable and actionable
- Professional reliability: Business-appropriate aesthetics that build trust
- Workshop-friendly: High contrast, readable in various lighting conditions
- Efficiency-focused: Minimize clicks, maximize productivity

---

## Core Design Elements

### A. Color Palette

**Dark Mode (Primary):**
- Background: 220 15% 12% (deep slate, main canvas)
- Surface: 220 15% 16% (cards, elevated elements)
- Border: 220 10% 25% (subtle divisions)
- Primary: 210 100% 55% (vibrant blue for CTAs, links)
- Success: 142 70% 45% (green for completed services)
- Warning: 38 92% 50% (amber for pending/alerts)
- Danger: 0 72% 51% (red for critical actions)
- Text Primary: 210 20% 98% (high contrast white)
- Text Secondary: 215 15% 70% (muted for labels)

**Light Mode:**
- Background: 0 0% 100% (pure white)
- Surface: 210 20% 98% (subtle off-white)
- Border: 220 13% 91% (light gray borders)
- Primary: 210 100% 50% (slightly darker blue)
- Text Primary: 220 25% 10% (near black)
- Text Secondary: 220 10% 45% (medium gray)

### B. Typography

**Font Families:**
- Primary: 'Inter' (Google Fonts) - clean, professional sans-serif for all UI
- Monospace: 'JetBrains Mono' - for plate numbers, phone numbers, IDs

**Type Scale:**
- Page Headers: text-3xl font-bold (30px)
- Section Headers: text-xl font-semibold (20px)
- Card Titles: text-lg font-medium (18px)
- Body Text: text-base (16px)
- Labels: text-sm font-medium (14px)
- Helper Text: text-xs text-secondary (12px)

### C. Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, 16, 20
- Micro spacing (form fields, icons): 2, 4
- Component padding: 6, 8
- Section spacing: 12, 16, 20
- Page margins: 8, 12

**Grid System:**
- Dashboard: 3-column layout on desktop (sidebar + main + info panel)
- Tables: Full-width with responsive columns
- Forms: 2-column layout for data entry (label + input)
- Cards: 2-3 column grid for vehicle/customer cards

### D. Component Library

**Navigation:**
- Sidebar: Fixed left navigation (w-64) with logo, main nav links, user profile at bottom
- Top bar: Breadcrumbs, search bar (prominent center position), quick actions (right)
- Role indicator badge in user profile section

**Data Display:**
- Tables: Striped rows, sortable headers with arrow indicators, row hover states, action dropdowns on row end
- Cards: Elevated surface with subtle shadow, rounded-lg corners, header with icon, key stats, action buttons footer
- Stats Widgets: Large number display with trend indicators, icon background circles, compact footers with change percentages
- Search Results: Highlighted matching text, avatar/icon left, info middle, quick action right

**Forms:**
- Input Fields: Full-width with floating labels, border on focus with primary color, helper text below, error states in red
- Dropdowns: Custom styled with search capability for mechanics, vehicle types
- Date Pickers: Calendar popup with today highlight
- Submit Areas: Primary button (right aligned), secondary/cancel (left), confirmation modals for destructive actions

**Dashboard Widgets:**
- Recent Services: Timeline-style list with date markers, service type icons, customer quick links
- Quick Stats: 4-card grid showing total customers, vehicles serviced (this month), pending work, revenue
- Upcoming Maintenance: Card list with vehicle info, due date badges, action buttons

**Overlays:**
- Modals: Centered, max-w-2xl, backdrop blur, slide-up animation
- Confirmation Dialogs: Compact, clear action buttons, red for destructive actions
- Toast Notifications: Top-right position, auto-dismiss, icons for success/error/warning

### E. Visual Patterns

**Icons:**
- Use Heroicons (outline for navigation, solid for filled states)
- Size: h-5 w-5 for inline, h-6 w-6 for buttons, h-8 w-8 for feature icons

**Shadows:**
- Cards: shadow-sm on base, shadow-md on hover
- Modals: shadow-xl with backdrop blur
- Dropdowns: shadow-lg

**Borders:**
- Inputs: border-2 on focus
- Cards: border border-surface
- Dividers: border-t border-border

**Animations:**
- Minimal and purposeful only
- Page transitions: 200ms ease
- Button hover: scale-105 transform
- No decorative animations

---

## Page-Specific Layouts

### Dashboard (Home)
- **Header:** Welcome message with date, search bar center (w-96), notification bell + profile right
- **Stats Row:** 4-column grid of stat cards (customers, vehicles, services this month, pending)
- **Main Content:** 2-column grid (recent services timeline left, upcoming maintenance right)
- **Quick Actions:** Floating action button (bottom-right) for "New Service Entry"

### Customer Management
- **Search/Filter Bar:** Top with phone/name/plate search, filters (active/all)
- **Customer Table:** Columns: Name, Phone (monospace), Vehicles Count, Last Service, Total Spent, Actions
- **Add Customer Button:** Primary, top-right "Add New Customer"

### Service Entry Form
- **2-Column Layout:** Customer selection left (search dropdown), vehicle selection right
- **Service Details:** Full-width textarea for work performed, parts used (dynamic add/remove rows)
- **Cost Breakdown:** Grid: Labor cost, Parts cost, Tax, Total (auto-calculated, emphasized)
- **Footer:** Save, Save & Print, Cancel buttons

### Vehicle Details Page
- **Header Card:** Vehicle info (plate, make, model, year) with customer link
- **Service History:** Chronological timeline with expandable service details, download options
- **Maintenance Reminders:** Badge indicators for upcoming services

---

## Images

No hero images needed - this is a utility application focused on data and workflow. All visual interest comes from:
- Clean data presentation
- Consistent iconography (Heroicons)
- Professional color palette
- Well-structured layouts

The only imagery should be:
- Optional customer/vehicle avatars (small, circular placeholders with initials)
- Company logo in sidebar (compact, 40px height)
- Icon indicators for service types (oil change, brake work, etc.)