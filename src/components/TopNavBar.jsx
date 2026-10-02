import React, { useState } from "react";
import {
  AppBar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
  useColorScheme,
} from "@mui/material";
import BrightnessAutoIcon from "@mui/icons-material/BrightnessAuto";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import GitHubIcon from "@mui/icons-material/GitHub";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LinkIcon from "@mui/icons-material/Link";
import LightModeIcon from "@mui/icons-material/LightMode";

function nextColorScheme(mode) {
  const cycle = { system: "light", light: "dark", dark: "system" };
  return cycle[mode ?? "system"] ?? "system";
}

function colorSchemeLabel(mode) {
  return ({ system: "Auto", light: "Light", dark: "Dark" })[mode ?? "system"] ?? "Auto";
}

export function TopNavBar() {
  const { mode, setMode } = useColorScheme();
  const nextMode = nextColorScheme(mode);
  const [linksAnchor, setLinksAnchor] = useState(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const linksOpen = Boolean(linksAnchor);

  const closeLinks = () => setLinksAnchor(null);

  return (
    <AppBar position="static" elevation={0}>
      <Toolbar sx={{ gap: 1 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6" component="h1" sx={{ fontWeight: 700 }}>twiddler-ctl</Typography>
        </Box>
        <Tooltip title="Links">
          <IconButton
            color="inherit"
            aria-label="Twiddler resource links"
            aria-haspopup="menu"
            aria-expanded={linksOpen ? "true" : undefined}
            onClick={(event) => setLinksAnchor(event.currentTarget)}
          >
            <LinkIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={linksAnchor} open={linksOpen} onClose={closeLinks}>
          <MenuItem component="a" href="https://www.mytwiddler.com/doc/doku.php?id=start" target="_blank" rel="noopener noreferrer" onClick={closeLinks}>
            Docs
          </MenuItem>
          <MenuItem component="a" href="https://forum.mytwiddler.com" target="_blank" rel="noopener noreferrer" onClick={closeLinks}>
            Forums
          </MenuItem>
        </Menu>
        <Tooltip title="About">
          <IconButton color="inherit" aria-label="About twiddler-ctl" onClick={() => setInfoOpen(true)}>
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Appearance">
          <IconButton
            color="inherit"
            onClick={() => setMode(nextMode)}
            aria-label={`Appearance: ${colorSchemeLabel(mode)}. Switch to ${colorSchemeLabel(nextMode)} mode`}
          >
            {mode === "light" ? <LightModeIcon fontSize="small" />
              : mode === "dark" ? <DarkModeIcon fontSize="small" />
            : <BrightnessAutoIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Dialog open={infoOpen} onClose={() => setInfoOpen(false)} aria-labelledby="about-dialog-title">
          <DialogTitle id="about-dialog-title">twiddler-ctl</DialogTitle>
          <DialogContent>
            <DialogContentText>
              An unofficial web based config management tool for the Twiddler.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Tooltip title="GitHub">
              <IconButton
                component="a"
                href="https://github.com/kiwiz/twiddler-ctl-web"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub source code"
                sx={{ mr: "auto" }}
              >
                <GitHubIcon />
              </IconButton>
            </Tooltip>
            <Button onClick={() => setInfoOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Toolbar>
    </AppBar>
  );
}
