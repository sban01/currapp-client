/* eslint-disable react-refresh/only-export-components -- lazy page consts live beside the menu config; HMR full-reload is fine here */
import { lazy } from "react";
import type { ReactNode } from "react";
import DashboardIcon from "@mui/icons-material/Dashboard";
import EventNoteIcon from "@mui/icons-material/EventNote";
import ListAltIcon from "@mui/icons-material/ListAlt";
import PersonIcon from "@mui/icons-material/Person";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SearchIcon from "@mui/icons-material/Search";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";
import GroupsIcon from "@mui/icons-material/Groups";
import SummarizeOutlinedIcon from "@mui/icons-material/SummarizeOutlined";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import ChecklistIcon from "@mui/icons-material/Checklist";
// Pages are code-split: each route's module is fetched on first visit (App wraps
// the routes in <Suspense>). Named-export pages are adapted to lazy()'s default.
const LOProgressPage = lazy(() => import("../page-components/progress/ProgressPage").then((m) => ({ default: m.LOProgressPage })));
const MissingNamesPage = lazy(() => import("../page-components/progress/ProgressPage").then((m) => ({ default: m.MissingNamesPage })));
const ScheduleProgressPage = lazy(() => import("../page-components/progress/ProgressPage").then((m) => ({ default: m.ScheduleProgressPage })));
const ScheduleActivitiesPage = lazy(() => import("../page-components/schedule/SchedulePage").then((m) => ({ default: m.ScheduleActivitiesPage })));
const ScheduleMainPage = lazy(() => import("../page-components/schedule/SchedulePage").then((m) => ({ default: m.ScheduleMainPage })));
const SchedulePersonalPage = lazy(() => import("../page-components/schedule/SchedulePersonalPage"));
const ObjectivesPage = lazy(() => import("../page-components/objectives/ObjectivesPage"));
const ObjectivesSearchPage = lazy(() => import("../page-components/objectives/ObjectivesSearchPage"));
const ObjectivesTracePage = lazy(() => import("../page-components/objectives/ObjectivesTracePage"));
const AdminPage = lazy(() => import("../page-components/admin/AdminPage"));
const ScheduleAdminPage = lazy(() => import("../page-components/scheduleadmin/ScheduleAdminPage"));
const CMAdminPage = lazy(() => import("../page-components/cmadmin/CMAdminPage"));
import type { Role } from "../types";

/**
 * Single source of truth for navigation + routing (name -> path -> component),
 * with `children` for sublevels and an optional minimum `roles` set. Layout
 * renders the sidebar from this; App generates the routes. A group's roles
 * are inherited by its children.
 *
 * Role gating here is client-side convenience only — see lib/roles.ts. The
 * real access control is enforced by the API on every request.
 */
export interface MenuItem {
  label: string;
  path?: string;
  icon?: ReactNode;
  element?: ReactNode;
  roles?: Role[];
  children?: MenuItem[];
}

export const MENU: MenuItem[] = [
  {
    label: "Progress",
    icon: <DashboardIcon />,
    children: [
      { label: "Schedule progress", path: "/progress/schedule", icon: <SummarizeOutlinedIcon />, element: <ScheduleProgressPage /> },
      { label: "Missing names", path: "/progress/missing-names", icon: <PersonOffIcon />, element: <MissingNamesPage /> },
      { label: "LO progress", path: "/progress/lo", icon: <ChecklistIcon />, element: <LOProgressPage /> },
    ],
  },
  {
    label: "Schedule",
    icon: <EventNoteIcon />,
    children: [
      { label: "Personal", path: "/schedule/personal", icon: <PersonIcon />, element: <SchedulePersonalPage /> },
      { label: "Main", path: "/schedule/main", icon: <EventNoteIcon />, element: <ScheduleMainPage /> },
      { label: "Activities", path: "/schedule/activities", icon: <ListAltIcon />, element: <ScheduleActivitiesPage /> },
    ],
  },
  {
    label: "Objectives",
    icon: <MenuBookIcon />,
    children: [
      { label: "View / download", path: "/objectives", icon: <MenuBookIcon />, element: <ObjectivesPage /> },
      { label: "Search", path: "/objectives/search", icon: <SearchIcon />, element: <ObjectivesSearchPage /> },
      { label: "Trace objectives", path: "/objectives/trace", icon: <AccountTreeIcon />, element: <ObjectivesTracePage /> },
    ],
  },
  {
    label: "Admin",
    path: "/admin",
    icon: <AdminPanelSettingsIcon />,
    roles: ["admin"],
    element: <AdminPage />,
  },
  {
    label: "Schedule Admin",
    path: "/scheduleadmin",
    icon: <EditCalendarIcon />,
    roles: ["admin", "scheduler", "CD"],
    element: <ScheduleAdminPage />,
  },
  {
    label: "CM Admin",
    path: "/cmadmin",
    icon: <GroupsIcon />,
    roles: ["admin", "CM"],
    element: <CMAdminPage />,
  },
];

export interface RouteLeaf {
  path: string;
  element: ReactNode;
  roles?: Role[];
}

/** Flatten the menu to routable leaves (path + element), carrying the
 *  inherited minimum roles down from parent groups. */
export function routeLeaves(items: MenuItem[] = MENU, inheritedRoles?: Role[]): RouteLeaf[] {
  const out: RouteLeaf[] = [];
  for (const it of items) {
    const roles = it.roles ?? inheritedRoles;
    if (it.path && it.element) out.push({ path: it.path, element: it.element, roles });
    if (it.children) out.push(...routeLeaves(it.children, roles));
  }
  return out;
}
