defmodule GridPanes.GridsFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `GridPanes.Grids` context.
  """

  @doc """
  Generate a grid.
  """
  def grid_fixture(attrs \\ %{}) do
    {:ok, grid} =
      attrs
      |> Enum.into(%{
        description: "some description",
        name: "some name",
        panes: %{}
      })
      |> GridPanes.Grids.create_grid()

    grid
  end
end
