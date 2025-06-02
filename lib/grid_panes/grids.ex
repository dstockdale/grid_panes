defmodule GridPanes.Grids do
  @moduledoc """
  The Grids context.
  """

  import Ecto.Query, warn: false
  alias GridPanes.Repo

  alias GridPanes.Grids.Grid

  @doc """
  Returns the list of grids.

  ## Examples

      iex> list_grids()
      [%Grid{}, ...]

  """
  def list_grids do
    Repo.all(Grid)
  end

  @doc """
  Gets a single grid.

  Raises `Ecto.NoResultsError` if the Grid does not exist.

  ## Examples

      iex> get_grid!(123)
      %Grid{}

      iex> get_grid!(456)
      ** (Ecto.NoResultsError)

  """
  def get_grid!(id), do: Repo.get!(Grid, id)

  @doc """
  Creates a grid.

  ## Examples

      iex> create_grid(%{field: value})
      {:ok, %Grid{}}

      iex> create_grid(%{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def create_grid(attrs) do
    %Grid{}
    |> Grid.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a grid.

  ## Examples

      iex> update_grid(grid, %{field: new_value})
      {:ok, %Grid{}}

      iex> update_grid(grid, %{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def update_grid(%Grid{} = grid, attrs) do
    grid
    |> Grid.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a grid.

  ## Examples

      iex> delete_grid(grid)
      {:ok, %Grid{}}

      iex> delete_grid(grid)
      {:error, %Ecto.Changeset{}}

  """
  def delete_grid(%Grid{} = grid) do
    Repo.delete(grid)
  end

  @doc """
  Updates a pane size in a grid without persisting to database.
  Used for real-time pane resizing.
  """
  def update_pane_size(%Grid{} = grid, pane_id, new_size_string) do
    case parse_size_string(new_size_string) do
      {new_value, new_unit} ->
        updated_panes =
          Enum.map(grid.panes, fn pane ->
            cond do
              pane.id == pane_id ->
                constrained_value = apply_size_constraints(new_value, pane)
                %{pane | size_value: constrained_value, size_unit: new_unit}

              needs_fr_redistribution?(pane, pane_id, grid.panes) ->
                redistribute_fr_unit(pane, new_value)

              true ->
                pane
            end
          end)

        %{grid | panes: updated_panes}

      :error ->
        # Return unchanged grid if parsing fails
        grid
    end
  end

  # Apply min/max size constraints to a value
  defp apply_size_constraints(value, pane) do
    cond do
      pane.collapse_at && Decimal.lt?(value, pane.collapse_at) ->
        pane.collapse_to

      pane.min_size && Decimal.lt?(value, pane.min_size) ->
        pane.min_size

      pane.max_size && Decimal.gt?(value, pane.max_size) ->
        pane.max_size

      true ->
        value
    end
  end

  # Parse size strings like "100px", "1.5fr", "auto"
  defp parse_size_string("auto"), do: {nil, :auto}

  defp parse_size_string(size_string) when is_binary(size_string) do
    size_string = String.trim(size_string)

    cond do
      String.ends_with?(size_string, "px") ->
        value = String.trim_trailing(size_string, "px")

        case Decimal.parse(value) do
          {value, ""} -> {value, :px}
          _ -> :error
        end

      String.ends_with?(size_string, "fr") ->
        case Decimal.parse(String.trim_trailing(size_string, "fr")) do
          {value, ""} -> {value, :fr}
          _ -> :error
        end

      true ->
        :error
    end
  end

  defp parse_size_string(_), do: :error

  # Check if this pane needs fr redistribution when another pane changes
  defp needs_fr_redistribution?(pane, changed_pane_id, all_panes) do
    pane.size_unit == :fr &&
      pane.id != changed_pane_id &&
      same_parent?(pane, changed_pane_id, all_panes) &&
      changed_pane_uses_fr?(changed_pane_id, all_panes)
  end

  # Check if two panes have the same parent (are siblings)
  defp same_parent?(pane, other_pane_id, all_panes) do
    other_pane = Enum.find(all_panes, &(&1.id == other_pane_id))
    other_pane && pane.parent_id == other_pane.parent_id
  end

  # Check if the changed pane uses fr units
  defp changed_pane_uses_fr?(pane_id, all_panes) do
    pane = Enum.find(all_panes, &(&1.id == pane_id))
    pane && pane.size_unit == :fr
  end

  # Simple fr redistribution - distribute the change among fr siblings
  defp redistribute_fr_unit(pane, delta_fr) do
    current_fr = pane.size_value || Decimal.new("1")
    # For simplicity, just reduce each sibling by a small amount
    # In a more sophisticated version, you'd calculate based on number of siblings
    # Distribute among ~4 siblings max
    reduction = Decimal.div(delta_fr, Decimal.new("4"))
    new_fr = Decimal.max(Decimal.new("0.1"), Decimal.sub(current_fr, reduction))
    %{pane | size_value: new_fr}
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking grid changes.

  ## Examples

      iex> change_grid(grid)
      %Ecto.Changeset{data: %Grid{}}

  """
  def change_grid(%Grid{} = grid, attrs \\ %{}) do
    Grid.changeset(grid, attrs)
  end
end
