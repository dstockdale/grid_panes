defmodule GridPanes.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      GridPanesWeb.Telemetry,
      GridPanes.Repo,
      {DNSCluster, query: Application.get_env(:grid_panes, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: GridPanes.PubSub},
      # Start a worker by calling: GridPanes.Worker.start_link(arg)
      # {GridPanes.Worker, arg},
      # Start to serve requests, typically the last entry
      GridPanesWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: GridPanes.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    GridPanesWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
