defmodule GridPanesWeb.GridLive.Show do
  use GridPanesWeb, :live_view

  alias GridPanes.Grids

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash}>
      <.header>
        Grid {@grid.id}
        <:subtitle>This is a grid record from your database.</:subtitle>
        <:actions>
          <.button navigate={~p"/grids"}>
            <.icon name="hero-arrow-left" />
          </.button>
          <.button variant="primary" navigate={~p"/grids/#{@grid}/edit?return_to=show"}>
            <.icon name="hero-pencil-square" /> Edit grid
          </.button>
        </:actions>
      </.header>

      <.list>
        <:item title="Name">{@grid.name}</:item>
        <:item title="Description">{@grid.description}</:item>
        <:item title="Panes">{@grid.panes}</:item>
      </.list>
    </Layouts.app>
    """
  end

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    {:ok,
     socket
     |> assign(:page_title, "Show Grid")
     |> assign(:grid, Grids.get_grid!(id))}
  end
end
