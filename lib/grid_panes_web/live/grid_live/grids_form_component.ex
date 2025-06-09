defmodule GridPanesWeb.GridLive.GridsFormComponent do
  use GridPanesWeb, :live_component

  alias GridPanes.Grids
  alias GridPanes.Grids.Pane

  @impl true
  def render(assigns) do
    ~H"""
    <div id={@id}>
      <.form
        for={@form}
        id={"#{@id}-form"}
        phx-change="validate"
        phx-submit="save"
        phx-target={@myself}
      >
        <ul :if={@form.errors != []} class="mb-4 text-red-600 text-sm">
          <%= for {attr, {msg, _opts}} <- @form.errors do %>
            <li>
              {Phoenix.Naming.humanize(attr)}: {msg}
            </li>
          <% end %>
        </ul>
        
        <div class="space-y-4">
          <.input field={@form[:name]} type="text" label="Grid Name" />
          <.input field={@form[:description]} type="textarea" label="Description" />
        </div>
        
        <div class="mt-6">
          <h3 class="text-lg font-medium mb-4">Grid Layout</h3>
          
          <div class="flex gap-2 mb-4">
            <.button
              type="button"
              phx-click="add-root-pane"
              phx-target={@myself}
              variant="outline"
              size="sm"
            >
              + Add Root Pane
            </.button>
            <.button
              type="button"
              phx-click="add-group"
              phx-target={@myself}
              variant="outline"
              size="sm"
            >
              + Add Group
            </.button>
          </div>
          
          <!-- Tree view of panes -->
          <div class="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <.tree_view panes={get_pane_tree(@form)} form={@form} target={@myself} />
          </div>
        </div>
        
        <!-- Detailed pane forms -->
        <div class="mt-6">
          <h3 class="text-lg font-medium mb-4">Pane Details</h3>
          <.inputs_for :let={panes_f} field={@form[:panes]}>
            <.pane_form form={panes_f} all_panes={get_all_panes(@form)} target={@myself} />
          </.inputs_for>
        </div>
        
        <footer class="mt-6 flex gap-2">
          <.button phx-disable-with="Saving..." type="submit">Save Grid</.button>
          <.button type="button" phx-click="cancel" phx-target={@myself} variant="outline">Cancel</.button>
        </footer>
      </.form>
    </div>
    """
  end

  @impl true
  def update(%{grid: grid} = assigns, socket) do
    changeset = Grids.change_grid(grid, %{})

    {:ok,
     socket
     |> assign(assigns)
     |> assign_form(changeset)}
  end

  @impl true
  def handle_event("validate", %{"grid" => grid_params}, socket) do
    changeset = Grids.change_grid(socket.assigns.grid, grid_params)
    {:noreply, assign(socket, form: to_form(changeset, action: :validate))}
  end

  def handle_event("save", %{"grid" => grid_params}, socket) do
    save_grid(socket, socket.assigns.action, grid_params)
  end

  def handle_event("add-root-pane", _params, socket) do
    add_pane(socket, %{type: :pane, parent_id: nil})
  end
  
  def handle_event("add-group", _params, socket) do
    add_pane(socket, %{type: :group, direction: :row, parent_id: nil})
  end
  
  def handle_event("add-child-pane", %{"parent_id" => parent_id}, socket) do
    add_pane(socket, %{type: :pane, parent_id: parent_id})
  end
  
  def handle_event("add-child-group", %{"parent_id" => parent_id}, socket) do
    add_pane(socket, %{type: :group, direction: :row, parent_id: parent_id})
  end
  
  def handle_event("remove-pane", %{"pane_index" => index}, socket) do
    index = String.to_integer(index)
    form = socket.assigns.form.source
    panes = Ecto.Changeset.get_embed(form, :panes, :struct)
    updated_panes = List.delete_at(panes, index)
    changeset = Ecto.Changeset.put_embed(form, :panes, updated_panes)
    
    {:noreply, assign(socket, form: to_form(changeset, action: :validate))}
  end
  
  def handle_event("cancel", _params, socket) do
    notify_parent({:cancelled})
    {:noreply, socket}
  end
  
  defp add_pane(socket, attrs) do
    form = socket.assigns.form.source
    panes = Ecto.Changeset.get_embed(form, :panes, :struct)
    
    # Generate a unique ID
    id = generate_unique_id(panes)
    
    # Calculate order for siblings
    order = calculate_sibling_order(panes, attrs[:parent_id])
    
    new_pane_attrs = Map.merge(attrs, %{
      id: id,
      order: order,
      size_unit: :fr,
      size_default: Decimal.new("1"),
      children: []
    })
    
    new_pane = struct(Pane, new_pane_attrs)
    updated_panes = panes ++ [new_pane]
    changeset = Ecto.Changeset.put_embed(form, :panes, updated_panes)
    
    {:noreply, assign(socket, form: to_form(changeset, action: :validate))}
  end
  
  defp generate_unique_id(panes) do
    existing_ids = MapSet.new(panes, & &1.id)
    
    Stream.iterate(1, &(&1 + 1))
    |> Stream.map(&"pane_#{&1}")
    |> Enum.find(&(not MapSet.member?(existing_ids, &1)))
  end
  
  defp calculate_sibling_order(panes, parent_id) do
    siblings = Enum.filter(panes, &(&1.parent_id == parent_id))
    length(siblings)
  end

  defp save_grid(socket, :edit, grid_params) do
    case Grids.update_grid(socket.assigns.grid, grid_params) do
      {:ok, grid} ->
        notify_parent({:saved, grid})

        {:noreply,
         socket
         |> put_flash(:info, "Grid updated successfully")}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, assign(socket, form: to_form(changeset))}
    end
  end

  defp save_grid(socket, :new, grid_params) do
    case Grids.create_grid(grid_params) do
      {:ok, grid} ->
        notify_parent({:saved, grid})

        {:noreply,
         socket
         |> put_flash(:info, "Grid created successfully")}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, assign(socket, form: to_form(changeset))}
    end
  end

  defp assign_form(socket, %Ecto.Changeset{} = changeset) do
    assign(socket, :form, to_form(changeset))
  end

  defp notify_parent(msg), do: send(self(), {__MODULE__, msg})
  
  # Helper functions for the template
  defp get_pane_tree(form) do
    panes = case Ecto.Changeset.get_embed(form.source, :panes) do
      nil -> []
      panes -> panes
    end
    
    build_tree(panes)
  end
  
  defp get_all_panes(form) do
    case Ecto.Changeset.get_embed(form.source, :panes) do
      nil -> []
      panes -> panes
    end
  end
  
  defp build_tree(panes) do
    panes_by_id = Map.new(panes, &{&1.id, &1})
    roots = Enum.filter(panes, &(is_nil(&1.parent_id)))
    
    Enum.map(roots, &build_tree_node(&1, panes_by_id))
  end
  
  defp build_tree_node(pane, panes_by_id) do
    children = 
      pane.children
      |> Enum.map(&Map.get(panes_by_id, &1))
      |> Enum.filter(& &1)
      |> Enum.sort_by(& &1.order)
      |> Enum.map(&build_tree_node(&1, panes_by_id))
    
    %{pane: pane, children: children}
  end
  
  # Tree view component
  defp tree_view(assigns) do
    ~H"""
    <div class="space-y-2">
      <div :for={node <- @panes} class="tree-node">
        <.tree_node node={node} form={@form} target={@target} level={0} />
      </div>
      <div :if={@panes == []} class="text-gray-500 italic text-sm">
        No panes yet. Add a root pane or group to get started.
      </div>
    </div>
    """
  end
  
  defp tree_node(assigns) do
    ~H"""
    <div class={"ml-#{@level * 4}"}>
      <div class="flex items-center gap-2 p-2 bg-white border rounded group hover:bg-gray-50">
        <div class="flex items-center gap-2 flex-1">
          <span class={"text-xs px-2 py-1 rounded #{if @node.pane.type == :group, do: "bg-blue-100 text-blue-800", else: "bg-green-100 text-green-800"}"}">
            {@node.pane.type}
          </span>
          <span class="font-medium">{@node.pane.id}</span>
          <span :if={@node.pane.type == :group} class="text-xs text-gray-500">
            ({@node.pane.direction})
          </span>
          <span class="text-xs text-gray-500">
            {size_display(@node.pane)}
          </span>
        </div>
        
        <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            :if={@node.pane.type == :group}
            type="button"
            phx-click="add-child-pane" 
            phx-value-parent_id={@node.pane.id}
            phx-target={@target}
            class="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
          >
            + Pane
          </button>
          <button 
            :if={@node.pane.type == :group}
            type="button"
            phx-click="add-child-group" 
            phx-value-parent_id={@node.pane.id}
            phx-target={@target}
            class="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            + Group
          </button>
          <button 
            type="button"
            phx-click="remove-pane" 
            phx-value-pane_index={find_pane_index(@form, @node.pane.id)}
            phx-target={@target}
            class="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            ✕
          </button>
        </div>
      </div>
      
      <div :if={@node.children != []} class="mt-1">
        <div :for={child_node <- @node.children}>
          <.tree_node node={child_node} form={@form} target={@target} level={@level + 1} />
        </div>
      </div>
    </div>
    """
  end
  
  defp size_display(pane) do
    case pane.size_unit do
      :auto -> "auto"
      :px -> "#{pane.size_default}px"
      :fr -> "#{pane.size_default}fr"
      _ -> ""
    end
  end
  
  defp find_pane_index(form, pane_id) do
    panes = get_all_panes(form)
    Enum.find_index(panes, &(&1.id == pane_id)) || 0
  end
  
  # Detailed pane form component
  defp pane_form(assigns) do
    ~H"""
    <div class="border border-gray-200 rounded-lg p-4 mb-4">
      <div class="flex items-center justify-between mb-4">
        <h4 class="font-medium">
          {@form[:id].value || "New Pane"}
          <span class={"ml-2 text-xs px-2 py-1 rounded #{if @form[:type].value == :group, do: "bg-blue-100 text-blue-800", else: "bg-green-100 text-green-800"}"}}>
            {@form[:type].value}
          </span>
        </h4>
      </div>
      
      <ul :if={@form.errors != []} class="mb-4 text-red-500 text-sm">
        <%= for {attr, {msg, _opts}} <- @form.errors do %>
          <li>
            {Phoenix.Naming.humanize(attr)}: {msg}
          </li>
        <% end %>
      </ul>
      
      <div class="grid grid-cols-2 gap-4">
        <.input field={@form[:id]} type="text" label="ID" />
        <.input field={@form[:type]} type="select" label="Type" options={Pane.type_options()} />
      </div>
      
      <div class="grid grid-cols-2 gap-4 mt-4">
        <.input 
          field={@form[:parent_id]} 
          type="select" 
          label="Parent" 
          options={parent_options(@all_panes, @form[:id].value)}
        />
        <.input field={@form[:order]} type="number" label="Order" />
      </div>
      
      <div :if={@form[:type].value == :group} class="mt-4">
        <.input
          field={@form[:direction]}
          type="select"
          label="Direction"
          options={Pane.direction_options()}
        />
      </div>
      
      <div :if={@form[:type].value in [:pane, :group]} class="mt-4">
        <h5 class="font-medium mb-2">Size</h5>
        <div class="grid grid-cols-3 gap-4">
          <.input field={@form[:size_unit]} type="select" label="Unit" options={Pane.size_unit_options()} />
          <.input 
            :if={@form[:size_unit].value in [:px, :fr]}
            field={@form[:size_default]} 
            type="text" 
            label="Default Size" 
          />
        </div>
        
        <div :if={@form[:size_unit].value == :px} class="grid grid-cols-2 gap-4 mt-2">
          <.input field={@form[:size_min]} type="number" label="Min Size (px)" />
          <.input field={@form[:size_max]} type="number" label="Max Size (px)" />
        </div>
      </div>
      
      <div class="mt-4">
        <.input field={@form[:collapsible]} type="checkbox" label="Collapsible" />
        <div :if={@form[:collapsible].value} class="grid grid-cols-2 gap-4 mt-2">
          <.input field={@form[:collapse_at]} type="number" label="Collapse At (px)" />
          <.input field={@form[:collapse_to]} type="number" label="Collapse To (px)" />
        </div>
      </div>
      
      <div class="mt-4">
        <h5 class="font-medium mb-2">Divider</h5>
        <div class="grid grid-cols-2 gap-4">
          <.input field={@form[:divider_position]} type="select" label="Position" options={Pane.divider_position_options()} />
          <.input 
            :if={@form[:divider_position].value in [:start, :end]}
            field={@form[:divider_size]} 
            type="number" 
            label="Size (px)" 
          />
        </div>
      </div>
    </div>
    """
  end
  
  defp parent_options(all_panes, current_id) do
    [{"None (Root)", nil}] ++ 
    all_panes
    |> Enum.filter(fn pane -> 
      pane.type == :group and pane.id != current_id
    end)
    |> Enum.map(&{&1.id, &1.id})
  end
end
