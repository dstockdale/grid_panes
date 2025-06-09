defmodule GridPanesWeb.GridLive.Index do
  use GridPanesWeb, :live_view

  alias GridPanes.Grids
  alias GridPanes.Grids.{Grid, Pane}

  import GridPanesWeb.Components.ResizablePanes

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.whole_screen flash={@flash}>
      <.resizable_grid grid={@layout_grid} id="resizable-grid">
        <:pane id="sidebar" class="bg-gray-50 overflow-hidden"></:pane>

        <:pane id="sidebar_top" class="overflow-hidden">
          Top
        </:pane>

        <:pane id="sidebar_middle" class="overflow-hidden">
          Sidebar Middle
        </:pane>

        <:pane id="sidebar_bottom" class="overflow-hidden">
          Bottom
        </:pane>

        <:pane id="main" class="overflow-hidden"></:pane>

        <:pane id="content" class="bg-blue-500 overflow-hidden"></:pane>

        <:pane id="content-left" class="bg-orange-500 overflow-x-hidden overflow-y-auto">
          <div class="p-6 h-full">
            <.live_component
              :if={!is_nil(@grid)}
              module={GridPanesWeb.GridLive.GridsFormComponent}
              id="polymorphic-ui"
              action={@live_action}
              grid={@grid}
            />
          </div>
        </:pane>

        <:pane id="content-right" class="bg-purple-500 h-full overflow-x-hidden overflow-y-auto">
          <div class="p-6 h-full">
            <.lorem lang="th" />
            <.lorem lang="ru" />
            <.lorem lang="th" />
            <.lorem lang="th" />
          </div>
        </:pane>

        <:pane id="footer" class="bg-pink-500 min-h-[30px]">
          <div class="text-white flex items-center justify-center h-full">
            <p>&copy; 2025 My App. All rights reserved.</p>
          </div>
        </:pane>
      </.resizable_grid>
    </Layouts.whole_screen>
    """
  end

  @impl true
  def mount(_params, _session, socket) do
    grid = %Grid{
      name: "Dashboard Layout",
      panes: [
        %Pane{
          id: "root",
          type: :group,
          direction: :column,
          children: ["sidebar", "main"],
          parent_id: nil,
          order: 0
        },
        # FIXED: Changed sidebar from :pane to :group and added direction
        %Pane{
          id: "sidebar",
          # Changed from :pane
          type: :group,
          # Added direction for row layout
          direction: :row,
          size_unit: :px,
          size_default: Decimal.new("300"),
          size_min: Decimal.new("60"),
          size_max: Decimal.new("500"),
          collapse_at: Decimal.new("120"),
          collapse_to: Decimal.new("60"),
          parent_id: "root",
          children: ["sidebar_top", "sidebar_middle", "sidebar_bottom"],
          order: 0,
          divider_position: :end,
          divider_size: Decimal.new("8")
        },
        %Pane{
          id: "sidebar_top",
          type: :pane,
          size_unit: :px,
          size_default: Decimal.new("100"),
          parent_id: "sidebar",
          children: [],
          divider_position: :end,
          divider_size: Decimal.new("8"),
          order: 0
        },
        %Pane{
          id: "sidebar_middle",
          type: :pane,
          size_unit: :fr,
          size_default: Decimal.new("1"),
          parent_id: "sidebar",
          children: [],
          divider_position: :end,
          divider_size: Decimal.new("8"),
          order: 1
        },
        %Pane{
          id: "sidebar_bottom",
          type: :pane,
          size_unit: :fr,
          size_default: Decimal.new("1"),
          parent_id: "sidebar",
          children: [],
          # Third row
          order: 2
        },
        %Pane{
          id: "main",
          type: :group,
          size_unit: :fr,
          size_default: Decimal.new("1"),
          direction: :row,
          children: ["content", "footer"],
          parent_id: "root",
          order: 1
        },
        %Pane{
          id: "content",
          type: :group,
          direction: :column,
          size_unit: :fr,
          size_default: Decimal.new("1"),
          parent_id: "main",
          # FIXED: Added content-middle to children array, fixed orders
          children: ["content-left", "content-middle", "content-right"],
          order: 0
        },
        %Pane{
          id: "content-left",
          type: :pane,
          size_unit: :fr,
          size_default: Decimal.new("1"),
          parent_id: "content",
          children: [],
          # First column
          order: 0,
          divider_position: :end,
          divider_size: Decimal.new("8")
        },
        %Pane{
          id: "content-right",
          type: :pane,
          size_unit: :fr,
          size_default: Decimal.new("1"),
          parent_id: "content",
          children: [],
          # Third column
          order: 2
        },
        %Pane{
          id: "footer",
          type: :pane,
          size_unit: :px,
          size_default: Decimal.new("60"),
          size_min: Decimal.new("30"),
          size_max: Decimal.new("100"),
          parent_id: "main",
          children: [],
          order: 1,
          divider_position: :start,
          divider_size: Decimal.new("8")
        }
      ]
    }

    # Create an empty grid for the form
    empty_grid = %Grid{
      name: "",
      description: "",
      panes: []
    }

    {:ok,
     socket
     |> assign(:grid, empty_grid)
     |> assign(:layout_grid, grid)
     |> assign(:live_action, :new)
     |> assign(:page_title, "Grid Designer")
     |> stream(:grids, Grids.list_grids())}
  end

  @impl true
  def handle_event("delete", %{"id" => id}, socket) do
    grid = Grids.get_grid!(id)
    {:ok, _} = Grids.delete_grid(grid)

    {:noreply, stream_delete(socket, :grids, grid)}
  end

  @impl true
  def handle_info({GridPanesWeb.GridLive.GridsFormComponent, {:saved, grid}}, socket) do
    {:noreply,
     socket
     |> put_flash(:info, "Grid \"#{grid.name}\" saved successfully!")
     |> stream_insert(:grids, grid)}
  end

  def handle_info({GridPanesWeb.GridLive.GridsFormComponent, {:cancelled}}, socket) do
    {:noreply, put_flash(socket, :info, "Grid editing cancelled")}
  end
end
