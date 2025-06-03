defmodule GridPanesWeb.Components.ResizablePanes do
  use Phoenix.Component

  alias GridPanes.Grids.{Grid, Pane}

  @pane_defaults %{
    class: ""
  }

  attr :id, :string, required: true
  attr :grid, Grid, required: true
  attr :class, :string, default: "h-full"
  attr :rest, :global

  slot :pane, required: true do
    attr :id, :string
    attr :class, :string
  end

  def resizable_grid(assigns) do
    panes_by_id = Map.new(assigns.grid.panes, &{&1.id, &1})

    groups =
      assigns.grid.panes
      |> Enum.filter(&(&1.type == :group))
      |> Map.new(fn group ->
        ordered_children =
          assigns.grid.panes
          |> Enum.filter(&(&1.parent_id == group.id))
          |> Enum.sort_by(& &1.order)
          |> Enum.map(& &1.id)

        {group.id, ordered_children}
      end)

    root_pane = Enum.find(assigns.grid.panes, &(&1.parent_id == nil))

    pane_content_map =
      assigns.pane
      |> Enum.map(fn pane_slot ->
        {pane_slot.id, pane_slot}
      end)
      |> Map.new()

    assigns =
      assigns
      |> assign(:panes_by_id, panes_by_id)
      |> assign(:groups, groups)
      |> assign(:root_id, root_pane && root_pane.id)
      |> assign(:pane_content_map, pane_content_map)

    ~H"""
    <.pane_styles panes_by_id={@panes_by_id} groups={@groups} />

    <.render_pane
      pane_id={@root_id}
      panes_by_id={@panes_by_id}
      groups={@groups}
      pane_content_map={@pane_content_map}
    />
    """
  end

  # Render a pane recursively
  defp render_pane(assigns) do
    pane = Map.get(assigns.panes_by_id, assigns.pane_id)
    assigns = assign(assigns, :current_pane, pane)

    case assigns.current_pane.type do
      :group -> render_pane_group(assigns)
      :pane -> render_single_pane(assigns)
    end
  end

  # Render a pane group with its children and dividers
  defp render_pane_group(%{current_pane: %{id: "root"}} = assigns) do
    children = Map.get(assigns.groups, assigns.current_pane.id, [])

    # Generate the grid items (panes + dividers)
    grid_items = generate_grid_items(children, assigns.panes_by_id)

    assigns = assign(assigns, :grid_items, grid_items)

    ~H"""
    <div
      id={@current_pane.id}
      data-pane-id={@current_pane.id}
      data-pane-type="group"
      data-pane-direction={@current_pane.direction}
      class="relative h-dvh"
    >
      <%= for item <- @grid_items do %>
        <%= case item.type do %>
          <% :pane -> %>
            <.render_pane
              pane_id={item.id}
              panes_by_id={@panes_by_id}
              groups={@groups}
              pane_content_map={@pane_content_map}
              pane_direction={@current_pane.direction}
            />
          <% :divider -> %>
            <div
              id={item.id}
              class="bg-gray-300 hover:bg-gray-400 cursor-col-resize flex items-center justify-center"
              data-pane-id={item.id}
              data-pane-type="divider"
              data-pane-size-unit="px"
              data-pane-target={item.target}
              data-pane-direction={@current_pane.direction}
              data-pane-before={item.pane_before}
              data-pane-after={item.pane_after}
              phx-hook="GridResize"
            >
              <div class="w-1 h-8 bg-gray-500 rounded"></div>
            </div>
        <% end %>
      <% end %>
    </div>
    """
  end

  defp render_pane_group(assigns) do
    children = Map.get(assigns.groups, assigns.current_pane.id, [])

    # Generate the grid items (panes + dividers)
    grid_items = generate_grid_items(children, assigns.panes_by_id)

    # Get slot content for this group (if any)
    content = Map.get(assigns.pane_content_map, assigns.current_pane.id, %{})
    merged_content = Map.merge(@pane_defaults, content)

    assigns =
      assigns
      |> assign(:grid_items, grid_items)
      |> assign(:merged_content, merged_content)
      |> assign(:inner_block, content)

    ~H"""
    <div
      id={@current_pane.id}
      data-pane-id={@current_pane.id}
      data-pane-type="group"
      data-pane-direction={@current_pane.direction}
      class={["relative", @merged_content.class]}
    >
      <%= for item <- @grid_items do %>
        <%= case item.type do %>
          <% :pane -> %>
            <.render_pane
              pane_id={item.id}
              panes_by_id={@panes_by_id}
              groups={@groups}
              pane_content_map={@pane_content_map}
              pane_direction={@current_pane.direction}
            />
          <% :divider -> %>
            <div
              id={item.id}
              class={divider_classes(@current_pane.direction)}
              data-pane-id={"#{item.id}-divider"}
              data-pane-type="divider"
              data-pane-direction={@current_pane.direction}
              data-pane-target={item.target}
              data-pane-divider-position={item.divider_position}
              phx-hook="GridResize"
            >
              <div class={divider_handle_classes(@current_pane.direction)}></div>
            </div>
        <% end %>
      <% end %>

      <%= if @inner_block do %>
        {render_slot(@inner_block)}
      <% end %>
    </div>
    """
  end

  # Generate grid items including dividers
  defp generate_grid_items(children, panes_by_id) do
    children
    |> Enum.with_index()
    |> Enum.flat_map(fn {child_id, index} ->
      pane = Map.get(panes_by_id, child_id)
      items = []

      # Add divider at start if needed
      items =
        if pane.divider_position == :start do
          divider_item = %{
            type: :divider,
            id: "#{child_id}-start-divider",
            target: child_id,
            pane_before: nil,
            pane_after: child_id,
            divider_position: pane.divider_position
          }

          items ++ [divider_item]
        else
          items
        end

      # Add the pane
      pane_item = %{type: :pane, id: child_id}
      items = items ++ [pane_item]

      # Add divider at end if needed
      items =
        if pane.divider_position == :end do
          next_child_id = Enum.at(children, index + 1)

          divider_item = %{
            type: :divider,
            id: "#{child_id}-end-divider",
            target: child_id,
            pane_before: child_id,
            pane_after: next_child_id,
            divider_position: pane.divider_position
          }

          items ++ [divider_item]
        else
          items
        end

      items
    end)
  end

  # Render a single pane (leaf node) with user-provided content
  defp render_single_pane(assigns) do
    content = Map.get(assigns.pane_content_map, assigns.current_pane.id, %{})
    merged_content = Map.merge(@pane_defaults, content)

    assigns =
      assigns
      |> assign(:merged_content, merged_content)
      |> assign(:inner_block, content)

    ~H"""
    <div
      id={@current_pane.id}
      data-pane-id={@current_pane.id}
      data-pane-type="pane"
      data-pane-size-default={@current_pane.size_default}
      data-pane-size-unit={@current_pane.size_unit}
      data-pane-direction={@current_pane.direction}
      data-pane-size-min={@current_pane.size_min}
      data-pane-size-max={@current_pane.size_max}
      class={["relative", @merged_content.class]}
    >
      {render_slot(@inner_block)}
    </div>
    """
  end

  # CSS classes for dividers based on direction
  defp divider_classes(:column),
    do: "bg-gray-300 hover:bg-gray-400 cursor-col-resize flex items-center justify-center"

  defp divider_classes("column"),
    do: "bg-gray-300 hover:bg-gray-400 cursor-col-resize flex items-center justify-center"

  defp divider_classes(:row),
    do: "bg-gray-300 hover:bg-gray-400 cursor-row-resize flex items-center justify-center"

  defp divider_classes("row"),
    do: "bg-gray-300 hover:bg-gray-400 cursor-row-resize flex items-center justify-center"

  # CSS classes for divider handles based on direction
  defp divider_handle_classes(:column), do: "w-1 h-8 bg-gray-500 rounded"
  defp divider_handle_classes("column"), do: "w-1 h-8 bg-gray-500 rounded"
  defp divider_handle_classes(:row), do: "w-8 h-1 bg-gray-500 rounded"
  defp divider_handle_classes("row"), do: "w-8 h-1 bg-gray-500 rounded"

  # Generate styles for the panes based on the Grid structure
  attr :panes_by_id, :map
  attr :groups, :map
  attr :preview, :boolean, default: false

  def pane_styles(assigns) do
    assigns =
      assigns
      |> assign_new(:css, fn ->
        # Get CSS variables for all panes
        css_variables = generate_css_variables(assigns.panes_by_id)

        # Generate grid styles for all groups
        grid_styles = generate_grid_styles(assigns.groups, assigns.panes_by_id)

        """
        :root {
          #{css_variables}
        }
        #{grid_styles}
        """
      end)

    ~H"""
    <style :if={!@preview} type="text/css" id="grid-styles" phx-update="ignore">
      <%= {:safe, @css} %>
    </style>

    <pre
      :if={@preview}
      class="bg-linear-to-t from-black to-slate-500 text-gray-50 p-2 text-sm font-mono"
      type="text/css"
    >
      <code>
    <%= {:safe, @css} %>
      </code>
    </pre>
    """
  end

  # Generate CSS variables for all panes with sizes
  defp generate_css_variables(panes_by_id) do
    panes_by_id
    |> Enum.filter(fn {_id, pane} -> pane.size_default != nil end)
    |> Enum.map(fn {_id, pane} ->
      size_str = Pane.size_string(pane)
      "--#{pane.id}-size: #{size_str};"
    end)
    |> Enum.join("\n  ")
  end

  # Generate grid styles for all groups
  defp generate_grid_styles(groups, panes_by_id) do
    groups
    |> Enum.map(fn {group_id, children} ->
      group = Map.get(panes_by_id, group_id)
      generate_group_style(group, children, panes_by_id)
    end)
    |> Enum.join("\n\n")
  end

  # Generate grid style for a single group with dividers
  defp generate_group_style(group, children, panes_by_id) do
    direction = group.direction

    template_prop =
      if direction == "row" || direction == :row,
        do: "grid-template-rows",
        else: "grid-template-columns"

    template_balance =
      if direction == "row" || direction == :row,
        do: "grid-template-columns: 1fr",
        else: "grid-template-rows: 1fr"

    # Generate grid template with dividers
    template_values = generate_grid_template_with_dividers(children, panes_by_id)

    """
    [data-pane-id="#{group.id}"] {
      display: grid;
      #{template_prop}: #{template_values};
      #{template_balance};
    }
    """
  end

  # Generate grid template including dividers
  defp generate_grid_template_with_dividers(children, panes_by_id) do
    children
    |> Enum.flat_map(fn child_id ->
      pane = Map.get(panes_by_id, child_id)
      pane_size = "var(--#{pane.id}-size)"

      # Build the template parts for this pane in correct order
      parts = []

      # Add divider at start if needed
      parts =
        if pane.divider_position == :start do
          divider_size = Pane.divider_size_string(pane) || "8px"
          parts ++ [divider_size]
        else
          parts
        end

      # Add the pane itself
      parts = parts ++ [pane_size]

      # Add divider at end if needed
      parts =
        if pane.divider_position == :end do
          divider_size = Pane.divider_size_string(pane) || "8px"
          parts ++ [divider_size]
        else
          parts
        end

      parts
    end)
    |> Enum.join(" ")
  end
end
