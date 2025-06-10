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
  Returns an `%Ecto.Changeset{}` for tracking grid changes.

  ## Examples

      iex> change_grid(grid)
      %Ecto.Changeset{data: %Grid{}}

  """
  def change_grid(%Grid{} = grid, attrs \\ %{}) do
    Grid.changeset(grid, attrs)
  end
end
