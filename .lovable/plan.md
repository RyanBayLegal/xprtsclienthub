

# Client Onboarding & Lead Tracking System

## Overview
A CRM-style web app for managing leads from first contact through to signed clients, with detailed client profiles. Your team manages the pipeline while clients can fill in parts of their own profile.

---

## 1. Authentication & Roles
- **Team login** (email/password) for your staff to manage leads and client profiles
- **Client login** so clients can view/complete their own profile
- Two roles: **Admin/Team** and **Client**

## 2. Lead Tracking Dashboard
A table view (inspired by your spreadsheet) to manage your sales pipeline:
- **Columns**: Name, Contact, Source, Website, Date Reached, Follow-up Email Sent, Date, Needs, Booked, Email Sent With Info, Next Steps, Follow-up Email After, Stage, Notes
- **Features**: Sort/filter by stage, search by name, inline editing for quick updates
- Click any lead to open their full Client Profile

## 3. Client Profile Page
A detailed profile form (based on your Client Profile template) with these sections:
- **Basic Info**: Name, Role, Company, Practice Area, Economic Buyer/Decision Maker checkbox
- **Assessment**: Key Attributes, Attitude (Internal Assessment), Stage, Pain Points, Influences, Motivators
- **Relationship**: Repeat Customer Probability, Meeting Preferences, Client Health Score
- **Business**: Future Plans, Roles Open (30-60 days) — a mini-table with role name, signed status, and pricing
- **Discovery**: Source, how they found you, notes

## 4. Client-Facing View
- Clients log in and see a simplified version of their profile
- They can fill in fields like Company info, Pain Points, Meeting Preferences, and Needs
- Team-only fields (Attitude, Health Score, etc.) are hidden from clients

## 5. Database (Supabase)
- **Leads table**: All pipeline tracking fields
- **Client profiles table**: Detailed profile data linked to leads
- **Roles table**: Team vs. Client access control
- **Row-Level Security**: Clients can only see/edit their own profile; team sees everything

## 6. Design & UX
- Clean, professional look with a sidebar navigation
- Dashboard as the home page with lead counts by stage
- Responsive design for use on desktop and tablet

