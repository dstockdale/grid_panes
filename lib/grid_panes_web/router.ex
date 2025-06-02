defmodule GridPanesWeb.Router do
  use GridPanesWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {GridPanesWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", GridPanesWeb do
    pipe_through :browser

    live "/test", TestLive, :index
    live "/grids", GridLive.Index, :index
    live "/grids/new", GridLive.Form, :new
    live "/grids/:id", GridLive.Show, :show
    live "/grids/:id/edit", GridLive.Form, :edit

    get "/", PageController, :home
  end

  # Other scopes may use custom stacks.
  # scope "/api", GridPanesWeb do
  #   pipe_through :api
  # end

  # Enable LiveDashboard and Swoosh mailbox preview in development
  if Application.compile_env(:grid_panes, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through :browser

      live_dashboard "/dashboard", metrics: GridPanesWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end
end
