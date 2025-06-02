defmodule GridPanes.Repo do
  use Ecto.Repo,
    otp_app: :grid_panes,
    adapter: Ecto.Adapters.Postgres
end
