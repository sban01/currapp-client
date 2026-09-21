import type { ReactNode } from "react";
import { useState } from "react";
import type { MouseEvent } from "react";
import {
  AppBar, Avatar, Autocomplete, Box, Collapse, Drawer, IconButton, List, ListItemButton,
  ListItemIcon, ListItemText, Menu, MenuItem, Paper, TextField, Toolbar, Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth/authContext";
import { MENU } from "../config/menu";
import type { MenuItem as NavItem } from "../config/menu";
import { hasRole } from "../lib/roles";
import { useGlobals } from "../lib/GlobalsContext";
import type { TermMonth } from "../lib/GlobalsContext";
import type { Role } from "../types";

const DRAWER_WIDTH = 240;
const TERM_MONTHS: TermMonth[] = ["January", "April", "August"];

/** Recursive sidebar entries from the menu config, filtered by the user's role.
 *  Groups (items with children) expand/collapse; leaves navigate. */
function NavList({ items, role, depth = 0 }: { items: NavItem[]; role?: Role; depth?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <List disablePadding>
      {items.filter((it) => hasRole(role, it.roles)).map((it) => {
        const hasChildren = !!it.children?.length;
        const isOpen = open[it.label] ?? true; // groups default open
        const selected = !!it.path && location.pathname === it.path;
        return (
          <Box key={it.label}>
            <ListItemButton
              selected={selected}
              sx={{ pl: 2 + depth * 2 }}
              onClick={() =>
                hasChildren
                  ? setOpen((o) => ({ ...o, [it.label]: !isOpen }))
                  : it.path && navigate(it.path)
              }
            >
              {it.icon && <ListItemIcon sx={{ minWidth: 36 }}>{it.icon}</ListItemIcon>}
              <ListItemText primary={it.label} sx={{ "& .MuiListItemText-primary": { fontSize: 14 } }} />
              {hasChildren && (isOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />)}
            </ListItemButton>
            {hasChildren && (
              <Collapse in={isOpen} timeout="auto" unmountOnExit>
                <NavList items={it.children!} role={role} depth={depth + 1} />
              </Collapse>
            )}
          </Box>
        );
      })}
    </List>
  );
}

/** Term-month/year selectors — every report and admin page reads the
 *  selected term from GlobalsContext, so this is the single place it's set. */
function TermSelect() {
  const { termY, termM, setTermY, setTermM } = useGlobals();
  return (
    <Paper
      elevation={2}
      sx={{ display: "flex", gap: 1, px: 1.5, py: 1, bgcolor: "background.paper", borderRadius: 2 }}
    >
      <Autocomplete
        id="termM"
        options={TERM_MONTHS}
        value={termM}
        disableClearable
        size="small"
        sx={{ width: 140 }}
        onChange={(_e, value) => setTermM(value)}
        renderInput={(params) => <TextField {...params} label="term month" />}
      />
      <TextField
        id="termY"
        label="term year"
        type="number"
        size="small"
        value={termY}
        slotProps={{ htmlInput: { min: 2020, max: new Date().getFullYear() + 2 } }}
        sx={{ width: 110 }}
        onChange={(e) => setTermY(Number(e.target.value))}
      />
    </Paper>
  );
}

function getInitials(name: string): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

/** App shell: top bar (title + term selectors + user menu) with a permanent
 *  left navigation drawer rendered from the menu config. */
export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const displayName = user?.name || user?.username || "?";
  const openMenu = (e: MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const closeMenu = () => setAnchorEl(null);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* very light blue: the primary colour at 20% opacity, dark text */}
      <AppBar
        position="static"
        color="primary"
        elevation={0}
        sx={(t) => ({
          bgcolor: alpha(t.palette.primary.main, 0.15),
          color: "text.primary",
          borderBottom: 1,
          borderColor: alpha(t.palette.primary.main, 0.15),
        })}
      >
        <Toolbar sx={{ gap: 2 }}>
          <Box
            component="a"
            href="https://cai.sgu.edu"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="CAi"
            sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}
          >
            <Box
              component="img"
              src={`${import.meta.env.BASE_URL}logo_cai.svg`}
              alt="CAi"
              sx={{ height: 55, display: "block" }}
            />
          </Box>
          <Box sx={{ flexGrow: 1, display: "flex", justifyContent: "center" }}>
            <Typography variant="h6" component="div" sx={{fontSize: 30, fontWeight: 600, whiteSpace: "nowrap" }}>
              SOM Curriculum App
            </Typography>
          </Box>
          <TermSelect />
          <IconButton onClick={openMenu} size="small">
            <Avatar sx={{ width: 45, height: 45, bgcolor: "secondary.main", fontSize: 24 }}>
              {getInitials(displayName)}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
            <MenuItem disabled>{user?.username || user?.name}</MenuItem>
            <MenuItem
              onClick={() => {
                queryClient.clear();
                closeMenu();
              }}
            >
              Clear data cache
            </MenuItem>
            <MenuItem
              onClick={() => {
                closeMenu();
                logout();
              }}
            >
              Sign out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: "flex", flexGrow: 1 }}>
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH, position: "relative", borderRight: 1, borderColor: "divider" },
          }}
        >
          <NavList items={MENU} role={user?.role} />
        </Drawer>

        <Box component="main" sx={{ flexGrow: 1, p: 2, minWidth: 0 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
