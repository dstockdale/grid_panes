defmodule GridPanesWeb.PageController do
  use GridPanesWeb, :controller

  def home(conn, _params) do
    render(conn, :home)
  end
end
