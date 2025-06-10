defmodule GridPanes.GridsFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `GridPanes.Grids` context.
  """

  @doc """
  Generate a grid.
  """
  def grid_fixture(attrs \\ %{}) do
    default_panes = [
      %{
        id: "root",
        type: :group,
        direction: :row,
        size_default: Decimal.new("1"),
        size_unit: :fr,
        children: ["left", "right"],
        parent_id: nil,
        order: 0
      },
      %{
        id: "left",
        type: :pane,
        size_default: Decimal.new("300"),
        size_unit: :px,
        parent_id: "root",
        children: [],
        order: 0
      },
      %{
        id: "right",
        type: :pane,
        size_default: Decimal.new("1"),
        size_unit: :fr,
        parent_id: "root",
        children: [],
        order: 1
      }
    ]

    {:ok, grid} =
      attrs
      |> Enum.into(%{
        description: "some description",
        name: "some name",
        panes: default_panes
      })
      |> GridPanes.Grids.create_grid()

    grid
  end
end
