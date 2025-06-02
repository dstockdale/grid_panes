defmodule GridPanes.GridsTest do
  use GridPanes.DataCase

  alias GridPanes.Grids

  describe "grids" do
    alias GridPanes.Grids.Grid

    import GridPanes.GridsFixtures

    @invalid_attrs %{name: nil, description: nil, panes: nil}

    test "list_grids/0 returns all grids" do
      grid = grid_fixture()
      assert Grids.list_grids() == [grid]
    end

    test "get_grid!/1 returns the grid with given id" do
      grid = grid_fixture()
      assert Grids.get_grid!(grid.id) == grid
    end

    test "create_grid/1 with valid data creates a grid" do
      valid_attrs = %{name: "some name", description: "some description", panes: %{}}

      assert {:ok, %Grid{} = grid} = Grids.create_grid(valid_attrs)
      assert grid.name == "some name"
      assert grid.description == "some description"
      assert grid.panes == %{}
    end

    test "create_grid/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = Grids.create_grid(@invalid_attrs)
    end

    test "update_grid/2 with valid data updates the grid" do
      grid = grid_fixture()
      update_attrs = %{name: "some updated name", description: "some updated description", panes: %{}}

      assert {:ok, %Grid{} = grid} = Grids.update_grid(grid, update_attrs)
      assert grid.name == "some updated name"
      assert grid.description == "some updated description"
      assert grid.panes == %{}
    end

    test "update_grid/2 with invalid data returns error changeset" do
      grid = grid_fixture()
      assert {:error, %Ecto.Changeset{}} = Grids.update_grid(grid, @invalid_attrs)
      assert grid == Grids.get_grid!(grid.id)
    end

    test "delete_grid/1 deletes the grid" do
      grid = grid_fixture()
      assert {:ok, %Grid{}} = Grids.delete_grid(grid)
      assert_raise Ecto.NoResultsError, fn -> Grids.get_grid!(grid.id) end
    end

    test "change_grid/1 returns a grid changeset" do
      grid = grid_fixture()
      assert %Ecto.Changeset{} = Grids.change_grid(grid)
    end
  end
end
