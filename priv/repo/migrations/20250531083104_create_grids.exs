defmodule GridPanes.Repo.Migrations.CreateGrids do
  use Ecto.Migration

  def change do
    create table(:grids, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :name, :string
      add :description, :text
      add :panes, :map

      timestamps(type: :utc_datetime)
    end
  end
end
