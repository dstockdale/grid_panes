defmodule GridPanesWeb.GridLive.Form do
  use GridPanesWeb, :live_view

  alias GridPanes.Grids
  alias GridPanes.Grids.Grid

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash}>
      <.header>
        {@page_title}
        <:subtitle>Use this form to manage grid records in your database.</:subtitle>
      </.header>

      <.form for={@form} id="grid-form" phx-change="validate" phx-submit="save">
        <.input field={@form[:name]} type="text" label="Name" />
        <.input field={@form[:description]} type="textarea" label="Description" />
        <footer>
          <.button phx-disable-with="Saving..." variant="primary">Save Grid</.button>
          <.button navigate={return_path(@return_to, @grid)}>Cancel</.button>
        </footer>
      </.form>
    </Layouts.app>
    """
  end

  @impl true
  def mount(params, _session, socket) do
    {:ok,
     socket
     |> assign(:return_to, return_to(params["return_to"]))
     |> apply_action(socket.assigns.live_action, params)}
  end

  defp return_to("show"), do: "show"
  defp return_to(_), do: "index"

  defp apply_action(socket, :edit, %{"id" => id}) do
    grid = Grids.get_grid!(id)

    socket
    |> assign(:page_title, "Edit Grid")
    |> assign(:grid, grid)
    |> assign(:form, to_form(Grids.change_grid(grid)))
  end

  defp apply_action(socket, :new, _params) do
    grid = %Grid{}

    socket
    |> assign(:page_title, "New Grid")
    |> assign(:grid, grid)
    |> assign(:form, to_form(Grids.change_grid(grid)))
  end

  @impl true
  def handle_event("validate", %{"grid" => grid_params}, socket) do
    changeset = Grids.change_grid(socket.assigns.grid, grid_params)
    {:noreply, assign(socket, form: to_form(changeset, action: :validate))}
  end

  def handle_event("save", %{"grid" => grid_params}, socket) do
    save_grid(socket, socket.assigns.live_action, grid_params)
  end

  defp save_grid(socket, :edit, grid_params) do
    case Grids.update_grid(socket.assigns.grid, grid_params) do
      {:ok, grid} ->
        {:noreply,
         socket
         |> put_flash(:info, "Grid updated successfully")
         |> push_navigate(to: return_path(socket.assigns.return_to, grid))}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, assign(socket, form: to_form(changeset))}
    end
  end

  defp save_grid(socket, :new, grid_params) do
    case Grids.create_grid(grid_params) do
      {:ok, grid} ->
        {:noreply,
         socket
         |> put_flash(:info, "Grid created successfully")
         |> push_navigate(to: return_path(socket.assigns.return_to, grid))}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, assign(socket, form: to_form(changeset))}
    end
  end

  defp return_path("index", _grid), do: ~p"/grids"
  defp return_path("show", grid), do: ~p"/grids/#{grid}"
end
