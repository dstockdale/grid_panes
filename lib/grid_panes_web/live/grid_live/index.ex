defmodule GridPanesWeb.GridLive.Index do
  use GridPanesWeb, :live_view

  alias GridPanes.Grids

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash}>
      <.header>
        Listing Grids
        <:actions>
          <.button variant="primary" navigate={~p"/grids/new"}>
            <.icon name="hero-plus" /> New Grid
          </.button>
        </:actions>
      </.header>

      <.table
        id="grids"
        rows={@streams.grids}
        row_click={fn {_id, grid} -> JS.navigate(~p"/grids/#{grid}") end}
      >
        <:col :let={{_id, grid}} label="Name">{grid.name}</:col>
        <:col :let={{_id, grid}} label="Description">{grid.description}</:col>
        <:col :let={{_id, grid}} label="Panes">{grid.panes}</:col>
        <:action :let={{_id, grid}}>
          <div class="sr-only">
            <.link navigate={~p"/grids/#{grid}"}>Show</.link>
          </div>
          <.link navigate={~p"/grids/#{grid}/edit"}>Edit</.link>
        </:action>
        <:action :let={{id, grid}}>
          <.link
            phx-click={JS.push("delete", value: %{id: grid.id}) |> hide("##{id}")}
            data-confirm="Are you sure?"
          >
            Delete
          </.link>
        </:action>
      </.table>
    </Layouts.app>
    """
  end

  @impl true
  def mount(_params, _session, socket) do
    {:ok,
     socket
     |> assign(:page_title, "Listing Grids")
     |> stream(:grids, Grids.list_grids())}
  end

  @impl true
  def handle_event("delete", %{"id" => id}, socket) do
    grid = Grids.get_grid!(id)
    {:ok, _} = Grids.delete_grid(grid)

    {:noreply, stream_delete(socket, :grids, grid)}
  end
end
