defmodule GridPanesWeb.GridLiveTest do
  use GridPanesWeb.ConnCase

  import Phoenix.LiveViewTest
  import GridPanes.GridsFixtures

  @create_attrs %{name: "some name", description: "some description", panes: %{}}
  @update_attrs %{name: "some updated name", description: "some updated description", panes: %{}}
  @invalid_attrs %{name: nil, description: nil, panes: nil}
  defp create_grid(_) do
    grid = grid_fixture()

    %{grid: grid}
  end

  describe "Index" do
    setup [:create_grid]

    test "lists all grids", %{conn: conn, grid: grid} do
      {:ok, _index_live, html} = live(conn, ~p"/grids")

      assert html =~ "Listing Grids"
      assert html =~ grid.name
    end

    test "saves new grid", %{conn: conn} do
      {:ok, index_live, _html} = live(conn, ~p"/grids")

      assert {:ok, form_live, _} =
               index_live
               |> element("a", "New Grid")
               |> render_click()
               |> follow_redirect(conn, ~p"/grids/new")

      assert render(form_live) =~ "New Grid"

      assert form_live
             |> form("#grid-form", grid: @invalid_attrs)
             |> render_change() =~ "can&#39;t be blank"

      assert {:ok, index_live, _html} =
               form_live
               |> form("#grid-form", grid: @create_attrs)
               |> render_submit()
               |> follow_redirect(conn, ~p"/grids")

      html = render(index_live)
      assert html =~ "Grid created successfully"
      assert html =~ "some name"
    end

    test "updates grid in listing", %{conn: conn, grid: grid} do
      {:ok, index_live, _html} = live(conn, ~p"/grids")

      assert {:ok, form_live, _html} =
               index_live
               |> element("#grids-#{grid.id} a", "Edit")
               |> render_click()
               |> follow_redirect(conn, ~p"/grids/#{grid}/edit")

      assert render(form_live) =~ "Edit Grid"

      assert form_live
             |> form("#grid-form", grid: @invalid_attrs)
             |> render_change() =~ "can&#39;t be blank"

      assert {:ok, index_live, _html} =
               form_live
               |> form("#grid-form", grid: @update_attrs)
               |> render_submit()
               |> follow_redirect(conn, ~p"/grids")

      html = render(index_live)
      assert html =~ "Grid updated successfully"
      assert html =~ "some updated name"
    end

    test "deletes grid in listing", %{conn: conn, grid: grid} do
      {:ok, index_live, _html} = live(conn, ~p"/grids")

      assert index_live |> element("#grids-#{grid.id} a", "Delete") |> render_click()
      refute has_element?(index_live, "#grids-#{grid.id}")
    end
  end

  describe "Show" do
    setup [:create_grid]

    test "displays grid", %{conn: conn, grid: grid} do
      {:ok, _show_live, html} = live(conn, ~p"/grids/#{grid}")

      assert html =~ "Show Grid"
      assert html =~ grid.name
    end

    test "updates grid and returns to show", %{conn: conn, grid: grid} do
      {:ok, show_live, _html} = live(conn, ~p"/grids/#{grid}")

      assert {:ok, form_live, _} =
               show_live
               |> element("a", "Edit")
               |> render_click()
               |> follow_redirect(conn, ~p"/grids/#{grid}/edit?return_to=show")

      assert render(form_live) =~ "Edit Grid"

      assert form_live
             |> form("#grid-form", grid: @invalid_attrs)
             |> render_change() =~ "can&#39;t be blank"

      assert {:ok, show_live, _html} =
               form_live
               |> form("#grid-form", grid: @update_attrs)
               |> render_submit()
               |> follow_redirect(conn, ~p"/grids/#{grid}")

      html = render(show_live)
      assert html =~ "Grid updated successfully"
      assert html =~ "some updated name"
    end
  end
end
