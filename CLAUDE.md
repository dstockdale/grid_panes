# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GridPanes is a Phoenix LiveView application that implements a sophisticated resizable grid layout system. The app allows users to create complex, nested layouts with draggable dividers (similar to VS Code's panel system) and includes an interactive editor (also built with the grid system) to visually design and validate layouts.

The editor allows users to:

-- Add and nest panes and grids via drag-and-drop.
-- Validate layout constraints in real-time.
-- Export reusable configuration and component code to use the grids in any LiveView.

The system supports multiple configuration modes:

-- Ephemeral: A static grid config is passed on mount. Users can resize, but changes are not saved.
-- Scoped persistence: Grid config is cached per user (e.g., via database or session), enabling personalized layouts.
-- Client persistence: Config is saved to localStorage or sessionStorage, enabling layout persistence between visits without backend involvement.

The goal is to support flexible, context-aware UI composition—bringing desktop-style layout behavior to LiveView apps.

## Architecture

### Core Components
- **Context**: `GridPanes.Grids` - Main business logic for grid operations
- **Schemas**: 
  - `Grid` - Container with embedded panes stored as JSON
  - `Pane` - Embedded schema representing individual panes or groups
- **LiveView Pages**: Index (demo), Show, Form for CRUD operations
- **Phoenix Component**: `ResizablePanes` - Renders the entire grid system
- **TypeScript Hook**: `GridResize` - Handles drag interactions and real-time resizing

### Pane System
- **Types**: `:group` (containers), `:pane` (content), `:divider` (auto-generated)
- **Size Units**: `:px` (fixed), `:fr` (CSS Grid fractions), `:auto`
- **Constraints**: `min_size`, `max_size`, `collapse_at`, `collapse_to`
- **Tree Structure**: Hierarchical parent-child relationships with validation

### Key Files
- `lib/grid_panes/grids.ex` - Context with real-time resize logic
- `lib/grid_panes/grids/grid.ex` - Main schema with tree validation
- `lib/grid_panes_web/components/resizable_panes.ex` - Core rendering component
- `assets/js/hooks/grid_resize.ts` - Frontend resize handling

## Development Commands

```bash
# Setup and Database
mix setup                    # Full project setup
mix ecto.setup              # Database setup only
mix ecto.reset              # Reset database

# Development Server
mix phx.server              # Start server (localhost:4000)
iex -S mix phx.server       # Start with IEx console

# Testing and Building
mix test                    # Run all tests
mix assets.build            # Build frontend assets
mix assets.deploy           # Production asset build
```

## Validation and Constraints

The Grid schema includes complex validations:
- Unique pane IDs within a grid
- Valid tree structure (no cycles, single root)
- Sibling order consistency (0, 1, 2...)
- Type-specific field requirements for panes vs groups

## Resizing Behavior

- **Fractional Units**: Zero-sum resizing between adjacent `fr` panes
- **Fixed Units**: Direct pixel manipulation for `px` panes
- **Constraints**: Real-time validation of min/max sizes and collapse thresholds
- **Auto-collapse**: Panes can collapse/expand based on size thresholds

## TypeScript Integration

The frontend uses Phoenix LiveView hooks with TypeScript classes:
- `Pane`, `Divider`, `GridResizeUtils` classes
- Event handling for mousedown/mousemove/mouseup
- Real-time constraint validation during drag operations